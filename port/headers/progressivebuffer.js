// Implements progressivebuffer.h
/**
 * ProgressiveBuffer accumulates serialized data for network or replay output.
 */
class ProgressiveBuffer {
  /**
   * @param {number} [blockSize=0] preferred block size when flushing
   */
  constructor(blockSize = 0) {
    this.blockSize = blockSize;
    this.buffer = [];
  }

  /**
   * @param {number} value byte value to append
   */
  push(value) {
    this.buffer.push(value);
  }
}

module.exports = { ProgressiveBuffer };
