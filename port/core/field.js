// Implements field.cpp

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
    };
    this.nil_event = new TriggerEvent();
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
}

/**
 * Placeholder stub for field.cpp encapsulating field state operations.
 * @returns {void}
 */
function fieldCpp() {}

module.exports = { Field, ChainLink, TriggerEvent, PlayerInfo, fieldCpp };
