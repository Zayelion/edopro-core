'use strict';

const luaState = require('lua-state');

/**
 * Attempts to build a Lua state instance using the exposed factory helpers.
 * @returns {*} Created Lua state instance when available.
 */
const createLuaState = () => {
  if (typeof luaState === 'function') return luaState();
  if (luaState && typeof luaState.LuaFactory === 'function') {
    const factory = new luaState.LuaFactory();
    if (typeof factory.createEngine === 'function') return factory.createEngine();
    if (typeof factory.createState === 'function') return factory.createState();
  }
  if (luaState && typeof luaState.createState === 'function') return luaState.createState();
  return undefined;
};

/**
 * Wraps the `lua-state` runtime as the port's scripting state engine.
 */
class StateEngine {
  /**
   * Builds a new state engine instance backed by the `lua-state` runtime.
   */
  constructor() {
    this.lua = createLuaState();
    this.loadedScripts = new Map();
  }

  /**
   * Loads and executes a Lua buffer through the underlying state.
   * @param {string} name Unique script identifier.
   * @param {string|Buffer} buffer Source buffer or string.
   * @returns {boolean} True when the buffer is accepted.
   */
  load(name, buffer) {
    if (!name || !buffer) return false;
    const script = buffer.toString();
    if (!this.lua) {
      this.loadedScripts.set(name, script);
      return true;
    }
    if (typeof this.lua.doString === 'function') this.lua.doString(script);
    if (typeof this.lua.execute === 'function') this.lua.execute(script);
    this.loadedScripts.set(name, script);
    return true;
  }

  /**
   * Retrieves and executes a global Lua function if present.
   * @param {string} functionName Name of the global Lua function.
   * @param {...*} args Arguments to forward to the Lua call.
   * @returns {*} Return value from the Lua function when present.
   */
  call(functionName, ...args) {
    if (!this.lua || !functionName) return undefined;
    const callable = typeof this.lua.getGlobal === 'function' ? this.lua.getGlobal(functionName) : this.lua[functionName];
    if (typeof callable !== 'function') return undefined;
    return callable(...args);
  }
}

module.exports = { StateEngine, createLuaState };
