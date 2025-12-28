// Implements effect.cpp

const {
  EFFECT_STATUS,
  EFFECT_COUNT_CODE,
  RESET_FLAGS,
  EFFECT_TYPES,
  EFFECT_FLAGS,
  EFFECT_FLAGS2,
  EFFECT_CODES,
  EFFECT_EVENTS,
} = require('../headers/effect_constants');
const { PLAYERS } = require('./card');

const FLAG_SLOTS = 2;

/**
 * Represents a single effect instance translated from the C++ engine.
 */
class Effect {
  /**
   * @param {import('./duel')} duel Owning duel instance reference.
   */
  constructor(duel) {
    this.duel = duel;
    this.countLimit = 0;
    this.countLimitMax = 0;
    this.countFlag = 0;
    this.countHoptIndex = 0;
    this.effectOwner = PLAYERS.PLAYER_NONE;
    this.type = 0;
    this.copyId = 0;
    this.range = 0;
    this.sRange = 0;
    this.oRange = 0;
    this.resetCount = 0;
    this.activeLocation = 0;
    this.activeSequence = 0;
    this.status = 0;
    this.code = 0;
    this.flag = Array.from({ length: FLAG_SLOTS }, () => 0);
    this.id = 0;
    this.initialId = 0;
    this.resetFlag = 0;
    this.countCode = 0;
    this.category = 0;
    this.hintTiming = [0, 0];
    this.cardType = 0;
    this.activeType = 0;
    this.labelObject = undefined;
    this.condition = undefined;
    this.cost = undefined;
    this.target = undefined;
    this.value = undefined;
    this.operation = undefined;
    this.owner = undefined;
    this.handler = undefined;
    this.activeHandler = undefined;
    this.description = 0n;
    this.label = [];
  }

  /**
   * Checks whether a primary flag is set.
   * @param {number} flagToCheck Flag bitmask.
   * @param {number} [slot=0] Which internal flag slot to check.
   * @returns {boolean} True when the flag is present.
   */
  isFlag(flagToCheck, slot = 0) {
    if (slot < 0 || slot >= FLAG_SLOTS) return false;
    return (this.flag[slot] & flagToCheck) !== 0;
  }

  /**
   * Sets a flag bit in the desired slot.
   * @param {number} flagToSet Flag bitmask to enable.
   * @param {number} [slot=0] Slot index to mutate.
   * @returns {void}
   */
  setFlag(flagToSet, slot = 0) {
    if (slot < 0 || slot >= FLAG_SLOTS) return;
    this.flag[slot] |= flagToSet;
  }

  /**
   * Determines if the effect is related to disable checks.
   * @returns {boolean} True when the effect disables or prevents disabling.
   */
  isDisableRelated() {
    if (this.code === EFFECT_CODES.EFFECT_IMMUNE_EFFECT) return true;
    if (this.code === EFFECT_CODES.EFFECT_DISABLE) return true;
    if (this.code === EFFECT_CODES.EFFECT_CANNOT_DISABLE) return true;
    if (this.code === EFFECT_CODES.EFFECT_FORBIDDEN) return true;
    return false;
  }

  /**
   * Determines if the effect is responsible for self-destruction logic.
   * @returns {boolean} True when the effect self-destroys.
   */
  isSelfDestroyRelated() {
    if (this.code === EFFECT_CODES.EFFECT_UNIQUE_CHECK) return true;
    if (this.code === EFFECT_CODES.EFFECT_SELF_DESTROY) return true;
    if (this.code === EFFECT_CODES.EFFECT_SELF_TOGRAVE) return true;
    return false;
  }

  /**
   * Determines whether the effect can be forbidden by other effects.
   * @returns {boolean} True when the effect is allowed to be forbidden.
   */
  isCanBeForbidden() {
    const counterType = this.code & 0xf0000;
    if (this.isFlag(EFFECT_FLAGS.EFFECT_FLAG_CANNOT_DISABLE) && !this.isFlag(EFFECT_FLAGS.EFFECT_FLAG_CANNOT_NEGATE)) return false;
    if (this.code === EFFECT_CODES.EFFECT_CHANGE_CODE) return false;
    if (counterType === EFFECT_CODES.EFFECT_COUNTER_PERMIT) return false;
    if (counterType === EFFECT_CODES.EFFECT_COUNTER_LIMIT) return false;
    return true;
  }

