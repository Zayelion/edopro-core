// Implements card.cpp

/**
 * Sentinel helper to mirror the C++ set0xff semantics.
 * @param {number} width Bit width of the target value.
 * @returns {number} Maximum unsigned integer for the provided width.
 */
const maxUnsigned = (width) => (2 ** width) - 1;

/**
 * Card location constants mirrored from ocgapi_constants.h.
 */
const CARD_LOCATIONS = {
  LOCATION_DECK: 0x01,
  LOCATION_HAND: 0x02,
  LOCATION_MZONE: 0x04,
  LOCATION_SZONE: 0x08,
  LOCATION_GRAVE: 0x10,
  LOCATION_REMOVED: 0x20,
  LOCATION_EXTRA: 0x40,
  LOCATION_OVERLAY: 0x80,
  LOCATION_ONFIELD: 0x0c,
};

/**
 * Card type constants mirrored from ocgapi_constants.h.
 */
const CARD_TYPES = {
  TYPE_MONSTER: 0x1,
  TYPE_SPELL: 0x2,
  TYPE_TRAP: 0x4,
  TYPE_NORMAL: 0x10,
  TYPE_EFFECT: 0x20,
  TYPE_FUSION: 0x40,
  TYPE_RITUAL: 0x80,
  TYPE_TRAPMONSTER: 0x100,
  TYPE_SPIRIT: 0x200,
  TYPE_UNION: 0x400,
  TYPE_GEMINI: 0x800,
  TYPE_TUNER: 0x1000,
  TYPE_SYNCHRO: 0x2000,
  TYPE_TOKEN: 0x4000,
  TYPE_MAXIMUM: 0x8000,
  TYPE_QUICKPLAY: 0x10000,
  TYPE_CONTINUOUS: 0x20000,
  TYPE_EQUIP: 0x40000,
  TYPE_FIELD: 0x80000,
  TYPE_COUNTER: 0x100000,
  TYPE_FLIP: 0x200000,
  TYPE_TOON: 0x400000,
  TYPE_XYZ: 0x800000,
  TYPE_PENDULUM: 0x1000000,
  TYPE_SPSUMMON: 0x2000000,
  TYPE_LINK: 0x4000000,
};

/**
 * Player identifiers mirrored from ocgapi_constants.h.
 */
const PLAYERS = {
  PLAYER_NONE: 2,
};

/**
 * Checks whether a numeric mask includes a specific power-of-two flag.
 * @param {number} value Value to inspect.
 * @param {number} mask Flag to check.
 * @returns {boolean} True when the flag is present.
 */
const hasMask = (value, mask) => (Math.trunc(value / mask) % 2) === 1;

/**
 * Lightweight snapshot of the card state.
 */
class CardState {
  /**
   * Creates a new card state with default values.
   */
  constructor() {
    this.code = 0;
    this.code2 = 0;
    this.setcodes = new Set();
    this.type = 0;
    this.level = 0;
    this.rank = 0;
    this.link = 0;
    this.link_marker = 0;
    this.lscale = 0;
    this.rscale = 0;
    this.attribute = 0;
    this.race = 0;
    this.attack = 0;
    this.defense = 0;
    this.base_attack = 0;
    this.base_defense = 0;
    this.controler = PLAYERS.PLAYER_NONE;
    this.location = 0;
    this.sequence = 0;
    this.position = 0;
    this.reason = 0;
    this.reason_card = undefined;
    this.reason_player = PLAYERS.PLAYER_NONE;
    this.reason_effect = undefined;
    this.pzone = false;
  }

  /**
   * Fills all numeric properties with their maximum unsigned value.
   * @returns {void}
   */
  set0xff() {
    this.code = maxUnsigned(32);
    this.code2 = maxUnsigned(32);
    this.type = maxUnsigned(32);
    this.level = maxUnsigned(32);
    this.rank = maxUnsigned(32);
    this.link = maxUnsigned(32);
    this.link_marker = maxUnsigned(32);
    this.lscale = maxUnsigned(32);
    this.rscale = maxUnsigned(32);
    this.attribute = maxUnsigned(32);
    this.race = maxUnsigned(32);
    this.attack = maxUnsigned(32);
    this.defense = maxUnsigned(32);
    this.base_attack = maxUnsigned(32);
    this.base_defense = maxUnsigned(32);
    this.controler = maxUnsigned(8);
    this.location = maxUnsigned(8);
    this.sequence = maxUnsigned(32);
    this.position = maxUnsigned(32);
    this.reason = maxUnsigned(32);
    this.reason_player = maxUnsigned(8);
  }

