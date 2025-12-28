const { EFFECT_FLAGS, EFFECT_FLAGS2, EFFECT_TYPES, EFFECT_EVENTS, EFFECT_CODES } = require('../effect');
const { CARD_LOCATIONS, PLAYERS } = require('../card');
const { OCG_CONSTANTS } = require('../ocgapi');
const { POINT_EVENT_CONSTANTS } = require('../processor');
const { ChainLink, TriggerEvent, Field } = require('../field');
const { FLIP_EFFECT_FLAGS } = require('../common');

const {
  EFFECT_FLAG_EVENT_PLAYER,
  EFFECT_FLAG_FIELD_ONLY,
  EFFECT_FLAG_DELAY,
} = EFFECT_FLAGS;
const { EFFECT_FLAG2_CHECK_SIMULTANEOUS } = EFFECT_FLAGS2;
const { EFFECT_TYPE_CONTINUOUS, EFFECT_TYPE_FIELD, EFFECT_TYPE_TRIGGER_O, EFFECT_TYPE_ACTIONS, EFFECT_TYPE_FLIP } = EFFECT_TYPES;
const {
  EVENT_FREE_CHAIN,
  EVENT_CHAIN_END,
  EVENT_SUMMON_SUCCESS,
  EVENT_SPSUMMON_SUCCESS,
  EVENT_FLIP_SUMMON_SUCCESS,
  EVENT_ADJUST,
  EVENT_BREAK_EFFECT,
  EVENT_PHASE_START,
  EVENT_CHAINING,
  EVENT_BECOME_TARGET,
  EVENT_FLIP,
} = EFFECT_EVENTS;
const { EFFECT_DISABLE_EFFECT, EFFECT_DISABLE_CHAIN } = EFFECT_CODES;

const { LOCATION_HAND, LOCATION_MZONE, LOCATION_DECK } = CARD_LOCATIONS;
const { PLAYER_NONE } = PLAYERS;
const { POS_FACEDOWN } = OCG_CONSTANTS;
const { NO_FLIP_EFFECT } = FLIP_EFFECT_FLAGS;

const {
  STATUS_EFFECT_ENABLED,
  STATUS_CHAINING,
  DUEL_TRIGGER_WHEN_PRIVATE_KNOWLEDGE,
  DUEL_OCG_OBSOLETE_IGNITION,
  DUEL_TCG_SEGOC_NONPUBLIC,
  DUEL_TCG_SEGOC_FIRSTTRIGGER,
  DUEL_TCG_FAST_EFFECT_IGNITION,
  PROCESS_RESTART,
} = POINT_EVENT_CONSTANTS;

const forEachEffect = (collection, code, handler) => {
  if (!collection) return;
  if (typeof collection.equal_range === 'function') {
    const range = collection.equal_range(code);
    if (range) {
      if (Array.isArray(range)) {
        for (const entry of range) handler(entry?.second ?? entry);
        return;
      }
      if (typeof range[Symbol.iterator] === 'function') {
        for (const entry of range) handler(entry?.second ?? entry);
        return;
      }
    }
  }
  if (collection instanceof Map) {
    const list = collection.get(code);
    if (Array.isArray(list)) {
      for (const effect of list) handler(effect);
    } else if (list) {
      handler(list);
    }
    return;
  }
  const list = collection[code];
  if (Array.isArray(list)) {
    for (const effect of list) handler(effect);
  } else if (list) {
    handler(list);
  }
};

const moveAll = (dst, src, prepend = false) => {
  if (!Array.isArray(dst) || !Array.isArray(src) || src.length === 0) return;
  if (prepend) dst.unshift(...src);
  else dst.push(...src);
  src.length = 0;
};

const ensureMap = (value) => (value instanceof Map ? value : new Map());

const checkTriggerEffect = (context, chain) => (
  typeof context.check_trigger_effect === 'function' ? context.check_trigger_effect(chain) : true
);

const checkNonpublicTrigger = (context, chain) => (
  typeof context.check_nonpublic_trigger === 'function' ? context.check_nonpublic_trigger(chain) : true
);

