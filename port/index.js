// Implements README-described API surface.
/**
 * JavaScript API surface mirroring the C interface described in the repository README.
 * These functions are currently stubs that should be connected to the actual
 * duel engine implementation when available.
 */

/**
 * Writes the ocgcore API version numbers at the provided addresses if they're not null.
 * In a real implementation, this mutates the reference parameters and returns void.
 * @param {object} majorRef Placeholder for the major version reference.
 * @param {object} minorRef Placeholder for the minor version reference.
 * @returns {{ major: number, minor: number }} Empty version values.
 */
function OCG_GetVersion(majorRef, minorRef) {
  return { major: 0, minor: 0 };
}

/**
 * Creates a new duel simulation with the specified options and saves the pointer in `duel`.
 * Returns a status code of type `OCG_DuelCreationStatus`.
 * @param {object} duelRef Placeholder for the duel reference holder.
 * @param {object} options Duel options configuration.
 * @returns {number} Empty creation status code.
 */
function OCG_CreateDuel(duelRef, options) {
  return 0;
}

/**
 * Deallocates the duel instance created by OCG_CreateDuel.
 * @param {object} duel Duel handle to destroy.
 * @returns {void}
 */
function OCG_DestroyDuel(duel) {
  return undefined;
}

/**
 * Adds the card specified by `info` to the duel.
 * @param {object} duel Duel handle receiving the card.
 * @param {object} info Card description for creation.
 * @returns {void}
 */
function OCG_DuelNewCard(duel, info) {
  return undefined;
}

/**
 * Starts the duel simulation and state machine after configuration is complete.
 * @param {object} duel Duel handle to start.
 * @returns {void}
 */
function OCG_StartDuel(duel) {
  return undefined;
}

/**
 * Runs the state machine to progress the duel or after a waiting state requiring a response.
 * Returns `OCG_DuelStatus` enum values.
 * @param {object} duel Duel handle to process.
 * @returns {number} Empty duel status value.
 */
function OCG_DuelProcess(duel) {
  return 0;
}

/**
 * Provides a pointer to the internal buffer containing binary messages from the duel simulation.
 * Subsequent calls invalidate previous buffers; the size is written to `lengthRef` if provided.
 * @param {object} duel Duel handle to query.
 * @param {object} lengthRef Placeholder for length reference.
 * @returns {Uint8Array} Empty message buffer.
 */
function OCG_DuelGetMessage(duel, lengthRef) {
  return new Uint8Array(0);
}

/**
 * Sets the next player response for the duel simulation; contents are copied internally.
 * @param {object} duel Duel handle to receive the response.
 * @param {Uint8Array|Buffer} buffer Binary response buffer.
 * @param {number} length Length of the response buffer.
 * @returns {void}
 */
function OCG_DuelSetResponse(duel, buffer, length) {
  return undefined;
}

/**
 * Loads a Lua card or support script for the specified duel.
 * Returns positive on success and zero on failure.
 * @param {object} duel Duel handle.
 * @param {Uint8Array|Buffer|string} buffer Script content.
 * @param {number} length Size of the buffer.
 * @param {string} name Unique script identifier.
 * @returns {number} Empty load status code.
 */
function OCG_LoadScript(duel, buffer, length, name) {
  return 0;
}

/**
 * Returns the number of cards in the specified zone.
 * @param {object} duel Duel handle.
 * @param {number} team Team identifier.
 * @param {number} loc Location mask.
 * @returns {number} Empty card count.
 */
function OCG_DuelQueryCount(duel, team, loc) {
  return 0;
}

/**
 * Returns a pointer to an internal buffer for the first card matching the query.
 * Subsequent calls invalidate previous queries; size is written to `lengthRef` if provided.
 * @param {object} duel Duel handle.
 * @param {object} lengthRef Placeholder for length reference.
 * @param {object} info Query description.
 * @returns {Uint8Array} Empty query result buffer.
 */
function OCG_DuelQuery(duel, lengthRef, info) {
  return new Uint8Array(0);
}

/**
 * Returns a pointer to an internal buffer for all cards matching the query.
 * Subsequent calls invalidate previous queries; size is written to `lengthRef` if provided.
 * @param {object} duel Duel handle.
 * @param {object} lengthRef Placeholder for length reference.
 * @param {object} info Query description.
 * @returns {Uint8Array} Empty query result buffer.
 */
function OCG_DuelQueryLocation(duel, lengthRef, info) {
  return new Uint8Array(0);
}

/**
 * Returns a pointer to an internal buffer containing card counts for every zone in the game.
 * Subsequent calls invalidate previous queries; size is written to `lengthRef` if provided.
 * @param {object} duel Duel handle.
 * @param {object} lengthRef Placeholder for length reference.
 * @returns {Uint8Array} Empty query result buffer.
 */
function OCG_DuelQueryField(duel, lengthRef) {
  return new Uint8Array(0);
}

module.exports = {
  OCG_GetVersion,
  OCG_CreateDuel,
  OCG_DestroyDuel,
  OCG_DuelNewCard,
  OCG_StartDuel,
  OCG_DuelProcess,
  OCG_DuelGetMessage,
  OCG_DuelSetResponse,
  OCG_LoadScript,
  OCG_DuelQueryCount,
  OCG_DuelQuery,
  OCG_DuelQueryLocation,
  OCG_DuelQueryField,
};