  /**
   * Checks whether the state matches a given location mask.
   * @param {number} loc Location mask.
   * @returns {boolean} True when the state matches the mask.
   */
  is_location(loc) {
    const flags = Object.values(CARD_LOCATIONS);
    for (const flag of flags) {
      if (hasMask(loc, flag) && hasMask(this.location, flag)) return true;
    }
    return false;
  }
}

/**
 * Tracks attacker card relationships.
 */
class AttackerMap extends Map {
  /**
   * Instantiates the attacker map.
   */
  constructor() {
    super();
  }

  /**
   * Adds or increments an entry for the provided card.
   * @param {Card} card Card being registered.
   * @returns {void}
   */
  addcard(card) {
    const fid = card ? card.fieldid_r : 0;
    const existing = this.get(fid) || { card: undefined, count: 0 };
    existing.card = card;
    existing.count += 1;
    this.set(fid, existing);
  }

  /**
   * Finds how many times a card was registered.
   * @param {Card} card Card to look up.
   * @returns {number} Number of registrations.
   */
  findcard(card) {
    const fid = card ? card.fieldid_r : 0;
    const entry = this.get(fid);
    if (!entry) return 0;
    return entry.count;
  }
}

/**
 * High-level representation of a card instance within a duel.
 * Mirrors key portions of card.cpp.
 */
class Card {
  /**
   * @param {import('./duel').Duel} duel Owning duel instance.
   */
  constructor(duel) {
    this.duel = duel;
    this.data = {};
    this.previous = new CardState();
    this.temp = new CardState();
    this.current = new CardState();
    this.owner = PLAYERS.PLAYER_NONE;
    this.summon = { type: 0, player: 0, location: 0, sequence: 0, pzone: false };
    this.status = 0;
    this.cover = 0;
    this.assume = new Map();
    this.overlay_target = undefined;
    this.equiping_target = undefined;
    this.effect_target_cards = new Set();
    this.xyz_materials = [];
    this.fieldid_r = 0;
  }

  /**
   * Comparator used to order cards in operations.
   * @param {Card} first First card.
   * @param {Card} second Second card.
   * @returns {boolean} True when the first card should precede the second.
   */
  static card_operation_sort(first, second) {
    const duel = first.duel;
    const cp1 = first.overlay_target?.current.controler ?? first.current.controler;
    const cp2 = second.overlay_target?.current.controler ?? second.current.controler;
    if (cp1 !== cp2) {
      if (cp1 === PLAYERS.PLAYER_NONE || cp2 === PLAYERS.PLAYER_NONE) return cp1 < cp2;
      const goesFirst = duel?.game_field?.infos?.turn_player === 0;
      if (goesFirst) return cp1 < cp2;
      return cp1 > cp2;
    }
    if (first.current.location !== second.current.location) return first.current.location < second.current.location;
    const firstLocation = first.current.location ?? 0;
    if (hasMask(firstLocation, CARD_LOCATIONS.LOCATION_OVERLAY)) {
      const seq1 = first.overlay_target?.current.sequence ?? 0;
      const seq2 = second.overlay_target?.current.sequence ?? 0;
      if (seq1 !== seq2) return seq1 < seq2;
      return first.current.sequence < second.current.sequence;
    }
    const deckMasks = [
      CARD_LOCATIONS.LOCATION_DECK,
      CARD_LOCATIONS.LOCATION_EXTRA,
      CARD_LOCATIONS.LOCATION_GRAVE,
      CARD_LOCATIONS.LOCATION_REMOVED,
    ];
    const inDeckArea = deckMasks.some((mask) => hasMask(firstLocation, mask));
    if (inDeckArea) return first.current.sequence > second.current.sequence;
    return first.current.sequence < second.current.sequence;
  }

