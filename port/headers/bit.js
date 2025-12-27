// Implements bit.h
/**
 * Utility container for bitwise flags used across the duel engine.
 */
class BitMask {
  /**
   * @param {number} [value=0] initial mask value
   */
  constructor(value = 0) {
    this.value = value;
  }

  /**
   * @param {number} flag bit flag to combine with the mask
   */
  enable(flag) {
    this.value |= flag;
  }

  /**
   * @param {number} flag bit flag to clear from the mask
   */
  disable(flag) {
    this.value &= ~flag;
  }

  /**
   * @param {number} flag bit flag to test
   * @returns {boolean} true when the flag is present
   */
  has(flag) {
    return (this.value & flag) === flag;
  }
}

module.exports = { BitMask };
