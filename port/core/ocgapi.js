// Implements ocgapi.cpp
const { Duel } = require('./duel');
const { bufferFrom } = require('./duel');

/**
 * Enumerates duel creation status codes mirrored from {@link ocgapi_types.h}.
 */
const DUEL_CREATION_STATUS = {
  OCG_DUEL_CREATION_SUCCESS: 0,
  OCG_DUEL_CREATION_NO_OUTPUT: 1,
  OCG_DUEL_CREATION_NOT_CREATED: 2,
  OCG_DUEL_CREATION_NULL_DATA_READER: 3,
  OCG_DUEL_CREATION_NULL_SCRIPT_READER: 4,
  OCG_DUEL_CREATION_INCOMPATIBLE_LUA_API: 5,
  OCG_DUEL_CREATION_NULL_RNG_SEED: 6,
};

/**
 * Enumerates duel processing status codes mirrored from {@link ocgapi_types.h}.
 */
const DUEL_STATUS = {
  OCG_DUEL_STATUS_END: 0,
  OCG_DUEL_STATUS_AWAITING: 1,
  OCG_DUEL_STATUS_CONTINUE: 2,
};

/**
 * Captures constants mirrored from ocgapi_constants.h for JavaScript consumers.
 */
const OCG_CONSTANTS = {
  LOCATION_DECK: 0x01,
  LOCATION_HAND: 0x02,
  LOCATION_MZONE: 0x04,
  LOCATION_SZONE: 0x08,
  LOCATION_GRAVE: 0x10,
  LOCATION_REMOVED: 0x20,
  LOCATION_EXTRA: 0x40,
  LOCATION_OVERLAY: 0x80,
  POS_FACEUP_ATTACK: 0x1,
  POS_FACEDOWN_ATTACK: 0x2,
  POS_FACEUP_DEFENSE: 0x4,
  POS_FACEDOWN_DEFENSE: 0x8,
};

/**
 * Defines the structural types shared with the OCG API.
 */
class DuelOptions {
  /**
   * @param {object} [params]
   * @param {number[]} [params.seed=[0,0,0,0]] Four-element RNG seed array.
   * @param {number} [params.flags=0] Duel option bitset.
   * @param {PlayerInfo} [params.team1] Player one configuration.
   * @param {PlayerInfo} [params.team2] Player two configuration.
   * @param {Function} [params.cardReader] Callback to populate card data.
   * @param {*} [params.payload1] Payload relayed to {@link cardReader}.
   * @param {Function} [params.scriptReader] Callback to load Lua scripts.
   * @param {*} [params.payload2] Payload relayed to {@link scriptReader}.
   * @param {Function} [params.logHandler] Callback to log engine messages.
   * @param {*} [params.payload3] Payload relayed to {@link logHandler}.
   * @param {Function} [params.cardReaderDone] Callback invoked after reads.
   * @param {*} [params.payload4] Payload relayed to {@link cardReaderDone}.
   * @param {number} [params.enableUnsafeLibraries=0] Unsafe library flag.
   */
  constructor({
    seed = [0, 0, 0, 0],
    flags = 0,
    team1 = new PlayerInfo(),
    team2 = new PlayerInfo(),
    cardReader,
    payload1,
    scriptReader,
    payload2,
    logHandler,
    payload3,
    cardReaderDone,
    payload4,
    enableUnsafeLibraries = 0,
  } = {}) {
    this.seed = seed;
    this.flags = flags;
    this.team1 = team1;
    this.team2 = team2;
    this.cardReader = cardReader;
    this.payload1 = payload1;
    this.scriptReader = scriptReader;
    this.payload2 = payload2;
    this.logHandler = logHandler;
    this.payload3 = payload3;
    this.cardReaderDone = cardReaderDone;
    this.payload4 = payload4;
    this.enableUnsafeLibraries = enableUnsafeLibraries;
  }
}

/**
 * Represents initialization information for a duel player.
 */
