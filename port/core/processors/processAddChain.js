const { EFFECT_TYPES, EFFECT_FLAGS, EFFECT_FLAGS2, EFFECT_CODES } = require('../effect');
const { CARD_TYPES, CARD_LOCATIONS } = require('../card');
const { ADD_CHAIN_CONSTANTS } = require('../processor');

const { LOCATIONS, POSITIONS, PLAYER } = ADD_CHAIN_CONSTANTS;

const {
  TYPE_FIELD,
  TYPE_PENDULUM,
  TYPE_TRAP,
  TYPE_MONSTER,
  TYPE_CONTINUOUS,
  TYPE_EQUIP,
  TYPE_LINK,
  TYPE_SPELL,
  TYPE_QUICKPLAY,
} = CARD_TYPES;

const {
  EFFECT_FLAG_LIMIT_ZONE,
  EFFECT_FLAG_CARD_TARGET,
  EFFECT_FLAG_FIELD_ONLY,
  EFFECT_FLAG_DAMAGE_STEP,
  EFFECT_FLAG_DAMAGE_CAL,
  EFFECT_FLAG_CANNOT_DISABLE,
  EFFECT_FLAG_CLIENT_HINT,
} = EFFECT_FLAGS;

const { EFFECT_FLAG2_FORCE_ACTIVATE_LOCATION } = EFFECT_FLAGS2;

const {
  EFFECT_DISABLE_EFFECT,
  EFFECT_DISABLE_CHAIN,
  EFFECT_REMAIN_FIELD,
  EFFECT_TRAP_ACT_IN_HAND,
  EFFECT_QP_ACT_IN_NTPHAND,
  EFFECT_TRAP_ACT_IN_SET_TURN,
  EFFECT_QP_ACT_IN_SET_TURN,
  EFFECT_BECOME_QUICK,
} = EFFECT_CODES;


/**
 * Ports the native `field::process(Processors::AddChain)` control flow.
 * @param {import('../field').Field} field Active duel field instance.
 * @param {{step:number, is_activated_effect?: boolean}} arg Processor payload mirrored from the engine.
 * @returns {boolean} True when processing finishes for this step, false when a coroutine yields.
 */
