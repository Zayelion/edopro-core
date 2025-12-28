// Implements libeffect.cpp
const {
  Effect,
  EFFECT_FLAGS,
  EFFECT_FLAGS2,
  EFFECT_TYPES,
  EFFECT_CODES,
  RESET_FLAGS,
  EFFECT_COUNT_CODE,
} = require('./effect');
const { ScriptLib, checkParamCount, isDeletedObject } = require('./scriptlib');
const { CARD_LOCATIONS } = require('./card');

/**
 * Ensures the provided value is an Effect instance.
 * @param {unknown} candidate Potential effect value.
 * @returns {Effect} Validated effect instance.
 * @throws {TypeError} When the value is not an Effect.
 */
const requireEffect = (candidate) => {
  if (candidate instanceof Effect) return candidate;
  throw new TypeError('Expected Effect instance for effect library operation');
};

/**
 * Creates a duel-bound effect owned by the provided card.
 * @param {object} card Card that will own the effect.
 * @returns {Effect} Newly created effect instance.
 */
const createEffect = (card) => {
  checkParamCount(arguments, 1);
  const ownerCard = card;
  const duel = ownerCard?.duel;
  if (!duel) throw new Error('Cannot create effect without duel context');
  const effect = duel.new_effect();
  const field = duel.game_field;
  const reasonPlayer = field?.core?.reason_player ?? 0;
  effect.effectOwner = reasonPlayer;
  effect.owner = ownerCard;
  return effect;
};

/**
 * Creates a duel-bound effect owned by the temporary global card proxy.
 * @param {import('./duel').Duel} duel Duel reference used to allocate the effect.
 * @returns {Effect} Newly created global effect instance.
 */
const globalEffect = (duel) => {
  checkParamCount(arguments, 1);
  if (!duel) throw new Error('Cannot create global effect without duel context');
  const effect = duel.new_effect();
  effect.effectOwner = 0;
  effect.owner = duel.game_field?.temp_card;
  return effect;
};

/**
 * Produces a shallow clone of the provided effect.
 * @param {Effect} effect Effect to clone.
 * @returns {Effect} Cloned effect instance.
 */
const clone = (effect) => {
  const target = requireEffect(effect);
  return target.clone();
};

/**
 * Resets an effect by detaching it from its owner and handler references.
 * @param {Effect} effect Effect to reset.
 * @returns {void}
 */
const reset = (effect) => {
  const target = requireEffect(effect);
  if (!target.owner) return;
  target.owner = undefined;
  if (target.handler) target.handler = undefined;
};

/**
 * Retrieves the unique field identifier of an effect.
 * @param {Effect} effect Effect being queried.
 * @returns {number} Field identifier.
 */
const getFieldId = (effect) => requireEffect(effect).id;

/**
 * Assigns a human-readable description id to the effect.
 * @param {Effect} effect Effect being modified.
 * @param {number|bigint} description Description identifier.
 * @returns {void}
 */
const setDescription = (effect, description) => {
  checkParamCount(arguments, 2);
  const target = requireEffect(effect);
  target.description = BigInt(description);
};

/**
 * Assigns an engine code to the effect.
 * @param {Effect} effect Effect being modified.
 * @param {number} code Code value.
 * @returns {void}
 */
const setCode = (effect, code) => {
  checkParamCount(arguments, 2);
  const target = requireEffect(effect);
  target.code = code;
};

/**
 * Defines the activation range for the effect.
 * @param {Effect} effect Effect being modified.
 * @param {number} range Range mask to store.
 * @returns {void}
 */
const setRange = (effect, range) => {
  checkParamCount(arguments, 2);
  const target = requireEffect(effect);
  target.range = range;
  if ((range & (CARD_LOCATIONS.LOCATION_MZONE | CARD_LOCATIONS.LOCATION_SZONE)) === (CARD_LOCATIONS.LOCATION_MZONE | CARD_LOCATIONS.LOCATION_SZONE)) target.range = CARD_LOCATIONS.LOCATION_ONFIELD;
};

