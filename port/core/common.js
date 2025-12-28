// Implements common.cpp equivalents.

/**
 * Represents boolean true in numeric form for interoperability with the native engine semantics.
 * @type {number}
 */
const TRUE = 1;

/**
 * Represents boolean false in numeric form for interoperability with the native engine semantics.
 * @type {number}
 */
const FALSE = 0;

/**
 * Symbolic locations mirrored from the native engine.
 */
const SYMBOLIC_LOCATIONS = {
  LOCATION_FZONE: 0x100,
  LOCATION_PZONE: 0x200,
  LOCATION_STZONE: 0x400,
  LOCATION_MMZONE: 0x800,
  LOCATION_EMZONE: 0x1000,
};

/**
 * Location redirect helpers.
 */
const LOCATION_REDIRECT = {
  LOCATION_DECKBOT: 0x10001,
  LOCATION_DECKSHF: 0x20001,
};

/**
 * Coin flip results mapped to numeric identifiers.
 */
const COIN_RESULTS = {
  COIN_HEADS: 1,
  COIN_TAILS: 0,
};

/**
 * Flip effect flags.
 */
const FLIP_EFFECT_FLAGS = {
  NO_FLIP_EFFECT: 0x10000,
};

/**
 * Player identifiers.
 */
const PLAYERS = {
  PLAYER_SELFDES: 5,
};

/**
 * Activity types matched to the native ActivityType enum.
 */
const ACTIVITY_TYPES = {
  ACTIVITY_SUMMON: 1,
  ACTIVITY_NORMALSUMMON: 2,
  ACTIVITY_SPSUMMON: 3,
  ACTIVITY_FLIPSUMMON: 4,
  ACTIVITY_ATTACK: 5,
  ACTIVITY_BATTLE_PHASE: 6,
  ACTIVITY_CHAIN: 7,
};

/**
 * Captures constants shared across the duel engine.
 */
class CommonConstants {
  constructor() {
    this.TRUE = TRUE;
    this.FALSE = FALSE;
    this.LOCATION_FZONE = SYMBOLIC_LOCATIONS.LOCATION_FZONE;
    this.LOCATION_PZONE = SYMBOLIC_LOCATIONS.LOCATION_PZONE;
    this.LOCATION_STZONE = SYMBOLIC_LOCATIONS.LOCATION_STZONE;
    this.LOCATION_MMZONE = SYMBOLIC_LOCATIONS.LOCATION_MMZONE;
    this.LOCATION_EMZONE = SYMBOLIC_LOCATIONS.LOCATION_EMZONE;
    this.LOCATION_DECKBOT = LOCATION_REDIRECT.LOCATION_DECKBOT;
    this.LOCATION_DECKSHF = LOCATION_REDIRECT.LOCATION_DECKSHF;
    this.COIN_HEADS = COIN_RESULTS.COIN_HEADS;
    this.COIN_TAILS = COIN_RESULTS.COIN_TAILS;
    this.NO_FLIP_EFFECT = FLIP_EFFECT_FLAGS.NO_FLIP_EFFECT;
    this.PLAYER_SELFDES = PLAYERS.PLAYER_SELFDES;
    this.ActivityType = { ...ACTIVITY_TYPES };
  }
}

/**
 * Signals that execution reached an unreachable branch.
 * @returns {never}
 */
function unreachable() {
  throw new Error('Unreachable execution path');
}

/**
 * Asserts that the provided condition is true and mirrors the native Assume macro.
 * @param {boolean} condition Condition expected to hold.
 * @returns {void}
 */
function assume(condition) {
  if (condition) return;
  unreachable();
}

module.exports = {
  TRUE,
  FALSE,
  SYMBOLIC_LOCATIONS,
  LOCATION_REDIRECT,
  COIN_RESULTS,
  FLIP_EFFECT_FLAGS,
  PLAYERS,
  ACTIVITY_TYPES,
  CommonConstants,
  assume,
  unreachable,
};
