// Implements ocgapi.cpp

/**
 * Captures constants mirrored from ocgapi_constants.h for JavaScript consumers.
 */
class OcgApiConstants {
  constructor() {
    this.CORE_VERSION = 0;
    this.PROTO_VERSION = 0;
  }
}

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

/**
 * Entry point for the OCG API facade.
 */
class OcgApi {
  /**
   * @param {object|undefined} [bridge] Optional bridge to native bindings.
   */
  constructor(bridge) {
    this.bridge = bridge;
  }
}

/**
 * Placeholder stub for ocgapi.cpp wrapping the core public API surface.
 * Introduce JavaScript equivalents of the native API calls here in the future.
 * @returns {void}
 */
function ocgapiCpp() {}

module.exports = {
  OcgApiConstants,
  DuelOptions,
  PlayerInfo,
  OcgApi,
  ocgapiCpp,
};
