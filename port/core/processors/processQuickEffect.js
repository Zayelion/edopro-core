const { EFFECT_FLAGS, EFFECT_TYPES, EFFECT_EVENTS } = require('../effect');
const { CARD_LOCATIONS } = require('../card');
const { OCG_CONSTANTS } = require('../ocgapi');
const { QUICK_EFFECT_CONSTANTS } = require('../processor');
const { ChainLink, TriggerEvent } = require('../field');

const { EFFECT_FLAG_DELAY, EFFECT_FLAG_FIELD_ONLY } = EFFECT_FLAGS;
const { EFFECT_TYPE_FIELD } = EFFECT_TYPES;
const { EVENT_FREE_CHAIN } = EFFECT_EVENTS;

const { LOCATION_HAND, LOCATION_DECK } = CARD_LOCATIONS;
const { POS_FACEDOWN } = OCG_CONSTANTS;

const {
  STATUS_CHAINING,
  TIMING_ATTACK,
  TIMING_DAMAGE_STEP,
  TIMING_DAMAGE_CAL,
  PROCESS_RESTART,
} = QUICK_EFFECT_CONSTANTS;

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

const deleteDelayedQuick = (delayedQuick, peffect, evt) => {
  if (!(delayedQuick instanceof Map)) return;
  if (delayedQuick.get(peffect) === evt) {
    delayedQuick.delete(peffect);
    return;
  }
  for (const [effect, event] of delayedQuick.entries()) {
    if (effect === peffect && event === evt) {
      delayedQuick.delete(effect);
      break;
    }
  }
};

/**
 * Ports the native `field::process(Processors::QuickEffect&)` control flow.
 * @param {import('../processor').ProcessDescriptor|import('../field').Field} unit Process descriptor or field instance.
 * @param {import('../field').Field} field Field instance driving resolution.
 * @returns {boolean} True when processing completes for the current step.
 */
