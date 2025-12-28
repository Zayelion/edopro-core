const { CARD_LOCATIONS, PLAYERS } = require('../card');
const { LuaParam, COROUTINE_YIELD } = require('../interpreter');

const { LOCATION_DECK, LOCATION_HAND } = CARD_LOCATIONS;
const { PLAYER_NONE } = PLAYERS;

/**
 * Ports the native `field::process(Processors::ExecuteTarget&)` control flow.
 * @param {import('../processor').ProcessDescriptor|import('../field').Field} unit Process descriptor or field instance.
 * @param {import('../field').Field} field Field instance driving resolution.
 * @returns {boolean} True when processing completes for the current step.
 */
function processExecuteTarget(unit, field) {
  const isFieldArg = unit && unit.core && unit.infos && unit.player;
  const context = isFieldArg ? unit : field ?? this;
  const arg = (isFieldArg ? field : unit?.payload ?? unit) ?? {};
  const step = isFieldArg ? (arg.step ?? 0) : (unit?.step ?? arg.step ?? 0);
  const { core, pduel, returns } = context;
  const triggeringEffect = arg.triggering_effect;
  const triggeringPlayer = arg.triggering_player ?? 0;
  const lua = pduel?.lua;

  if (!triggeringEffect?.target) {
    if (typeof context.mergeSolvingEvents === 'function') {
      context.mergeSolvingEvents();
    } else {
      core.solving_event = core.solving_event ?? [];
      core.sub_solving_event = core.sub_solving_event ?? [];
      if (core.sub_solving_event.length) {
        core.solving_event.unshift(...core.sub_solving_event);
        core.sub_solving_event.length = 0;
      }
    }
    if (lua?.parameters) lua.parameters.length = 0;
    if (Array.isArray(core.solving_event) && core.solving_event.length) core.solving_event.shift();
    return true;
  }

  if (step === 0) {
    if (typeof context.mergeSolvingEvents === 'function') {
      context.mergeSolvingEvents();
    } else {
      core.solving_event = core.solving_event ?? [];
      core.sub_solving_event = core.sub_solving_event ?? [];
      if (core.sub_solving_event.length) {
        core.solving_event.unshift(...core.sub_solving_event);
        core.sub_solving_event.length = 0;
      }
    }
    const event = (core.solving_event && core.solving_event[0]) || context.nil_event;
    lua?.add_param(LuaParam.INT, 1, true);
    lua?.add_param(LuaParam.INT, event.reason_player ?? 0, true);
    lua?.add_param(LuaParam.INT, event.reason ?? 0, true);
    lua?.add_param(LuaParam.EFFECT, event.reason_effect, true);
    lua?.add_param(LuaParam.INT, event.event_value ?? 0, true);
    lua?.add_param(LuaParam.INT, event.event_player ?? 0, true);
    lua?.add_param(LuaParam.GROUP, event.event_cards, true);
    lua?.add_param(LuaParam.INT, triggeringPlayer, true);
    lua?.add_param(LuaParam.EFFECT, triggeringEffect, true);
    if (core.check_level === 0) {
      core.shuffle_deck_check[0] = false;
      core.shuffle_deck_check[1] = false;
      core.shuffle_hand_check[0] = false;
      core.shuffle_hand_check[1] = false;
    }
    arg.shuffle_check_was_disabled = core.shuffle_check_disabled;
    core.shuffle_check_disabled = false;
    core.check_level += 1;
  }

  core.reason_effect = triggeringEffect;
  core.reason_player = triggeringPlayer;
  const count = lua?.parameters?.length ?? 0;
  const yieldValue = { value: 0 };
  const result = lua?.call_coroutine
    ? lua.call_coroutine(triggeringEffect.target, count, yieldValue, step)
    : undefined;
  returns.set(0, Number.isFinite(yieldValue.value) ? Math.trunc(yieldValue.value) : 0);
  if (result !== COROUTINE_YIELD) {
    core.reason_effect = null;
    core.reason_player = PLAYER_NONE;
    core.check_level = Math.max(0, core.check_level - 1);
    if (core.check_level === 0) {
      if (core.shuffle_hand_check[0]) context.shuffle(0, LOCATION_HAND);
      if (core.shuffle_hand_check[1]) context.shuffle(1, LOCATION_HAND);
      if (core.shuffle_deck_check[0]) context.shuffle(0, LOCATION_DECK);
      if (core.shuffle_deck_check[1]) context.shuffle(1, LOCATION_DECK);
    }
    core.shuffle_check_disabled = arg.shuffle_check_was_disabled;
    if (Array.isArray(core.solving_event) && core.solving_event.length) core.solving_event.shift();
    return true;
  }

  return false;
}

module.exports = processExecuteTarget;
