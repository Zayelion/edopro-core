'use strict';

// Implements interpreter.cpp

/**
 * Enumerates the supported Lua parameter analogues used by the interpreter.
 * @readonly
 * @enum {string}
 */
const LuaParam = Object.freeze({
  INT: 'int',
  STRING: 'string',
  BOOLEAN: 'boolean',
  CARD: 'card',
  EFFECT: 'effect',
  GROUP: 'group',
  FUNCTION: 'function',
  INDEX: 'index',
  DELETED: 'deleted'
});

/**
 * Lightweight interpreter bookkeeping layer that mirrors interpreter.cpp APIs.
 */
class Interpreter {
  /**
   * @param {import('./duel').Duel} duel Owning duel instance.
   * @param {object} options Interpreter options.
   */
  constructor(duel, options) {
    this.duel = duel;
    this.options = options;
    this.registeredCards = new Set();
    this.registeredEffects = new Set();
    this.registeredGroups = new Set();
    this.registeredObjects = new Map();
    this.parameters = [];
    this.loadedScripts = new Map();
    this.lastResults = [];
    this.coroutines = new Map();
    this.callDepth = 0;
    this.noAction = 0;
    this.references = new Map();
    this.nextReferenceId = 1;
  }

  /**
   * Registers a card with the interpreter.
   * @param {import('./card').Card} card Card to register.
   */
  register_card(card) {
    if (!card) return;
    this.registeredCards.add(card);
  }

  /**
   * Registers an effect with the interpreter.
   * @param {import('./effect').Effect} effect Effect to register.
   */
  register_effect(effect) {
    if (!effect) return;
    this.registeredEffects.add(effect);
  }

  /**
   * Unregisters an effect from the interpreter.
   * @param {import('./effect').Effect} effect Effect to unregister.
   */
  unregister_effect(effect) {
    if (!effect) return;
    this.registeredEffects.delete(effect);
    effect.condition = undefined;
    effect.cost = undefined;
    effect.target = undefined;
    effect.operation = undefined;
    effect.value = undefined;
  }

  /**
   * Registers a group with the interpreter.
   * @param {import('./group').Group} group Group to register.
   */
  register_group(group) {
    if (!group) return;
    this.registeredGroups.add(group);
  }

  /**
   * Registers a generic object for bookkeeping.
   * @param {import('./lua_obj').LuaObj} obj Object to register.
   * @param {string} tableName Name of the virtual table this object belongs to.
   * @param {boolean} weak Whether the reference should be weakly tracked.
   */
  register_obj(obj, tableName, weak) {
    if (!obj) return;
    const bucket = this.registeredObjects.get(tableName) ?? new Set();
    bucket.add(obj);
    this.registeredObjects.set(tableName, bucket);
    if (!weak) return;
    obj.isWeakReference = true;
  }

  /**
   * Triggers a garbage collection pass.
   * @param {boolean} [full=false] Whether to force a full collection cycle.
   */
  collect(full = false) {
    this.parameters.length = 0;
    if (!full) return;
    this.registeredCards.forEach((card) => {
      if (!card || card.isDeleted) this.registeredCards.delete(card);
    });
    this.registeredEffects.forEach((effect) => {
      if (!effect || effect.isDeleted) this.registeredEffects.delete(effect);
    });
    this.registeredGroups.forEach((group) => {
      if (!group || group.isDeleted) this.registeredGroups.delete(group);
    });
  }

  /**
   * Loads a script buffer for later use.
   * @param {string|Buffer} buffer Script contents.
   * @param {number} [len=0] Unused length parameter maintained for API parity.
   * @param {string} [scriptName] Optional script identifier.
   * @returns {boolean} True when the buffer is accepted.
   */
  load_script(buffer, len = 0, scriptName) { // eslint-disable-line no-unused-vars
    if (!buffer) return false;
    const name = scriptName ?? `script_${this.loadedScripts.size + 1}`;
    this.loadedScripts.set(name, buffer);
    return true;
  }

  /**
   * Loads a card script if it has not been cached already.
   * @param {number} code Card code to load.
   * @returns {boolean} True when the script is available.
   */
  load_card_script(code) {
    const key = `c${code}`;
    if (this.loadedScripts.has(key)) return true;
    if (!this.duel || !this.duel.read_script_callback) return false;
    const filename = `${key}.lua`;
    const script = this.duel.read_script_callback(filename, this.duel.read_script_payload);
    if (!script) return false;
    this.loadedScripts.set(key, script);
    return true;
  }

