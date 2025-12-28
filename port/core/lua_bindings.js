'use strict';

const { ScriptLib, pushCardLib, pushEffectLib, pushGroupLib, pushDuelLib, pushDebugLib } = require('./scriptlib');

/**
 * Attaches registered ScriptLib functions to the provided Lua state.
 * @param {import('./state_engine').StateEngine} stateEngine Active state engine instance.
 * @param {ScriptLib} [registry] Optional preconfigured ScriptLib registry.
 * @returns {ScriptLib} Registry containing all bound functions.
 */
const registerLuaFunctions = (stateEngine, registry) => {
  const lua = stateEngine?.lua;
  if (!lua) return registry ?? new ScriptLib();
  const activeRegistry = registry ?? new ScriptLib();
  pushCardLib(activeRegistry);
  pushEffectLib(activeRegistry);
  pushGroupLib(activeRegistry);
  pushDuelLib(activeRegistry);
  pushDebugLib(activeRegistry);
  const setter = typeof lua.setGlobal === 'function' ? lua.setGlobal : (name, fn) => {
    lua[name] = fn;
  };
  activeRegistry.registered.forEach((fn, name) => setter(name, fn));
  return activeRegistry;
};

module.exports = { registerLuaFunctions };