class PlayerInfo {
  /**
   * @param {object} [params]
   * @param {number} [params.lifePoints=8000] Starting life points.
   * @param {number} [params.startCount=5] Starting hand count.
   * @param {number} [params.drawCount=1] Cards drawn per turn.
   */
  constructor({ lifePoints = 8000, startCount = 5, drawCount = 1 } = {}) {
    this.lifePoints = lifePoints;
    this.startCount = startCount;
    this.drawCount = drawCount;
  }
}

/**
 * Represents information for adding a new card to a duel.
 */
class NewCardInfo {
  /**
   * @param {object} [params]
   * @param {number} [params.team=0] Team index.
   * @param {number} [params.duelist=0] Duelist index for tag formats.
   * @param {number} [params.code=0] Card identifier.
   * @param {number} [params.con=0] Controller index.
   * @param {number} [params.loc=0] Location mask.
   * @param {number} [params.seq=0] Sequence index.
   * @param {number} [params.pos=0] Position mask.
   */
  constructor({ team = 0, duelist = 0, code = 0, con = 0, loc = 0, seq = 0, pos = 0 } = {}) {
    this.team = team;
    this.duelist = duelist;
    this.code = code;
    this.con = con;
    this.loc = loc;
    this.seq = seq;
    this.pos = pos;
  }
}

/**
 * Describes a query request against the duel state.
 */
class QueryInfo {
  /**
   * @param {object} [params]
   * @param {number} [params.flags=0] Query flags.
   * @param {number} [params.con=0] Controller index.
   * @param {number} [params.loc=0] Location mask.
   * @param {number} [params.seq=0] Sequence index.
   * @param {number} [params.overlay_seq=0] Overlay sequence index.
   */
  constructor({ flags = 0, con = 0, loc = 0, seq = 0, overlay_seq = 0 } = {}) {
    this.flags = flags;
    this.con = con;
    this.loc = loc;
    this.seq = seq;
    this.overlay_seq = overlay_seq;
  }
}

/**
 * Entry point for the OCG API facade.
 */
class OcgApi {
  /**
   * @param {object|undefined} [bridge] Optional bridge to native bindings.
   */
  constructor(bridge) {
    this.bridge = bridge;
  }
}

/**
 * Writes the ocgcore API version numbers at the provided addresses when present.
 * @param {{ value?: number }|undefined} majorRef Placeholder for the major version reference.
 * @param {{ value?: number }|undefined} minorRef Placeholder for the minor version reference.
 * @returns {{ major: number, minor: number }} Version numbers.
 */
function OCG_GetVersion(majorRef, minorRef) {
  const major = 11;
  const minor = 0;
  if (majorRef && typeof majorRef === 'object') majorRef.value = major;
  if (minorRef && typeof minorRef === 'object') minorRef.value = minor;
  return { major, minor };
}

/**
 * Validates that the provided seed array is non-zero.
 * @param {number[]} seed Seed array to check.
 * @returns {boolean} True when all entries are zero.
 */
function isZeroSeed(seed) {
  const normalized = Array.isArray(seed) ? seed : [];
  if (normalized.length < 4) return false;
  const zeroCount = normalized.filter((value) => (value ?? 0) === 0).length;
  return zeroCount === 4;
}

/**
 * Normalizes duel options into the structure expected by {@link Duel}.
 * @param {DuelOptions} options Raw options.
 * @returns {DuelOptions} Normalized options.
 */
function normalizeOptions(options) {
  const opts = options instanceof DuelOptions ? options : new DuelOptions(options || {});
  const seed = Array.isArray(opts.seed) ? opts.seed.slice(0, 4) : [0, 0, 0, 0];
  while (seed.length < 4) seed.push(0);
  opts.seed = seed.map((value) => value ?? 0);
  return opts;
}

/**
 * Creates a new duel simulation with the specified options and saves the pointer in `outDuel`.
 * Returns a status code of type `OCG_DuelCreationStatus`.
 * @param {{ value?: Duel }|undefined} outDuel Placeholder for the duel reference holder.
 * @param {DuelOptions} options Duel options configuration.
 * @returns {number} Creation status code.
 */
