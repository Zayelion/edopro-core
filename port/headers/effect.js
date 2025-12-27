// Implements effect.h
/**
 * Models an effect instance applied to cards or duels.
 */
class Effect {
  /**
   * @param {object} [params] effect setup data
   * @param {number} [params.code=0] effect identifier
   * @param {number} [params.range=0] zones the effect applies to
   * @param {number} [params.type=0] effect category flags
   */
  constructor({ code = 0, range = 0, type = 0 } = {}) {
    this.code = code;
    this.range = range;
    this.type = type;
    this.handler = null;
    this.label = null;
    this.resetCount = 0;
  }
}

module.exports = { Effect };
