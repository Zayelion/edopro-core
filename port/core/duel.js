// Implements duel.cpp
const { Card } = require('./card');
const { Effect } = require('./effect');
const { Group } = require('./group');
const { Interpreter } = require('./interpreter');
const { Field } = require('./field');

/* eslint-disable max-classes-per-file */

/**
 * Represents immutable card data copied from the C++ structure.
 */
class CardData {
  /**
   * @param {object} data Raw card data matching the fields of OCG_CardData.
   */
  constructor(data) {
    this.code = data.code || 0;
    this.alias = data.alias || 0;
    this.type = data.type || 0;
    this.level = data.level || 0;
    this.attribute = data.attribute || 0;
    this.race = data.race || 0;
    this.attack = data.attack || 0;
    this.defense = data.defense || 0;
    this.lscale = data.lscale || 0;
    this.rscale = data.rscale || 0;
    this.link_marker = data.link_marker || 0;
    this.setcodes = new Set();
    if (Array.isArray(data.setcodes)) {
      for (const code of data.setcodes) {
        if (code === 0) break;
        this.setcodes.add(code);
      }
    }
  }
}

/**
 * Represents a single binary message being buffered for the client.
 */
class DuelMessage {
  /**
   * @param {number} message Initial message identifier.
   */
  constructor(message) {
    this.data = Buffer.alloc(0);
    this.writeUint8(message);
  }

  /**
   * Appends raw binary content to the message buffer.
   * @param {Buffer|Uint8Array|ArrayBuffer|number[]} buff Data to append.
   * @param {number} [size] Optional byte length to respect from the provided buffer.
   */
  write(buff, size) {
    if (!buff || size === 0) return;
    const content = bufferFrom(buff, size);
    if (content.length === 0) return;
    this.data = Buffer.concat([this.data, content]);
  }

  /**
   * Writes location info into the message using the structure from duel.cpp.
   * @param {{ controler: number, location: number, sequence: number, position: number }} loc Location structure.
   */
  writeLoc(loc) {
    this.writeUint8(loc.controler);
    this.writeUint8(loc.location);
    this.writeUint32(loc.sequence);
    this.writeUint32(loc.position);
  }

  /**
   * Writes an unsigned 8-bit integer to the buffer.
   * @param {number} value Number to encode.
   */
  writeUint8(value) {
    const buff = Buffer.alloc(1);
    buff.writeUInt8(value >>> 0, 0);
    this.write(buff);
  }

  /**
   * Writes an unsigned 32-bit integer to the buffer.
   * @param {number} value Number to encode.
   */
  writeUint32(value) {
    const buff = Buffer.alloc(4);
    buff.writeUInt32LE(value >>> 0, 0);
    this.write(buff);
  }
}

/**
 * Coerces arbitrary binary-like inputs into a Node.js Buffer.
 * @param {Buffer|Uint8Array|ArrayBuffer|number[]} input Source data.
 * @param {number} [size] Optional byte length to slice from the input.
 * @returns {Buffer} Normalized buffer.
 */
function bufferFrom(input, size) {
  if (!input) return Buffer.alloc(0);
  let buff;
  if (Buffer.isBuffer(input)) buff = input;
  if (!buff && input instanceof Uint8Array) buff = Buffer.from(input.buffer, input.byteOffset, input.byteLength);
  if (!buff && input instanceof ArrayBuffer) buff = Buffer.from(input);
  if (!buff && Array.isArray(input)) buff = Buffer.from(input);
  if (!buff) return Buffer.alloc(0);
  if (typeof size === 'number') return buff.subarray(0, size);
  return buff;
}

/**
 * Deterministic pseudo-random number generator using xorshift128.
 * Mirrors the semantics of the C++ std::mt19937 usage by exposing a
 * {@link next} method and a {@link max} constant.
 */
