// Implements function_array_helper.h
/**
 * Provides helpers for storing callbacks in fixed-size arrays.
 */
class FunctionArrayHelper {
  /**
   * @param {number} [capacity=0] maximum number of entries
   */
  constructor(capacity = 0) {
    this.capacity = capacity;
    this.items = new Array(capacity).fill(null);
  }

  /**
   * @param {number} index index to assign
   * @param {Function} fn callback to store
   */
  set(index, fn) {
    this.items[index] = fn;
  }

  /**
   * @param {number} index index to retrieve
   * @returns {Function|null}
   */
  get(index) {
    return this.items[index] ?? null;
  }
}

module.exports = { FunctionArrayHelper };
