// Implements card.cpp

/**
 * High-level representation of a card instance within a duel.
 * Mirrors the minimal scaffolding defined in duel.cpp for allocations.
 */
class Card {
  /**
   * @param {import('./duel').Duel} duel Owning duel instance.
   */
  constructor(duel) {
    this.duel = duel;
    this.data = null;
    this.assume = new Set();
  }
}

/**
 * Placeholder stub mirroring the responsibilities of card.cpp in the C++ source.
 * Implement card-related helpers and behaviors when porting the engine.
 * @returns {void}
 */
function cardCpp() {}

module.exports = { Card, cardCpp };
