// Implements containers_fwd.h equivalents.

/**
 * Normalizes a numeric value ensuring a finite number is returned.
 * @param {number|undefined} value Candidate numeric value.
 * @param {number} fallback Default to return when value is not finite.
 * @returns {number} Validated numeric value.
 */
function normalizeNumber(value, fallback) {
  if (Number.isFinite(value)) return value;
  return fallback;
}

/**
 * Translates a boolean comparator into an Array.sort compatible callback.
 * @param {(left: unknown, right: unknown) => boolean} compare Comparator returning true when left precedes right.
 * @returns {(left: unknown, right: unknown) => number} Sort callback for Array.sort.
 */
function comparatorToSorter(compare) {
  return (left, right) => {
    if (compare(left, right)) return -1;
    if (compare(right, left)) return 1;
    return 0;
  };
}

/**
 * Orders cards by their cardid property mirroring the native comparator.
 * @param {{ cardid?: number }|undefined} left First card-like instance.
 * @param {{ cardid?: number }|undefined} right Second card-like instance.
 * @returns {boolean} True when left should be placed before right.
 */
function cardSort(left, right) {
  const leftId = normalizeNumber(left?.cardid, 0);
  const rightId = normalizeNumber(right?.cardid, 0);
  return leftId < rightId;
}

/**
 * Container mirroring a std::set with deterministic card ordering.
 */
class CardSet {
  /**
   * @param {(left: unknown, right: unknown) => boolean} compare Comparator applied to maintain order.
   */
  constructor(compare = cardSort) {
    this.compare = compare;
    this.sorter = comparatorToSorter(compare);
    this.items = [];
  }

  /**
   * Inserts a card-like object if it is not already present.
   * @param {unknown} card Card-like instance to store.
   * @returns {void}
   */
  add(card) {
    if (this.items.includes(card)) return;
    this.items.push(card);
    this.items.sort(this.sorter);
  }

  /**
   * Removes a stored card-like object.
   * @param {unknown} card Card-like instance to remove.
   * @returns {boolean} True when the card was removed.
   */
  delete(card) {
    const index = this.items.indexOf(card);
    if (index === -1) return false;
    this.items.splice(index, 1);
    return true;
  }

  /**
   * Checks whether the set already stores the provided card-like object.
   * @param {unknown} card Card-like instance to check.
   * @returns {boolean} True when the card is present.
   */
  has(card) {
    return this.items.includes(card);
  }

  /**
   * Returns the ordered list of stored items.
   * @returns {unknown[]} Snapshot of stored items.
   */
  values() {
    return [...this.items];
  }
}

/**
 * Orders effects by their identifier.
 * @param {{ id?: number }|undefined} first First effect-like instance.
 * @param {{ id?: number }|undefined} second Second effect-like instance.
 * @returns {boolean} True when the first effect has a lower id.
 */
function effectSortId(first, second) {
  const firstId = normalizeNumber(first?.id, 0);
  const secondId = normalizeNumber(second?.id, 0);
  return firstId < secondId;
}

/**
 * Comparator class leveraging {@link effectSortId}.
 */
class EffectSortById {
  /**
   * @param {{ id?: number }|undefined} first First effect-like instance.
   * @param {{ id?: number }|undefined} second Second effect-like instance.
   * @returns {boolean} True when first precedes second.
   */
  compare(first, second) {
    return effectSortId(first, second);
  }
}

/**
 * Comparator class ordering effects by their initial identifiers.
 */
class EffectSortByInitialId {
  /**
   * @param {{ initial_id?: number }|undefined} first First effect-like instance.
   * @param {{ initial_id?: number }|undefined} second Second effect-like instance.
   * @returns {boolean} True when first precedes second.
   */
  compare(first, second) {
    const firstId = normalizeNumber(first?.initial_id, 0);
    const secondId = normalizeNumber(second?.initial_id, 0);
    return firstId < secondId;
  }
}

/**
 * Represents a multi-map keyed by numeric priority that tracks effects.
 */
class EffectContainer {
  /**
   * Creates a new multi-map to store effects keyed by priority.
   */
  constructor() {
    this.buckets = new Map();
    this.indexer = new Map();
  }

  /**
   * Registers an effect under a numeric priority.
   * @param {number} priority Numeric key representing ordering.
   * @param {unknown} effect Effect-like instance to store.
   * @returns {void}
   */
  add(priority, effect) {
    const bucket = this.buckets.get(priority) ?? [];
    bucket.push(effect);
    bucket.sort(comparatorToSorter(effectSortId));
    this.buckets.set(priority, bucket);
    this.indexer.set(effect, { priority });
  }

  /**
   * Removes an effect from the container using its indexer entry.
   * @param {unknown} effect Effect-like instance to remove.
   * @returns {boolean} True when the effect was found and removed.
   */
  delete(effect) {
    const info = this.indexer.get(effect);
    if (!info) return false;
    const bucket = this.buckets.get(info.priority);
    if (!bucket) return false;
    const position = bucket.indexOf(effect);
    if (position === -1) return false;
    bucket.splice(position, 1);
    if (bucket.length === 0) this.buckets.delete(info.priority);
    this.indexer.delete(effect);
    return true;
  }

  /**
   * Retrieves the effects stored under a specific priority.
   * @param {number} priority Numeric key representing ordering.
   * @returns {unknown[]} Snapshot of effects for the key.
   */
  get(priority) {
    const bucket = this.buckets.get(priority);
    if (!bucket) return [];
    return [...bucket];
  }

  /**
   * Exposes the indexer used to map effects back to their priority.
   * @returns {Map<unknown, { priority: number }>} Map from effect to index metadata.
   */
  getIndexer() {
    return this.indexer;
  }
}

/**
 * Convenience wrapper returning a new card vector equivalent.
 * @returns {unknown[]} Empty card vector.
 */
function createCardVector() {
  return [];
}

/**
 * Convenience wrapper returning a new effect vector equivalent.
 * @returns {unknown[]} Empty effect vector.
 */
function createEffectVector() {
  return [];
}

/**
 * Convenience wrapper returning a new chain list equivalent.
 * @returns {unknown[]} Empty chain list.
 */
function createChainList() {
  return [];
}

/**
 * Convenience wrapper returning a new chain array equivalent.
 * @returns {unknown[]} Empty chain array.
 */
function createChainArray() {
  return [];
}

/**
 * Convenience wrapper returning a new effect set equivalent.
 * @returns {unknown[]} Empty effect set.
 */
function createEffectSet() {
  return [];
}

/**
 * Convenience wrapper returning a new instant effect list equivalent.
 * @returns {Map<unknown, unknown>} Empty map from effect to chain-like data.
 */
function createInstantEffectList() {
  return new Map();
}

/**
 * Convenience wrapper returning a new event list equivalent.
 * @returns {unknown[]} Empty event list.
 */
function createEventList() {
  return [];
}

module.exports = {
  cardSort,
  effectSortId,
  EffectSortById,
  EffectSortByInitialId,
  CardSet,
  EffectContainer,
  createCardVector,
  createEffectVector,
  createChainList,
  createChainArray,
  createEffectSet,
  createInstantEffectList,
  createEventList,
};
