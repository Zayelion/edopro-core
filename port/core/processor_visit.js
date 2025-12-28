// Implements processor_visit.cpp
const { PROCESS_REQUIREMENTS, PROCESS_RESTART } = require('./processor');

/**
 * OCG duel status flags matching the native engine.
 * @type {{ OCG_DUEL_STATUS_END: number, OCG_DUEL_STATUS_AWAITING: number, OCG_DUEL_STATUS_CONTINUE: number }}
 */
const DUEL_STATUS = {
  OCG_DUEL_STATUS_END: 0,
  OCG_DUEL_STATUS_AWAITING: 1,
  OCG_DUEL_STATUS_CONTINUE: 2,
};

/**
 * Dispatches a single queued process unit and returns the resulting duel status.
 * @param {import('./processor').ProcessorQueue} processor Queue instance to pull work from.
 * @param {(unit: import('./processor').ProcessDescriptor) => boolean} handler Handler that performs the native processing work and returns true when the process is complete.
 * @returns {number} Duel status value.
 */
function visitProcessor(processor, handler) {
  if (!processor) return DUEL_STATUS.OCG_DUEL_STATUS_END;
  processor.flushSubunits();
  if (!processor.units.length) return DUEL_STATUS.OCG_DUEL_STATUS_END;
  const current = processor.peek();
  if (!current) return DUEL_STATUS.OCG_DUEL_STATUS_END;
  if (current.step === PROCESS_RESTART) current.step = 0;
  const completed = handler(current);
  if (completed) {
    processor.complete();
    return DUEL_STATUS.OCG_DUEL_STATUS_CONTINUE;
  }
  current.step += 1;
  const awaiting = PROCESS_REQUIREMENTS[current.type];
  if (awaiting) return DUEL_STATUS.OCG_DUEL_STATUS_AWAITING;
  return DUEL_STATUS.OCG_DUEL_STATUS_CONTINUE;
}

module.exports = { DUEL_STATUS, visitProcessor };
