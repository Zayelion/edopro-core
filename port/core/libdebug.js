// Implements libdebug.cpp
const { CARD_LOCATIONS } = require('./card');
const { ScriptLib } = require('./scriptlib');

const MSG_AI_NAME = 0x16;
const MSG_SHOW_HINT = 0x17;

/**
 * Normalizes a numeric location constant into the field-friendly string identifiers.
 * @param {number} location Raw location mask.
 * @returns {string|undefined} String location understood by {@link Field#add_card}.
 */
const normalizeLocation = (location) => {
  if (location === CARD_LOCATIONS.LOCATION_MZONE) return 'MZONE';
  if (location === CARD_LOCATIONS.LOCATION_SZONE) return 'SZONE';
  if (location === CARD_LOCATIONS.LOCATION_DECK) return 'DECK';
  if (location === CARD_LOCATIONS.LOCATION_HAND) return 'HAND';
  if (location === CARD_LOCATIONS.LOCATION_GRAVE) return 'GRAVE';
  if (location === CARD_LOCATIONS.LOCATION_REMOVED) return 'REMOVED';
  if (location === CARD_LOCATIONS.LOCATION_EXTRA) return 'EXTRA';
  return undefined;
};

/**
 * Sends a debug message through the duel logger for every argument supplied.
 * @param {import('./duel').Duel} duel Duel receiving the messages.
 * @param {...unknown} parts Message fragments to concatenate.
 * @returns {void}
 */
const message = (duel, ...parts) => {
  if (!duel) return;
  if (!parts.length) return;
  for (const part of parts) {
    const text = `${part}`;
    duel.handle_message_callback(duel.handle_message_payload, text);
  }
};

/**
 * Adds a new card to the field respecting the provided placement information.
 * @param {import('./duel').Duel} duel Duel hosting the card.
 * @param {number} code Card identifier to create.
 * @param {number} owner Owning player index.
 * @param {number} playerid Controlling player index.
 * @param {number} location Location mask.
 * @param {number} sequence Sequence index inside the location.
 * @param {number} position Position mask applied to the card.
 * @param {boolean} [proc=false] Whether to mark the summon procedure as complete.
 * @returns {import('./card').Card|undefined} Newly created card when placed.
 */
const addCard = (duel, code, owner, playerid, location, sequence, position, proc = false) => {
  if (!duel?.game_field) return undefined;
  if (owner !== 0 && owner !== 1) return undefined;
  if (playerid !== 0 && playerid !== 1) return undefined;
  const normalized = normalizeLocation(location);
  if (!normalized) throw new Error('Passed invalid location');
  if (!duel.game_field.player[playerid]) throw new Error('Passed invalid location');
  const card = duel.new_card(code);
  card.owner = owner;
  card.current = card.current || {};
  card.current.position = position ?? card.current.position ?? 0;
  duel.game_field.add_card(playerid, card, normalized, sequence);
  if (proc) card.status = card.status | 0x100000;
  return card;
};

/**
 * Overwrites life points and draw configuration for a player.
 * @param {import('./duel').Duel} duel Duel whose player info will be mutated.
 * @param {number} playerid Player identifier.
 * @param {number} lp Life points value.
 * @param {number} startcount Starting hand size.
 * @param {number} drawcount Cards drawn per turn.
 * @returns {void}
 */
const setPlayerInfo = (duel, playerid, lp, startcount, drawcount) => {
  if (!duel?.game_field) return;
  if (playerid !== 0 && playerid !== 1) return;
  const player = duel.game_field.player[playerid];
  if (!player) return;
  player.lp = lp;
  player.start_lp = lp;
  player.start_count = startcount;
  player.draw_count = drawcount;
};

/**
 * Pre-configures the summon parameters for a card.
 * @param {import('./card').Card} card Card to annotate.
 * @param {number} summonType Summon type flag.
 * @param {number} [summonLocation=0] Summon location.
 * @param {number} [summonSequence=0] Summon sequence.
 * @param {boolean} [summonPzone=false] Whether the summon originated from the pendulum zone.
 * @returns {void}
 */
const preSummon = (card, summonType, summonLocation = 0, summonSequence = 0, summonPzone = false) => {
  if (!card) return;
  card.summon.location = summonLocation;
  card.summon.type = summonType;
  card.summon.sequence = summonSequence;
  card.summon.pzone = summonPzone;
};

/**
 * Equips a card to a target when the board state allows it.
 * @param {import('./card').Card} equipCard Equip card instance.
 * @param {import('./card').Card} target Card to receive the equip.
 * @returns {boolean} True when the equip succeeded.
 */
const preEquip = (equipCard, target) => {
  if (!equipCard || !target) return false;
  const equipLocation = equipCard.current?.location;
  const targetLocation = target.current?.location;
  const targetPosition = target.current?.position ?? 0;
  const facedownDefense = targetPosition & 0x2;
  if (equipLocation !== 'SZONE') return false;
  if (targetLocation !== 'MZONE') return false;
  if (facedownDefense) return false;
  equipCard.equiping_target = target;
  equipCard.effect_target_cards.add(target);
  target.effect_target_owner = target.effect_target_owner || new Set();
  target.effect_target_owner.add(equipCard);
  return true;
};

/**
 * Adds a card-to-card targeting relationship used by effects.
 * @param {import('./card').Card} source Card declaring the target.
 * @param {import('./card').Card} target Targeted card.
 * @returns {void}
 */