  /**
   * Checks whether the card comes from the extra deck.
   * @returns {boolean} True when the type flags indicate an extra deck monster.
   */
  is_extra_deck_monster() {
    const cardType = this.data.type || 0;
    if (!hasMask(cardType, CARD_TYPES.TYPE_MONSTER)) return false;
    const extraTypes = [
      CARD_TYPES.TYPE_FUSION,
      CARD_TYPES.TYPE_SYNCHRO,
      CARD_TYPES.TYPE_XYZ,
      CARD_TYPES.TYPE_PENDULUM,
      CARD_TYPES.TYPE_LINK,
      CARD_TYPES.TYPE_RITUAL,
    ];
    const matchesExtraType = extraTypes.some((flag) => hasMask(cardType, flag));
    if (!matchesExtraType) return false;
    return true;
  }

  /**
   * Returns the assumed property value if present.
   * @param {number} assumeType Key representing the assumed property type.
   * @returns {number|undefined} Stored assumed value, if any.
   */
  get_assumed_property(assumeType) {
    return this.assume.get(assumeType);
  }

  /**
   * Packages information about the card location.
   * @returns {{ controler: number, location: number, sequence: number, position: number }} Encoded location details.
   */
  get_info_location() {
    if (this.overlay_target) {
      const location = (this.overlay_target.current.location + CARD_LOCATIONS.LOCATION_OVERLAY) % 256;
      return {
        controler: this.overlay_target.current.controler,
        location,
        sequence: this.overlay_target.current.sequence,
        position: this.current.sequence,
      };
    }
    return {
      controler: this.current.controler,
      location: this.current.location,
      sequence: this.current.sequence,
      position: this.current.position,
    };
  }

  /**
   * Returns a lightweight info bundle matching the QUERY_* accessors in card.cpp.
   * @returns {object} Serializable snapshot of the current card state.
   */
  get_infos() {
    const info = {
      code: this.data.code || 0,
      position: this.current.position,
      alias: this.data.alias || 0,
      type: this.data.type || 0,
      level: this.data.level || 0,
      rank: this.data.rank || 0,
      attribute: this.data.attribute || 0,
      race: this.data.race || 0,
      attack: this.data.attack || 0,
      defense: this.data.defense || 0,
      base_attack: this.data.attack || 0,
      base_defense: this.data.defense || 0,
      reason: this.current.reason,
      cover: this.cover,
      owner: this.owner,
      status: this.status,
      lscale: this.data.lscale || 0,
      rscale: this.data.rscale || 0,
      link: this.data.link || 0,
      link_marker: this.data.link_marker || 0,
      overlay: this.xyz_materials.map((card) => card.data.code || 0),
    };
    if (this.equiping_target) {
      info.equip_target = this.equiping_target.get_info_location();
    }
    if (this.current.reason_card) {
      info.reason_card = this.current.reason_card.get_info_location();
    }
    if (this.effect_target_cards.size) {
      info.targets = Array.from(this.effect_target_cards).map((card) => card.get_info_location());
    }
    return info;
  }

  /**
   * Provides a second code for specific double-name cards.
   * @param {number} code Base card code.
   * @returns {number} Secondary code if applicable.
   */
  second_code(code) {
    const MARINE_DOLPHIN = 78734208;
    const TWINKLE_MOSS = 17732278;
    if (code === MARINE_DOLPHIN) return 17955766;
    if (code === TWINKLE_MOSS) return 17732278;
    return 0;
  }
}

/**
 * Placeholder to mirror the card.cpp export surface.
 * @returns {{ Card: typeof Card, CardState: typeof CardState, AttackerMap: typeof AttackerMap }} Card exports.
 */
function cardCpp() {
  return { Card, CardState, AttackerMap };
}

module.exports = {
  Card,
  CardState,
  AttackerMap,
  CARD_LOCATIONS,
  CARD_TYPES,
  PLAYERS,
  cardCpp,
};
