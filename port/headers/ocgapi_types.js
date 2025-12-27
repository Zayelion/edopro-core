// Implements ocgapi_types.h
/**
 * Defines the structural types shared with the OCG API.
 */
class DuelOptions {
  /**
   * @param {object} [params]
   * @param {number} [params.seed=0]
   * @param {number} [params.flag=0]
   */
  constructor({ seed = 0, flag = 0 } = {}) {
    this.seed = seed;
    this.flag = flag;
  }
}

/**
 * Represents initialization information for a duel player.
 */
class PlayerInfo {
  /**
   * @param {object} [params]
   * @param {number} [params.lifePoints=8000]
   * @param {number} [params.startCount=0]
   * @param {number} [params.drawCount=0]
   */
  constructor({ lifePoints = 8000, startCount = 0, drawCount = 0 } = {}) {
    this.lifePoints = lifePoints;
    this.startCount = startCount;
    this.drawCount = drawCount;
  }
}

module.exports = {
  DuelOptions,
  PlayerInfo,
};