class XorShift128 {
  /**
   * @param {number[]} seeds Four-element seed array used to initialize the generator.
   */
  constructor(seeds = [0, 0, 0, 0]) {
    const normalized = seeds.slice(0, 4);
    while (normalized.length < 4) normalized.push(0);
    // Avoid the all-zero state which would stall the generator.
    this.state = normalized.map((value, index) => (value >>> 0) || ((index + 1) * 1812433253));
    this.max = 0xffffffff;
  }

  /**
   * Generates the next 32-bit unsigned integer.
   * @returns {number} Next pseudo-random integer.
   */
  next() {
    let [x, y, z, w] = this.state;
    const t = x ^ (x << 11);
    x = y;
    y = z;
    z = w;
    // eslint-disable-next-line no-bitwise
    w = (w ^ (w >>> 19) ^ (t ^ (t >>> 8))) >>> 0;
    this.state = [x, y, z, w];
    return w;
  }
}

/**
 * Port of the duel.cpp logic into JavaScript.
 */
class Duel {
  /**
   * Mirrors the C++ constructor by setting up RNG, callbacks and helper objects.
   * @param {object} options Duel configuration mirroring OCG_DuelOptions.
   * @param {{ value: boolean }} validLuaLib Mutable flag signalling interpreter validity.
   */
  constructor(options = {}, validLuaLib = { value: true }) {
    const seedArray = Array.isArray(options.seed) ? options.seed : [0, 0, 0, 0];
    this.random = new XorShift128(seedArray);
    this.read_card_callback = options.cardReader || (() => {});
    this.read_script_callback = options.scriptReader || (() => {});
    this.handle_message_callback = options.logHandler || (() => {});
    this.read_card_done_callback = options.cardReaderDone || (() => {});
    this.read_card_payload = options.payload1;
    this.read_script_payload = options.payload2;
    this.handle_message_payload = options.payload3;
    this.read_card_done_payload = options.payload4;
    this.cards = new Set();
    this.groups = new Set();
    this.effects = new Set();
    this.assumes = new Set();
    this.messages = [];
    this.buff = Buffer.alloc(0);
    this.data_cache = new Map();
    this.lua = new Interpreter(this, options);
    if (!validLuaLib.value) return;
    this.game_field = new Field(this, options);
    this.game_field.temp_card = this.new_card(0);
  }

  /**
   * Cleans up allocated structures to mirror the C++ destructor.
   */
  destroy() {
    for (const card of this.cards) {
      this.cards.delete(card);
    }
    for (const group of this.groups) {
      group.container.clear();
      group.isIteratorDirty = true;
    }
    for (const effect of this.effects) {
      this.effects.delete(effect);
    }
    this.game_field = undefined;
    this.lua = undefined;
    for (const group of this.groups) {
      this.groups.delete(group);
    }
  }

  /**
   * Resets duel state mirroring duel::clear.
   */
  clear() {
    const defaultOptions = { seed: [0, 0, 0, 0], players: [{ life: 8000, hand: 5, draw: 1 }, { life: 8000, hand: 5, draw: 1 }] };
    for (const card of this.cards) {
      this.cards.delete(card);
    }
    for (const effect of this.effects) {
      this.lua?.unregister_effect(effect);
      this.effects.delete(effect);
    }
    this.game_field = undefined;
    this.lua?.collect(true);
    this.cards.clear();
    for (const group of this.groups) {
      group.container.clear();
      group.isIteratorDirty = true;
    }
    this.effects.clear();
    this.game_field = new Field(this, defaultOptions);
    this.game_field.temp_card = this.new_card(0);
  }

  /**
   * Creates a new card instance associated with the duel.
   * @param {number} code Card identifier to load via callback.
   * @returns {Card} Newly created card.
   */
  new_card(code) {
    const card = new Card(this);
    card.data = new CardData({});
    this.cards.add(card);
    if (code) card.data = this.read_card(code);
    card.data.code = code;
    this.lua?.register_card(card);
    return card;
  }

  /**
   * Creates a new effect instance associated with the duel.
   * @returns {Effect} Newly created effect.
   */
  new_effect() {
    const effect = new Effect(this);
    this.effects.add(effect);
    this.lua?.register_effect(effect);
    return effect;
  }

