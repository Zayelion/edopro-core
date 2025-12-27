// Implements effect_constants.h
/**
 * Provides the constants that describe effect categories and flags.
 */
class EffectConstants {
  constructor() {
    this.EFFECT_TYPE_SINGLE = 0x0001;
    this.EFFECT_TYPE_FIELD = 0x0002;
    this.EFFECT_TYPE_EQUIP = 0x0004;
    this.EFFECT_TYPE_ACTIONS = 0x0008;
    this.EFFECT_TYPE_ACTIVATE = 0x0010;
    this.EFFECT_FLAG_PLAYER_TARGET = 0x0001;
    this.EFFECT_FLAG_CARD_TARGET = 0x0002;
  }
}

module.exports = { EffectConstants };
