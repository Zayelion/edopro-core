// Implements scriptlib.cpp
const { Card } = require('./card');
const { Effect } = require('./effect');
const { Group } = require('./group');
const { registerCardLibrary } = require('./libcard');
const { registerDebugLibrary } = require('./libdebug');
const { registerDuelLibrary } = require('./libduel');
const { registerEffectLibrary } = require('./libeffect');

const LUA_PARAM_NAMES = {
  INT: 'Int',
  STRING: 'String',
  CARD: 'Card',
  GROUP: 'Group',
  EFFECT: 'Effect',
  FUNCTION: 'Function',
  BOOLEAN: 'boolean',
  DELETED: 'Deleted',
};

/**
 * Represents the scripting library exposed to Lua scripts.
 */
class ScriptLib {
  constructor() {
    this.registered = new Map();
  }

  /**
   * Registers a global function with the library.
   * @param {string} name Global function name.
   * @param {Function} fn Implementation reference.
   * @returns {void}
   */
  add(name, fn) {
    this.registered.set(name, fn);
  }

  /**
   * Retrieves a previously registered function.
   * @param {string} name Global function name.
   * @returns {Function|undefined} Stored implementation when present.
   */
  get(name) {
    return this.registered.get(name);
  }

  /**
   * Registers every function contained inside a library object.
   * @param {Record<string, Function>} library Map of functions keyed by export name.
   * @returns {void}
   */
  addLibrary(library) {
    if (!library) return;
    const entries = Object.entries(library);
    for (const [key, value] of entries) {
      this.registered.set(key, value);
    }
  }
}

/**
 * Fetches the readable Lua-style type name for a value.
 * @param {unknown} value Value to classify.
 * @returns {string} Lua-style type description.
 */
const getLuaTypeName = (value) => {
  if (value instanceof Card) return LUA_PARAM_NAMES.CARD;
  if (value instanceof Group) return LUA_PARAM_NAMES.GROUP;
  if (value instanceof Effect) return LUA_PARAM_NAMES.EFFECT;
  if (typeof value === 'function') return LUA_PARAM_NAMES.FUNCTION;
  if (typeof value === 'string') return LUA_PARAM_NAMES.STRING;
  if (typeof value === 'number') return LUA_PARAM_NAMES.INT;
  if (typeof value === 'boolean') return LUA_PARAM_NAMES.BOOLEAN;
  if (value === undefined) return 'nil';
  if (Array.isArray(value)) return 'table';
  if (typeof value === 'object' && value?.lua_type === 'DELETED') return LUA_PARAM_NAMES.DELETED;
  return 'unknown';
};

/**
 * Ensures the provided argument list meets the required count.
 * @param {IArguments|unknown[]} args Arguments array-like structure.
 * @param {number} count Expected number of parameters.
 * @returns {void}
 * @throws {Error} When the provided count is insufficient.
 */
const checkParamCount = (args, count) => {
  if (args.length >= count) return;
  throw new Error(`${count} Parameters are needed.`);
};

/**
 * Guard that prevents action execution when the duel forbids it.
 * @param {import('./duel').Duel|undefined} duel Duel reference.
 * @returns {void}
 * @throws {Error} When the duel marks actions as disallowed.
 */
const checkActionPermission = (duel) => {
  if (!duel?.lua?.no_action) return;
  throw new Error('Action is not allowed here.');
};

/**
 * Produces a group of cards returned by the duel state.
 * @param {import('./duel').Duel|undefined} duel Duel reference.
 * @param {boolean} cancelable Whether a canceled action should yield undefined.
 * @returns {Group|undefined} Group of returned cards or undefined when canceled.
 */
const pushReturnCards = (duel, cancelable) => {
  if (!duel?.game_field) return undefined;
  const returnInfo = duel.game_field.return_cards || {};
  if (returnInfo.canceled && cancelable) return undefined;
  const listed = Array.isArray(returnInfo.list) ? returnInfo.list : [];
  if (typeof duel.new_group === 'function') return duel.new_group(listed);
  return new Group(listed);
};

/**
 * Determines whether an object corresponds to a deleted Lua reference.
 * @param {unknown} value Candidate value.
 * @returns {boolean} True when the value tracks a deleted object.
 */
const isDeletedObject = (value) => {
  if (!value) return false;
  if (typeof value === 'object' && value.lua_type === 'DELETED') return true;
  return false;
};

/**
 * Registers card library bindings on the provided registry.
 * @param {ScriptLib} registry Library registry.
 * @returns {Record<string, Function>} Registered functions for chaining.
 */
const pushCardLib = (registry) => registerCardLibrary(registry);

/**
 * Registers effect library bindings on the provided registry.
 * @param {ScriptLib} registry Library registry.
 * @returns {Record<string, Function>} Registered functions for chaining.
 */
const pushEffectLib = (registry) => registerEffectLibrary(registry);

/**
 * Registers group library bindings on the provided registry.
 * @param {ScriptLib} registry Library registry.
 * @returns {Record<string, Function>} Registered functions for chaining.
 */
const pushGroupLib = (registry) => ({ registry });

/**
 * Registers duel library bindings on the provided registry.
 * @param {ScriptLib} registry Library registry.
 * @returns {Record<string, Function>} Registered functions for chaining.
 */
const pushDuelLib = (registry) => registerDuelLibrary(registry);

/**
 * Registers debug library bindings on the provided registry.
 * @param {ScriptLib} registry Library registry.
 * @returns {Record<string, Function>} Registered functions for chaining.
 */
const pushDebugLib = (registry) => registerDebugLibrary(registry);

module.exports = {
  ScriptLib,
  pushCardLib,
  pushEffectLib,
  pushGroupLib,
  pushDuelLib,
  pushDebugLib,
  checkParamCount,
  checkActionPermission,
  pushReturnCards,
  getLuaTypeName,
  isDeletedObject,
  LUA_PARAM_NAMES,
};
