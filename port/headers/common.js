// Implements common.h
/**
 * Captures constants shared across the duel engine.
 */
class CommonConstants {
  constructor() {
    this.TRUE = 1;
    this.FALSE = 0;
    this.LOCATION_FZONE = 0x100;
    this.LOCATION_PZONE = 0x200;
    this.LOCATION_STZONE = 0x400;
    this.LOCATION_MMZONE = 0x800;
    this.LOCATION_EMZONE = 0x1000;
    this.LOCATION_DECKBOT = 0x10001;
    this.LOCATION_DECKSHF = 0x20001;
    this.COIN_HEADS = 1;
    this.COIN_TAILS = 0;
    this.NO_FLIP_EFFECT = 0x10000;
    this.PLAYER_SELFDES = 5;
    this.ActivityType = {
      ACTIVITY_SUMMON: 1,
      ACTIVITY_NORMALSUMMON: 2,
      ACTIVITY_SPSUMMON: 3,
      ACTIVITY_FLIPSUMMON: 4,
      ACTIVITY_ATTACK: 5,
      ACTIVITY_BATTLE_PHASE: 6,
      ACTIVITY_CHAIN: 7,
    };
  }
}

module.exports = { CommonConstants };