/**
 * Sets target ranges for self and opponent relative locations.
 * @param {Effect} effect Effect being modified.
 * @param {number} selfRange Range for the effect owner.
 * @param {number} opponentRange Range for the opponent.
 * @returns {void}
 */
const setTargetRange = (effect, selfRange, opponentRange) => {
  checkParamCount(arguments, 3);
  const target = requireEffect(effect);
  target.sRange = selfRange;
  target.oRange = opponentRange;
  target.flag[0] &= ~EFFECT_FLAGS.EFFECT_FLAG_ABSOLUTE_TARGET;
};

/**
 * Applies absolute ranges respecting an owning player perspective.
 * @param {Effect} effect Effect being modified.
 * @param {number} playerId Player choosing the absolute perspective.
 * @param {number} selfRange Range for the acting player.
 * @param {number} opponentRange Range for the opponent.
 * @returns {void}
 */
const setAbsoluteRange = (effect, playerId, selfRange, opponentRange) => {
  checkParamCount(arguments, 4);
  const target = requireEffect(effect);
  if (playerId === 0) {
    target.sRange = selfRange;
    target.oRange = opponentRange;
  }
  if (playerId !== 0) {
    target.sRange = opponentRange;
    target.oRange = selfRange;
  }
  target.flag[0] |= EFFECT_FLAGS.EFFECT_FLAG_ABSOLUTE_TARGET;
};

/**
 * Sets the count limit and associated flags for an effect.
 * @param {Effect} effect Effect being modified.
 * @param {number} count Maximum activation count.
 * @param {number|undefined} code Optional count code marker.
 * @param {number} flag Optional flag bitmask.
 * @returns {void}
 */
const setCountLimit = (effect, count, code, flag = 0) => {
  checkParamCount(arguments, 2);
  if (count === 0) throw new Error('The count must not be 0');
  const target = requireEffect(effect);
  const resolvedFlag = flag;
  target.flag[0] |= EFFECT_FLAGS.EFFECT_FLAG_COUNT_LIMIT;
  target.countLimit = count;
  target.countLimitMax = count;
  target.countCode = code ?? 0;
  target.countFlag = resolvedFlag;
};

/**
 * Configures reset flags and counter values.
 * @param {Effect} effect Effect being modified.
 * @param {number} resetFlags Reset bitmask.
 * @param {number} [count=1] Number of resets to permit.
 * @returns {void}
 */
const setReset = (effect, resetFlags, count = 1) => {
  checkParamCount(arguments, 2);
  const target = requireEffect(effect);
  let adjustedFlags = resetFlags;
  if (adjustedFlags & RESET_FLAGS.RESET_PHASE) adjustedFlags |= RESET_FLAGS.RESET_SELF_TURN | RESET_FLAGS.RESET_OPPO_TURN;
  target.resetFlag = adjustedFlags;
  target.resetCount = count || 1;
};

/**
 * Assigns the effect type flags while updating related range defaults.
 * @param {Effect} effect Effect being modified.
 * @param {number} typeMask Type mask to apply.
 * @returns {void}
 */
