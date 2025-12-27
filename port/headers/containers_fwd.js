// Implements containers_fwd.h
/**
 * Lightweight registry describing forward-declared container types.
 */
class ContainersForward {
  constructor() {
    this.registered = new Map();
  }

  /**
   * @param {string} name container identifier
   * @param {Function} ctor constructor reference
   */
  add(name, ctor) {
    this.registered.set(name, ctor);
  }

  /**
   * @param {string} name container identifier
   * @returns {Function|undefined} previously registered constructor
   */
  get(name) {
    return this.registered.get(name);
  }
}

module.exports = { ContainersForward };
