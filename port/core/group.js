// Implements group.cpp

/**
 * Collection of card-like objects with helper utilities mirroring the C++ group container.
 */
class Group {
  /**
   * @param {Iterable<any>|undefined} source optional iterable of card-like objects
   */
  constructor(source) {
    this.container = new Set();
    if (source) {
      for (const entry of source) {
        this.container.add(entry);
      }
    }
    this.isReadonly = false;
    this.isIteratorDirty = true;
    this.iteratorOrder = [];
    this.iteratorIndex = -1;
  }

  /**
   * Checks whether the collection contains a card reference.
   * @param {any} card card reference to locate
   * @returns {boolean}
   */
  hasCard(card) {
    return this.container.has(card);
  }

  /**
   * Creates a shallow copy of the group and its container.
   * @returns {Group}
   */
  clone() {
    return new Group(this.container);
  }

  /**
   * Marks the group as mutable, throwing if modifications are not allowed.
   * @private
   * @returns {void}
   */
  assertWritable() {
    if (!this.isReadonly) {
      return;
    }
    throw new Error('attempt to modify a read only group');
  }

  /**
   * Clears all stored entries.
   * @returns {Group}
   */
  clear() {
    this.assertWritable();
    this.isIteratorDirty = true;
    this.container.clear();
    return this;
  }

  /**
   * Adds a card or merges another group into this one.
   * @param {any|Group} value card-like object or group
   * @returns {Group}
   */
  addCard(value) {
    this.assertWritable();
    this.isIteratorDirty = true;
    if (value instanceof Group) {
      for (const card of value.container) {
        this.container.add(card);
      }
      return this;
    }
    this.container.add(value);
    return this;
  }

  /**
   * Removes a card or subtracts another group from this one.
   * @param {any|Group} value card-like object or group
   * @returns {Group}
   */
  removeCard(value) {
    this.assertWritable();
    this.isIteratorDirty = true;
    if (value instanceof Group) {
      if (value === this) {
        throw new Error('Attempting to remove a group from itself');
      }
      for (const card of value.container) {
        this.container.delete(card);
      }
      return this;
    }
    this.container.delete(value);
    return this;
  }

  /**
   * Initializes iterator state and returns the first entry.
   * @returns {any|undefined}
   */
  getFirst() {
    this.isIteratorDirty = false;
    this.iteratorOrder = Array.from(this.container);
    this.iteratorIndex = 0;
    const first = this.iteratorOrder[this.iteratorIndex];
    if (first !== undefined) {
      return first;
    }
    this.iteratorIndex = -1;
    return undefined;
  }

  /**
   * Continues iteration from the last {@link getFirst} call.
   * @returns {any|undefined}
   */
  getNext() {
    if (this.isIteratorDirty) {
      throw new Error('Called Group.GetNext without first calling Group.GetFirst');
    }
    if (this.iteratorIndex < 0) {
      return undefined;
    }
    this.iteratorIndex += 1;
    const next = this.iteratorOrder[this.iteratorIndex];
    if (next !== undefined) {
      return next;
    }
    this.iteratorIndex = -1;
    return undefined;
  }

  /**
   * Retrieves the card-like object at a specific position.
   * @param {number} position zero-based position to fetch
   * @returns {any|undefined}
   */
  takeAtPos(position) {
    if (position < 0) {
      return undefined;
    }
    const items = Array.from(this.container);
    if (position >= items.length) {
      return undefined;
    }
    return items[position];
  }

  /**
   * Counts the stored items.
   * @returns {number}
   */
  getCount() {
    return this.container.size;
  }

  /**
   * Returns a new group containing only matching entries.
   * @param {Function} predicate predicate receiving a card-like object
   * @param {any|Group|undefined} exception card or group to exclude from evaluation
   * @param {...any} extraArgs additional parameters forwarded to the predicate
   * @returns {Group}
   */
  filter(predicate, exception, ...extraArgs) {
    const workingSet = new Set(this.container);
    if (exception instanceof Group) {
      for (const card of exception.container) {
        workingSet.delete(card);
      }
    }
    if (!(exception instanceof Group) && exception !== undefined) {
      workingSet.delete(exception);
    }
    const result = new Group();
    for (const card of workingSet) {
      if (predicate(card, ...extraArgs)) {
        result.container.add(card);
      }
    }
    return result;
  }

  /**
   * Filters the current group in place.
   * @param {Function} predicate predicate receiving a card-like object
   * @param {any|Group|undefined} exception card or group to skip during evaluation
   * @param {...any} extraArgs additional parameters forwarded to the predicate
   * @returns {Group}
   */
  match(predicate, exception, ...extraArgs) {
    this.assertWritable();
    this.isIteratorDirty = true;
    const iterator = this.container.values();
    if (exception instanceof Group) {
      const exclusion = new Set(exception.container);
      for (const card of iterator) {
        if (exclusion.has(card)) {
          this.container.delete(card);
          continue;
        }
        if (!predicate(card, ...extraArgs)) {
          this.container.delete(card);
        }
      }
      return this;
    }
    for (const card of iterator) {
      if (exception !== undefined && card === exception) {
        this.container.delete(card);
        continue;
      }
      if (!predicate(card, ...extraArgs)) {
        this.container.delete(card);
      }
    }
    return this;
  }

  /**
   * Counts entries matching a predicate after excluding optional exceptions.
   * @param {Function} predicate predicate receiving a card-like object
   * @param {any|Group|undefined} exception card or group to exclude from evaluation
   * @param {...any} extraArgs additional parameters forwarded to the predicate
   * @returns {number}
   */
  filterCount(predicate, exception, ...extraArgs) {
    const workingSet = new Set(this.container);
    if (exception instanceof Group) {
      for (const card of exception.container) {
        workingSet.delete(card);
      }
    }
    if (!(exception instanceof Group) && exception !== undefined) {
      workingSet.delete(exception);
    }
    let count = 0;
    for (const card of workingSet) {
      if (predicate(card, ...extraArgs)) {
        count += 1;
      }
    }
    return count;
  }
}

module.exports = { Group };