const checkSPSelfFromHandTrigger = (context, chain) => (
  typeof context.check_spself_from_hand_trigger === 'function' ? context.check_spself_from_hand_trigger(chain) : true
);

const ensureEventHelpers = () => {
  if (!Field || Field.prototype.process_instant_event) return;
  Field.prototype.process_instant_event = function processInstantEvent() {
    return processInstantEvent(this);
  };
  Field.prototype.process_single_event = function processSingleEvent() {
    return processSingleEvent(this);
  };
  Field.prototype.process_single_event_effect = function processSingleEventEffect(peffect, ev, tp, ntp) {
    return processSingleEventEffect(this, peffect, ev, tp, ntp);
  };
};

/**
 * Ports the native `field::process(Processors::PointEvent&)` control flow.
 * @param {import('../processor').ProcessDescriptor|import('../field').Field} unit Process descriptor or field instance.
 * @param {import('../field').Field} field Field instance driving resolution.
 * @returns {boolean} True when processing completes for the current step.
 */
function processPointEvent(unit, field) {
  ensureEventHelpers();
  const isFieldArg = unit && unit.core && unit.infos && unit.player;
  const context = isFieldArg ? unit : field ?? this;
  const arg = (isFieldArg ? field : unit?.payload ?? unit) ?? {};
  const step = isFieldArg ? (arg.step ?? 0) : (unit?.step ?? arg.step ?? 0);
  const { core, infos, effects, returns } = context;
  const skipTrigger = Boolean(arg.skip_trigger);
  const skipFreechain = Boolean(arg.skip_freechain);
  const skipNew = Boolean(arg.skip_new);

  core.select_chains = core.select_chains ?? [];
  core.new_fchain = core.new_fchain ?? [];
  core.new_ochain = core.new_ochain ?? [];
  core.new_fchain_s = core.new_fchain_s ?? [];
  core.new_ochain_s = core.new_ochain_s ?? [];
  core.new_ochain_h = core.new_ochain_h ?? [];
  core.current_chain = core.current_chain ?? [];
  core.point_event = core.point_event ?? [];
  core.instant_event = core.instant_event ?? [];
  core.full_event = core.full_event ?? [];
  core.delayed_activate_event = core.delayed_activate_event ?? [];
  core.delayed_quick = ensureMap(core.delayed_quick);
  core.delayed_quick_tmp = ensureMap(core.delayed_quick_tmp);
  core.spe_effect = core.spe_effect ?? [0, 0];

  switch (step) {
    case 0: {
      core.select_chains = [];
      moveAll(core.point_event, core.instant_event);
      if (skipTrigger) {
        arg.step = 7;
        return false;
      }
      moveAll(core.new_fchain_s, core.new_fchain, true);
      moveAll(core.new_ochain_s, core.new_ochain, true);
      moveAll(core.full_event, core.delayed_activate_event);
      core.delayed_quick.clear();
      const tmp = core.delayed_quick;
      core.delayed_quick = core.delayed_quick_tmp;
      core.delayed_quick_tmp = tmp;
      core.current_player = infos.turn_player;
      arg.step = 1;
      return false;
    }
    case 1:
      return false;
    case 2: {
      core.select_chains = [];
      const updated = [];
      for (const clit of core.new_fchain_s) {
        const peffect = clit.triggering_effect;
        const phandler = peffect.get_handler();
        let updatedState = false;
        const updateTriggeringState = () => {
          if (updatedState) return;
          updatedState = true;
          clit.set_triggering_state(phandler);
        };
        if (phandler.is_has_relation?.(clit)) updateTriggeringState();
        if (clit.triggering_player !== phandler.current.controler && !peffect.is_flag(EFFECT_FLAG_EVENT_PLAYER)) {
          clit.triggering_player = phandler.current.controler;
          updateTriggeringState();
        }
        const tp = clit.triggering_player;
        if ((!clit.was_just_sent || phandler.current.location === LOCATION_HAND)
          && checkTriggerEffect(context, clit)
          && peffect.is_chainable(tp)
          && peffect.is_activateable(tp, clit.evt, true, false, false,
            context.is_flag(DUEL_TRIGGER_WHEN_PRIVATE_KNOWLEDGE),
            context.is_flag(DUEL_TRIGGER_WHEN_PRIVATE_KNOWLEDGE))) {
          if (tp === core.current_player) core.select_chains.push(clit);
          updated.push(clit);
        } else {
          peffect.active_type = 0;
        }
      }
      core.new_fchain_s = updated;
      if (core.select_chains.length === 0) {
        returns.set(0, -1);
      } else {
        if (context.is_flag(DUEL_TCG_SEGOC_FIRSTTRIGGER)) {
          core.select_chains.sort((a, b) => (a.event_id ?? 0) - (b.event_id ?? 0));
          const firstId = core.select_chains[0].event_id;
          core.select_chains = core.select_chains.filter((ch) => ch.event_id === firstId);
        }
        if (core.select_chains.length === 1) {
          returns.set(0, 0);
        } else {
          context.emplace_process?.('SelectChain', core.current_player, 0x7f, true);
        }
      }
      return false;
    }
    case 3: {
      if (returns.at(0) === -1) {
        if (core.new_fchain_s.length) {
          core.current_player = 1 - infos.turn_player;
          arg.step = 1;
        } else {
          core.current_player = infos.turn_player;
        }
        return false;
      }
      const newchain = core.select_chains[returns.at(0)];
      const peffect = newchain.triggering_effect;
      const tp = newchain.triggering_player;
      peffect.get_handler().set_status(STATUS_CHAINING, true);
      peffect.dec_count(tp);
      const chainId = newchain.chain_id;
      core.new_chains = core.new_chains ?? [];
      core.new_chains.push(...core.select_chains.splice(returns.at(0), 1));
      context.emplace_process?.('AddChain');
      core.new_fchain_s = core.new_fchain_s.filter((ch) => ch.chain_id !== chainId);
      arg.step = 1;
      return false;
    }
    case 4: {
      core.select_chains = [];
      const updated = [];
      for (const clit of core.new_ochain_s) {
        const peffect = clit.triggering_effect;
        const phandler = peffect.get_handler();
        let updatedState = false;
        const updateTriggeringState = () => {
          if (updatedState) return;
          updatedState = true;
          clit.set_triggering_state(phandler);
        };
        if (phandler.is_has_relation?.(clit)) updateTriggeringState();
        if (!peffect.is_flag(EFFECT_FLAG_FIELD_ONLY) && (peffect.type & EFFECT_TYPE_FIELD)
          && (peffect.range & LOCATION_HAND) && phandler.current.location === LOCATION_HAND) {
          if (!phandler.is_has_relation?.(clit) && peffect.is_condition_check(phandler.current.controler, clit.evt)) {
            phandler.create_relation(clit);
          }
          peffect.set_activate_location();
          clit.triggering_player = phandler.current.controler;
          updateTriggeringState();
        }
        if (clit.triggering_player !== phandler.current.controler && !peffect.is_flag(EFFECT_FLAG_EVENT_PLAYER)) {
          clit.triggering_player = phandler.current.controler;
          updateTriggeringState();
        }
        const tp = clit.triggering_player;
        if ((!clit.was_just_sent || phandler.current.location === LOCATION_HAND)
          && (context.is_flag(DUEL_TRIGGER_WHEN_PRIVATE_KNOWLEDGE) || checkNonpublicTrigger(context, clit))
          && checkTriggerEffect(context, clit)
          && peffect.is_chainable(tp)
          && peffect.is_activateable(tp, clit.evt, true, false, false,
            context.is_flag(DUEL_TRIGGER_WHEN_PRIVATE_KNOWLEDGE),
            context.is_flag(DUEL_TRIGGER_WHEN_PRIVATE_KNOWLEDGE))
          && checkSPSelfFromHandTrigger(context, clit)) {
          if (tp === core.current_player) core.select_chains.push(clit);
          updated.push(clit);
        } else {
          peffect.active_type = 0;
        }
      }
      core.new_ochain_s = updated;
      if (core.select_chains.length === 0) {
        returns.set(0, -2);
        arg.step = 5;
        return false;
      }
      if (context.is_flag(DUEL_TCG_SEGOC_NONPUBLIC)) core.new_ochain_h = [];
      if (context.is_flag(DUEL_TCG_SEGOC_FIRSTTRIGGER)) {
        core.select_chains.sort((a, b) => (a.event_id ?? 0) - (b.event_id ?? 0));
        const firstId = core.select_chains[0].event_id;
        core.select_chains = core.select_chains.filter((ch) => ch.event_id === firstId);
      }
      if (core.select_chains.length === 1 && core.current_chain.length === 0) {
        context.emplace_process?.('SelectEffectYesNo', core.current_player, 221, core.select_chains[0].triggering_effect.get_handler());
        return false;
      }
      context.emplace_process?.('SelectChain', core.current_player, 0x7f, false);
      arg.step = 5;
      return false;
    }
    case 5: {
      returns.set(0, returns.at(0) - 1);
      return false;
    }
    case 6: {
      const ret = returns.at(0);
      if (ret === -2 || (ret === -1 && !context.is_flag(DUEL_TCG_SEGOC_FIRSTTRIGGER))) {
        for (const ch of core.select_chains) {
          ch.triggering_effect.active_type = 0;
          core.new_ochain_s = core.new_ochain_s.filter((entry) => entry.chain_id !== ch.chain_id);
        }
        if (core.new_ochain_s.length) {
          core.current_player = 1 - infos.turn_player;
          arg.step = 3;
        } else {
          core.current_player = infos.turn_player;
          arg.step = 6;
        }
        return false;
      }
      if (ret === -1) {
        const discardedId = core.select_chains[0]?.event_id;
        core.new_ochain_s = core.new_ochain_s.filter((ch) => !(ch.event_id === discardedId && ch.triggering_player === core.current_player));
        arg.step = 3;
        return false;
      }
      const newchain = core.select_chains[ret];
      const peffect = newchain.triggering_effect;
      const tp = newchain.triggering_player;
      peffect.get_handler().set_status(STATUS_CHAINING, true);
      peffect.dec_count(tp);
      const chainId = newchain.chain_id;
      core.new_chains = core.new_chains ?? [];
      core.new_chains.push(...core.select_chains.splice(ret, 1));
      context.emplace_process?.('AddChain');
      core.new_ochain_s = core.new_ochain_s.filter((ch) => ch.chain_id !== chainId);
      core.new_ochain_h = core.new_ochain_h.filter((ch) => ch.chain_id !== chainId);
      arg.step = 3;
      return false;
    }
    case 7: {
      core.select_chains = [];
      return false;
    }
    case 8: {
      if (skipFreechain || !(context.is_flag(DUEL_OCG_OBSOLETE_IGNITION) || context.is_flag(DUEL_TCG_FAST_EFFECT_IGNITION))
        || (infos.phase !== PHASE_MAIN1 && infos.phase !== PHASE_MAIN2)) {
        return false;
      }
      const checkEventsOcg = () => {
        if (context.check_event?.(EVENT_CHAIN_END)) return true;
        const ev = new TriggerEvent();
        if (!context.check_event?.(EVENT_SUMMON_SUCCESS, ev)
          && !context.check_event?.(EVENT_SPSUMMON_SUCCESS, ev)
          && !context.check_event?.(EVENT_FLIP_SUMMON_SUCCESS, ev)) {
          return false;
        }
        return ev.reason_player === infos.turn_player;
      };
      if (core.current_chain.length === 0 && (context.is_flag(DUEL_TCG_FAST_EFFECT_IGNITION) || checkEventsOcg())) {
        const newchain = new ChainLink();
        newchain.evt = new TriggerEvent();
        newchain.evt.event_cards = null;
        newchain.evt.event_value = 0;
        newchain.evt.event_player = PLAYER_NONE;
        newchain.evt.reason_effect = null;
        newchain.evt.reason = 0;
        newchain.evt.reason_player = PLAYER_NONE;
        newchain.flag = 0;
        newchain.triggering_player = infos.turn_player;
        if (effects.ignition_effect) {
          const entries = typeof effects.ignition_effect[Symbol.iterator] === 'function'
            ? effects.ignition_effect
            : [];
          for (const entry of entries) {
            const peffect = entry?.second ?? entry?.[1] ?? entry;
            if (!peffect) continue;
            const phandler = peffect.get_handler();
            newchain.evt.event_code = peffect.code;
            if ((context.is_flag(DUEL_TCG_FAST_EFFECT_IGNITION) || phandler.current.location === LOCATION_MZONE)
              && peffect.is_chainable(infos.turn_player)
              && peffect.is_activateable(infos.turn_player, newchain.evt)) {
              const chain = new ChainLink();
              chain.flag = 0;
              chain.chain_id = infos.field_id++;
              chain.evt = { ...newchain.evt };
              chain.triggering_effect = peffect;
              chain.set_triggering_state(phandler);
              chain.triggering_player = infos.turn_player;
              core.ignition_priority_chains = core.ignition_priority_chains ?? [];
              core.ignition_priority_chains.push(chain);
            }
          }
        }
      }
      return false;
    }
    case 9: {
      infos.priorities[0] = 0;
      infos.priorities[1] = 0;
      if (core.current_chain.length === 0) {
        if (!core.hand_adjusted) {
          if (context.is_flag(DUEL_INVERTED_QUICK_PRIORITY)) {
            context.emplace_process?.('QuickEffect', skipFreechain, 1 - infos.turn_player);
          } else {
            context.emplace_process?.('QuickEffect', skipFreechain, infos.turn_player);
          }
        }
      } else {
        const last = core.current_chain[core.current_chain.length - 1];
        context.emplace_process?.('QuickEffect', skipFreechain, 1 - last.triggering_player);
      }
      return false;
    }
    case 10: {
      core.new_ochain_h = [];
      core.full_event = [];
      core.delayed_quick.clear();
      if (Array.isArray(core.chain_limit)) {
        for (const chLim of core.chain_limit) {
          context.pduel.lua.ensure_luaL_stack(chLim.function);
        }
      }
      core.chain_limit = [];
      if (core.current_chain.length) {
        for (const ch of core.current_chain) {
          ch.triggering_effect.get_handler().set_status(STATUS_CHAINING, false);
        }
        context.emplace_process?.('SolveChain', skipTrigger, skipFreechain, skipNew);
      } else {
        moveAll(core.used_event ?? (core.used_event = []), core.point_event);
        context.reset_chain?.();
        returns.set(0, false);
      }
      if (core.set_forced_attack) {
        core.set_forced_attack = false;
        context.emplace_process?.('ForcedBattle');
      }
      return true;
    }
    case 30: {
      const checkPlayer = infos.turn_player;
      context.nil_event.event_code = EVENT_FREE_CHAIN;
      core.select_chains = [];
      core.spe_effect[checkPlayer] = 0;
      forEachEffect(effects.continuous_effect, EVENT_FREE_CHAIN, (peffect) => {
        if (peffect.get_handler_player() === checkPlayer && peffect.is_activateable(checkPlayer, context.nil_event)) {
          core.select_chains.push({ triggering_effect: peffect });
          core.spe_effect[checkPlayer] += 1;
        }
      });
      if (core.select_chains.length) context.emplace_process?.('SelectChain', checkPlayer, core.spe_effect[checkPlayer], false);
      else arg.step = 31;
      return false;
    }
    case 31: {
      if (returns.at(0) === -1) return false;
      const newchain = core.select_chains[returns.at(0)];
      const peffect = newchain.triggering_effect;
      core.select_chains = [];
      context.solve_continuous(peffect.get_handler_player(), peffect, context.nil_event);
      arg.step = 29;
      return false;
    }
    case 32: {
      const checkPlayer = 1 - infos.turn_player;
      context.nil_event.event_code = EVENT_FREE_CHAIN;
      core.select_chains = [];
      core.spe_effect[checkPlayer] = 0;
      forEachEffect(effects.continuous_effect, EVENT_FREE_CHAIN, (peffect) => {
        if (peffect.get_handler_player() === checkPlayer && peffect.is_activateable(checkPlayer, context.nil_event)) {
          core.select_chains.push({ triggering_effect: peffect });
          core.spe_effect[checkPlayer] += 1;
        }
      });
      if (core.select_chains.length) context.emplace_process?.('SelectChain', checkPlayer, core.spe_effect[checkPlayer], false);
      else arg.step = PROCESS_RESTART;
      return false;
    }
    case 33: {
      if (returns.at(0) === -1) {
        arg.step = PROCESS_RESTART;
        return false;
      }
      const newchain = core.select_chains[returns.at(0)];
      const peffect = newchain.triggering_effect;
      core.select_chains = [];
      context.solve_continuous(peffect.get_handler_player(), peffect, context.nil_event);
      arg.step = 31;
      return false;
    }
    default:
      break;
  }

  if (core.set_forced_attack) {
    core.set_forced_attack = false;
    context.emplace_process?.('ForcedBattle');
  }
  return true;
}