const preSetTarget = (source, target) => {
  if (!source || !target) return;
  source.add_card_target = source.add_card_target || ((cardTarget) => {
    source.effect_target_cards = source.effect_target_cards || new Set();
    source.effect_target_cards.add(cardTarget);
  });
  source.add_card_target(target);
};

/**
 * Primes the counter map on a card without enforcing permissions.
 * @param {import('./card').Card} card Card to receive counters.
 * @param {number} countertype Counter identifier.
 * @param {number} count Amount to add.
 * @returns {void}
 */
const preAddCounter = (card, countertype, count) => {
  if (!card) return;
  card.counters = card.counters || new Map();
  const cttype = countertype & ~0x1000;
  const entry = card.counters.get(cttype) || { permitted: 0, unrestricted: 0 };
  const withoutPermit = (countertype & 0x1000) !== 0 && (countertype & 0x2000) === 0;
  if (withoutPermit) entry.unrestricted += count;
  if (!withoutPermit) entry.permitted += count;
  card.counters.set(cttype, entry);
};

/**
 * Clears the duel state and seeds the duel options for a reload.
 * @param {import('./duel').Duel} duel Duel being reset.
 * @param {number} flag Duel option bitmask.
 * @param {number} [rule=3] Master rule placeholder.
 * @param {boolean} [build=false] Whether the reload is being built for visualization only.
 * @returns {void}
 */
const reloadFieldBegin = (duel, flag, rule = 3, build = false) => {
  if (!duel) return;
  duel.clear();
  const field = duel.game_field;
  if (!field) return;
  let options = flag;
  const shouldApplyRule = rule && !build;
  if (shouldApplyRule) options |= flag;
  field.core.duel_options = options;
};

/**
 * Finalizes a field reload by resetting shuffle checks and returning a snapshot.
 * @param {import('./duel').Duel} duel Duel being updated.
 * @returns {object|undefined} Field snapshot produced by {@link Field#reload_field_info}.
 */
const reloadFieldEnd = (duel) => {
  if (!duel?.game_field) return undefined;
  const { core } = duel.game_field;
  core.shuffle_hand_check[0] = false;
  core.shuffle_hand_check[1] = false;
  core.shuffle_deck_check[0] = false;
  core.shuffle_deck_check[1] = false;
  return duel.game_field.reload_field_info();
};

/**
 * Writes a string payload into the duel message queue with the desired message code.
 * @param {import('./duel').Duel} duel Duel hosting the message.
 * @param {number} messageCode Message identifier.
 * @param {string} value String payload.
 * @returns {void}
 */
const writeStringMessage = (duel, messageCode, value) => {
  if (!duel || typeof value !== 'string') return;
  const message = duel.new_message(messageCode);
  const length = Math.min(value.length, 1024);
  const lengthBuffer = Buffer.alloc(2);
  lengthBuffer.writeUInt16LE(length, 0);
  message.write(lengthBuffer);
  message.write(Buffer.from(value).subarray(0, length));
  message.writeUint8(0);
};

/**
 * Sets the AI name by emitting a message to the duel buffer.
 * @param {import('./duel').Duel} duel Target duel instance.
 * @param {string} name Name to assign.
 * @returns {void}
 */
const setAIName = (duel, name) => writeStringMessage(duel, MSG_AI_NAME, name);

/**
 * Emits a hint message to the duel buffer.
 * @param {import('./duel').Duel} duel Target duel instance.
 * @param {string} hint Hint content.
 * @returns {void}
 */
const showHint = (duel, hint) => writeStringMessage(duel, MSG_SHOW_HINT, hint);

/**
 * Dumps the current stack trace to the console to aid debugging.
 * @returns {void}
 */
const printStacktrace = () => {
  const trace = new Error('Debug stacktrace');
  // eslint-disable-next-line no-console
  console.error(trace.stack);
};

/**
 * Provides a string representation for cards or generic values.
 * @param {import('./card').Card|unknown} card Card instance or any value.
 * @returns {string} Human-readable description.
 */
const cardToStringWrapper = (card) => {
  if (card?.data) return `Card(${card.data.code ?? 0})`;
  if (typeof card === 'undefined') return 'undefined';
  return `${card}`;
};

/**
 * Registers the debug library bindings into the provided registry or returns them as a map.
 * @param {ScriptLib} registry Registry receiving the debug exports.
 * @returns {{ [key: string]: Function }} Registered function map when registry is absent.
 */
function registerDebugLibrary(registry) {
  const exports = {
    Message: message,
    AddCard: addCard,
    SetPlayerInfo: setPlayerInfo,
    PreSummon: preSummon,
    PreEquip: preEquip,
    PreSetTarget: preSetTarget,
    PreAddCounter: preAddCounter,
    ReloadFieldBegin: reloadFieldBegin,
    ReloadFieldEnd: reloadFieldEnd,
    SetAIName: setAIName,
    ShowHint: showHint,
    PrintStacktrace: printStacktrace,
    CardToStringWrapper: cardToStringWrapper,
  };
  if (!(registry instanceof ScriptLib)) return exports;
  for (const [name, fn] of Object.entries(exports)) {
    registry.add(name, fn);
  }
  return exports;
}

module.exports = {
  registerDebugLibrary,
};
