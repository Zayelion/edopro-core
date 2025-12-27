// Implements processor_unit.h
/**
 * Represents a unit of work for the duel processor.
 */
class ProcessorUnit {
  /**
   * @param {string} [name=""] descriptive identifier for the unit
   * @param {Function|null} [task=null] callable to execute
   */
  constructor(name = "", task = null) {
    this.name = name;
    this.task = task;
    this.children = [];
  }
}

module.exports = { ProcessorUnit };
