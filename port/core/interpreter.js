// Implements interpreter.cpp

/**
 * Lightweight interpreter placeholder used for bookkeeping hooks.
 */
class Interpreter {
  /**
   * @param {import('./duel').Duel} duel Owning duel instance.
   * @param {object} options Interpreter options.
   */
  constructor(duel, options) {
    this.duel = duel;
    this.options = options;
    this.registeredCards = new Set();
    this.registeredEffects = new Set();
  }

  /**
   * Registers a card with the interpreter.
   * @param {import('./card').Card} card Card to register.
   */
  register_card(card) {
    this.registeredCards.add(card);
  }

  /**
   * Registers an effect with the interpreter.
   * @param {import('./effect').Effect} effect Effect to register.
   */
  register_effect(effect) {
    this.registeredEffects.add(effect);
  }

  /**
   * Unregisters an effect from the interpreter.
   * @param {import('./effect').Effect} effect Effect to unregister.
   */
  unregister_effect(effect) {
    this.registeredEffects.delete(effect);
  }

  /**
   * Triggers a garbage collection pass.
   * @param {boolean} [full=false] Whether to force a full collection cycle.
   */
  collect(full = false) { // eslint-disable-line no-unused-vars
    // No-op placeholder to mirror the C++ API.
  }
}

/**
 * Placeholder stub for interpreter.cpp for future interpreter behaviors in the port.
 * @returns {void}
 */
function interpreterCpp() {}

module.exports = { Interpreter, interpreterCpp };
