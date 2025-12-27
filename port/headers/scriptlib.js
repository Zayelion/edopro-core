// Implements scriptlib.h
/**
 * Represents the scripting library exposed to Lua scripts.
 */
class ScriptLib {
  constructor() {
    this.registered = new Map();
  }

  /**
   * @param {string} name global function name
   * @param {Function} fn implementation reference
   */
  add(name, fn) {
    this.registered.set(name, fn);
  }
}

module.exports = { ScriptLib };
