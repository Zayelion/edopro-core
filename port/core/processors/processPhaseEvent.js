const { EFFECT_CODES, EFFECT_FLAGS, EFFECT_TYPES, EFFECT_EVENTS, RESET_FLAGS } = require('../effect');
const { CARD_LOCATIONS, PLAYERS } = require('../card');
const { OCG_CONSTANTS } = require('../ocgapi');

const {
  EFFECT_SET_CONTROL,
  EFFECT_HAND_LIMIT,
  EFFECT_SKIP_DP,
  EFFECT_SKIP_SP,
  EFFECT_SKIP_BP,
  EFFECT_SKIP_EP,
} = EFFECT_CODES;

const { EFFECT_FLAG_FIELD_ONLY } = EFFECT_FLAGS;
const { EFFECT_TYPE_ACTIONS, EFFECT_TYPE_CONTINUOUS } = EFFECT_TYPES;
const { EVENT_PHASE, EVENT_FREE_CHAIN } = EFFECT_EVENTS;
const { RESET_SELF_TURN, RESET_OPPO_TURN } = RESET_FLAGS;

const { LOCATION_GRAVE } = CARD_LOCATIONS;
const { PLAYER_NONE } = PLAYERS;

const { POS_FACEUP } = OCG_CONSTANTS;

const PHASE_DRAW = 0x01;
const PHASE_STANDBY = 0x02;
const PHASE_BATTLE_START = 0x08;
const PHASE_BATTLE_STEP = 0x10;
const PHASE_BATTLE = 0x80;
const PHASE_END = 0x200;

const TIMING_DRAW_PHASE = 0x1;
const TIMING_STANDBY_PHASE = 0x2;
const TIMING_BATTLE_START = 0x8;
const TIMING_BATTLE_END = 0x10;
const TIMING_END_PHASE = 0x20;

const MSG_HINT = 2;

const HINT_EVENT = 1;
const HINT_SELECTMSG = 3;

const DUEL_NO_HAND_LIMIT = 0x1000000;
const DUEL_INVERTED_QUICK_PRIORITY = 0x4000000;

const REASON_RULE = 0x400;
const REASON_DISCARD = 0x4000;
const REASON_ADJUST = 0x100;

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
 * Ports the native `field::process(Processors::PhaseEvent&)` control flow.
 * @param {import('../processor').ProcessDescriptor|import('../field').Field} unit Process descriptor or field instance.
 * @param {import('../field').Field} field Field instance driving resolution.
 * @returns {boolean} True when processing completes for the current step.
 */