function OCG_CreateDuel(outDuel, options) {
  if (!outDuel) return DUEL_CREATION_STATUS.OCG_DUEL_CREATION_NO_OUTPUT;
  const normalized = normalizeOptions(options);
  if (!normalized.cardReader) {
    outDuel.value = undefined;
    return DUEL_CREATION_STATUS.OCG_DUEL_CREATION_NULL_DATA_READER;
  }
  if (!normalized.scriptReader) {
    outDuel.value = undefined;
    return DUEL_CREATION_STATUS.OCG_DUEL_CREATION_NULL_SCRIPT_READER;
  }
  if (isZeroSeed(normalized.seed)) {
    outDuel.value = undefined;
    return DUEL_CREATION_STATUS.OCG_DUEL_CREATION_NULL_RNG_SEED;
  }
  const validLuaLib = { value: true };
  const duel = new Duel({
    seed: normalized.seed,
    flags: normalized.flags,
    team1: normalized.team1,
    team2: normalized.team2,
    cardReader: normalized.cardReader,
    payload1: normalized.payload1,
    scriptReader: normalized.scriptReader,
    payload2: normalized.payload2,
    logHandler: normalized.logHandler,
    payload3: normalized.payload3,
    cardReaderDone: normalized.cardReaderDone,
    payload4: normalized.payload4,
    enableUnsafeLibraries: normalized.enableUnsafeLibraries,
  }, validLuaLib);
  if (!validLuaLib.value) {
    outDuel.value = undefined;
    return DUEL_CREATION_STATUS.OCG_DUEL_CREATION_INCOMPATIBLE_LUA_API;
  }
  outDuel.value = duel;
  return DUEL_CREATION_STATUS.OCG_DUEL_CREATION_SUCCESS;
}

/**
 * Deallocates the duel instance created by OCG_CreateDuel.
 * @param {Duel|undefined} duel Duel handle to destroy.
 * @returns {void}
 */
function OCG_DestroyDuel(duel) {
  duel?.destroy();
}

/**
 * Resolves a numeric location mask into the field storage key.
 * @param {number} loc Location mask from {@link OCG_CONSTANTS}.
 * @returns {string|undefined} Storage key expected by {@link Field#add_card}.
 */
function resolveLocation(loc) {
  if (loc === OCG_CONSTANTS.LOCATION_MZONE) return 'MZONE';
  if (loc === OCG_CONSTANTS.LOCATION_SZONE) return 'SZONE';
  if (loc === OCG_CONSTANTS.LOCATION_DECK) return 'DECK';
  if (loc === OCG_CONSTANTS.LOCATION_HAND) return 'HAND';
  if (loc === OCG_CONSTANTS.LOCATION_GRAVE) return 'GRAVE';
  if (loc === OCG_CONSTANTS.LOCATION_REMOVED) return 'REMOVED';
  if (loc === OCG_CONSTANTS.LOCATION_EXTRA) return 'EXTRA';
  return undefined;
}

/**
 * Adds the card specified by `info` to the duel.
 * @param {Duel|undefined} duel Duel handle receiving the card.
 * @param {NewCardInfo} info Card description for creation.
 * @returns {void}
 */
function OCG_DuelNewCard(duel, info) {
  if (!duel || !info) return;
  const location = resolveLocation(info.loc);
  if (!location) return;
  const card = duel.new_card(info.code);
  card.owner = info.team ?? 0;
  card.current.position = info.pos ?? 0;
  duel.game_field?.add_card(info.con ?? 0, card, location, info.seq ?? 0);
}

/**
 * Starts the duel simulation and state machine after configuration is complete.
 * @param {Duel|undefined} duel Duel handle to start.
 * @returns {void}
 */
function OCG_StartDuel(duel) {
  duel?.game_field?.reload_field_info();
}

