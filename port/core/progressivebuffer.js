// Implements progressivebuffer.h

/**
 * ProgressiveBuffer accumulates serialized data for network or replay output.
 */
class ProgressiveBuffer {
  /**
   * @param {number} [blockSize=0] Preferred block size when flushing.
   */
  constructor(blockSize = 0) {
    this.blockSize = blockSize;
    this.buffer = [];
  }

  /**
   * Appends a byte value to the buffer.
   * @param {number} value Byte value to append.
   * @returns {void}
   */
  push(value) {
    this.buffer.push(value);
  }
}

module.exports = { ProgressiveBuffer };
