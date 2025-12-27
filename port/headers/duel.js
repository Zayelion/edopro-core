// Implements duel.h
/**
 * Represents a duel session including participating players and state.
 */
class Duel {
  /**
   * @param {object} [params] initialization data
   * @param {number} [params.seed=0] RNG seed
   * @param {Array<object>} [params.players=[]] player metadata
   */
  constructor({ seed = 0, players = [] } = {}) {
    this.seed = seed;
    this.players = players;
    this.turnCount = 0;
    this.phase = null;
    this.fields = [];
  }
}

module.exports = { Duel };