function processPhaseEvent(unit, field) {
  const isFieldArg = unit && unit.core && unit.infos && unit.player;
  const context = isFieldArg ? unit : field ?? this;
  const arg = (isFieldArg ? field : unit?.payload ?? unit) ?? {};
  const step = isFieldArg ? (arg.step ?? 0) : (unit?.step ?? arg.step ?? 0);
  const { core, infos, effects, returns, pduel, player } = context;
  const returnCards = context.return_cards ?? context.returnCards ?? {};
  const phase = arg.phase;

  switch (step) {
    case 0: {
      if ((phase === PHASE_DRAW && (core.force_turn_end || context.is_player_affected_by_effect(infos.turn_player, EFFECT_SKIP_DP)))
        || (phase === PHASE_STANDBY && (core.force_turn_end || context.is_player_affected_by_effect(infos.turn_player, EFFECT_SKIP_SP)))
        || (phase === PHASE_BATTLE_START && (core.force_turn_end || context.is_player_affected_by_effect(infos.turn_player, EFFECT_SKIP_BP)))
        || (phase === PHASE_BATTLE && (core.force_turn_end || context.is_player_affected_by_effect(infos.turn_player, EFFECT_SKIP_BP)))
        || (phase === PHASE_END && (core.force_turn_end || context.is_player_affected_by_effect(infos.turn_player, EFFECT_SKIP_EP)))) {
        arg.step = 24;
        return false;
      }

      const phaseEvent = EVENT_PHASE + phase;
      context.nil_event.event_code = phaseEvent;
      context.nil_event.event_player = infos.turn_player;
      let checkPlayer = infos.turn_player;
      if (arg.is_opponent) checkPlayer = 1 - infos.turn_player;
      core.select_chains = [];
      let tfCount = 0;
      let toCount = 0;
      let fcCount = 0;
      let cnCount = 0;

      forEachEffect(effects.trigger_f_effect, phaseEvent, (peffect) => {
        peffect.set_activate_location();
        if (!peffect.is_activateable(checkPlayer, context.nil_event)) return;
        peffect.id = infos.field_id++;
        core.select_chains.push({ triggering_effect: peffect });
        tfCount += 1;
      });
      forEachEffect(effects.continuous_effect, phaseEvent, (peffect) => {
        if (peffect.get_handler_player() !== checkPlayer || !peffect.is_activateable(checkPlayer, context.nil_event)) return;
        peffect.id = infos.field_id++;
        core.select_chains.push({ triggering_effect: peffect });
        cnCount += 1;
      });

      if (Array.isArray(effects.pheff)) {
        for (const peffect of effects.pheff) {
          if (!peffect || peffect.code !== EFFECT_SET_CONTROL) continue;
          if (!(peffect.reset_flag & phase)) continue;
          const pid = peffect.get_handler_player();
          if (pid !== checkPlayer) continue;
          const tp = infos.turn_player;
          const selfTurn = (peffect.reset_flag & RESET_SELF_TURN) && pid === tp;
          const oppoTurn = (peffect.reset_flag & RESET_OPPO_TURN) && pid !== tp;
          if (!(selfTurn || oppoTurn)) continue;
          if (peffect.reset_count !== 1) continue;
          const phandler = peffect.get_handler();
          if (peffect.get_value(phandler) !== phandler.current.controler) continue;
          core.select_chains.push({ triggering_effect: peffect });
          cnCount += 1;
        }
      }

      core.spe_effect[checkPlayer] = 0;
      if (!core.hand_adjusted) {
        forEachEffect(effects.trigger_o_effect, phaseEvent, (peffect) => {
          peffect.set_activate_location();
          if (!peffect.is_activateable(checkPlayer, context.nil_event)) return;
          peffect.id = infos.field_id++;
          core.select_chains.push({ triggering_effect: peffect });
          toCount += 1;
          core.spe_effect[checkPlayer] += 1;
        });
        if (phase === PHASE_DRAW) core.hint_timing[infos.turn_player] = TIMING_DRAW_PHASE;
        else if (phase === PHASE_STANDBY) core.hint_timing[infos.turn_player] = TIMING_STANDBY_PHASE;
        else if (phase === PHASE_BATTLE_START) core.hint_timing[infos.turn_player] = TIMING_BATTLE_START;
        else if (phase === PHASE_BATTLE) core.hint_timing[infos.turn_player] = TIMING_BATTLE_END;
        else core.hint_timing[infos.turn_player] = TIMING_END_PHASE;

        forEachEffect(effects.activate_effect, EVENT_FREE_CHAIN, (peffect) => {
          peffect.set_activate_location();
          if (!peffect.is_chainable(checkPlayer) || !peffect.is_activateable(checkPlayer, context.nil_event)) return;
          peffect.id = infos.field_id++;
          core.select_chains.push({ triggering_effect: peffect });
          if (context.check_hint_timing?.(peffect) || context.check_cteffect_hint?.(peffect, checkPlayer)) {
            core.spe_effect[checkPlayer] += 1;
          }
          fcCount += 1;
        });
        forEachEffect(effects.quick_o_effect, EVENT_FREE_CHAIN, (peffect) => {
          peffect.set_activate_location();
          if (!peffect.is_chainable(checkPlayer) || !peffect.is_activateable(checkPlayer, context.nil_event)) return;
          peffect.id = infos.field_id++;
          core.select_chains.push({ triggering_effect: peffect });
          if (context.check_hint_timing?.(peffect)) core.spe_effect[checkPlayer] += 1;
          fcCount += 1;
        });
        forEachEffect(effects.continuous_effect, EVENT_FREE_CHAIN, (peffect) => {
          if (peffect.get_handler_player() !== checkPlayer || !peffect.is_activateable(checkPlayer, context.nil_event)) return;
          peffect.id = infos.field_id++;
          core.select_chains.push({ triggering_effect: peffect });
          fcCount += 1;
        });
      }

      if (core.select_chains.length === 0) {
        returns.set(0, -1);
        arg.step = 1;
        return false;
      }
      if (tfCount === 0 && cnCount === 1 && toCount === 0 && fcCount === 0) {
        returns.set(0, 0);
        arg.step = 1;
        return false;
      }
      const message = pduel.new_message(MSG_HINT);
      message.write(HINT_EVENT);
      message.write(checkPlayer);
      if (infos.phase === PHASE_DRAW) message.write(20);
      else if (infos.phase === PHASE_STANDBY) message.write(21);
      else if (infos.phase === PHASE_BATTLE_START) message.write(28);
      else if (infos.phase === PHASE_BATTLE) message.write(25);
      else message.write(26);
      if (tfCount === 0 && toCount === 1 && fcCount === 0 && cnCount === 0) {
        context.emplace_process?.('SelectEffectYesNo', checkPlayer, 0, core.select_chains[0].triggering_effect.get_handler());
        return false;
      }
      context.emplace_process?.('SelectChain', checkPlayer, core.spe_effect[checkPlayer], (tfCount + cnCount) > 0);
      arg.step = 1;
      return false;
    }
    case 1: {
      returns.set(0, returns.at(0) - 1);
      return false;
    }
    case 2: {
      if (returns.at(0) === -1) {
        if (arg.priority_passed) {
          arg.step = 19;
        } else {
          arg.priority_passed = true;
          arg.is_opponent = !arg.is_opponent;
          arg.step = PROCESS_RESTART;
        }
        return false;
      }
      arg.priority_passed = false;
      const selected = core.select_chains[returns.at(0)];
      const peffect = selected?.triggering_effect;
      const phandler = peffect?.get_handler();
      if (!(peffect.type & EFFECT_TYPE_ACTIONS)) {
        if (peffect.is_flag(EFFECT_FLAG_FIELD_ONLY)) {
          context.remove_effect?.(peffect);
        } else {
          const handler = peffect.get_handler?.() ?? peffect.handler;
          handler?.remove_effect?.(peffect);
        }
        context.adjust_all();
        arg.step = 3;
      } else if (!(peffect.type & EFFECT_TYPE_CONTINUOUS)) {
        let checkPlayer = infos.turn_player;
        if (arg.is_opponent) checkPlayer = 1 - infos.turn_player;
        core.new_chains = core.new_chains ?? [];
        core.new_chains.push(...core.select_chains.splice(returns.at(0), 1));
        selected.flag = 0;
        selected.chain_id = infos.field_id++;
        selected.evt = { ...context.nil_event };
        selected.set_triggering_state(phandler);
        selected.triggering_player = checkPlayer;
        phandler.set_status(STATUS_CHAINING, true);
        peffect.dec_count(checkPlayer);
        core.select_chains = [];
        context.emplace_process?.('AddChain');
        if (context.is_flag(DUEL_INVERTED_QUICK_PRIORITY)) {
          context.emplace_process?.('QuickEffect', false, checkPlayer);
        } else {
          context.emplace_process?.('QuickEffect', false, 1 - checkPlayer);
        }
        infos.priorities[0] = 0;
        infos.priorities[1] = 0;
      } else {
        core.select_chains = [];
        context.solve_continuous(peffect.get_handler_player(), peffect, context.nil_event);
        arg.step = 3;
      }
      return false;
    }
    case 3: {
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
    case 4: {
      context.adjust_instant();
      context.emplace_process?.('PointEvent', false, false, false);
      arg.step = PROCESS_RESTART;
      return false;
    }
    case 20: {
      if (phase !== PHASE_END) {
        arg.step = 24;
        return false;
      }
      let limit = 6;
      const eset = [];
      context.filter_player_effect?.(infos.turn_player, EFFECT_HAND_LIMIT, eset);
      if (eset.length) limit = eset[eset.length - 1].get_value();
      const hd = player[infos.turn_player].list_hand.length;
      if (hd <= limit || context.is_flag(DUEL_NO_HAND_LIMIT)) {
        arg.step = 24;
        return false;
      }
      core.select_cards = [];
      for (const pcard of player[infos.turn_player].list_hand) core.select_cards.push(pcard);
      const message = pduel.new_message(MSG_HINT);
      message.write(HINT_SELECTMSG);
      message.write(infos.turn_player);
      message.write(501);
      const toDiscard = hd - limit;
      context.emplace_process?.('SelectCard', infos.turn_player, false, toDiscard, toDiscard);
      return false;
    }
    case 21: {
      if (returnCards.list?.length) {
        context.send_to(
          new Set(returnCards.list),
          null,
          REASON_RULE + REASON_DISCARD + REASON_ADJUST,
          infos.turn_player,
          PLAYER_NONE,
          LOCATION_GRAVE,
          0,
          POS_FACEUP,
        );
      }
      return false;
    }
    case 22: {
      core.hand_adjusted = true;
      context.emplace_process?.('PointEvent', false, false, false);
      arg.step = PROCESS_RESTART;
      arg.is_opponent = false;
      arg.priority_passed = false;
      return false;
    }
    case 25: {
      core.hint_timing[infos.turn_player] = 0;
      context.reset_phase(phase);
      context.adjust_all();
      return false;
    }
    case 26: {
      core.quick_f_chain.clear();
      core.instant_event.clear();
      core.point_event.clear();
      core.delayed_activate_event.clear();
      core.full_event.clear();
      return true;
    }
    default:
      return true;
  }
}

module.exports = processPhaseEvent;
