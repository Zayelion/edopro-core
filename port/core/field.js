// Implements field.cpp
const { ProcessorQueue } = require('./processor');
const { visitProcessor } = require('./processor_visit');
const { LuaParam, COROUTINE_YIELD } = require('./interpreter');
const { OCG_CONSTANTS } = require('./ocgapi');
const { CARD_LOCATIONS, PLAYERS } = require('./card');
const { getProcessorStub } = require('./processor_stubs');

/**
 * Represents a trigger event mirrored from the native engine.
 */
class TriggerEvent {
  constructor() {
    this.trigger_card = undefined;
    this.event_cards = undefined;
    this.reason_effect = undefined;
    this.event_code = 0;
    this.event_value = 0;
    this.reason = 0;
    this.event_player = 0;
    this.reason_player = 0;
    this.global_id = 0;
  }
}

/**
 * Encapsulates a single chain link snapshot.
 */
class ChainLink {
  constructor() {
    this.triggering_state = {};
    this.evt = new TriggerEvent();
    this.chain_count = 0;
    this.triggering_player = 0;
    this.triggering_controler = 0;
    this.triggering_position = 0;
    this.target_player = 0;
    this.disable_player = 0;
    this.triggering_summon_location = 0;
    this.triggering_summon_proc_complete = false;
    this.was_just_sent = false;
    this.chain_id = 0;
    this.triggering_location = 0;
    this.triggering_sequence = 0;
    this.triggering_status = 0;
    this.triggering_summon_type = 0;
    this.replace_op = 0;
    this.target_param = 0;
    this.flag = 0;
    this.event_id = 0;
    this.triggering_effect = undefined;
    this.target_cards = undefined;
    this.disable_reason = undefined;
    this.applied_chain_counters = [];
    this.opinfos = new Map();
    this.possibleopinfos = new Map();
  }

  /**
   * Sort helper matching the original engine ordering.
   * @param {ChainLink} left First chain link.
   * @param {ChainLink} right Second chain link.
   * @returns {boolean} True when left should precede right.
   */
  static chain_operation_sort(left, right) {
    const leftId = left.triggering_effect?.id ?? 0;
    const rightId = right.triggering_effect?.id ?? 0;
    return leftId < rightId;
  }

  /**
   * Captures the triggering state from a card-like object.
   * @param {object} card Card instance carrying state information.
   * @returns {void}
   */
  set_triggering_state(card) {
    if (!card) return;
    const current = card.current || {};
    this.triggering_controler = current.controler ?? 0;
    this.triggering_location = current.location ?? 0;
    this.triggering_sequence = current.sequence ?? 0;
    this.triggering_position = current.position ?? 0;
    this.triggering_status = card.status ?? 0;
    this.triggering_summon_type = card.summon?.type ?? 0;
    this.triggering_summon_location = card.summon?.location ?? 0;
    this.triggering_summon_proc_complete = Boolean(card.is_summon_complete);
    this.triggering_state.code = card.get_code ? card.get_code() : card.code ?? 0;
    this.triggering_state.code2 = card.get_another_code ? card.get_another_code() : 0;
    this.triggering_state.level = card.get_level ? card.get_level() : card.level ?? 0;
    this.triggering_state.rank = card.get_rank ? card.get_rank() : card.rank ?? 0;
    this.triggering_state.attribute = card.get_attribute ? card.get_attribute() : card.attribute ?? 0;
    this.triggering_state.type = card.get_type ? card.get_type() : card.type ?? 0;
    this.triggering_state.race = card.get_race ? card.get_race() : card.race ?? 0;
    this.triggering_state.attack = card.get_attack ? card.get_attack() : card.attack ?? 0;
    this.triggering_state.defense = card.get_defense ? card.get_defense() : card.defense ?? 0;
    const codes = card.get_set_card ? card.get_set_card() : [];
    this.triggering_state.setcodes = new Set(codes || []);
  }
}

/**
 * Tracks card arrays for a single player.
 */
