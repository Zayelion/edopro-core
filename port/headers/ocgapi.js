// Implements ocgapi.h
/**
 * Entry point for the OCG API facade.
 */
class OcgApi {
  /**
   * @param {object} [bridge] optional bridge to native bindings
   */
  constructor(bridge = null) {
    this.bridge = bridge;
  }
}

module.exports = { OcgApi };