const setType = (effect, typeMask) => {
  checkParamCount(arguments, 2);
  const target = requireEffect(effect);
  let applied = typeMask;
  if (applied & 0x0ff0) applied |= EFFECT_TYPES.EFFECT_TYPE_ACTIONS;
  if (!(applied & 0x0ff0)) applied &= ~EFFECT_TYPES.EFFECT_TYPE_ACTIONS;
  if (applied & (EFFECT_TYPES.EFFECT_TYPE_ACTIVATE | EFFECT_TYPES.EFFECT_TYPE_IGNITION | EFFECT_TYPES.EFFECT_TYPE_QUICK_O | EFFECT_TYPES.EFFECT_TYPE_QUICK_F)) applied |= EFFECT_TYPES.EFFECT_TYPE_FIELD;
  if (applied & EFFECT_TYPES.EFFECT_TYPE_ACTIVATE) target.range = CARD_LOCATIONS.LOCATION_SZONE + CARD_LOCATIONS.LOCATION_HAND;
  if (applied & EFFECT_TYPES.EFFECT_TYPE_FLIP) {
    target.code = EFFECT_CODES.EVENT_FLIP ?? target.code;
    if (!(applied & EFFECT_TYPES.EFFECT_TYPE_TRIGGER_O)) applied |= EFFECT_TYPES.EFFECT_TYPE_TRIGGER_F;
  }
  target.type = applied;
};

/**
 * Stores property flags associated with the effect.
 * @param {Effect} effect Effect being modified.
 * @param {number} primary Primary flag set.
 * @param {number} [secondary=0] Secondary flag set.
 * @returns {void}
 */
const setProperty = (effect, primary, secondary = 0) => {
  checkParamCount(arguments, 2);
  const target = requireEffect(effect);
  target.flag[0] = (target.flag[0] & 0x4f) | (primary & ~0x4f);
  target.flag[1] = secondary;
};

/**
 * Stores arbitrary label data on the effect.
 * @param {Effect} effect Effect being modified.
 * @param {...number|number[]} labels Numeric labels or an array of labels.
 * @returns {void}
 */
const setLabel = (effect, ...labels) => {
  checkParamCount(arguments, 2);
  const target = requireEffect(effect);
  target.label = [];
  const values = Array.isArray(labels[0]) ? labels[0] : labels;
  for (const value of values) {
    target.label.push(Number(value));
  }
};

/**
 * Attaches a label object reference onto the effect.
 * @param {Effect} effect Effect being modified.
 * @param {unknown} object Object to associate or undefined to clear.
 * @returns {void}
 */
const setLabelObject = (effect, object) => {
  checkParamCount(arguments, 2);
  const target = requireEffect(effect);
  if (object === undefined) {
    target.labelObject = undefined;
    return;
  }
  target.labelObject = object;
};

/**
 * Sets the category flags on the effect.
 * @param {Effect} effect Effect being modified.
 * @param {number} category Category mask.
 * @returns {void}
 */
const setCategory = (effect, category) => {
  checkParamCount(arguments, 2);
  const target = requireEffect(effect);
  target.category = category;
};

/**
 * Defines hint timing values for the effect.
 * @param {Effect} effect Effect being modified.
 * @param {number} selfTiming Hint timing for the effect owner.
 * @param {number} opponentTiming Optional opponent timing (defaults to selfTiming).
 * @returns {void}
 */
const setHintTiming = (effect, selfTiming, opponentTiming = selfTiming) => {
  checkParamCount(arguments, 2);
  const target = requireEffect(effect);
  target.hintTiming = [selfTiming, opponentTiming];
};

/**
 * Assigns a condition callback to the effect.
 * @param {Effect} effect Effect being modified.
 * @param {Function} condition Callback function.
 * @returns {void}
 */
const setCondition = (effect, condition) => {
  checkParamCount(arguments, 2);
  const target = requireEffect(effect);
  target.condition = condition;
};

/**
 * Assigns a target selection callback to the effect.
 * @param {Effect} effect Effect being modified.
 * @param {Function} targetSelector Callback function.
 * @returns {void}
 */
const setTarget = (effect, targetSelector) => {
  checkParamCount(arguments, 2);
  const target = requireEffect(effect);
  target.target = targetSelector;
};

/**
 * Assigns a cost callback to the effect.
 * @param {Effect} effect Effect being modified.
 * @param {Function} cost Callback function.
 * @returns {void}
 */
const setCost = (effect, cost) => {
  checkParamCount(arguments, 2);
  const target = requireEffect(effect);
  target.cost = cost;
};