  /**
   * Deletes a card from the duel.
   * @param {Card} card Card instance to remove.
   */
  delete_card(card) {
    this.cards.delete(card);
  }

  /**
   * Deletes a group from the duel.
   * @param {Group} group Group instance to remove.
   */
  delete_group(group) {
    this.groups.delete(group);
  }

  /**
   * Deletes an effect from the duel, unregistering it first.
   * @param {Effect} effect Effect instance to remove.
   */
  delete_effect(effect) {
    this.lua?.unregister_effect(effect);
    this.effects.delete(effect);
  }

  /**
   * Serializes queued messages into the buffer just like duel::generate_buffer.
   */
  generate_buffer() {
    for (const message of this.messages) {
      const size = message.data.length >>> 0;
      if (size === 0) continue;
      const sizeBuffer = Buffer.alloc(4);
      sizeBuffer.writeUInt32LE(size, 0);
      this.write_buffer(sizeBuffer, sizeBuffer.length);
      this.write_buffer(message.data, size);
    }
    this.messages = [];
  }

  /**
   * Clears the assumed effects from tracked cards.
   */
  restore_assumes() {
    for (const card of this.assumes) {
      card.assume.clear();
    }
    this.assumes.clear();
  }

  /**
   * Writes raw bytes to the internal buffer.
   * @param {Buffer|Uint8Array|ArrayBuffer|number[]} data Binary content.
   * @param {number} size Number of bytes to write.
   */
  write_buffer(data, size) {
    if (size === 0) return;
    const slice = bufferFrom(data, size);
    if (slice.length === 0) return;
    this.buff = Buffer.concat([this.buff, slice]);
  }

  /**
   * Clears the outgoing buffer.
   */
  clear_buffer() {
    this.buff = Buffer.alloc(0);
  }

  /**
   * Stores the next response buffer on the field.
   * @param {Buffer|Uint8Array|ArrayBuffer|number[]} resp Response data.
   * @param {number} len Size of the response data.
   */
  set_response(resp, len) {
    if (!this.game_field) return;
    const responseBuffer = bufferFrom(resp, len);
    this.game_field.returns.data = Buffer.alloc(len);
    if (len === 0) return;
    responseBuffer.copy(this.game_field.returns.data, 0, 0, len);
  }

  /**
   * Provides a uniform integer distribution between l and h inclusive.
   * @param {number} l Lower bound.
   * @param {number} h Upper bound.
   * @returns {number} Generated integer in range.
   */
  get_next_integer(l, h) {
    if (l > h) throw new Error('Lower bound must not exceed upper bound');
    const range = BigInt(h) - BigInt(l) + 1n;
    const lim = BigInt(this.random.max % Number(range));
    let n;
    do {
      n = BigInt(this.random.next());
    } while (n <= lim);
    return Number(n % range) + l;
  }

  /**
   * Creates a new {@link DuelMessage} and appends it to the queue.
   * @param {number} message Message identifier.
   * @returns {DuelMessage} The newly created message instance.
   */
  new_message(message) {
    const duelMessage = new DuelMessage(message);
    this.messages.push(duelMessage);
    return duelMessage;
  }

  /**
   * Reads a card from the cache or delegates to the card reader callback.
   * @param {number} code Card identifier.
   * @returns {CardData} Cached or freshly loaded card data.
   */
  read_card(code) {
    if (this.data_cache.has(code)) return this.data_cache.get(code);
    const data = {};
    this.read_card_callback(this.read_card_payload, code, data);
    const cardData = new CardData(data);
    this.data_cache.set(code, cardData);
    this.read_card_done_callback(this.read_card_done_payload, data);
    return cardData;
  }
}

module.exports = {
  Duel,
  DuelMessage,
  CardData,
  bufferFrom,
  XorShift128,
  Card,
  Effect,
  Group,
  Interpreter,
  Field,
};
