// Implements libgroup.cpp
const { Group } = require('./group');
const { ScriptLib, checkParamCount } = require('./scriptlib');

/**
 * Ensures the provided value is a {@link Group} instance.
 * @param {unknown} candidate Potential group reference.
 * @returns {Group} Validated group instance.
 * @throws {TypeError} When the candidate is not a group.
 */
const requireGroup = (candidate) => {
  if (candidate instanceof Group) return candidate;
  throw new TypeError('Expected Group instance for group library operation');
};

/**
 * Marks a group as deleted, mirroring the native cleanup behavior.
 * @param {Group} group Target group to delete.
 * @returns {number} Always returns zero for Lua compatibility.
 */
const deleteGroup = (group) => {
  const target = requireGroup(group);
  target.clear();
  target.lua_type = 'DELETED';
  return 0;
};

/**
 * Clones a group into a new instance.
 * @param {Group} group Group to clone.
 * @returns {Group} New cloned group.
 */
const clone = (group) => requireGroup(group).clone();

/**
 * Prevents the group from being treated as temporary.
 * @param {Group} group Group to persist.
 * @returns {Group} The provided group.
 */
const keepAlive = (group) => {
  const target = requireGroup(group);
  target.keepAlive = true;
  return target;
};

/**
 * Clears all cards from the group.
 * @param {Group} group Group to clear.
 * @returns {Group} The cleared group.
 */
const clear = (group) => requireGroup(group).clear();

/**
 * Adds a card or group contents to the provided group.
 * @param {Group} group Destination group.
 * @param {Group|any} value Card or group to add.
 * @returns {Group} Updated group instance.
 */
const addCard = (group, value) => requireGroup(group).addCard(value);

/**
 * Removes a card or group contents from the provided group.
 * @param {Group} group Destination group.
 * @param {Group|any} value Card or group to remove.
 * @returns {Group} Updated group instance.
 */
const removeCard = (group, value) => requireGroup(group).removeCard(value);

/**
 * Retrieves the next card in the iteration sequence.
 * @param {Group} group Group to iterate.
 * @returns {any|undefined} Next card or undefined when finished.
 */
const getNext = (group) => requireGroup(group).getNext();

/**
 * Retrieves the first card in the iteration sequence.
 * @param {Group} group Group to iterate.
 * @returns {any|undefined} First card or undefined when empty.
 */
const getFirst = (group) => requireGroup(group).getFirst();

/**
 * Fetches a card at a specific zero-based index.
 * @param {Group} group Group to inspect.
 * @param {number} position Zero-based index to read.
 * @returns {any|undefined} Card reference when present.
 */
const takeAtPos = (group, position) => requireGroup(group).takeAtPos(position);

/**
 * Counts how many entries are present in the group.
 * @param {Group} group Group to inspect.
 * @returns {number} Entry count.
 */
const getCount = (group) => requireGroup(group).getCount();

/**
 * Filters a group using the provided predicate.
 * @param {Group} group Group to filter.
 * @param {Function} predicate Predicate function receiving a card.
 * @param {Group|any|undefined} exception Card or group to skip.
 * @param {...any} extraArgs Additional parameters forwarded to the predicate.
 * @returns {Group} New filtered group.
 */
const filter = (group, predicate, exception, ...extraArgs) => {
  const target = requireGroup(group);
  if (typeof predicate !== 'function') return new Group();
  return target.filter(predicate, exception, ...extraArgs);
};

/**
 * Applies a predicate directly to the group, mutating it in place.
 * @param {Group} group Group to mutate.
 * @param {Function} predicate Predicate function receiving a card.
 * @param {Group|any|undefined} exception Card or group to skip.
 * @param {...any} extraArgs Additional parameters forwarded to the predicate.
 * @returns {Group} Mutated group reference.
 */
const match = (group, predicate, exception, ...extraArgs) => {
  const target = requireGroup(group);
  if (typeof predicate !== 'function') return target;
  return target.match(predicate, exception, ...extraArgs);
};

/**
 * Counts how many entries satisfy the provided predicate.
 * @param {Group} group Group to evaluate.
 * @param {Function} predicate Predicate function receiving a card.
 * @param {Group|any|undefined} exception Card or group to skip.
 * @param {...any} extraArgs Additional parameters forwarded to the predicate.
 * @returns {number} Matching entry count.
 */