/**
 * Assigns a raw value or callback to the effect.
 * @param {Effect} effect Effect being modified.
 * @param {number|boolean|Function} value Value or evaluator callback.
 * @returns {void}
 */
const setValue = (effect, value) => {
  checkParamCount(arguments, 2);
  const target = requireEffect(effect);
  if (typeof value === 'function') {
    target.flag[0] |= EFFECT_FLAGS.EFFECT_FLAG_FUNC_VALUE;
    target.value = value;
    return;
  }
  target.flag[0] &= ~EFFECT_FLAGS.EFFECT_FLAG_FUNC_VALUE;
  target.value = value;
};

/**
 * Assigns an operation callback to the effect.
 * @param {Effect} effect Effect being modified.
 * @param {Function|undefined} operation Operation function or undefined to clear.
 * @returns {void}
 */
const setOperation = (effect, operation) => {
  checkParamCount(arguments, 2);
  const target = requireEffect(effect);
  target.operation = operation;
};

/**
 * Sets the owning player for the effect.
 * @param {Effect} effect Effect being modified.
 * @param {number} playerId Owner player identifier.
 * @returns {void}
 */
const setOwnerPlayer = (effect, playerId) => {
  const target = requireEffect(effect);
  if (playerId !== 0 && playerId !== 1) return;
  target.effectOwner = playerId;
};

/**
 * Retrieves the description identifier.
 * @param {Effect} effect Effect being queried.
 * @returns {bigint|number} Description identifier.
 */
const getDescription = (effect) => requireEffect(effect).description;

/**
 * Retrieves the code assigned to the effect.
 * @param {Effect} effect Effect being queried.
 * @returns {number} Code value.
 */
const getCode = (effect) => requireEffect(effect).code;

/**
 * Retrieves the activation range mask.
 * @param {Effect} effect Effect being queried.
 * @returns {number} Range value.
 */
const getRange = (effect) => requireEffect(effect).range;

/**
 * Retrieves the target range masks for owner and opponent.
 * @param {Effect} effect Effect being queried.
 * @returns {number[]} Self and opponent range values.
 */
const getTargetRange = (effect) => {
  const target = requireEffect(effect);
  return [target.sRange, target.oRange];
};

/**
 * Retrieves count limit tracking values.
 * @param {Effect} effect Effect being queried.
 * @returns {number[]} Count limit, maximum, code, flag, and HOPT index.
 */
const getCountLimit = (effect) => {
  const target = requireEffect(effect);
  return [target.countLimit, target.countLimitMax, target.countCode, target.countFlag, target.countHoptIndex];
};

/**
 * Retrieves reset flags and count.
 * @param {Effect} effect Effect being queried.
 * @returns {number[]} Reset flag and counter pair.
 */
const getReset = (effect) => {
  const target = requireEffect(effect);
  return [target.resetFlag, target.resetCount];
};

/**
 * Retrieves the effect type mask.
 * @param {Effect} effect Effect being queried.
 * @returns {number} Type mask.
 */
const getType = (effect) => requireEffect(effect).type;

/**
 * Retrieves property flags for the effect.
 * @param {Effect} effect Effect being queried.
 * @returns {number[]} Primary and secondary flags.
 */
const getProperty = (effect) => {
  const target = requireEffect(effect);
  return [target.flag[0], target.flag[1]];
};

/**
 * Retrieves all stored labels.
 * @param {Effect} effect Effect being queried.
 * @returns {number[]} Stored labels.
 */
const getLabel = (effect) => {
  const target = requireEffect(effect);
  if (!target.label.length) return [0];
  return [...target.label];
};

/**
 * Retrieves the label object reference.
 * @param {Effect} effect Effect being queried.
 * @returns {unknown} Label object or undefined.
 */
const getLabelObject = (effect) => requireEffect(effect).labelObject;