class PlayerInfo {
  /**
   * @param {object} team Player initialization data.
   */
  constructor(team = {}) {
    this.lp = team.startingLP ?? 8000;
    this.start_lp = this.lp;
    this.start_count = team.startingDrawCount ?? 5;
    this.draw_count = team.drawCountPerTurn ?? 1;
    this.used_location = 0;
    this.disabled_location = 0;
    this.extra_p_count = 0;
    this.exchanges = 0;
    this.tag_index = 0;
    this.recharge = false;
    this.list_mzone = Array.from({ length: 7 }, () => undefined);
    this.list_szone = Array.from({ length: 8 }, () => undefined);
    this.list_main = [];
    this.list_grave = [];
    this.list_hand = [];
    this.list_remove = [];
    this.list_extra = [];
    this.extra_lists_main = [];
    this.extra_lists_hand = [];
    this.extra_lists_extra = [];
    this.extra_extra_p_count = [];
  }
}

/**
 * Minimal field port carrying duel state containers and helpers.
 */
class Field {
  /**
   * @param {import('./duel').Duel} duel Owning duel instance.
   * @param {object} options Field configuration mirroring OCG_DuelOptions.
   */
  constructor(duel, options) {
    this.duel = duel;
    this.options = options;
    this.temp_card = undefined;
    this.returns = { data: Buffer.alloc(0) };
    this.core = {
      duel_options: options.flags ?? 0,
      shuffle_check_disabled: false,
      shuffle_deck_check: [false, false],
      shuffle_hand_check: [false, false],
      current_chain: [],
      solving_event: [],
      sub_solving_event: [],
      check_level: 0,
      reason_effect: undefined,
      reason_player: PLAYERS.PLAYER_NONE,
    };
    this.nil_event = new TriggerEvent();
    this.processor = new ProcessorQueue(this);
    this.processHandlers = new Map();
    this.player = [
      new PlayerInfo(options.team1),
      new PlayerInfo(options.team2),
    ];
    this.infos = {
      event_id: 1,
      field_id: 1,
      copy_id: 1,
      turn_id: 0,
      turn_id_by_player: [0, 0],
      card_id: 1,
      phase: 0,
      turn_player: 0,
      priorities: [0, 0],
      can_shuffle: true,
    };
  }

  /**
   * Merges pending sub solving events into the main solving queue.
   * @returns {void}
   */
  mergeSolvingEvents() {
    if (!Array.isArray(this.core.sub_solving_event)) this.core.sub_solving_event = [];
    if (!Array.isArray(this.core.solving_event)) this.core.solving_event = [];
    if (this.core.sub_solving_event.length === 0) return;
    this.core.solving_event = [...this.core.sub_solving_event, ...this.core.solving_event];
    this.core.sub_solving_event = [];
  }

  /**
   * Retrieves the array representing a specific player location.
   * @param {PlayerInfo} info Player state container.
   * @param {number|string|undefined} location Location identifier or human readable name.
   * @returns {Array|undefined} Matching card list.
   */
  getLocationList(info, location) {
    if (!info) return undefined;
    if (location === OCG_CONSTANTS.LOCATION_HAND || location === CARD_LOCATIONS.LOCATION_HAND || location === 'HAND') return info.list_hand;
    if (location === OCG_CONSTANTS.LOCATION_DECK || location === CARD_LOCATIONS.LOCATION_DECK || location === 'DECK') return info.list_main;
    return undefined;
  }

  /**
   * Shuffles a player's zone using the duel RNG when available.
   * @param {number} playerid Player index.
   * @param {number|string|undefined} location Location identifier or human readable name.
   * @returns {void}
   */
  shuffle(playerid, location) {
    const playerInfo = this.player[playerid];
    if (!playerInfo) return;
    const target = this.getLocationList(playerInfo, location);
    if (!Array.isArray(target)) return;
    let index = target.length - 1;
    while (index > 0) {
      const randomSource = this.duel?.random?.next ? this.duel.random.next() : Math.floor(Math.random() * (index + 1));
      const swapIndex = Math.trunc(randomSource % (index + 1));
      const temp = target[index];
      target[index] = target[swapIndex];
      target[swapIndex] = temp;
      index -= 1;
    }
  }