  /**
   * Adds a parameter to the invocation queue.
   * @param {LuaParam} type Parameter type.
   * @param {*} value Parameter value.
   * @param {boolean} [front=false] Whether to enqueue at the front.
   */
  add_param(type, value, front = false) {
    const payload = { type, value };
    if (front) {
      this.parameters.unshift(payload);
      return;
    }
    this.parameters.push(payload);
  }

  /**
   * Pushes parameters into an array and clears the queue.
   * @returns {Array<*>} Extracted parameters.
   */
  push_param() {
    const values = this.parameters.map((entry) => entry.value);
    this.parameters.length = 0;
    return values;
  }

  /**
   * Calls an arbitrary function using the queued parameters.
   * @param {Function} func Function handle to execute.
   * @param {number} paramCount Expected parameter count.
   * @param {number} retCount Expected return count.
   * @returns {boolean} True when the call succeeds.
   */
  call_function(func, paramCount, retCount) {
    if (!func) return this.ret_fail('"CallFunction": attempt to call a null function.');
    if (paramCount !== this.parameters.length) return this.ret_fail(`"CallFunction": incorrect parameter count (${paramCount} expected, ${this.parameters.length} pushed)`);
    if (typeof func !== 'function') return this.ret_fail('"CallFunction": attempt to call an error function');
    const args = this.push_param();
    try {
      const result = func(...args);
      const results = Array.isArray(result) ? result : [result];
      this.lastResults = Number.isInteger(retCount) && retCount >= 0 ? results.slice(0, retCount) : results;
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown interpreter error';
      return this.ret_fail(message);
    }
  }

  /**
   * Calls a card-bound function using the queued parameters.
   * @param {import('./card').Card} card Target card.
   * @param {string} functionName Method name to call on the card.
   * @param {number} paramCount Expected parameter count.
   * @param {number} retCount Expected return count.
   * @param {boolean} [forced=true] Whether to treat missing functions as errors.
   * @returns {boolean} True when the call succeeds.
   */
  call_card_function(card, functionName, paramCount, retCount, forced = true) {
    if (paramCount !== this.parameters.length) return this.ret_fail(`"CallCardFunction"(c${card?.data?.code}.${functionName}): incorrect parameter count`);
    if (!card) return this.ret_fail(`"CallCardFunction"(c0.${functionName}): attempt to call an error function`, forced);
    const handler = card[functionName];
    if (typeof handler !== 'function') return this.ret_fail(`"CallCardFunction"(c${card.data?.code}.${functionName}): attempt to call an error function`, forced);
    return this.call_function(handler.bind(card), paramCount, retCount);
  }

  /**
   * Calls a function defined by a loaded card script.
   * @param {number} code Card code whose script should be used.
   * @param {string} functionName Function name to invoke.
   * @param {number} paramCount Expected parameter count.
   * @param {number} retCount Expected return count.
   * @returns {boolean} True when the call succeeds.
   */
  call_code_function(code, functionName, paramCount, retCount) {
    if (paramCount !== this.parameters.length) return this.ret_fail('"CallCodeFunction": incorrect parameter count');
    const loaded = this.load_card_script(code);
    if (!loaded) return this.ret_fail('"CallCodeFunction": attempt to call an error function');
    const script = this.loadedScripts.get(`c${code}`);
    if (!script || typeof script[functionName] !== 'function') return this.ret_fail('"CallCodeFunction": attempt to call an error function');
    return this.call_function(script[functionName], paramCount, retCount);
  }

  /**
   * Evaluates a condition using a provided function handle.
   * @param {Function|number} functionRef Function to invoke.
   * @param {number} paramCount Expected parameter count.
   * @returns {boolean} Boolean representation of the call result.
   */
  check_condition(functionRef, paramCount) {
    if (!functionRef) {
      this.parameters.length = 0;
      return true;
    }
    const success = this.call_function(functionRef, paramCount, 1);
    if (!success) return false;
    const [result] = this.lastResults;
    return Boolean(result);
  }

