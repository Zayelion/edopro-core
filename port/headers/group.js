// Implements group.h
/**
 * Represents a logical group of cards.
 */
class Group {
  /**
   * @param {Array<import('./card').Card>} [cards=[]] initial card members
   */
  constructor(cards = []) {
    this.cards = cards;
  }

  /**
   * @param {import('./card').Card} card card to include
   */
  add(card) {
    this.cards.push(card);
  }
}

module.exports = { Group };