  /**
   * Generates a lightweight snapshot of the field state.
   * @returns {object} Serializable representation of the field.
   */
  reload_field_info() {
    const players = this.player.map((info) => ({
      lp: info.lp,
      mzone: info.list_mzone.map((card) => ({
        occupied: Boolean(card),
        position: card?.current?.position ?? 0,
        xyz_materials: card?.xyz_materials?.length ?? 0,
      })),
      szone: info.list_szone.map((card) => ({
        occupied: Boolean(card),
        position: card?.current?.position ?? 0,
        xyz_materials: card?.xyz_materials?.length ?? 0,
      })),
      main: info.list_main.length,
      hand: info.list_hand.length,
      grave: info.list_grave.length,
      removed: info.list_remove.length,
      extra: info.list_extra.length,
      extra_p_count: info.extra_p_count,
    }));
    return {
      duel_options: this.core.duel_options,
      players,
      chain_size: this.core.current_chain.length,
    };
  }

  /**
   * Places a card into a basic location container.
   * @param {number} playerid Target player index.
   * @param {object} card Card instance to register.
   * @param {string} location Human readable location label.
   * @param {number} sequence Sequence index within the location when applicable.
   * @returns {void}
   */
  add_card(playerid, card, location, sequence) {
    if (!card) return;
    const playerInfo = this.player[playerid];
    if (!playerInfo) return;
    card.current = card.current || {};
    card.current.controler = playerid;
    card.current.location = location;
    card.current.sequence = sequence ?? 0;
    card.current.position = card.current.position ?? 0;
    if (location === 'MZONE') {
      playerInfo.list_mzone[card.current.sequence] = card;
      return;
    }
    if (location === 'SZONE') {
      playerInfo.list_szone[card.current.sequence] = card;
      return;
    }
    if (location === 'DECK') {
      playerInfo.list_main.push(card);
      return;
    }
    if (location === 'HAND') {
      playerInfo.list_hand.push(card);
      return;
    }
    if (location === 'GRAVE') {
      playerInfo.list_grave.push(card);
      return;
    }
    if (location === 'REMOVED') {
      playerInfo.list_remove.push(card);
      return;
    }
    if (location === 'EXTRA') playerInfo.list_extra.push(card);
  }

  /**
   * Registers a handler for a specific process type.
   * @param {string} type Process identifier.
   * @param {(unit: import('./processor').ProcessDescriptor, field: Field) => boolean} handler Processing handler.
   * @returns {void}
   */
  registerProcessHandler(type, handler) {
    if (!type || typeof handler !== 'function') return;
    this.processHandlers.set(type, handler);
  }

  /**
   * Queues a process on the main unit list.
   * @param {string} type Process identifier.
   * @param {Record<string, any>} [payload] Optional payload.
   * @returns {import('./processor').ProcessDescriptor|undefined} Created process.
   */
  queueProcess(type, payload) {
    if (!this.processor) return undefined;
    return this.processor.enqueue(type, payload);
  }

  /**
   * Queues a process on the subunit list.
   * @param {string} type Process identifier.
   * @param {Record<string, any>} [payload] Optional payload.
   * @returns {import('./processor').ProcessDescriptor|undefined} Created process.
   */
  queueSubProcess(type, payload) {
    if (!this.processor) return undefined;
    return this.processor.enqueueSubunit(type, payload);
  }

  /**
   * Routes a processor unit to the matching stub function.
   * @param {import('./processor').ProcessDescriptor|undefined} unit Process unit awaiting handling.
   * @returns {boolean} True when the processor completes.
   */
  dispatchProcess(unit) {
    if (!unit) return true;
    const stub = getProcessorStub(unit.type);
    if (stub) return stub(this, unit);
    return this.handleProcess(unit);
  }

  /**
   * Dispatches the process through registered handlers or method-based fallbacks.
   * @param {import('./processor').ProcessDescriptor} unit Current process unit.
   * @returns {boolean} True when the process is finished.
   */
  handleProcess(unit) {
    const handler = this.processHandlers.get(unit.type);
    if (handler) return handler(unit, this);
    const fallbackName = `process${unit.type}`;
    const fallback = this[fallbackName];
    if (typeof fallback === 'function') return fallback.call(this, unit);
    return true;
  }