/**
 * Retrieves the category mask.
 * @param {Effect} effect Effect being queried.
 * @returns {number} Category mask.
 */
const getCategory = (effect) => requireEffect(effect).category;

/**
 * Retrieves the owning card reference.
 * @param {Effect} effect Effect being queried.
 * @returns {object|undefined} Owner card.
 */
const getOwner = (effect) => requireEffect(effect).getOwner();

/**
 * Retrieves the handler card reference.
 * @param {Effect} effect Effect being queried.
 * @returns {object|undefined} Handler card.
 */
const getHandler = (effect) => requireEffect(effect).getHandler();

/**
 * Retrieves the owning player identifier.
 * @param {Effect} effect Effect being queried.
 * @returns {number} Player identifier.
 */
const getOwnerPlayer = (effect) => requireEffect(effect).getOwnerPlayer();

/**
 * Retrieves the handler player identifier.
 * @param {Effect} effect Effect being queried.
 * @returns {number} Handler controler or zero when unavailable.
 */
const getHandlerPlayer = (effect) => {
  const handler = requireEffect(effect).handler;
  if (!handler?.current) return 0;
  return handler.current.controler ?? 0;
};

/**
 * Retrieves hint timing information.
 * @param {Effect} effect Effect being queried.
 * @returns {number[]} Owner and opponent hint timings.
 */
const getHintTiming = (effect) => [...requireEffect(effect).hintTiming];

/**
 * Retrieves the condition callback.
 * @param {Effect} effect Effect being queried.
 * @returns {Function|undefined} Condition callback.
 */
const getCondition = (effect) => requireEffect(effect).condition;

/**
 * Retrieves the target selection callback.
 * @param {Effect} effect Effect being queried.
 * @returns {Function|undefined} Target callback.
 */
const getTarget = (effect) => requireEffect(effect).target;

/**
 * Retrieves the cost callback.
 * @param {Effect} effect Effect being queried.
 * @returns {Function|undefined} Cost callback.
 */
const getCost = (effect) => requireEffect(effect).cost;

/**
 * Retrieves the value or callback stored on the effect.
 * @param {Effect} effect Effect being queried.
 * @returns {number|boolean|Function|undefined} Stored value.
 */
const getValue = (effect) => requireEffect(effect).value;

/**
 * Retrieves the operation callback.
 * @param {Effect} effect Effect being queried.
 * @returns {Function|undefined} Operation callback.
 */
const getOperation = (effect) => requireEffect(effect).operation;

/**
 * Retrieves the active type mask assigned at runtime.
 * @param {Effect} effect Effect being queried.
 * @returns {number} Active type mask.
 */
const getActiveType = (effect) => requireEffect(effect).activeType;

/**
 * Checks whether the effect is an active type match.
 * @param {Effect} effect Effect being queried.
 * @param {number} typeMask Type mask to test.
 * @returns {boolean} True when any bits overlap.
 */
const isActiveType = (effect, typeMask) => {
  checkParamCount(arguments, 2);
  return (requireEffect(effect).activeType & typeMask) !== 0;
};

/**
 * Checks whether the effect has the supplied property flags.
 * @param {Effect} effect Effect being queried.
 * @param {number} primary Primary mask.
 * @param {number} [secondary=0] Secondary mask.
 * @returns {boolean} True when the flags are present.
 */
const isHasProperty = (effect, primary, secondary = 0) => {
  checkParamCount(arguments, 2);
  const target = requireEffect(effect);
  const matchesPrimary = !primary || (target.flag[0] & primary) !== 0;
  const matchesSecondary = !secondary || (target.flag[1] & secondary) !== 0;
  return matchesPrimary && matchesSecondary;
};

/**
 * Checks whether the effect has the supplied category bits.
 * @param {Effect} effect Effect being queried.
 * @param {number} category Category mask.
 * @returns {boolean} True when any bits overlap.
 */
