const { EFFECT_CODES, EFFECT_FLAGS, EFFECT_TYPES, EFFECT_EVENTS } = require('../effect');
const { CARD_LOCATIONS, PLAYERS } = require('../card');
const { OCG_CONSTANTS } = require('../ocgapi');
const { LuaParam } = require('../interpreter');

const {
  EFFECT_BP_FIRST_TURN,
  EFFECT_CANNOT_BP,
  EFFECT_CANNOT_EP,
  EFFECT_CANNOT_M2,
  EFFECT_MUST_ATTACK,
  EFFECT_SPSUMMON_PROC,
  EFFECT_SPSUMMON_PROC_G,
  EFFECT_SKIP_M1,
  EFFECT_SKIP_M2,
} = EFFECT_CODES;

const { EFFECT_FLAG_BOTH_SIDE } = EFFECT_FLAGS;
const { EFFECT_TYPE_CONTINUOUS } = EFFECT_TYPES;
const { EVENT_FREE_CHAIN } = EFFECT_EVENTS;

const { LOCATION_HAND } = CARD_LOCATIONS;
const { PLAYER_NONE } = PLAYERS;

const {
  POS_FACEUP_ATTACK,
  POS_FACEDOWN_ATTACK,
  POS_FACEUP_DEFENSE,
  POS_FACEDOWN_DEFENSE,
  POS_FACEUP,
  POS_FACEDOWN,
} = OCG_CONSTANTS;

const STATUS_CHAINING = 0x10000;
const STATUS_FORM_CHANGED = 0x100;

const TIMING_MAIN_END = 0x4;

const PHASE_MAIN1 = 0x04;
const PHASE_MAIN2 = 0x100;
const PHASE_BATTLE_START = 0x08;
const PHASE_BATTLE_STEP = 0x10;
const PHASE_BATTLE = 0x80;

const MSG_HINT = 2;
const MSG_NEW_PHASE = 41;

const HINT_EVENT = 1;

const DUEL_ATTACK_FIRST_TURN = 0x02;

const PROCESS_RESTART = 0xffff;

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

/**
 * Ports the native `field::process(Processors::IdleCommand&)` control flow.
 * @param {import('../processor').ProcessDescriptor|import('../field').Field} unit Process descriptor or field instance.
 * @param {import('../field').Field} field Field instance driving resolution.
 * @returns {boolean} True when processing completes for the current step.
 */