function processInstantEvent(context) {
  const { core, effects, infos } = context;
  const checkSimul = (peffect, phandler) => (
    (peffect.flag?.[1] ?? 0) & EFFECT_FLAG2_CHECK_SIMULTANEOUS
  ) && core.just_sent_cards?.has?.(phandler);

  if (!core.queue_event || core.queue_event.length === 0) return true;
  const tp = [];
  const ntp = [];
  for (const ev of core.queue_event) {
    forEachEffect(effects.continuous_effect, ev.event_code, (peffect) => {
      let ownerPlayer = peffect.get_handler_player();
      if (peffect.is_flag(EFFECT_FLAG_EVENT_PLAYER) && (ev.event_player === 0 || ev.event_player === 1)) {
        ownerPlayer = ev.event_player;
      }
      if (peffect.is_activateable(ownerPlayer, ev)) {
        const chainSet = (() => {
          if (peffect.is_flag(EFFECT_FLAG_DELAY) && (core.chain_solving || core.conti_solving)) {
            return ownerPlayer === infos.turn_player ? (core.delayed_continuous_tp ?? (core.delayed_continuous_tp = []))
              : (core.delayed_continuous_ntp ?? (core.delayed_continuous_ntp = []));
          }
          return ownerPlayer === infos.turn_player ? tp : ntp;
        })();
        const newchain = new ChainLink();
        newchain.chain_id = 0;
        newchain.chain_count = 0;
        newchain.triggering_effect = peffect;
        newchain.triggering_player = ownerPlayer;
        newchain.evt = ev;
        newchain.target_cards = null;
        newchain.target_player = PLAYER_NONE;
        newchain.target_param = 0;
        newchain.disable_player = PLAYER_NONE;
        newchain.disable_reason = null;
        newchain.flag = 0;
        chainSet.push(newchain);
      }
    });

    if (ev.event_code === EVENT_ADJUST || ev.event_code === EVENT_BREAK_EFFECT
      || ((ev.event_code & 0xfffff000) === EVENT_PHASE_START)) {
      continue;
    }
    forEachEffect(effects.trigger_f_effect, ev.event_code, (peffect) => {
      const phandler = peffect.get_handler();
      if (!phandler.is_status(STATUS_EFFECT_ENABLED) || !peffect.is_condition_check(phandler.current.controler, ev)) return;
      let wasJustSent = false;
      if ((wasJustSent = checkSimul(peffect, phandler)) && (peffect.range & LOCATION_HAND) === 0) return;
      peffect.set_activate_location();
      const newchain = new ChainLink();
      newchain.was_just_sent = wasJustSent;
      newchain.flag = 0;
      newchain.chain_id = infos.field_id++;
      newchain.event_id = ev.global_id;
      newchain.evt = ev;
      newchain.triggering_effect = peffect;
      newchain.set_triggering_state(phandler);
      if (peffect.is_flag(EFFECT_FLAG_EVENT_PLAYER) && (ev.event_player === 0 || ev.event_player === 1)) {
        newchain.triggering_player = ev.event_player;
      } else {
        newchain.triggering_player = phandler.current.controler;
      }
      phandler.create_relation(newchain);
      core.new_fchain = core.new_fchain ?? [];
      core.new_fchain.push(newchain);
    });
    forEachEffect(effects.trigger_o_effect, ev.event_code, (peffect) => {
      const phandler = peffect.get_handler();
      const act = phandler.is_status(STATUS_EFFECT_ENABLED) && peffect.is_condition_check(phandler.current.controler, ev);
      let wasJustSent = false;
      if ((wasJustSent = checkSimul(peffect, phandler)) && (peffect.range & LOCATION_HAND) === 0) return;
      if ((peffect.range & LOCATION_HAND) === 0 && !act) return;
      peffect.set_activate_location();
      const newchain = new ChainLink();
      newchain.was_just_sent = wasJustSent;
      newchain.flag = 0;
      newchain.chain_id = infos.field_id++;
      newchain.event_id = ev.global_id;
      newchain.evt = ev;
      newchain.triggering_effect = peffect;
      newchain.set_triggering_state(phandler);
      if (peffect.is_flag(EFFECT_FLAG_EVENT_PLAYER) && (ev.event_player === 0 || ev.event_player === 1)) {
        newchain.triggering_player = ev.event_player;
      } else {
        newchain.triggering_player = phandler.current.controler;
      }
      if (peffect.is_flag(EFFECT_FLAG_FIELD_ONLY)
        || !(peffect.range & LOCATION_HAND)
        || ((peffect.range & phandler.current.location) && act)) {
        phandler.create_relation(newchain);
      }
      core.new_ochain = core.new_ochain ?? [];
      core.new_ochain.push(newchain);
    });

    forEachEffect(effects.quick_f_effect, ev.event_code, (peffect) => {
      const phandler = peffect.get_handler();
      peffect.set_activate_location();
      if (peffect.is_activateable(phandler.current.controler, ev)) {
        core.quick_f_chain = ensureMap(core.quick_f_chain);
        const newchain = new ChainLink();
        newchain.flag = 0;
        newchain.chain_id = infos.field_id++;
        newchain.evt = ev;
        newchain.triggering_effect = peffect;
        newchain.set_triggering_state(phandler);
        if (peffect.is_flag(EFFECT_FLAG_EVENT_PLAYER) && (ev.event_player === 0 || ev.event_player === 1)) {
          newchain.triggering_player = ev.event_player;
        } else {
          newchain.triggering_player = phandler.current.controler;
        }
        phandler.create_relation(newchain);
        core.quick_f_chain.set(peffect, newchain);
      }
    });
    core.delayed_activate_event = core.delayed_activate_event ?? [];
    core.delayed_activate_event.push(ev);
    forEachEffect(effects.quick_o_effect, ev.event_code, (peffect) => {
      if (peffect.is_flag(EFFECT_FLAG_DELAY) && peffect.is_condition_check(peffect.get_handler().current.controler, ev)) {
        core.delayed_quick_tmp = ensureMap(core.delayed_quick_tmp);
        core.delayed_quick_tmp.set(peffect, ev);
      }
    });
  }

  while (tp.length) {
    core.sub_solving_continuous = core.sub_solving_continuous ?? [];
    core.sub_solving_continuous.push(tp.shift());
    context.emplace_process?.('SolveContinuous');
  }
  while (ntp.length) {
    core.sub_solving_continuous = core.sub_solving_continuous ?? [];
    core.sub_solving_continuous.push(ntp.shift());
    context.emplace_process?.('SolveContinuous');
  }
  moveAll(core.instant_event, core.queue_event);
  return true;
}