const isHasCategory = (effect, category) => {
  checkParamCount(arguments, 2);
  return (requireEffect(effect).category & category) !== 0;
};

/**
 * Checks whether the effect has the supplied type bits.
 * @param {Effect} effect Effect being queried.
 * @param {number} typeMask Type mask.
 * @returns {boolean} True when any bits overlap.
 */
const isHasType = (effect, typeMask) => {
  checkParamCount(arguments, 2);
  return (requireEffect(effect).type & typeMask) !== 0;
};

/**
 * Determines whether the effect can be activated by a player.
 * @param {Effect} effect Effect being queried.
 * @param {number} playerId Player identifier.
 * @returns {boolean} True when activation is permitted.
 */
const isActivatable = (effect, playerId) => {
  checkParamCount(arguments, 2);
  return requireEffect(effect).checkCountLimit(playerId);
};

/**
 * Checks whether the effect has been activated.
 * @param {Effect} effect Effect being queried.
 * @returns {boolean} True when the type mask contains activation markers.
 */
const isActivated = (effect) => (requireEffect(effect).type & 0x7f0) !== 0;

/**
 * Retrieves the location used during activation.
 * @param {Effect} effect Effect being queried.
 * @returns {number} Activation location.
 */
const getActivateLocation = (effect) => requireEffect(effect).activeLocation;

/**
 * Retrieves the sequence index used during activation.
 * @param {Effect} effect Effect being queried.
 * @returns {number} Activation sequence.
 */
const getActivateSequence = (effect) => requireEffect(effect).activeSequence;

/**
 * Validates whether the effect still has remaining activations.
 * @param {Effect} effect Effect being queried.
 * @param {number} playerId Player attempting activation.
 * @returns {boolean} True when the count limit permits activation.
 */
const checkCountLimit = (effect, playerId) => {
  checkParamCount(arguments, 2);
  return requireEffect(effect).checkCountLimit(playerId);
};

/**
 * Consumes available count limit entries.
 * @param {Effect} effect Effect being modified.
 * @param {number} playerId Player consuming the count.
 * @param {number} count Number of activations to consume.
 * @param {boolean} [oathOnly=false] Whether to limit consumption to oath-marked counts.
 * @returns {void}
 */
const useCountLimit = (effect, playerId, count = 1, oathOnly = false) => {
  checkParamCount(arguments, 2);
  const target = requireEffect(effect);
  if (oathOnly && !(target.countFlag & EFFECT_COUNT_CODE.EFFECT_COUNT_CODE_OATH)) return;
  let remaining = count;
  while (remaining > 0) {
    target.decCount(playerId);
    remaining -= 1;
  }
};

/**
 * Restores used count limits.
 * @param {Effect} effect Effect being modified.
 * @param {number} playerId Player restoring the count.
 * @param {number} count Number of activations to restore.
 * @param {boolean} [oathOnly=false] Whether to limit restoration to oath-marked counts.
 * @returns {void}
 */
const restoreCountLimit = (effect, playerId, count = 1, oathOnly = false) => {
  checkParamCount(arguments, 2);
  const target = requireEffect(effect);
  if (oathOnly && !(target.countFlag & EFFECT_COUNT_CODE.EFFECT_COUNT_CODE_OATH)) return;
  let remaining = count;
  while (remaining > 0) {
    target.incCount(playerId);
    remaining -= 1;
  }
};

/**
 * Retrieves the provided effect value untouched.
 * @param {Effect} effect Effect reference.
 * @returns {Effect} Same effect instance.
 */
const getLuaRef = (effect) => requireEffect(effect);

/**
 * Identity conversion for effect references.
 * @param {Effect} effect Effect reference.
 * @returns {Effect} Same effect instance.
 */
const fromLuaRef = (effect) => requireEffect(effect);

/**
 * Indicates if the provided value represents a deleted object marker.
 * @param {unknown} value Value to inspect.
 * @returns {boolean} True when the object tracks a deleted Lua reference.
 */