const filterCount = (group, predicate, exception, ...extraArgs) => {
  const result = filter(group, predicate, exception, ...extraArgs);
  return result.getCount();
};

/**
 * Filters and selects cards returning a new group.
 * @param {Group} group Group to evaluate.
 * @param {Function} predicate Predicate used to select cards.
 * @param {Group|any|undefined} exception Card or group to skip.
 * @param {...any} extraArgs Additional parameters forwarded to the predicate.
 * @returns {Group} Newly constructed group with selected cards.
 */
const filterSelect = (group, predicate, exception, ...extraArgs) => filter(group, predicate, exception, ...extraArgs);

/**
 * Selects cards using the provided predicate, returning a new group.
 * @param {Group} group Group to evaluate.
 * @param {Function} predicate Predicate used to select cards.
 * @param {Group|any|undefined} exception Card or group to skip.
 * @param {...any} extraArgs Additional parameters forwarded to the predicate.
 * @returns {Group} Newly constructed group with selected cards.
 */
const select = (group, predicate, exception, ...extraArgs) => filter(group, predicate, exception, ...extraArgs);

/**
 * Determines whether any card satisfies the predicate.
 * @param {Group} group Group to inspect.
 * @param {Function} predicate Predicate used to test cards.
 * @param {Group|any|undefined} exception Card or group to skip.
 * @param {...any} extraArgs Additional parameters forwarded to the predicate.
 * @returns {boolean} True when at least one match exists.
 */
const isExists = (group, predicate, exception, ...extraArgs) => filterCount(group, predicate, exception, ...extraArgs) > 0;

/**
 * Reports whether a specific card is contained in the group.
 * @param {Group} group Group to inspect.
 * @param {any} card Card reference to locate.
 * @returns {boolean} True when the card is present.
 */
const isContains = (group, card) => requireGroup(group).hasCard(card);

/**
 * Reports whether every provided card is included in the group.
 * @param {Group} group Group to inspect.
 * @param {Group|any[]} list Cards to check for membership.
 * @returns {boolean} True when all provided cards are present.
 */
const includes = (group, list) => {
  const target = requireGroup(group);
  if (list instanceof Group) {
    for (const card of list.container) {
      if (!target.hasCard(card)) return false;
    }
    return true;
  }
  if (!Array.isArray(list)) return false;
  for (const card of list) {
    if (!target.hasCard(card)) return false;
  }
  return true;
};

/**
 * Registers group-facing library functions with the provided registry.
 * @param {ScriptLib} registry Registry instance or plain collector.
 * @returns {{ [key: string]: Function }} Registered function map.
 */
function registerGroupLibrary(registry) {
  const functions = {
    Clone: clone,
    DeleteGroup: deleteGroup,
    KeepAlive: keepAlive,
    Clear: clear,
    AddCard: addCard,
    Merge: addCard,
    RemoveCard: removeCard,
    Sub: removeCard,
    GetNext: getNext,
    GetFirst: getFirst,
    TakeatPos: takeAtPos,
    GetCount: getCount,
    Filter: filter,
    Match: match,
    FilterCount: filterCount,
    FilterSelect: filterSelect,
    Select: select,
    IsExists: isExists,
    IsContains: isContains,
    Includes: includes,
  };
  if (registry instanceof ScriptLib) {
    Object.entries(functions).forEach(([name, fn]) => registry.add(name, fn));
  }
  return functions;
}

/**
 * Adapter that proxies Lua-style group function invocations with parameter guards.
 * @param {Function} fn Target function to wrap.
 * @param {number} count Required argument count.
 * @returns {Function} Wrapped implementation.
 */
const luaFunction = (fn, count) => (...args) => {
  checkParamCount(args, count);
  return fn(...args);
};

module.exports = {
  deleteGroup,
  clone,
  keepAlive,
  clear,
  addCard,
  removeCard,
  getNext,
  getFirst,
  takeAtPos,
  getCount,
  filter,
  match,
  filterCount,
  filterSelect,
  select,
  isExists,
  isContains,
  includes,
  luaFunction,
  registerGroupLibrary,
};
