// Implements function_array_helper.h

/**
 * Utility for storing a fixed number of callback references.
 */
class FunctionArrayHelper {
  /**
   * @param {number} [capacity=0] maximum number of entries
   */
  constructor(capacity = 0) {
    this.capacity = capacity;
    this.items = Array.from({ length: capacity });
  }

  /**
   * Assigns a callback to a specific index.
   * @param {number} index index to assign
   * @param {Function} fn callback to store
   * @returns {void}
   */
  set(index, fn) {
    this.items[index] = fn;
  }

  /**
   * Retrieves a callback from a specific index.
   * @param {number} index index to retrieve
   * @returns {Function|undefined}
   */
  get(index) {
    return this.items[index];
  }
}

module.exports = { FunctionArrayHelper };
