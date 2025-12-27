// Implements field.h
/**
 * Represents a duel field with zones for each player.
 */
class Field {
  /**
   * @param {object} [params] field initialization
   * @param {Array<Array<import('./card').Card>>} [params.monsterZones=[]] monster zone layout per player
   * @param {Array<Array<import('./card').Card>>} [params.spellZones=[]] spell/trap zone layout per player
   */
  constructor({ monsterZones = [], spellZones = [] } = {}) {
    this.monsterZones = monsterZones;
    this.spellZones = spellZones;
    this.graveyards = [];
    this.removed = [];
  }
}

module.exports = { Field };