  /**
   * Checks whether the effect currently respects its count limit.
   * @param {number} playerId Target player identifier.
   * @returns {boolean} True when the effect can still be activated.
   */
  checkCountLimit(playerId) {
    if (!this.isFlag(EFFECT_FLAGS.EFFECT_FLAG_COUNT_LIMIT)) return true;
    if (this.countLimit <= 0) return false;
    if (!this.countCode && !this.countFlag) return true;
    if (this.countFlag === EFFECT_COUNT_CODE.EFFECT_COUNT_CODE_SINGLE) return this.countLimit > 0;
    if (playerId !== PLAYERS.PLAYER_NONE) return this.countLimit > 0;
    return this.countLimit > 0;
  }

  /**
   * Reduces the count limit after an activation.
   * @returns {void}
   */
  decCount() {
    if (this.countLimit <= 0) return;
    this.countLimit -= 1;
  }

  /**
   * Increases the count limit bookkeeping.
   * @returns {void}
   */
  incCount() {
    this.countLimit += 1;
    if (this.countLimitMax >= this.countLimit) return;
    this.countLimitMax = this.countLimit;
  }

  /**
   * Resets the remaining count to the maximum tracked value.
   * @returns {void}
   */
  recharge() {
    this.countLimit = this.countLimitMax;
  }

  /**
   * Marks the effect as currently available.
   * @returns {void}
   */
  setAvailable() {
    this.status |= EFFECT_STATUS.EFFECT_STATUS_AVAILABLE;
  }

  /**
   * Clears the available status flag.
   * @returns {void}
   */
  clearAvailable() {
    this.status &= ~EFFECT_STATUS.EFFECT_STATUS_AVAILABLE;
  }

  /**
   * Determines if the effect currently has an available status flag.
   * @returns {boolean} True when available.
   */
  isAvailable() {
    return (this.status & EFFECT_STATUS.EFFECT_STATUS_AVAILABLE) !== 0;
  }

  /**
   * Retrieves the owning player identifier.
   * @returns {number} Player constant.
   */
  getOwnerPlayer() {
    return this.effectOwner;
  }

  /**
   * Retrieves the owning card reference.
   * @returns {object|undefined} Card that owns the effect.
   */
  getOwner() {
    return this.owner;
  }

  /**
   * Retrieves the handler card reference.
   * @returns {object|undefined} Card handling the effect.
   */
  getHandler() {
    return this.handler;
  }

  /**
   * Returns a shallow clone of this effect suitable for independent bookkeeping.
   * @returns {Effect} Cloned effect instance.
   */
  clone() {
    const copy = new Effect(this.duel);
    copy.countLimit = this.countLimit;
    copy.countLimitMax = this.countLimitMax;
    copy.countFlag = this.countFlag;
    copy.countHoptIndex = this.countHoptIndex;
    copy.effectOwner = this.effectOwner;
    copy.type = this.type;
    copy.copyId = this.copyId;
    copy.range = this.range;
    copy.sRange = this.sRange;
    copy.oRange = this.oRange;
    copy.resetCount = this.resetCount;
    copy.activeLocation = this.activeLocation;
    copy.activeSequence = this.activeSequence;
    copy.status = this.status;
    copy.code = this.code;
    copy.flag = [...this.flag];
    copy.id = this.id;
    copy.initialId = this.initialId;
    copy.resetFlag = this.resetFlag;
    copy.countCode = this.countCode;
    copy.category = this.category;
    copy.hintTiming = [...this.hintTiming];
    copy.cardType = this.cardType;
    copy.activeType = this.activeType;
    copy.labelObject = this.labelObject;
    copy.condition = this.condition;
    copy.cost = this.cost;
    copy.target = this.target;
    copy.value = this.value;
    copy.operation = this.operation;
    copy.owner = this.owner;
    copy.handler = this.handler;
    copy.activeHandler = this.activeHandler;
    copy.description = this.description;
    copy.label = [...this.label];
    return copy;
  }
}

/**
 * Placeholder stub for effect.cpp to track effect handling in the JavaScript port.
 * @returns {{Effect: typeof Effect, EFFECT_STATUS: typeof EFFECT_STATUS, EFFECT_TYPES: typeof EFFECT_TYPES, EFFECT_FLAGS: typeof EFFECT_FLAGS, EFFECT_FLAGS2: typeof EFFECT_FLAGS2, EFFECT_CODES: typeof EFFECT_CODES, EFFECT_EVENTS: typeof EFFECT_EVENTS, RESET_FLAGS: typeof RESET_FLAGS, EFFECT_COUNT_CODE: typeof EFFECT_COUNT_CODE}} Exposed effect helpers.
 */
function effectCpp() {
  return {
    Effect,
    EFFECT_STATUS,
    EFFECT_TYPES,
    EFFECT_FLAGS,
    EFFECT_FLAGS2,
    EFFECT_CODES,
    EFFECT_EVENTS,
    RESET_FLAGS,
    EFFECT_COUNT_CODE,
  };
}

module.exports = { Effect, effectCpp };
