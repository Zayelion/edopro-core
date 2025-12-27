// Implements interpreter.h
/**
 * Encapsulates the Lua interpreter bridge used by the duel engine.
 */
class Interpreter {
  /**
   * @param {object} [params] configuration options
   * @param {object} [params.state={}] initial interpreter state
   */
  constructor({ state = {} } = {}) {
    this.state = state;
    this.loadedLibraries = new Set();
  }
}

module.exports = { Interpreter };