/**
 * Runs the state machine to progress the duel or after a waiting state requiring a response.
 * Returns `OCG_DuelStatus` enum values.
 * @param {Duel|undefined} duel Duel handle to process.
 * @returns {number} Duel status value.
 */
function OCG_DuelProcess(duel) {
  if (!duel) return DUEL_STATUS.OCG_DUEL_STATUS_END;
  if (!duel.game_field?.process) return DUEL_STATUS.OCG_DUEL_STATUS_END;
  const flag = duel.game_field.process();
  duel.generate_buffer();
  return flag ?? DUEL_STATUS.OCG_DUEL_STATUS_CONTINUE;
}

/**
 * Provides a pointer to the internal buffer containing binary messages from the duel simulation.
 * Subsequent calls invalidate previous buffers; the size is written to `lengthRef` if provided.
 * @param {Duel|undefined} duel Duel handle to query.
 * @param {{ value?: number }|undefined} lengthRef Placeholder for length reference.
 * @returns {Buffer|undefined} Message buffer.
 */
function OCG_DuelGetMessage(duel, lengthRef) {
  if (!duel) return undefined;
  duel.generate_buffer();
  if (lengthRef && typeof lengthRef === 'object') lengthRef.value = duel.buff.length;
  return duel.buff;
}

/**
 * Sets the next player response for the duel simulation; contents are copied internally.
 * @param {Duel|undefined} duel Duel handle to receive the response.
 * @param {Buffer|Uint8Array|ArrayBuffer|number[]} buffer Binary response buffer.
 * @param {number} length Length of the response buffer.
 * @returns {void}
 */
function OCG_DuelSetResponse(duel, buffer, length) {
  if (!duel) return;
  duel.set_response(buffer, length);
}

/**
 * Loads a Lua card or support script for the specified duel.
 * Returns positive on success and zero on failure.
 * @param {Duel|undefined} duel Duel handle.
 * @param {Buffer|Uint8Array|ArrayBuffer|string} buffer Script content.
 * @param {number} length Size of the buffer.
 * @param {string} name Unique script identifier.
 * @returns {number} Load status code (1 for success, 0 for failure).
 */
function OCG_LoadScript(duel, buffer, length, name) {
  if (!duel || !duel.lua) return 0;
  const content = bufferFrom(buffer, length);
  const loaded = duel.lua.load_script(content, content.length, name);
  return loaded ? 1 : 0;
}

/**
 * Returns the number of cards in the specified zone.
 * @param {Duel|undefined} duel Duel handle.
 * @param {number} team Team identifier.
 * @param {number} loc Location mask.
 * @returns {number} Card count.
 */
function OCG_DuelQueryCount(duel, team, loc) {
  if (!duel?.game_field?.player || team > 1) return 0;
  const player = duel.game_field.player[team];
  if (!player) return 0;
  if (loc === OCG_CONSTANTS.LOCATION_HAND) return player.list_hand.length;
  if (loc === OCG_CONSTANTS.LOCATION_GRAVE) return player.list_grave.length;
  if (loc === OCG_CONSTANTS.LOCATION_REMOVED) return player.list_remove.length;
  if (loc === OCG_CONSTANTS.LOCATION_EXTRA) return player.list_extra.length;
  if (loc === OCG_CONSTANTS.LOCATION_DECK) return player.list_main.length;
  if (loc === OCG_CONSTANTS.LOCATION_MZONE) return player.list_mzone.filter(Boolean).length;
  if (loc === OCG_CONSTANTS.LOCATION_SZONE) return player.list_szone.filter(Boolean).length;
  return 0;
}

/**
 * Serializes a single card query into a buffer.
 * @param {Duel|undefined} duel Duel handle.
 * @param {QueryInfo} info Query description.
 * @returns {Buffer|undefined} Serialized card snapshot.
 */