function processIdleCommand(unit, field) {
  const isFieldArg = unit && unit.core && unit.infos && unit.player;
  const context = isFieldArg ? unit : field ?? this;
  const arg = (isFieldArg ? field : unit?.payload ?? unit) ?? {};
  const step = isFieldArg ? (arg.step ?? 0) : (unit?.step ?? arg.step ?? 0);
  const { core, infos, player, effects, returns, pduel } = context;

  switch (step) {
    case 0: {
      let mustAttack = false;
      core.select_chains = [];
      context.nil_event.event_code = EVENT_FREE_CHAIN;
      if (core.set_forced_attack) {
        core.set_forced_attack = false;
        arg.step = PROCESS_RESTART;
        context.emplace_process?.('ForcedBattle');
        return false;
      }
      core.to_bp = true;
      core.to_ep = true;
      if ((!context.is_flag(DUEL_ATTACK_FIRST_TURN) && infos.turn_id === 1
        && !context.is_player_affected_by_effect(infos.turn_player, EFFECT_BP_FIRST_TURN))
        || infos.phase === PHASE_MAIN2
        || context.is_player_affected_by_effect(infos.turn_player, EFFECT_CANNOT_BP)
        || core.force_turn_end) {
        core.to_bp = false;
      }
      if (infos.phase === PHASE_MAIN1) {
        for (const pcard of player[infos.turn_player].list_mzone) {
          if (pcard && pcard.is_capable_attack() && pcard.is_affected_by_effect(EFFECT_MUST_ATTACK)) {
            mustAttack = true;
            break;
          }
        }
        if (core.to_bp && (mustAttack || context.is_player_affected_by_effect(infos.turn_player, EFFECT_CANNOT_EP))) {
          core.to_ep = false;
        }
      }
      if ((infos.phase === PHASE_MAIN1 && context.is_player_affected_by_effect(infos.turn_player, EFFECT_SKIP_M1))
        || (infos.phase === PHASE_MAIN2 && context.is_player_affected_by_effect(infos.turn_player, EFFECT_SKIP_M2))
        || core.force_turn_end) {
        if (core.to_bp && core.to_ep) {
          core.select_options = [];
          core.select_options.push(80);
          core.select_options.push(81);
          context.emplace_process?.('SelectOption', infos.turn_player);
          arg.step = 11;
        } else if (core.to_bp) {
          arg.phase_to_change_to = 6;
          arg.step = 10;
          context.reset_phase(infos.phase);
          context.adjust_all();
        } else {
          arg.phase_to_change_to = 7;
          arg.step = 10;
          context.reset_phase(infos.phase);
          context.adjust_all();
        }
        return false;
      }
      if (infos.phase === PHASE_MAIN2 && core.skip_m2) {
        core.skip_m2 = false;
        returns.set(0, 7);
        return false;
      }

      forEachEffect(effects.activate_effect, EVENT_FREE_CHAIN, (peffect) => {
        peffect.set_activate_location();
        if (peffect.is_activateable(infos.turn_player, context.nil_event)) {
          core.select_chains.push({ triggering_effect: peffect });
        }
      });
      forEachEffect(effects.quick_o_effect, EVENT_FREE_CHAIN, (peffect) => {
        peffect.set_activate_location();
        if (peffect.is_activateable(infos.turn_player, context.nil_event)) {
          core.select_chains.push({ triggering_effect: peffect });
        }
      });
      forEachEffect(effects.continuous_effect, EVENT_FREE_CHAIN, (peffect) => {
        if (peffect.get_handler_player() === infos.turn_player
          && peffect.is_activateable(infos.turn_player, context.nil_event)) {
          core.select_chains.push({ triggering_effect: peffect });
        }
      });
      if (effects.ignition_effect) {
        for (const entry of effects.ignition_effect) {
          const peffect = entry?.second ?? entry?.[1] ?? entry;
          if (!peffect) continue;
          peffect.set_activate_location();
          if (peffect.is_activateable(infos.turn_player, context.nil_event)) {
            core.select_chains.push({ triggering_effect: peffect });
          }
        }
      }

      core.summonable_cards = [];
      for (const pcard of player[infos.turn_player].list_hand) {
        if (pcard.is_can_be_summoned(infos.turn_player, false, null, 0)) core.summonable_cards.push(pcard);
      }
      for (const pcard of player[infos.turn_player].list_mzone) {
        if (pcard && pcard.is_can_be_summoned(infos.turn_player, false, null, 0)) core.summonable_cards.push(pcard);
      }

      core.spsummonable_cards = [];
      const eset = [];
      context.filter_field_effect?.(EFFECT_SPSUMMON_PROC, eset);
      for (const peff of eset) {
        const pcard = peff.get_handler();
        if (!peff.check_count_limit(pcard.current.controler)) continue;
        if (pcard.current.controler === infos.turn_player && pcard.is_special_summonable(infos.turn_player, 0)) {
          core.spsummonable_cards.push(pcard);
        }
      }
      eset.length = 0;
      context.filter_field_effect?.(EFFECT_SPSUMMON_PROC_G, eset);
      for (const peff of eset) {
        const pcard = peff.get_handler();
        if (!peff.check_count_limit(infos.turn_player)) continue;
        if (pcard.current.controler !== infos.turn_player && !peff.is_flag(EFFECT_FLAG_BOTH_SIDE)) continue;
        const oreason = core.reason_effect;
        const op = core.reason_player;
        core.reason_effect = peff;
        core.reason_player = pcard.current.controler;
        context.save_lp_cost?.();
        pduel.lua.add_param(LuaParam.EFFECT, peff);
        pduel.lua.add_param(LuaParam.CARD, pcard);
        if (pduel.lua.check_condition(peff.condition, 2)) core.spsummonable_cards.push(pcard);
        context.restore_lp_cost?.();
        core.reason_effect = oreason;
        core.reason_player = op;
      }

      core.repositionable_cards = [];
      for (const pcard of player[infos.turn_player].list_mzone) {
        if (!pcard) continue;
        if ((pcard.is_position(POS_FACEUP | POS_FACEDOWN_ATTACK) && pcard.is_capable_change_position(infos.turn_player))
          || (pcard.is_position(POS_FACEDOWN) && pcard.is_can_be_flip_summoned(infos.turn_player))) {
          core.repositionable_cards.push(pcard);
        }
      }

      core.msetable_cards = [];
      core.ssetable_cards = [];
      for (const pcard of player[infos.turn_player].list_hand) {
        if (pcard.is_setable_mzone(infos.turn_player, false, null, 0)) core.msetable_cards.push(pcard);
        if (pcard.is_setable_szone(infos.turn_player)) core.ssetable_cards.push(pcard);
      }

      context.emplace_process?.('SelectIdleCmd', infos.turn_player);
      return false;
    }
    case 1: {
      const ret = returns.at(0);
      const ctype = ret & 0xffff;
      const sel = ret >> 16;
      if (ctype === 5) {
        const newchain = core.select_chains[sel];
        const peffect = newchain?.triggering_effect;
        if (peffect?.type & EFFECT_TYPE_CONTINUOUS) {
          core.select_chains = [];
          context.solve_continuous(peffect.get_handler_player(), peffect, context.nil_event);
          arg.step = 2;
          return false;
        }
        const phandler = peffect.get_handler();
        newchain.flag = 0;
        newchain.chain_id = infos.field_id++;
        newchain.evt = newchain.evt ?? {};
        newchain.evt.event_code = peffect.code;
        newchain.evt.event_player = PLAYER_NONE;
        newchain.evt.event_value = 0;
        newchain.evt.event_cards = null;
        newchain.evt.reason = 0;
        newchain.evt.reason_effect = null;
        newchain.evt.reason_player = PLAYER_NONE;
        newchain.set_triggering_state(phandler);
        newchain.triggering_player = infos.turn_player;
        core.new_chains = core.new_chains ?? [];
        core.new_chains.push(...core.select_chains.splice(sel, 1));
        phandler.set_status(STATUS_CHAINING, true);
        peffect.dec_count(infos.turn_player);
        core.select_chains = [];
        context.emplace_process?.('AddChain');
        context.emplace_process?.('QuickEffect', false, 1 - infos.turn_player);
        infos.priorities[0] = 0;
        infos.priorities[1] = 0;
        core.select_chains = [];
        return false;
      }
      if (ctype === 0) {
        arg.step = 4;
        return false;
      }
      if (ctype === 1) {
        arg.step = 5;
        return false;
      }
      if (ctype === 2) {
        arg.step = 6;
        return false;
      }
      if (ctype === 3) {
        arg.step = 7;
        return false;
      }
      if (ctype === 4) {
        arg.step = 8;
        return false;
      }
      if (ctype === 8) {
        arg.step = PROCESS_RESTART;
        context.shuffle(infos.turn_player, LOCATION_HAND);
        infos.can_shuffle = false;
        return false;
      }
      arg.step = 9;
      const message = pduel.new_message(MSG_HINT);
      message.write(HINT_EVENT);
      message.write(1 - infos.turn_player);
      message.write(23);
      core.select_chains = [];
      core.hint_timing[infos.turn_player] = TIMING_MAIN_END;
      context.emplace_process?.('QuickEffect', false, 1 - infos.turn_player);
      infos.priorities[infos.turn_player] = 1;
      infos.priorities[1 - infos.turn_player] = 0;
      arg.phase_to_change_to = ctype;
      return false;
    }
    case 2: {
      if (Array.isArray(core.chain_limit)) {
        for (const chLim of core.chain_limit) {
          pduel.lua.ensure_luaL_stack(chLim.function);
        }
      }
      core.chain_limit = [];
      for (const ch of core.current_chain ?? []) {
        ch.triggering_effect.get_handler().set_status(STATUS_CHAINING, false);
      }
      context.emplace_process?.('SolveChain', false, false, false);
      arg.step = PROCESS_RESTART;
      return false;
    }
    case 3: {
      context.adjust_instant();
      context.emplace_process?.('PointEvent', false, false, false);
      arg.step = PROCESS_RESTART;
      return false;
    }
    case 5: {
      const target = core.summonable_cards[returns.at(0) >> 16];
      core.summon_cancelable = true;
      context.summon(infos.turn_player, target, null, false, 0);
      arg.step = PROCESS_RESTART;
      return false;
    }
    case 6: {
      const target = core.spsummonable_cards[returns.at(0) >> 16];
      core.summon_cancelable = true;
      context.special_summon_rule(infos.turn_player, target, 0);
      arg.step = PROCESS_RESTART;
      return false;
    }
    case 7: {
      const target = core.repositionable_cards[returns.at(0) >> 16];
      if (target.is_position(POS_FACEUP_ATTACK)) {
        core.phase_action = true;
        context.change_position(target, null, infos.turn_player, POS_FACEUP_DEFENSE, false);
        context.adjust_all();
        context.emplace_process?.('PointEvent', false, false, false);
      } else if (target.is_position(POS_FACEUP_DEFENSE)) {
        core.phase_action = true;
        context.change_position(target, null, infos.turn_player, POS_FACEUP_ATTACK, false);
        context.adjust_all();
        context.emplace_process?.('PointEvent', false, false, false);
      } else if (target.is_position(POS_FACEDOWN_ATTACK)) {
        arg.card_to_reposition = target;
        let positions = 0;
        if (target.is_capable_change_position(infos.turn_player)) positions |= POS_FACEDOWN_DEFENSE;
        if (target.is_can_be_flip_summoned(infos.turn_player)) positions |= POS_FACEUP_ATTACK;
        context.emplace_process?.('SelectPosition', infos.turn_player, target.data.code, positions);
        arg.step = 12;
        return false;
      } else {
        context.emplace_process?.('FlipSummon', target.current.controler, target);
      }
      target.set_status(STATUS_FORM_CHANGED, true);
      arg.step = PROCESS_RESTART;
      return false;
    }
    case 8: {
      const target = core.msetable_cards[returns.at(0) >> 16];
      core.summon_cancelable = true;
      context.mset(target.current.controler, target, null, false, 0);
      arg.step = PROCESS_RESTART;
      return false;
    }
    case 9: {
      const target = core.ssetable_cards[returns.at(0) >> 16];
      context.emplace_process?.('SpellSet', target.current.controler, target.current.controler, target, null);
      arg.step = PROCESS_RESTART;
      return false;
    }
    case 10: {
      if (Array.isArray(core.chain_limit)) {
        for (const chLim of core.chain_limit) {
          pduel.lua.ensure_luaL_stack(chLim.function);
        }
      }
      core.chain_limit = [];
      if (core.current_chain?.length) {
        for (const ch of core.current_chain) {
          ch.triggering_effect.get_handler().set_status(STATUS_CHAINING, false);
        }
        context.emplace_process?.('SolveChain', false, false, false);
        arg.step = PROCESS_RESTART;
        return false;
      }
      context.reset_phase(infos.phase);
      context.adjust_all();
      return false;
    }
    case 11: {
      returns.set(0, arg.phase_to_change_to);
      infos.can_shuffle = true;
      return true;
    }
    case 12: {
      if (returns.at(0) === 0) arg.phase_to_change_to = 6;
      else arg.phase_to_change_to = 7;
      context.reset_phase(infos.phase);
      context.adjust_all();
      arg.step = 10;
      return false;
    }
    case 13: {
      const target = arg.card_to_reposition;
      if (returns.at(0) === POS_FACEUP_ATTACK) {
        context.emplace_process?.('FlipSummon', target.current.controler, target);
      } else {
        core.phase_action = true;
        context.change_position(target, null, infos.turn_player, POS_FACEDOWN_DEFENSE, false);
        context.adjust_all();
        context.emplace_process?.('PointEvent', false, false, false);
      }
      target.set_status(STATUS_FORM_CHANGED, true);
      arg.step = PROCESS_RESTART;
      return false;
    }
    default:
      return true;
  }
}

module.exports = processIdleCommand;