  /**
   * Executes the cost coroutine for the provided triggering effect.
   * Mirrors the native `field::process(Processors::ExecuteCost&)` flow.
   * @param {import('./processor').ProcessDescriptor} unit Process descriptor carrying payload data.
   * @returns {boolean} True when the process is complete.
   */
  processExecuteCost(unit) {
    const payload = unit?.payload ?? {};
    const triggering_effect = payload.triggering_effect;
    const triggering_player = payload.triggering_player ?? 0;
    const lua = this.duel?.lua;
    if (!lua) return true;
    if (!triggering_effect?.cost) {
      this.mergeSolvingEvents();
      lua.parameters.length = 0;
      this.core.solving_event.shift();
      return true;
    }
    if (unit.step === 0) {
      this.mergeSolvingEvents();
      const event = this.core.solving_event[0] ?? this.nil_event;
      lua.add_param(LuaParam.INT, 1, true);
      lua.add_param(LuaParam.INT, event.reason_player ?? 0, true);
      lua.add_param(LuaParam.INT, event.reason ?? 0, true);
      lua.add_param(LuaParam.EFFECT, event.reason_effect, true);
      lua.add_param(LuaParam.INT, event.event_value ?? 0, true);
      lua.add_param(LuaParam.INT, event.event_player ?? 0, true);
      lua.add_param(LuaParam.GROUP, event.event_cards, true);
      lua.add_param(LuaParam.INT, triggering_player, true);
      lua.add_param(LuaParam.EFFECT, triggering_effect, true);
      if (this.core.check_level === 0) {
        this.core.shuffle_deck_check[0] = false;
        this.core.shuffle_deck_check[1] = false;
        this.core.shuffle_hand_check[0] = false;
        this.core.shuffle_hand_check[1] = false;
      }
      payload.shuffle_check_was_disabled = this.core.shuffle_check_disabled;
      this.core.shuffle_check_disabled = false;
      this.core.check_level += 1;
    }
    this.core.reason_effect = triggering_effect;
    this.core.reason_player = triggering_player;
    const count = this.duel.lua.parameters.length;
    const yieldValue = { value: 0 };
    const result = lua.call_coroutine(triggering_effect.cost, count, yieldValue, unit.step);
    this.returns.value0 = typeof yieldValue.value === 'number' ? Math.trunc(yieldValue.value) : 0;
    if (result !== COROUTINE_YIELD) {
      this.core.reason_effect = undefined;
      this.core.reason_player = PLAYERS.PLAYER_NONE;
      this.core.check_level = Math.max(0, this.core.check_level - 1);
      if (this.core.check_level === 0) {
        if (this.core.shuffle_hand_check[0]) this.shuffle(0, CARD_LOCATIONS.LOCATION_HAND);
        if (this.core.shuffle_hand_check[1]) this.shuffle(1, CARD_LOCATIONS.LOCATION_HAND);
        if (this.core.shuffle_deck_check[0]) this.shuffle(0, CARD_LOCATIONS.LOCATION_DECK);
        if (this.core.shuffle_deck_check[1]) this.shuffle(1, CARD_LOCATIONS.LOCATION_DECK);
      }
      this.core.shuffle_check_disabled = payload.shuffle_check_was_disabled;
      this.core.solving_event.shift();
      return true;
    }
    return false;
  }

  /**
   * Primary processing entry point mirroring `processor_visit.cpp` semantics.
   * @param {import('./processor').ProcessDescriptor} [unit] Optional processor unit to handle directly.
   * @returns {number|boolean} Duel status value or completion flag when invoked directly.
   */
  process(unit) {
    if (unit) return this.dispatchProcess(unit);
    return visitProcessor(this.processor, (current) => this.dispatchProcess(current));
  }
}

/**
 * Placeholder stub for field.cpp encapsulating field state operations.
 * @returns {void}
 */
function fieldCpp() {}

module.exports = { Field, ChainLink, TriggerEvent, PlayerInfo, fieldCpp };