function serializeCardQuery(duel, info) {
  if (!duel?.game_field) return undefined;
  const player = duel.game_field.player[info.con];
  if (!player) return undefined;
  const location = resolveLocation(info.loc);
  if (!location) return undefined;
  let card;
  if (location === 'MZONE') card = player.list_mzone[info.seq];
  if (!card && location === 'SZONE') card = player.list_szone[info.seq];
  if (!card && location === 'HAND') card = player.list_hand[info.seq];
  if (!card && location === 'GRAVE') card = player.list_grave[info.seq];
  if (!card && location === 'REMOVED') card = player.list_remove[info.seq];
  if (!card && location === 'EXTRA') card = player.list_extra[info.seq];
  if (!card && location === 'DECK') card = player.list_main[info.seq];
  if (!card) return undefined;
  const payload = JSON.stringify({
    code: card.data?.code ?? 0,
    location: card.current?.location ?? info.loc,
    position: card.current?.position ?? 0,
    sequence: card.current?.sequence ?? info.seq,
  });
  return Buffer.from(payload, 'utf8');
}

/**
 * Returns a pointer to an internal buffer for the first card matching the query.
 * Subsequent calls invalidate previous queries; size is written to `lengthRef` if provided.
 * @param {Duel|undefined} duel Duel handle.
 * @param {{ value?: number }|undefined} lengthRef Placeholder for length reference.
 * @param {QueryInfo} info Query description.
 * @returns {Buffer|undefined} Query result buffer.
 */
function OCG_DuelQuery(duel, lengthRef, info) {
  const buffer = serializeCardQuery(duel, info || new QueryInfo());
  if (!buffer) return undefined;
  if (lengthRef && typeof lengthRef === 'object') lengthRef.value = buffer.length;
  return buffer;
}

/**
 * Returns a pointer to an internal buffer for all cards matching the query.
 * Subsequent calls invalidate previous queries; size is written to `lengthRef` if provided.
 * @param {Duel|undefined} duel Duel handle.
 * @param {{ value?: number }|undefined} lengthRef Placeholder for length reference.
 * @param {QueryInfo} info Query description.
 * @returns {Buffer|undefined} Query result buffer.
 */
function OCG_DuelQueryLocation(duel, lengthRef, info) {
  if (!duel?.game_field) return undefined;
  const query = info || new QueryInfo();
  const player = duel.game_field.player[query.con];
  if (!player) return undefined;
  const location = resolveLocation(query.loc);
  if (!location) return undefined;
  const lists = {
    MZONE: player.list_mzone,
    SZONE: player.list_szone,
    HAND: player.list_hand,
    GRAVE: player.list_grave,
    REMOVED: player.list_remove,
    EXTRA: player.list_extra,
    DECK: player.list_main,
  };
  const cards = lists[location] || [];
  const payload = cards.map((card, index) => ({
    code: card?.data?.code ?? 0,
    position: card?.current?.position ?? 0,
    sequence: index,
    occupied: Boolean(card),
  }));
  const buffer = Buffer.from(JSON.stringify(payload), 'utf8');
  if (lengthRef && typeof lengthRef === 'object') lengthRef.value = buffer.length;
  return buffer;
}

/**
 * Returns a pointer to an internal buffer containing card counts for every zone in the game.
 * Subsequent calls invalidate previous queries; size is written to `lengthRef` if provided.
 * @param {Duel|undefined} duel Duel handle.
 * @param {{ value?: number }|undefined} lengthRef Placeholder for length reference.
 * @returns {Buffer|undefined} Query result buffer.
 */
function OCG_DuelQueryField(duel, lengthRef) {
  if (!duel?.game_field) return undefined;
  const snapshot = duel.game_field.reload_field_info();
  const buffer = Buffer.from(JSON.stringify(snapshot), 'utf8');
  if (lengthRef && typeof lengthRef === 'object') lengthRef.value = buffer.length;
  return buffer;
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
  OCG_CONSTANTS,
  DUEL_STATUS,
  DUEL_CREATION_STATUS,
  DuelOptions,
  PlayerInfo,
  NewCardInfo,
  QueryInfo,
  OcgApi,
};