function processSingleEvent(context) {
  const { core } = context;
  if (!core.single_event || core.single_event.length === 0) return true;
  const tp = [];
  const ntp = [];
  for (const ev of core.single_event) {
    const starget = ev.trigger_card;
    forEachEffect(starget.single_effect, ev.event_code, (peffect) => {
      processSingleEventEffect(context, peffect, ev, tp, ntp);
    });
    for (const pcard of starget.xyz_materials ?? []) {
      forEachEffect(pcard.xmaterial_effect, ev.event_code, (peffect) => {
        if (peffect.type & EFFECT_TYPE_FIELD) return;
        processSingleEventEffect(context, peffect, ev, tp, ntp);
      });
    }
  }
  while (tp.length) {
    core.sub_solving_continuous = core.sub_solving_continuous ?? [];
    core.sub_solving_continuous.push(tp.shift());
    context.emplace_process?.('SolveContinuous');
  }
  while (ntp.length) {
    core.sub_solving_continuous = core.sub_solving_continuous ?? [];
    core.sub_solving_continuous.push(ntp.shift());
    context.emplace_process?.('SolveContinuous');
  }
  core.single_event.length = 0;
  return true;
}

function processSingleEventEffect(context, peffect, e, tp, ntp) {
  const { core, infos } = context;
  if (!(peffect.type & EFFECT_TYPE_ACTIONS)) return false;
  if ((peffect.type & EFFECT_TYPE_FLIP) && (e.event_value & (NO_FLIP_EFFECT >> 16))) return false;

  if (peffect.type & EFFECT_TYPE_CONTINUOUS) {
    let ownerPlayer = peffect.get_handler_player();
    if (peffect.is_flag(EFFECT_FLAG_EVENT_PLAYER) && (e.event_player === 0 || e.event_player === 1)) {
      ownerPlayer = e.event_player;
    }
    if (peffect.is_activateable(ownerPlayer, e)) {
      const chainSet = (() => {
        if (peffect.is_flag(EFFECT_FLAG_DELAY) && (core.chain_solving || core.conti_solving)) {
          return ownerPlayer === infos.turn_player ? (core.delayed_continuous_tp ?? (core.delayed_continuous_tp = []))
            : (core.delayed_continuous_ntp ?? (core.delayed_continuous_ntp = []));
        }
        return ownerPlayer === infos.turn_player ? tp : ntp;
      })();
      const newchain = new ChainLink();
      newchain.chain_id = 0;
      newchain.chain_count = 0;
      newchain.triggering_effect = peffect;
      newchain.triggering_player = ownerPlayer;
      newchain.evt = e;
      newchain.target_cards = null;
      newchain.target_player = PLAYER_NONE;
      newchain.target_param = 0;
      newchain.disable_player = PLAYER_NONE;
      newchain.disable_reason = null;
      newchain.flag = 0;
      chainSet.push(newchain);
    }
  } else {
    const phandler = peffect.get_handler();
    if (!peffect.is_condition_check(phandler.current.controler, e)) return false;
    peffect.set_activate_location();
    const chainSet = (() => {
      if (core.flip_delayed && e.event_code === EVENT_FLIP) {
        return peffect.type & EFFECT_TYPE_TRIGGER_O ? (core.new_ochain_b ?? (core.new_ochain_b = []))
          : (core.new_fchain_b ?? (core.new_fchain_b = []));
      }
      return peffect.type & EFFECT_TYPE_TRIGGER_O ? (core.new_ochain ?? (core.new_ochain = []))
        : (core.new_fchain ?? (core.new_fchain = []));
    })();
    const newchain = new ChainLink();
    newchain.flag = 0;
    newchain.chain_id = infos.field_id++;
    newchain.event_id = e.global_id;
    newchain.evt = e;
    newchain.triggering_effect = peffect;
    newchain.set_triggering_state(phandler);
    if (peffect.is_flag(EFFECT_FLAG_EVENT_PLAYER) && (e.event_player === 0 || e.event_player === 1)) {
      newchain.triggering_player = e.event_player;
    } else {
      if (phandler.current.reason & 0x4) newchain.triggering_player = phandler.previous.controler;
      else newchain.triggering_player = newchain.triggering_controler;
    }
    peffect.set_active_type();
    phandler.create_relation(newchain);
    const deffect = phandler.is_affected_by_effect(EFFECT_DISABLE_EFFECT);
    if (deffect) {
      const negeff = context.pduel.new_effect();
      negeff.owner = deffect.owner;
      negeff.type = EFFECT_TYPES.EFFECT_TYPE_SINGLE;
      negeff.code = EFFECT_DISABLE_CHAIN;
      negeff.value = newchain.chain_id;
      negeff.reset_flag = 0x1000 | deffect.get_value();
      phandler.add_effect(negeff);
    }
    chainSet.push(newchain);
  }
  return true;
}

processPointEvent.process_instant_event = processInstantEvent;
processPointEvent.process_single_event = processSingleEvent;
processPointEvent.process_single_event_effect = processSingleEventEffect;

module.exports = processPointEvent;