function processAddChain(field, arg) {
  const { core, pduel, infos, returns } = field;

  /**
   * Retrieves the first element of an array-like container.
   * @param {Array<any>} list Candidate list.
   * @returns {any|undefined} First element if available.
   */
  const getFront = (list) => {
    if (!Array.isArray(list)) return undefined;
    if (!list.length) return undefined;
    return list[0];
  };

  /**
   * Retrieves the last element of an array-like container.
   * @param {Array<any>} list Candidate list.
   * @returns {any|undefined} Last element if available.
   */
  const getBack = (list) => {
    if (!Array.isArray(list)) return undefined;
    if (!list.length) return undefined;
    return list[list.length - 1];
  };

  /**
   * Removes and returns the first element of an array-like container.
   * @param {Array<any>} list Candidate list.
   * @returns {any|undefined} Removed element if available.
   */
  const popFront = (list) => {
    if (!Array.isArray(list)) return undefined;
    if (!list.length) return undefined;
    return list.shift();
  };

  /**
   * Checks whether a flag exists on a numeric bitfield.
   * @param {number} value Bitfield to test.
   * @param {number} flag Mask to inspect.
   * @returns {boolean} True when the mask is present.
   */
  const hasFlag = (value, flag) => (value & flag) !== 0;

  /**
   * Applies activation zone resolution mirrored from the engine.
   * @param {any} clit Pending chain link.
   * @param {any} peffect Triggering effect instance.
   * @param {any} phandler Effect handler card.
   * @returns {{shouldStop: boolean, zone: number, loc?: number}} Zone resolution results.
   */
  const handleZoneSelection = (clit, peffect, phandler) => {
    let zone = 0xff;
    if (!hasFlag(phandler.data.type, TYPE_FIELD | TYPE_PENDULUM) && peffect.is_flag(EFFECT_FLAG_LIMIT_ZONE)) {
      pduel.lua.add_param(clit.triggering_player, true);
      pduel.lua.add_param(clit.evt.event_cards, true);
      pduel.lua.add_param(clit.evt.event_player, true);
      pduel.lua.add_param(clit.evt.event_value, true);
      pduel.lua.add_param(clit.evt.reason_effect, true);
      pduel.lua.add_param(clit.evt.reason, true);
      pduel.lua.add_param(clit.evt.reason_player, true);
      zone = peffect.get_value(7);
      if (!zone) return { shouldStop: true, zone };
    }

    let loc = LOCATIONS.LOCATION_SZONE;
    if (peffect.is_flag(EFFECT_FLAG2_FORCE_ACTIVATE_LOCATION)) {
      loc = peffect.get_value();
      if (!loc) return { shouldStop: true, zone, loc };
    }

    if (phandler.current.location === LOCATIONS.LOCATION_HAND) {
      if (hasFlag(phandler.data.type, TYPE_PENDULUM)) loc = LOCATIONS.LOCATION_PZONE;
      if (hasFlag(phandler.data.type, TYPE_FIELD)) loc = LOCATIONS.LOCATION_FZONE;
    }

    phandler.enable_field_effect(false);
    field.move_to_field(
      phandler,
      phandler.current.controler,
      phandler.current.controler,
      loc,
      loc === LOCATIONS.LOCATION_MZONE ? POSITIONS.POS_FACEUP_ATTACK : POSITIONS.POS_FACEUP,
      false,
      0,
      zone,
    );

    return { shouldStop: false, zone, loc };
  };

  /**
   * Releases Lua chain limit callbacks.
   * @returns {void}
   */
  const handleChainLimitCleanup = () => {
    if (!Array.isArray(core.chain_limit)) return;
    for (const chLim of core.chain_limit) {
      pduel.lua.ensure_luaL_stack(chLim.function);
    }
    core.chain_limit = [];
  };

  /**
   * Resets default target bookkeeping on a chain link.
   * @param {any} clit Chain link container.
   * @returns {void}
   */
  const setDefaultChainTargets = (clit) => {
    clit.target_cards = undefined;
    clit.target_player = PLAYER.PLAYER_NONE;
    clit.target_param = 0;
    clit.disable_reason = undefined;
    clit.disable_player = PLAYER.PLAYER_NONE;
    clit.replace_op = 0;
  };

  /**
   * Mirrors the native special summon once-per-duel bookkeeping.
   * @param {any} clit Chain link container.
   * @param {any} peffect Triggering effect instance.
   * @returns {void}
   */
  const handleSpecialSummonOnceOld = (clit, peffect) => {
    if (!clit.opinfos.count(0x200) || !clit.opinfos[0x200].op_count) return;
    if (field.is_flag(DUEL_CANNOT_SUMMON_OATH_OLD)) {
      core.spsummon_rst = true;
      field.set_spsummon_counter(clit.triggering_player, true, true);
      if (clit.opinfos[0x200].op_player === PLAYER.PLAYER_ALL) field.set_spsummon_counter(1 - clit.triggering_player, true, true);
    }

    if (!field.is_flag(DUEL_SPSUMMON_ONCE_OLD_NEGATE)) return;
    if (!(core.global_flag & GLOBALFLAG_SPSUMMON_ONCE)) return;

    const optarget = clit.opinfos[0x200];
    if (!optarget.op_cards) return;

    if (optarget.op_player === PLAYER.PLAYER_ALL) {
      const opCards = optarget.op_cards.container;
      if (!Array.isArray(opCards)) return;
      const first = opCards[0];
      const second = opCards[1];
      const sumplayer = optarget.op_param;
      if (first?.spsummon_code) {
        core.spsummon_once_map[sumplayer][first.spsummon_code] = (core.spsummon_once_map[sumplayer][first.spsummon_code] || 0) + 1;
        core.spsummon_once_map_rst[sumplayer][first.spsummon_code] = (core.spsummon_once_map_rst[sumplayer][first.spsummon_code] || 0) + 1;
      }

      if (second?.spsummon_code) {
        core.spsummon_once_map[1 - sumplayer][second.spsummon_code] = (core.spsummon_once_map[1 - sumplayer][second.spsummon_code] || 0) + 1;
        core.spsummon_once_map_rst[1 - sumplayer][second.spsummon_code] = (core.spsummon_once_map_rst[1 - sumplayer][second.spsummon_code] || 0) + 1;
      }

      return;
    }

    let sumplayer = clit.triggering_player;
    if (peffect.is_flag(EFFECT_FLAG_CARD_TARGET) && optarget.op_player === 0x10) sumplayer = 1 - sumplayer;
    const opCards = optarget.op_cards.container;
    if (!Array.isArray(opCards)) return;
    for (const pcard of opCards) {
      if (!pcard.spsummon_code) continue;
      core.spsummon_once_map[sumplayer][pcard.spsummon_code] = (core.spsummon_once_map[sumplayer][pcard.spsummon_code] || 0) + 1;
      core.spsummon_once_map_rst[sumplayer][pcard.spsummon_code] = (core.spsummon_once_map_rst[sumplayer][pcard.spsummon_code] || 0) + 1;
    }
  };

  switch (arg.step) {
    case 0: {
      if (!core.new_chains?.length) return true;
      const clit = getFront(core.new_chains);
      const peffect = clit.triggering_effect;
      arg.is_activated_effect = false;
      if (hasFlag(peffect.type, EFFECT_TYPES.EFFECT_TYPE_ACTIVATE)) arg.step = PROCESSOR_STEPS.CHECK_SPECIAL_ACTIVATION;
      return false;
    }
    case 1: {
      const clit = getFront(core.new_chains);
      const eset = [];
      field.filter_player_effect(clit.triggering_player, EFFECT_ACTIVATE_COST, eset);
      for (const peff of eset) {
        pduel.lua.add_param(peff);
        pduel.lua.add_param(clit.triggering_effect);
        pduel.lua.add_param(clit.triggering_player);
        if (!pduel.lua.check_condition(peff.target, 3)) continue;
        if (!peff.operation) continue;
        core.sub_solving_event.push(clit.evt);
        field.emplace_process('ExecuteOperation', { effect: peff, triggering_player: clit.triggering_player });
      }

      if (!arg.is_activated_effect) return false;

      const peffect = clit.triggering_effect;
      const phandler = peffect.get_handler();
      phandler.set_status(STATUS_FLAGS.STATUS_ACT_FROM_HAND, phandler.current.location === LOCATIONS.LOCATION_HAND);
      if (phandler.current.location === LOCATIONS.LOCATION_SZONE) {
        field.change_position(phandler, undefined, phandler.current.controler, POSITIONS.POS_FACEUP, 0);
        return false;
      }

      const zoneResult = handleZoneSelection(clit, peffect, phandler);
      if (zoneResult.shouldStop) return true;
      return false;
    }
    case 2: {
      const clit = getFront(core.new_chains);
      const peffect = clit.triggering_effect;
      const phandler = peffect.get_handler();
      if (hasFlag(peffect.type, EFFECT_TYPES.EFFECT_TYPE_ACTIVATE)) clit.set_triggering_state(phandler);
      const message = pduel.new_message(MESSAGE_CODES.MSG_CHAINING);
      message.write(phandler.data.code);
      message.write(phandler.get_info_location());
      message.write(clit.triggering_controler);
      message.write(clit.triggering_location);
      message.write(clit.triggering_sequence);
      message.write(peffect.description);
      message.write(core.current_chain.length + 1);
      handleChainLimitCleanup();
      peffect.card_type = phandler.get_type();
      if ((peffect.card_type & (TYPE_TRAP | TYPE_MONSTER)) === (TYPE_TRAP | TYPE_MONSTER)) peffect.card_type -= TYPE_TRAP;
      if (field.is_flag(DUEL_TRIGGER_WHEN_PRIVATE_KNOWLEDGE)) {
        const shouldSetActive = (peffect.type & EFFECT_TYPES.EFFECT_TYPE_CONTINUOUS) === 0 && (peffect.type & EFFECT_TYPES.EFFECT_TYPE_SINGLE) !== 0;
        if (!shouldSetActive) peffect.set_active_type();
      }
      if (!field.is_flag(DUEL_TRIGGER_WHEN_PRIVATE_KNOWLEDGE)) peffect.set_active_type();

      peffect.active_handler = peffect.handler.overlay_target;
      clit.chain_count = core.current_chain.length + 1;
      setDefaultChainTargets(clit);
      if (phandler.current.location === LOCATIONS.LOCATION_HAND) clit.flag |= CHAIN_HAND_EFFECT;
      core.current_chain.push(clit);
      const lastChain = getBack(core.current_chain);
      lastChain.applied_chain_counters = field.check_chain_counter(peffect, clit.triggering_player, clit.chain_count);
      if (!peffect.is_flag(EFFECT_FLAG_FIELD_ONLY) && (!(peffect.type & 0x2a0) || (peffect.code & 0xfffff000) === EVENT_PHASE)) phandler.create_relation(clit);
      peffect.effect_owner = clit.triggering_player;
      const deffect = phandler.is_affected_by_effect(EFFECT_DISABLE_EFFECT);
      if (!peffect.is_flag(EFFECT_FLAG_FIELD_ONLY) && phandler.is_has_relation(clit) && deffect) {
        const negeff = pduel.new_effect();
        negeff.owner = deffect.owner;
        negeff.type = EFFECT_TYPES.EFFECT_TYPE_SINGLE;
        negeff.code = EFFECT_DISABLE_CHAIN;
        negeff.value = clit.chain_id;
        negeff.reset_flag = RESET_CHAIN | RESET_EVENT | deffect.get_value();
        phandler.add_effect(negeff);
      }
      popFront(core.new_chains);
      return false;
    }
    case 3: {
      const clit = getBack(core.current_chain);
      const playerid = clit.triggering_player;
      const peffect = clit.triggering_effect;
      if (!field.is_flag(DUEL_USE_TRAPS_IN_NEW_CHAIN) && field.get_cteffect(peffect, playerid, true)) {
        const damage_step = infos.phase === PHASES.PHASE_DAMAGE && !peffect.is_flag(EFFECT_FLAG_DAMAGE_STEP);
        const damage_cal = infos.phase === PHASES.PHASE_DAMAGE_CAL && !peffect.is_flag(EFFECT_FLAG_DAMAGE_CAL);
        if (damage_step || damage_cal) {
          returns.set(0, true);
          return false;
        }

        field.emplace_process('SelectEffectYesNo', { playerid, descriptionId: 94, handler: peffect.get_handler() });
        return false;
      }

      returns.set(0, false);
      return false;
    }
    case 4: {
      if (!returns.at(0)) {
        core.select_chains = [];
        core.select_options = [];
        arg.step = 5;
        return false;
      }

      if (core.select_chains.length > 1) {
        const clit = getBack(core.current_chain);
        field.emplace_process('SelectOption', { playerid: clit.triggering_player });
        return false;
      }

      returns.set(0, 0);
      return false;
    }
    case 5: {
      const clit = getBack(core.current_chain);
      const ch = core.select_chains[returns.at(0)];
      const playerid = clit.triggering_player;
      const peffect = ch.triggering_effect;
      const phandler = peffect.get_handler();
      const message = pduel.new_message(MESSAGE_CODES.MSG_HINT);
      message.write(HINT_OPSELECTED);
      message.write(playerid);
      const optionIndex = returns.at(0);
      const option = optionIndex >= core.select_options.length ? core.select_options[optionIndex] : 65;
      message.write(option);
      clit.triggering_effect = peffect;
      clit.evt = ch.evt;
      phandler.create_relation(clit);
      peffect.dec_count(playerid);
      if (!(peffect.type & EFFECT_TYPES.EFFECT_TYPE_ACTIVATE)) {
        peffect.type |= EFFECT_TYPES.EFFECT_TYPE_ACTIVATE;
        clit.flag |= CHAIN_ACTIVATING;
      }
      core.select_chains = [];
      core.select_options = [];
      const deffect = pduel.new_effect();
      deffect.owner = phandler;
      deffect.code = 0;
      deffect.type = EFFECT_TYPES.EFFECT_TYPE_SINGLE;
      deffect.flag = [EFFECT_FLAG_CANNOT_DISABLE | EFFECT_FLAG_CLIENT_HINT];
      deffect.description = 65;
      deffect.reset_flag = RESET_CHAIN;
      phandler.add_effect(deffect);
      return false;
    }
    case 6: {
      const clit = getBack(core.current_chain);
      const peffect = clit.triggering_effect;
      if (peffect.cost) {
        core.sub_solving_event.push(clit.evt);
        field.emplace_process('ExecuteCost', { effect: peffect, triggering_player: clit.triggering_player });
      }
      return false;
    }
    case 7: {
      const clit = getBack(core.current_chain);
      const peffect = clit.triggering_effect;
      if (peffect.target) {
        core.sub_solving_event.push(clit.evt);
        field.emplace_process('ExecuteTarget', { effect: peffect, triggering_player: clit.triggering_player });
      }
      return false;
    }
    case 8: {
      field.break_effect(false);
      const clit = getBack(core.current_chain);
      const peffect = clit.triggering_effect;
      const phandler = peffect.get_handler();
      if (clit.target_cards && clit.target_cards.container.length) {
        if (peffect.is_flag(EFFECT_FLAG_CARD_TARGET)) {
          for (const pcard of clit.target_cards.container) {
            field.raise_single_event(pcard, undefined, EVENT_BECOME_TARGET, peffect, 0, clit.triggering_player, 0, clit.chain_count);
          }
          field.process_single_event();
          if (clit.target_cards.container.length) field.raise_event(clit.target_cards.container, EVENT_BECOME_TARGET, peffect, 0, clit.triggering_player, clit.triggering_player, clit.chain_count);
        }
      }

      if (peffect.type & EFFECT_TYPES.EFFECT_TYPE_ACTIVATE) {
        core.leave_confirmed.add(phandler);
        if (!(phandler.data.type & (TYPE_CONTINUOUS | TYPE_FIELD | TYPE_EQUIP | TYPE_PENDULUM | TYPE_LINK)) && !phandler.is_affected_by_effect(EFFECT_REMAIN_FIELD)) phandler.set_status(STATUS_FLAGS.STATUS_LEAVE_CONFIRMED, true);
      }

      if (phandler.get_type() & (TYPE_SPELL | TYPE_TRAP)) {
        const continuousTypes = TYPE_CONTINUOUS | TYPE_FIELD | TYPE_EQUIP | TYPE_PENDULUM | TYPE_LINK;
        const shouldMarkContinuous = (phandler.get_type() & continuousTypes) && phandler.is_has_relation(clit) && phandler.current.location === LOCATIONS.LOCATION_SZONE && !peffect.is_flag(EFFECT_FLAG_FIELD_ONLY);
        if (shouldMarkContinuous) clit.flag |= CHAIN_CONTINUOUS_CARD;
      }

      core.phase_action = true;
      handleSpecialSummonOnceOld(clit, peffect);
      const message = pduel.new_message(MESSAGE_CODES.MSG_CHAINED);
      message.write(clit.chain_count);
      field.raise_event(phandler, EVENT_CHAINING, peffect, 0, clit.triggering_player, clit.triggering_player, clit.chain_count);
      field.process_instant_event();
      core.just_sent_cards.clear();
      core.real_chain_count += 1;
      if (core.new_chains.length) field.emplace_process('AddChain');
      field.adjust_all();
      return true;
    }
    case PROCESSOR_STEPS.CHECK_SPECIAL_ACTIVATION: {
      arg.is_activated_effect = true;
      const clit = getFront(core.new_chains);
      const peffect = clit.triggering_effect;
      const phandler = peffect.get_handler();
      let ecode = 0;
      if (phandler.current.location === LOCATIONS.LOCATION_HAND) {
        if (phandler.data.type & TYPE_TRAP) ecode = EFFECT_TRAP_ACT_IN_HAND;
        if ((phandler.data.type & TYPE_SPELL) && (phandler.data.type & TYPE_QUICKPLAY || phandler.is_affected_by_effect(EFFECT_BECOME_QUICK)) && infos.turn_player !== phandler.current.controler) ecode = EFFECT_QP_ACT_IN_NTPHAND;
      }

      if (phandler.current.location === LOCATIONS.LOCATION_SZONE) {
        if (phandler.data.type & TYPE_TRAP && phandler.get_status(STATUS_FLAGS.STATUS_SET_TURN)) ecode = EFFECT_TRAP_ACT_IN_SET_TURN;
        if (phandler.data.type & TYPE_SPELL && (phandler.data.type & TYPE_QUICKPLAY || phandler.is_affected_by_effect(EFFECT_BECOME_QUICK)) && phandler.get_status(STATUS_FLAGS.STATUS_SET_TURN)) ecode = EFFECT_QP_ACT_IN_SET_TURN;
      }

      if (!ecode) {
        arg.step = 0;
        return false;
      }

      core.select_effects = [];
      core.select_options = [];
      const eset = [];
      phandler.filter_effect(ecode, eset);
      let hasNoSideEffectEffs = false;
      if (eset.length) {
        for (const peff of eset) {
          if (peff.has_function_value() || peff.has_count_limit()) {
            if (peff.check_count_limit(phandler.current.controler)) {
              core.select_effects.push(peff);
              core.select_options.push(peff.description);
            }
            continue;
          }
          hasNoSideEffectEffs = hasNoSideEffectEffs || true;
        }

        if (!core.select_options.length) {
          arg.step = 0;
          return false;
        }

        if (hasNoSideEffectEffs) {
          core.select_options.unshift(99);
          core.select_effects.unshift(undefined);
        }

        if (core.select_options.length === 1) returns.set(0, 0);
        if (core.select_options.length !== 1) field.emplace_process('SelectOption', { playerid: phandler.current.controler });
      }
      return false;
    }
    case 11: {
      const clit = getFront(core.new_chains);
      const peffect = clit.triggering_effect;
      const phandler = peffect.get_handler();
      if (core.select_effects.length) {
        const eff = core.select_effects[returns.at(0)];
        if (eff) {
          eff.dec_count(phandler.current.controler);
          pduel.lua.add_param(peffect);
          eff.get_value(phandler, 1);
        }
      }
      arg.step = 0;
      return false;
    }
    default:
      return true;
  }
}

module.exports = processAddChain;