const isDeleted = (value) => isDeletedObject(value);

/**
 * Registers the effect library on the supplied registry.
 * @param {ScriptLib} registry Registry instance or placeholder.
 * @returns {Record<string, Function>} Registered functions for chaining.
 */
function registerEffectLibrary(registry) {
  const library = {
    CreateEffect: createEffect,
    GlobalEffect: globalEffect,
    Clone: clone,
    Reset: reset,
    GetFieldID: getFieldId,
    SetDescription: setDescription,
    SetCode: setCode,
    SetRange: setRange,
    SetTargetRange: setTargetRange,
    SetAbsoluteRange: setAbsoluteRange,
    SetCountLimit: setCountLimit,
    SetReset: setReset,
    SetType: setType,
    SetProperty: setProperty,
    SetLabel: setLabel,
    SetLabelObject: setLabelObject,
    SetCategory: setCategory,
    SetHintTiming: setHintTiming,
    SetCondition: setCondition,
    SetTarget: setTarget,
    SetCost: setCost,
    SetValue: setValue,
    SetOperation: setOperation,
    SetOwnerPlayer: setOwnerPlayer,
    GetDescription: getDescription,
    GetCode: getCode,
    GetRange: getRange,
    GetTargetRange: getTargetRange,
    GetCountLimit: getCountLimit,
    GetReset: getReset,
    GetType: getType,
    GetProperty: getProperty,
    GetLabel: getLabel,
    GetLabelObject: getLabelObject,
    GetCategory: getCategory,
    GetOwner: getOwner,
    GetHandler: getHandler,
    GetOwnerPlayer: getOwnerPlayer,
    GetHandlerPlayer: getHandlerPlayer,
    GetHintTiming: getHintTiming,
    GetCondition: getCondition,
    GetTarget: getTarget,
    GetCost: getCost,
    GetValue: getValue,
    GetOperation: getOperation,
    GetActiveType: getActiveType,
    IsActiveType: isActiveType,
    IsHasProperty: isHasProperty,
    IsHasCategory: isHasCategory,
    IsHasType: isHasType,
    IsActivatable: isActivatable,
    IsActivated: isActivated,
    GetActivateLocation: getActivateLocation,
    GetActivateSequence: getActivateSequence,
    CheckCountLimit: checkCountLimit,
    UseCountLimit: useCountLimit,
    RestoreCountLimit: restoreCountLimit,
    GetLuaRef: getLuaRef,
    FromLuaRef: fromLuaRef,
    IsDeleted: isDeleted,
  };
  if (!(registry instanceof ScriptLib)) return library;
  registry.addLibrary(library);
  return library;
}

module.exports = {
  registerEffectLibrary,
  createEffect,
  globalEffect,
  clone,
  reset,
  getFieldId,
  setDescription,
  setCode,
  setRange,
  setTargetRange,
  setAbsoluteRange,
  setCountLimit,
  setReset,
  setType,
  setProperty,
  setLabel,
  setLabelObject,
  setCategory,
  setHintTiming,
  setCondition,
  setTarget,
  setCost,
  setValue,
  setOperation,
  setOwnerPlayer,
  getDescription,
  getCode,
  getRange,
  getTargetRange,
  getCountLimit,
  getReset,
  getType,
  getProperty,
  getLabel,
  getLabelObject,
  getCategory,
  getOwner,
  getHandler,
  getOwnerPlayer,
  getHandlerPlayer,
  getHintTiming,
  getCondition,
  getTarget,
  getCost,
  getValue,
  getOperation,
  getActiveType,
  isActiveType,
  isHasProperty,
  isHasCategory,
  isHasType,
  isActivatable,
  isActivated,
  getActivateLocation,
  getActivateSequence,
  checkCountLimit,
  useCountLimit,
  restoreCountLimit,
  getLuaRef,
  fromLuaRef,
  isDeleted,
};