function processQuickEffect(unit, field) {
  const isFieldArg = unit && unit.core && unit.infos && unit.player;
  const context = isFieldArg ? unit : field ?? this;
  const arg = (isFieldArg ? field : unit?.payload ?? unit) ?? {};
  const step = isFieldArg ? (arg.step ?? 0) : (unit?.step ?? arg.step ?? 0);
  const { core, infos, effects, returns } = context;
  const skipFreechain = Boolean(arg.skip_freechain);
  const priority = arg.priority_player ?? 0;

  core.select_chains = core.select_chains ?? [];
  core.new_chains = core.new_chains ?? [];
  core.new_ochain_h = core.new_ochain_h ?? [];
  core.full_event = core.full_event ?? [];
  core.point_event = core.point_event ?? [];
  core.instant_event = core.instant_event ?? [];
  core.spe_effect = core.spe_effect ?? [0, 0];
  core.quick_f_chain = core.quick_f_chain instanceof Map ? core.quick_f_chain : new Map();
  core.delayed_quick = core.delayed_quick instanceof Map ? core.delayed_quick : new Map();

  switch (step) {
    case 0: {
      let checkPlayer = infos.turn_player;
      if (arg.is_opponent) checkPlayer = 1 - infos.turn_player;
      core.select_chains = [];
      for (const [peffect, chain] of core.quick_f_chain.entries()) {
        const phandler = peffect.get_handler();
        if (peffect.is_chainable(chain.triggering_player)
          && peffect.check_count_limit(chain.triggering_player)
          && phandler.is_has_relation(chain)) {
          if (chain.triggering_player === checkPlayer) core.select_chains.push(chain);
        } else {
          core.quick_f_chain.delete(peffect);
        }
      }
      if (core.select_chains.length === 0) returns.set(0, -1);
      else if (core.select_chains.length === 1) returns.set(0, 0);
      else context.emplace_process?.('SelectChain', checkPlayer, 0, true);
      return false;
    }
    case 1: {
      if (returns.at(0) === -1) {
        if (core.quick_f_chain.size) {
          arg.is_opponent = true;
          arg.step = PROCESS_RESTART;
        } else if (core.new_chains.length) {
          context.emplace_process?.('AddChain');
          const last = core.new_chains[core.new_chains.length - 1];
          context.emplace_process?.('QuickEffect', false, 1 - last.triggering_player);
          infos.priorities[0] = 0;
          infos.priorities[1] = 0;
          return true;
        }
        return false;
      }
      const newchain = core.select_chains[returns.at(0)];
      const peffect = newchain.triggering_effect;
      const tp = newchain.triggering_player;
      peffect.get_handler().set_status(STATUS_CHAINING, true);
      peffect.dec_count(tp);
      core.new_chains.push(...core.select_chains.splice(returns.at(0), 1));
      core.quick_f_chain.delete(peffect);
      arg.step = PROCESS_RESTART;
      return false;
    }
    case 2: {
      if (core.ignition_priority_chains?.length) {
        core.select_chains = core.ignition_priority_chains;
        core.ignition_priority_chains = [];
      }
      for (const event of [core.point_event, core.instant_event]) {
        for (const ev of event) {
          forEachEffect(effects.activate_effect, ev.event_code, (peffect) => {
            peffect.set_activate_location();
            if (!peffect.is_flag(EFFECT_FLAG_DELAY) && peffect.is_chainable(priority) && peffect.is_activateable(priority, ev)) {
              const phandler = peffect.get_handler();
              const newchain = new ChainLink();
              newchain.flag = 0;
              newchain.chain_id = infos.field_id++;
              newchain.evt = ev;
              newchain.triggering_effect = peffect;
              newchain.set_triggering_state(phandler);
              newchain.triggering_player = priority;
              core.select_chains.push(newchain);
            }
          });
          forEachEffect(effects.quick_o_effect, ev.event_code, (peffect) => {
            peffect.set_activate_location();
            if (!peffect.is_flag(EFFECT_FLAG_DELAY) && peffect.is_chainable(priority) && peffect.is_activateable(priority, ev)) {
              const phandler = peffect.get_handler();
              const newchain = new ChainLink();
              newchain.flag = 0;
              newchain.chain_id = infos.field_id++;
              newchain.evt = ev;
              newchain.triggering_effect = peffect;
              newchain.set_triggering_state(phandler);
              newchain.triggering_player = priority;
              core.select_chains.push(newchain);
            }
          });
        }
      }
      for (const ch of core.new_ochain_h) {
        const peffect = ch.triggering_effect;
        const phandler = peffect.get_handler();
        if (!peffect.is_flag(EFFECT_FLAG_FIELD_ONLY) && (peffect.type & EFFECT_TYPE_FIELD)
          && (peffect.range & LOCATION_HAND) && phandler.current.location === LOCATION_HAND) {
          if (!phandler.is_has_relation(ch) && peffect.is_condition_check(phandler.current.controler, ch.evt)) {
            phandler.create_relation(ch);
          }
          peffect.set_activate_location();
          ch.triggering_player = phandler.current.controler;
          ch.set_triggering_state(phandler);
        }
        if (ch.triggering_player === priority && !phandler.is_status(STATUS_CHAINING)
          && ((ch.triggering_location === LOCATION_HAND && phandler.is_position(POS_FACEDOWN)) || ch.triggering_location === LOCATION_DECK)
          && phandler.is_has_relation(ch) && peffect.is_chainable(priority)
          && peffect.is_activateable(priority, ch.evt, true)
          && context.check_spself_from_hand_trigger?.(ch)) {
          core.select_chains.push(ch);
        }
      }
      for (const ev of core.full_event) {
        forEachEffect(effects.activate_effect, ev.event_code, (peffect) => {
          peffect.set_activate_location();
          if (peffect.is_flag(EFFECT_FLAG_DELAY) && peffect.is_chainable(priority) && peffect.is_activateable(priority, ev)) {
            const phandler = peffect.get_handler();
            const newchain = new ChainLink();
            newchain.flag = 0;
            newchain.chain_id = infos.field_id++;
            newchain.evt = ev;
            newchain.triggering_effect = peffect;
            newchain.set_triggering_state(phandler);
            newchain.triggering_player = priority;
            core.select_chains.push(newchain);
          }
        });
      }
      for (const [peffect, evt] of core.delayed_quick.entries()) {
        peffect.set_activate_location();
        if (peffect.is_chainable(priority) && peffect.is_activateable(priority, evt, true, false, false)) {
          const phandler = peffect.get_handler();
          const newchain = new ChainLink();
          newchain.flag = 0;
          newchain.chain_id = infos.field_id++;
          newchain.evt = evt;
          newchain.triggering_effect = peffect;
          newchain.set_triggering_state(phandler);
          newchain.triggering_player = priority;
          core.select_chains.push(newchain);
        }
      }
      core.spe_effect[priority] = core.select_chains.length;
      if (!skipFreechain) {
        context.nil_event.event_code = EVENT_FREE_CHAIN;
        forEachEffect(effects.activate_effect, EVENT_FREE_CHAIN, (peffect) => {
          peffect.set_activate_location();
          if (peffect.is_chainable(priority) && peffect.is_activateable(priority, context.nil_event)) {
            const phandler = peffect.get_handler();
            const newchain = new ChainLink();
            newchain.flag = 0;
            newchain.chain_id = infos.field_id++;
            newchain.evt = context.nil_event;
            newchain.triggering_effect = peffect;
            newchain.set_triggering_state(phandler);
            newchain.triggering_player = priority;
            if (context.check_hint_timing?.(peffect) || context.check_cteffect_hint?.(peffect, priority)) {
              core.spe_effect[priority] += 1;
            }
            core.select_chains.push(newchain);
          }
        });
        forEachEffect(effects.quick_o_effect, EVENT_FREE_CHAIN, (peffect) => {
          peffect.set_activate_location();
          if (peffect.is_chainable(priority) && peffect.is_activateable(priority, context.nil_event)) {
            const phandler = peffect.get_handler();
            const newchain = new ChainLink();
            newchain.flag = 0;
            newchain.chain_id = infos.field_id++;
            newchain.evt = context.nil_event;
            newchain.triggering_effect = peffect;
            newchain.set_triggering_state(phandler);
            newchain.triggering_player = priority;
            if (context.check_hint_timing?.(peffect)) core.spe_effect[priority] += 1;
            core.select_chains.push(newchain);
          }
        });
      }
      if (core.current_chain.length || (core.hint_timing[0] & TIMING_ATTACK) || (core.hint_timing[1] & TIMING_ATTACK)) {
        core.spe_effect[priority] = core.select_chains.length;
      }
      context.emplace_process?.('SelectChain', priority, core.spe_effect[priority], false);
      return false;
    }
    case 3: {
      if (core.select_chains.length && returns.at(0) !== -1) {
        const newchain = core.select_chains[returns.at(0)];
        const peffect = newchain.triggering_effect;
        deleteDelayedQuick(core.delayed_quick, peffect, newchain.evt);
        core.new_chains.push(...core.select_chains.splice(returns.at(0), 1));
        peffect.get_handler().set_status(STATUS_CHAINING, true);
        peffect.dec_count(priority);
        context.emplace_process?.('AddChain');
        context.emplace_process?.('QuickEffect', false, 1 - priority);
        infos.priorities[0] = 0;
        infos.priorities[1] = 0;
      } else {
        infos.priorities[priority] = 1;
        if (!infos.priorities[0] || !infos.priorities[1]) {
          context.emplace_process?.('QuickEffect', { step: 1 }, skipFreechain, 1 - priority);
        } else {
          core.hint_timing[0] &= TIMING_DAMAGE_STEP | TIMING_DAMAGE_CAL;
          core.hint_timing[1] &= TIMING_DAMAGE_STEP | TIMING_DAMAGE_CAL;
        }
      }
      core.select_chains = [];
      return true;
    }
    default:
      return true;
  }
}

module.exports = processQuickEffect;