  /**
   * Creates a failure response and clears pending parameters.
   * @param {string} message Error message.
   * @param {boolean} [error=true] Whether to propagate the error to the duel logger.
   * @returns {false} Always returns false for chaining convenience.
   */
  ret_fail(message, error = true) {
    if (error && this.duel && this.duel.handle_message_callback) this.duel.handle_message_callback(message, 'error', this.duel.handle_message_payload);
    this.parameters.length = 0;
    return false;
  }

  /**
   * Evaluates whether a card matches a predicate function.
   * @param {import('./card').Card} card Card instance to evaluate.
   * @param {Function} functionRef Predicate function to call.
   * @param {Array<*>} [extraArgs=[]] Additional arguments to forward.
   * @returns {boolean} Predicate result or true when function is missing.
   */
  check_matching(card, functionRef, extraArgs = []) {
    if (!functionRef) return true;
    const args = [card, ...extraArgs];
    try {
      const result = functionRef(...args);
      return Boolean(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown interpreter error';
      return this.ret_fail(message);
    }
  }

  /**
   * Evaluates a predicate using a table of arguments.
   * @param {import('./card').Card} card Card instance to evaluate.
   * @param {Function} functionRef Predicate function to call.
   * @param {Array<*>} tableArgs Table of arguments to expand.
   * @returns {boolean} Predicate result or true when function is missing or table is not provided.
   */
  check_matching_table(card, functionRef, tableArgs) {
    if (!functionRef) return true;
    if (!Array.isArray(tableArgs)) return true;
    return this.check_matching(card, functionRef, tableArgs);
  }

  /**
   * Invokes an operation and returns a numeric result.
   * @param {import('./card').Card} card Card to pass as the first parameter.
   * @param {Function} functionRef Operation to execute.
   * @param {Array<*>} [extraArgs=[]] Additional parameters for the operation.
   * @returns {number} Integer representation of the operation result.
   */
  get_operation_value(card, functionRef, extraArgs = []) {
    if (!functionRef) return 0;
    const result = this.check_matching(card, functionRef, extraArgs);
    if (typeof result === 'boolean') return result ? 1 : 0;
    if (typeof result === 'number') return Math.trunc(result);
    return 0;
  }

  /**
   * Invokes an operation and writes all returned values to the target array.
   * @param {import('./card').Card} card Card to pass as the first parameter.
   * @param {Function} functionRef Operation to execute.
   * @param {Array<*>} extraArgs Additional parameters for the operation.
   * @param {Array<number>} result Target array to receive numeric results.
   * @returns {boolean} True when the invocation succeeds.
   */
  get_operation_values(card, functionRef, extraArgs, result) {
    if (!functionRef) return false;
    if (!Array.isArray(result)) return false;
    const args = [card, ...(Array.isArray(extraArgs) ? extraArgs : [])];
    try {
      const value = functionRef(...args);
      const values = Array.isArray(value) ? value : [value];
      values.forEach((entry) => {
        if (typeof entry === 'boolean') {
          result.push(entry ? 1 : 0);
          return;
        }
        if (typeof entry === 'number') result.push(Math.trunc(entry));
      });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown interpreter error';
      return this.ret_fail(message);
    }
  }

  /**
   * Executes a function expecting a numeric return value using queued parameters.
   * @param {Function} functionRef Function handle to call.
   * @param {number} paramCount Expected parameter count.
   * @returns {number} Integer result of the function or 0 on failure.
   */
  get_function_value(functionRef, paramCount) {
    if (!functionRef) return 0;
    const success = this.call_function(functionRef, paramCount, 1);
    if (!success) return 0;
    const [result] = this.lastResults;
    if (typeof result === 'boolean') return result ? 1 : 0;
    if (typeof result === 'number') return Math.trunc(result);
    return 0;
  }

  /**
   * Executes a function expecting multiple numeric return values using queued parameters.
   * @param {Function} functionRef Function handle to call.
   * @param {number} paramCount Expected parameter count.
   * @param {Array<number>} result Target array to receive numeric results.
   * @returns {boolean} True when the invocation succeeds.
   */
  get_function_values(functionRef, paramCount, result) {
    if (!functionRef) return false;
    if (!Array.isArray(result)) return false;
    const success = this.call_function(functionRef, paramCount, undefined);
    if (!success) return false;
    const values = Array.isArray(this.lastResults) ? this.lastResults : [];
    values.forEach((value) => {
      if (typeof value === 'boolean') {
        result.push(value ? 1 : 0);
        return;
      }
      if (typeof value === 'number') result.push(Math.trunc(value));
    });
    return true;
  }

  /**
   * Calls a generator-like coroutine with queued parameters.
   * @param {Function} functionRef Generator or async-like function to invoke.
   * @param {number} paramCount Expected parameter count.
   * @param {{value: *}} [yieldValue] Target to receive yielded value.
   * @param {number} step Current resume step.
   * @returns {number} Coroutine status constant.
   */
  call_coroutine(functionRef, paramCount, yieldValue, step) {
    if (!functionRef) return COROUTINE_ERROR;
    if (paramCount !== this.parameters.length) return COROUTINE_ERROR;
    const args = this.push_param();
    if (step === 0) {
      try {
        const generator = functionRef(...args);
        if (!generator || typeof generator.next !== 'function') return this.handle_coroutine_error('Coroutine did not return a generator.');
        this.coroutines.set(functionRef, generator);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown interpreter error';
        return this.handle_coroutine_error(message);
      }
    }
    const coroutine = this.coroutines.get(functionRef);
    if (!coroutine) return COROUTINE_ERROR;
    this.callDepth += 1;
    let result;
    try {
      result = coroutine.next();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown interpreter error';
      this.callDepth -= 1;
      this.coroutines.delete(functionRef);
      return this.handle_coroutine_error(message);
    }
    if (yieldValue && typeof yieldValue === 'object') yieldValue.value = result?.value;
    if (!result || result.done) {
      this.callDepth -= 1;
      this.coroutines.delete(functionRef);
      return COROUTINE_FINISH;
    }
    this.callDepth -= 1;
    return COROUTINE_YIELD;
  }

  /**
   * Duplicates an internal reference handle.
   * @param {number|Function|object} ref Reference to clone.
   * @returns {number} New reference identifier.
   */
  clone_lua_ref(ref) {
    if (ref === undefined) return 0;
    const handle = this.nextReferenceId;
    this.nextReferenceId += 1;
    this.references.set(handle, ref);
    return handle;
  }

  /**
   * Converts a weak reference to a strong reference identifier.
   * @param {number} ref Weak reference identifier.
   * @returns {number} Strong reference identifier.
   */
  strong_from_weak_ref(ref) {
    if (!ref) return 0;
    const target = this.references.get(ref);
    if (target === undefined) return 0;
    return this.clone_lua_ref(target);
  }

  /**
   * Pushes a weak reference onto the provided collection.
   * @param {Map<number, *>} store Target store to receive the reference.
   * @param {number} ref Reference identifier to push.
   */
  push_weak_ref(store, ref) {
    if (!store || typeof store.set !== 'function') return;
    const target = this.references.get(ref);
    if (target === undefined) return;
    store.set(ref, target);
  }

  /**
   * Retrieves an object stored under a reference handle.
   * @param {number} handle Reference handle to read.
   * @returns {*} Stored object or undefined when missing.
   */
  get_ref_object(handle) {
    if (!handle) return undefined;
    return this.references.get(handle);
  }

  /**
   * Handles coroutine errors, logging them consistently.
   * @param {string} message Error message to forward.
   * @returns {number} Always returns COROUTINE_ERROR.
   */
  handle_coroutine_error(message) {
    this.ret_fail(message);
    return COROUTINE_ERROR;
  }

  /**
   * Pushes an interpreter-managed object reference into a store.
   * @param {*} obj Object instance to store.
   * @returns {*} Provided object reference.
   */
  static pushobject(obj) {
    return obj;
  }
}

/**
 * Placeholder stub for interpreter.cpp for future interpreter behaviors in the port.
 * @returns {void}
 */
function interpreterCpp() {}

const COROUTINE_FINISH = 1;
const COROUTINE_YIELD = 2;
const COROUTINE_ERROR = 3;

module.exports = { Interpreter, interpreterCpp, LuaParam, COROUTINE_FINISH, COROUTINE_YIELD, COROUTINE_ERROR };
