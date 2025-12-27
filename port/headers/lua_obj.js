// Implements lua_obj.h
/**
 * Base class mirroring the Lua object helper used to expose engine objects.
 */
class LuaObj {
  /**
   * @param {string} [typeName=""] textual type identifier
   */
  constructor(typeName = "") {
    this.typeName = typeName;
    this.references = new Set();
  }
}

module.exports = { LuaObj };
