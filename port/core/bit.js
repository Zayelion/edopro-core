// Implements bit.h

/**
 * Utility container for bitwise flags used across the duel engine.
 */
class BitMask {
  /**
   * @param {number} [value=0] Initial mask value.
   */
  constructor(value = 0) {
    this.value = value;
  }

  /**
   * Combines the provided flag with the current mask.
   * @param {number} flag Bit flag to enable.
   * @returns {void}
   */
  enable(flag) {
    this.value |= flag;
  }

  /**
   * Clears the provided flag from the current mask.
   * @param {number} flag Bit flag to disable.
   * @returns {void}
   */
  disable(flag) {
    this.value &= ~flag;
  }

  /**
   * Checks whether the provided flag is present in the mask.
   * @param {number} flag Bit flag to test.
   * @returns {boolean} True when the flag is present.
   */
  has(flag) {
    return (this.value & flag) === flag;
  }
}

module.exports = { BitMask };
