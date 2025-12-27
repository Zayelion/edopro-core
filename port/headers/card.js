// Implements card.h
/**
 * Represents positional details for a card on the field.
 */
class LocInfo {
  /**
   * @param {object} [params] optional location parameters
   * @param {number} [params.controler=0] controller player id
   * @param {number} [params.location=0] location mask
   * @param {number} [params.sequence=0] sequence index within the zone
   * @param {number} [params.position=0] battle position flags
   */
  constructor({ controler = 0, location = 0, sequence = 0, position = 0 } = {}) {
    this.controler = controler;
    this.location = location;
    this.sequence = sequence;
    this.position = position;
  }
}

/**
 * Captures the mutable state of a card including stats and placement.
 */
class CardState extends LocInfo {
  /**
   * @param {object} [params] initial state overrides
   */
  constructor(params = {}) {
    super(params);
    const {
      code = 0,
      code2 = 0,
      setcodes = new Set(),
      type = 0,
      level = 0,
      rank = 0,
      link = 0,
      linkMarker = 0,
      lscale = 0,
      rscale = 0,
      attribute = 0,
      race = 0,
      attack = 0,
      defense = 0,
      baseAttack = 0,
      baseDefense = 0,
      reason = 0,
      pzone = false,
      reasonCard = null,
      reasonPlayer = 0,
      reasonEffect = null,
    } = params;
    this.code = code;
    this.code2 = code2;
    this.setcodes = setcodes;
    this.type = type;
    this.level = level;
    this.rank = rank;
    this.link = link;
    this.linkMarker = linkMarker;
    this.lscale = lscale;
    this.rscale = rscale;
    this.attribute = attribute;
    this.race = race;
    this.attack = attack;
    this.defense = defense;
    this.baseAttack = baseAttack;
    this.baseDefense = baseDefense;
    this.reason = reason;
    this.pzone = pzone;
    this.reasonCard = reasonCard;
    this.reasonPlayer = reasonPlayer;
    this.reasonEffect = reasonEffect;
  }
}

/**
 * High-level representation of a card instance within a duel.
 */
class Card {
  /**
   * @param {object} [params] optional card construction data
   * @param {object} [params.data] immutable card metadata
   * @param {CardState} [params.previous] previous state snapshot
   * @param {CardState} [params.temp] temporary state snapshot
   * @param {CardState} [params.current] current state snapshot
   * @param {number} [params.owner=0] player that owns the card
   */
  constructor({ data = {}, previous = new CardState(), temp = new CardState(), current = new CardState(), owner = 0 } = {}) {
    this.data = data;
    this.previous = previous;
    this.temp = temp;
    this.current = current;
    this.owner = owner;
    this.overlayCards = [];
    this.effects = [];
    this.equipingCards = [];
  }
}

module.exports = {
  Card,
  CardState,
  LocInfo,
};
