const { EFFECT_CODES, EFFECT_FLAGS, EFFECT_TYPES, EFFECT_EVENTS, EFFECT_COUNT_CODE, RESET_FLAGS } = require('../effect');
const { CARD_TYPES, CARD_LOCATIONS, PLAYERS } = require('../card');
const { OCG_CONSTANTS } = require('../ocgapi');
const { Field } = require('../field');

const {
  EFFECT_DISABLE_EFFECT,
  EFFECT_DISABLE_CHAIN,
  EFFECT_DISABLE_FIELD,
  EFFECT_USE_EXTRA_MZONE,
  EFFECT_USE_EXTRA_SZONE,
  EFFECT_CANNOT_LOSE_LP,
  EFFECT_CANNOT_LOSE_DECK,
} = EFFECT_CODES;

const {
  EFFECT_FLAG_FIELD_ONLY,
  EFFECT_FLAG_DELAY,
  EFFECT_FLAG_CONTINUOUS_TARGET,
  EFFECT_FLAG_COUNT_LIMIT,
} = EFFECT_FLAGS;

const {
  EFFECT_TYPE_ACTIVATE,
  EFFECT_TYPE_CONTINUOUS,
  EFFECT_TYPE_FIELD,
  EFFECT_TYPE_ACTIONS,
  EFFECT_TYPE_SINGLE,
} = EFFECT_TYPES;

const {
  EVENT_CHAIN_ACTIVATING,
  EVENT_CHAIN_SOLVING,
  EVENT_CHAIN_SOLVED,
  EVENT_CHAIN_NEGATED,
  EVENT_CHAIN_DISABLED,
  EVENT_CHAIN_END,
  EVENT_CHAINING,
  EVENT_ADJUST,
  EVENT_BREAK_EFFECT,
  EVENT_PHASE_START,
} = EFFECT_EVENTS;

const { EFFECT_COUNT_CODE_OATH } = EFFECT_COUNT_CODE;
const { RESET_EVENT } = RESET_FLAGS;

const { TYPE_FIELD, TYPE_EQUIP } = CARD_TYPES;
const { LOCATION_HAND, LOCATION_GRAVE } = CARD_LOCATIONS;
const { PLAYER_NONE, PLAYER_ALL } = PLAYERS;

const { POS_FACEUP } = OCG_CONSTANTS;

const STATUS_DISABLED = 0x1;
const STATUS_FORBIDDEN = 0x4000000;
const STATUS_LEAVE_CONFIRMED = 0x2000;
const STATUS_CHAINING = 0x10000;

const CHAIN_DISABLE_ACTIVATE = 0x01;
const CHAIN_DISABLE_EFFECT = 0x02;
const CHAIN_HAND_EFFECT = 0x04;
const CHAIN_CONTINUOUS_CARD = 0x08;
const CHAIN_ACTIVATING = 0x10;

const TIMING_DAMAGE_STEP = 0x2000;
const TIMING_DAMAGE_CAL = 0x4000;
const TIMING_CHAIN_END = 0x8000;

const MSG_CHAIN_SOLVING = 72;
const MSG_CHAIN_SOLVED = 73;
const MSG_CHAIN_END = 74;
const MSG_CHAIN_NEGATED = 75;
const MSG_CHAIN_DISABLED = 76;
const MSG_MISSED_EFFECT = 120;
const MSG_WIN = 5;
const MSG_FIELD_DISABLED = 56;

const DUEL_RELAY = 0x80;
const DUEL_1_FACEUP_FIELD = 0x400;
const DUEL_SPSUMMON_ONCE_OLD_NEGATE = 0x40000;
const DUEL_CANNOT_SUMMON_OATH_OLD = 0x80000;

const GLOBALFLAG_SPSUMMON_ONCE = 0x200;

const REASON_TEMPORARY = 0x4;
const REASON_RULE = 0x400;

const PROCESS_RESTART = 0xffff;

const moveAll = (dst, src) => {
  if (!Array.isArray(dst) || !Array.isArray(src) || src.length === 0) return;
  dst.push(...src);
  src.length = 0;
};

const getStoreEntries = (store) => {
  if (!store) return [];
  if (typeof store.entries === 'function') return store.entries();
  return Object.entries(store);
};

const getStoreValue = (store, key) => {
  if (!store) return 0;
  if (typeof store.get === 'function') return store.get(key) ?? 0;
  return store[key] ?? 0;
};

const setStoreValue = (store, key, value) => {
  if (!store) return;
  if (typeof store.set === 'function') {
    store.set(key, value);
    return;
  }
  store[key] = value;
};

const getOpInfo = (chain, key) => {
  if (!chain?.opinfos) return undefined;
  if (chain.opinfos instanceof Map) return chain.opinfos.get(key);
  return chain.opinfos[key];
};

const ensureHelpers = () => {
  if (Field.prototype.break_effect) return;
  Field.prototype.break_effect = function breakEffect(clearSent = false) {
    return breakEffect(this, clearSent);
  };
  Field.prototype.adjust_instant = function adjustInstant() {
    return adjustInstant(this);
  };
  Field.prototype.adjust_all = function adjustAll() {
    return adjustAll(this);
  };
  Field.prototype.refresh_location_info_instant = function refreshLocationInfoInstant() {
    return refreshLocationInfoInstant(this);
  };
};

/**
 * Ports the native `field::process(Processors::SolveChain&)` control flow.
 * @param {import('../processor').ProcessDescriptor|import('../field').Field} unit Process descriptor or field instance.
 * @param {import('../field').Field} field Field instance driving resolution.
 * @returns {boolean} True when processing completes for the current step.
 */
function processSolveChain(unit, field) {
  ensureHelpers();
  const isFieldArg = unit && unit.core && unit.infos && unit.player;
  const context = isFieldArg ? unit : field ?? this;
  const arg = (isFieldArg ? field : unit?.payload ?? unit) ?? {};
  const step = isFieldArg ? (arg.step ?? 0) : (unit?.step ?? arg.step ?? 0);
  const { core, infos, returns, pduel, player } = context;

  if (!core.current_chain?.length && step === 0) return true;
  const cait = core.current_chain[core.current_chain.length - 1];

  switch (step) {
    case 0: {
      if (core.spsummon_rst) {
        if (context.is_flag(DUEL_CANNOT_SUMMON_OATH_OLD)) {
          context.set_spsummon_counter?.(0, false, true);
          context.set_spsummon_counter?.(1, false, true);
          core.spsummon_rst = false;
        }
        if (context.is_flag(DUEL_SPSUMMON_ONCE_OLD_NEGATE)) {
          for (let plr = 0; plr < 2; ++plr) {
            for (const [rawCode, count] of getStoreEntries(core.spsummon_once_map[plr])) {
              const spcode = typeof rawCode === 'string' ? Number(rawCode) : rawCode;
              const rst = getStoreValue(core.spsummon_once_map_rst[plr], spcode);
              const next = (count ?? 0) - rst;
              setStoreValue(core.spsummon_once_map[plr], spcode, next);
              setStoreValue(core.spsummon_once_map_rst[plr], spcode, 0);
            }
          }
        }
      }
      const message = pduel.new_message(MSG_CHAIN_SOLVING);
      message.write(cait.chain_count);
      context.add_to_disable_check_list?.(cait.triggering_effect.get_handler());
      context.adjust_instant();
      context.raise_event?.(null, EVENT_CHAIN_ACTIVATING, cait.triggering_effect, 0, cait.triggering_player, cait.triggering_player, cait.chain_count);
      context.process_instant_event?.();
      return false;
    }
    case 1: {
      const peffect = cait.triggering_effect;
      if ((cait.flag & CHAIN_DISABLE_ACTIVATE) && context.is_chain_negatable?.(cait.chain_count)) {
        context.remove_oath_effect?.(peffect);
        if (peffect.is_flag(EFFECT_FLAG_COUNT_LIMIT) && (peffect.count_flag & EFFECT_COUNT_CODE_OATH)) {
          context.dec_effect_code?.(peffect.count_code, peffect.count_flag, peffect.count_hopt_index, cait.triggering_player);
        }
        if (cait.applied_chain_counters) {
          context.restore_chain_counter?.(cait.triggering_player, cait.applied_chain_counters);
          cait.applied_chain_counters = null;
        }
        if (Array.isArray(core.new_fchain)) {
          core.new_fchain = core.new_fchain.filter((ch) => !(ch.evt.event_code === EVENT_CHAINING && ch.evt.event_value === cait.chain_count));
        }
        if (Array.isArray(core.new_ochain)) {
          core.new_ochain = core.new_ochain.filter((ch) => !(ch.evt.event_code === EVENT_CHAINING && ch.evt.event_value === cait.chain_count));
        }
        context.raise_event?.(null, EVENT_CHAIN_NEGATED, peffect, 0, cait.triggering_player, cait.triggering_player, cait.chain_count);
        context.process_instant_event?.();
        arg.step = 9;
        return false;
      }
      if (cait.applied_chain_counters) cait.applied_chain_counters = null;
      context.release_oath_relation?.(peffect);
      context.break_effect?.();
      core.chain_solving = true;
      context.raise_event?.(null, EVENT_CHAIN_SOLVING, peffect, 0, cait.triggering_player, cait.triggering_player, cait.chain_count);
      context.process_instant_event?.();
      return false;
    }
    case 2: {
      core.spsummon_state_count_tmp[0] = core.spsummon_state_count[0];
      core.spsummon_state_count_tmp[1] = core.spsummon_state_count[1];
      const peffect = cait.triggering_effect;
      const pcard = peffect.get_handler();
      if ((cait.flag & CHAIN_CONTINUOUS_CARD) && !pcard.is_has_relation(cait)) {
        arg.step = 3;
        return false;
      }
      if ((peffect.type & EFFECT_TYPE_ACTIVATE) && pcard.is_has_relation(cait) && !cait.replace_op) {
        pcard.enable_field_effect(true);
        if (context.is_flag(DUEL_1_FACEUP_FIELD)) {
          if (pcard.data.type & TYPE_FIELD) {
            const fscard = player[1 - pcard.current.controler].list_szone[5];
            if (fscard && fscard.is_position(POS_FACEUP)) fscard.enable_field_effect(false);
          }
        }
        context.adjust_instant();
      }
      if (context.is_chain_disablable?.(cait.chain_count)
        && (!peffect.is_flag(EFFECT_FLAG_CONTINUOUS_TARGET) || cait.replace_op)) {
        if (context.is_chain_disabled?.(cait.chain_count)
          || (pcard.get_status(STATUS_DISABLED | STATUS_FORBIDDEN) && pcard.is_has_relation(cait))) {
          if (!(cait.flag & CHAIN_DISABLE_EFFECT)) {
            const message = pduel.new_message(MSG_CHAIN_DISABLED);
            message.write(cait.chain_count);
          }
          context.raise_event?.(null, EVENT_CHAIN_DISABLED, peffect, 0, cait.triggering_player, cait.triggering_player, cait.chain_count);
          context.process_instant_event?.();
          arg.step = 3;
          return false;
        }
      }
      return false;
    }
    case 3: {
      const peffect = cait.triggering_effect;
      const pcard = peffect.get_handler();
      if ((cait.flag & CHAIN_CONTINUOUS_CARD) && !pcard.is_has_relation(cait)) return false;
      if (cait.replace_op) {
        arg.backed_up_operation = peffect.operation;
        peffect.operation = cait.replace_op;
      } else {
        arg.backed_up_operation = 0;
      }
      if (peffect.operation) {
        core.sub_solving_event.push(cait.evt);
        context.emplace_process?.('ExecuteOperation', peffect, cait.triggering_player);
      }
      return false;
    }
    case 4: {
      const peffect = cait.triggering_effect;
      if (arg.backed_up_operation) {
        if (peffect.operation) {
          pduel.lua.ensure_luaL_stack?.(peffect.operation);
        }
        peffect.operation = arg.backed_up_operation;
      }
      core.special_summoning?.clear?.();
      core.equiping_cards?.clear?.();
      return false;
    }
    case 5: {
      const hadBackup = arg.backed_up_operation;
      arg.backed_up_operation = 0;
      if (hadBackup === 0) {
        const opinfo = getOpInfo(cait, 0x200);
        if (opinfo?.op_count) {
          if (context.is_flag(DUEL_CANNOT_SUMMON_OATH_OLD)) {
            if (core.spsummon_state_count_tmp[cait.triggering_player] === core.spsummon_state_count[cait.triggering_player]) {
              context.set_spsummon_counter?.(cait.triggering_player);
            }
            if (opinfo.op_player === PLAYER_ALL
              && core.spsummon_state_count_tmp[1 - cait.triggering_player] === core.spsummon_state_count[1 - cait.triggering_player]) {
              context.set_spsummon_counter?.(1 - cait.triggering_player);
            }
          }
          if (context.is_flag(DUEL_CANNOT_SUMMON_OATH_OLD)) {
            const optarget = opinfo;
            if (optarget.op_cards?.container) {
              if (optarget.op_player === PLAYER_ALL) {
                const sumplayer = optarget.op_param;
                if (context.is_flag(DUEL_SPSUMMON_ONCE_OLD_NEGATE) && (core.global_flag & GLOBALFLAG_SPSUMMON_ONCE)) {
                  const cards = Array.from(optarget.op_cards.container);
                  const first = cards[0];
                  const second = cards[1];
                  if (first?.spsummon_code) {
                    const map = core.spsummon_once_map[sumplayer];
                    const current = getStoreValue(map, first.spsummon_code);
                    setStoreValue(map, first.spsummon_code, current + 1);
                  }
                  if (second?.spsummon_code) {
                    const map = core.spsummon_once_map[1 - sumplayer];
                    const current = getStoreValue(map, second.spsummon_code);
                    setStoreValue(map, second.spsummon_code, current + 1);
                  }
                }
                const cards = Array.from(optarget.op_cards.container);
                context.check_card_counter?.(cards[0], context.ACTIVITY_SPSUMMON, sumplayer);
                context.check_card_counter?.(cards[1], context.ACTIVITY_SPSUMMON, 1 - sumplayer);
              } else {
                let sumplayer = cait.triggering_player;
                if (cait.triggering_effect.is_flag(EFFECT_FLAGS.EFFECT_FLAG_CARD_TARGET) && optarget.op_player === 0x10) {
                  sumplayer = 1 - sumplayer;
                }
                for (const ptarget of optarget.op_cards.container) {
                  if (context.is_flag(DUEL_SPSUMMON_ONCE_OLD_NEGATE)
                    && (core.global_flag & GLOBALFLAG_SPSUMMON_ONCE)
                    && ptarget.spsummon_code) {
                    const map = core.spsummon_once_map[sumplayer];
                    const current = getStoreValue(map, ptarget.spsummon_code);
                    setStoreValue(map, ptarget.spsummon_code, current + 1);
                  }
                  context.check_card_counter?.(ptarget, context.ACTIVITY_SPSUMMON, sumplayer);
                }
              }
            }
          }
        }
      }
      core.spsummon_state_count_tmp[0] = 0;
      core.spsummon_state_count_tmp[1] = 0;
      core.chain_solving = false;
      if (core.delayed_continuous_tp?.length) {
        core.conti_player = infos.turn_player;
        core.sub_solving_continuous.push(core.delayed_continuous_tp.shift());
        context.emplace_process?.('SolveContinuous');
      } else if (core.delayed_continuous_ntp?.length) {
        core.conti_player = 1 - infos.turn_player;
        core.sub_solving_continuous.push(core.delayed_continuous_ntp.shift());
        context.emplace_process?.('SolveContinuous');
      } else {
        core.conti_player = PLAYER_NONE;
      }
      context.raise_event?.(null, EVENT_CHAIN_SOLVED, cait.triggering_effect, 0, cait.triggering_player, cait.triggering_player, cait.chain_count);
      context.adjust_disable_check_list?.();
      context.process_instant_event?.();
      arg.step = 9;
      return false;
    }
    case 10: {
      const message = pduel.new_message(MSG_CHAIN_SOLVED);
      message.write(cait.chain_count);
      const peffect = cait.triggering_effect;
      const pcard = peffect.get_handler();
      if ((peffect.type & EFFECT_TYPE_ACTIVATE) && (cait.flag & CHAIN_ACTIVATING)) peffect.type &= ~EFFECT_TYPE_ACTIVATE;
      if ((cait.flag & CHAIN_HAND_EFFECT) && !pcard.is_position(POS_FACEUP) && pcard.current.location === LOCATION_HAND) {
        context.shuffle?.(pcard.current.controler, LOCATION_HAND);
      }
      if (cait.target_cards?.container?.size) {
        for (const ptarget of cait.target_cards.container) {
          ptarget.release_relation?.(cait);
        }
      }
      if ((pcard.data.type & TYPE_EQUIP) && (peffect.type & EFFECT_TYPE_ACTIVATE)
        && !pcard.equiping_target && pcard.is_has_relation(cait)) {
        pcard.set_status(STATUS_LEAVE_CONFIRMED, true);
      }
      if (context.is_flag(DUEL_1_FACEUP_FIELD)) {
        if ((pcard.data.type & TYPE_FIELD) && (peffect.type & EFFECT_TYPE_ACTIVATE)
          && !pcard.is_status(STATUS_LEAVE_CONFIRMED) && pcard.is_has_relation(cait)) {
          const fscard = player[1 - pcard.current.controler].list_szone[5];
          if (fscard && fscard.is_position(POS_FACEUP)) {
            context.destroy?.(fscard, null, REASON_RULE, 1 - pcard.current.controler);
          }
        }
      }
      peffect.active_type = 0;
      peffect.active_handler = null;
      pcard.release_relation?.(cait);
      for (const cit of core.delayed_enable_set ?? []) {
        if (cit.current.location === CARD_LOCATIONS.LOCATION_MZONE) cit.enable_field_effect(true);
      }
      core.delayed_enable_set?.clear?.();
      context.adjust_all();
      core.current_chain.pop();
      core.real_chain_count = Math.max(0, (core.real_chain_count ?? 0) - 1);
      if (!core.current_chain.length) {
        for (const chLim of core.chain_limit ?? []) {
          pduel.lua.ensure_luaL_stack?.(chLim.function);
        }
        core.chain_limit = [];
        return false;
      }
      if ((core.summoning_card || core.summoning_proc_group_type) && core.reserved) {
        if (context.processor?.subunits) context.processor.subunits.push(core.reserved);
        core.reserved = null;
      }
      core.summoning_card = null;
      core.summoning_proc_group_type = 0;
      arg.step = PROCESS_RESTART;
      return false;
    }
    case 11: {
      if (core.leave_confirmed?.size) {
        for (const card of Array.from(core.leave_confirmed)) {
          if (!card.is_status(STATUS_LEAVE_CONFIRMED)) core.leave_confirmed.delete(card);
        }
        if (core.leave_confirmed.size) {
          context.send_to?.(core.leave_confirmed, null, REASON_RULE, PLAYER_NONE, PLAYER_NONE, LOCATION_GRAVE, 0, POS_FACEUP);
        }
      }
      return false;
    }
    case 12: {
      core.used_event = core.used_event ?? [];
      moveAll(core.used_event, core.point_event);
      pduel.new_message(MSG_CHAIN_END);
      context.reset_chain?.();
      if ((core.summoning_card || core.summoning_proc_group_type || core.effect_damage_step === 1) && core.reserved) {
        if (context.processor?.subunits) context.processor.subunits.push(core.reserved);
        core.reserved = null;
      }
      core.summoning_proc_group_type = 0;
      core.summoning_card = null;
      return false;
    }
    case 13: {
      core.just_sent_cards?.clear?.();
      context.raise_event?.(null, EVENT_CHAIN_END, null, 0, 0, 0, 0);
      context.process_instant_event?.();
      context.adjust_all();
      if (!arg.skip_trigger || !arg.skip_new) {
        core.hint_timing[0] |= TIMING_CHAIN_END;
        core.hint_timing[1] |= TIMING_CHAIN_END;
        context.emplace_process?.('PointEvent', arg.skip_trigger, arg.skip_freechain || arg.skip_new, arg.skip_new);
      }
      returns.set(0, true);
      return true;
    }
    default:
      return true;
  }
}

function breakEffect(context, clearSent = false) {
  const { core, infos, player, pduel } = context;
  if (clearSent) core.just_sent_cards?.clear?.();
  core.hint_timing[0] &= TIMING_DAMAGE_STEP | TIMING_DAMAGE_CAL;
  core.hint_timing[1] &= TIMING_DAMAGE_STEP | TIMING_DAMAGE_CAL;
  if (Array.isArray(core.new_ochain)) {
    for (let i = core.new_ochain.length - 1; i >= 0; --i) {
      const ch = core.new_ochain[i];
      const peffect = ch.triggering_effect;
      if (!peffect.is_flag(EFFECT_FLAG_DELAY)) {
        if (peffect.is_flag(EFFECT_FLAG_FIELD_ONLY)
          || !(peffect.type & EFFECT_TYPE_FIELD)
          || peffect.in_range?.(ch)) {
          const message = pduel.new_message(MSG_MISSED_EFFECT);
          message.write(peffect.get_handler().get_info_location());
          message.write(peffect.get_handler().data.code);
        }
        core.new_ochain.splice(i, 1);
      }
    }
  }
  core.used_event = core.used_event ?? [];
  moveAll(core.used_event, core.instant_event);
  adjustInstant(context);
  if (!context.is_flag(DUEL_RELAY) && !core.force_turn_end) {
    let winp = 5;
    let rea = 1;
    if (player[0].lp <= 0 && player[1].lp > 0 && !context.is_player_affected_by_effect(0, EFFECT_CANNOT_LOSE_LP)) {
      winp = 1;
      rea = 1;
    }
    if (core.overdraw[0] && !core.overdraw[1] && !context.is_player_affected_by_effect(0, EFFECT_CANNOT_LOSE_DECK)) {
      winp = 1;
      rea = 2;
    }
    if (player[1].lp <= 0 && player[0].lp > 0 && !context.is_player_affected_by_effect(1, EFFECT_CANNOT_LOSE_LP)) {
      winp = 0;
      rea = 1;
    }
    if (core.overdraw[1] && !core.overdraw[0] && !context.is_player_affected_by_effect(1, EFFECT_CANNOT_LOSE_DECK)) {
      winp = 0;
      rea = 2;
    }
    if (player[1].lp <= 0 && player[0].lp <= 0
      && !(context.is_player_affected_by_effect(0, EFFECT_CANNOT_LOSE_LP)
        && context.is_player_affected_by_effect(1, EFFECT_CANNOT_LOSE_LP))) {
      if (context.is_player_affected_by_effect(0, EFFECT_CANNOT_LOSE_LP)) winp = 0;
      else if (context.is_player_affected_by_effect(1, EFFECT_CANNOT_LOSE_LP)) winp = 1;
      else winp = PLAYER_NONE;
      rea = 1;
    }
    if (core.overdraw[1] && core.overdraw[0]
      && !(context.is_player_affected_by_effect(0, EFFECT_CANNOT_LOSE_DECK)
        && context.is_player_affected_by_effect(1, EFFECT_CANNOT_LOSE_DECK))) {
      if (context.is_player_affected_by_effect(0, EFFECT_CANNOT_LOSE_DECK)) winp = 0;
      else if (context.is_player_affected_by_effect(1, EFFECT_CANNOT_LOSE_DECK)) winp = 1;
      else winp = PLAYER_NONE;
      rea = 2;
    }
    if (winp !== 5) {
      const message = pduel.new_message(MSG_WIN);
      message.write(winp);
      message.write(rea);
      core.overdraw[0] = false;
      core.overdraw[1] = false;
      core.win_player = 5;
      core.win_reason = 0;
    } else if (core.win_player !== 5) {
      const message = pduel.new_message(MSG_WIN);
      message.write(core.win_player);
      message.write(core.win_reason);
      core.win_player = 5;
      core.win_reason = 0;
      core.overdraw[0] = false;
      core.overdraw[1] = false;
    }
  }
  return 0;
}

function adjustInstant(context) {
  const { infos } = context;
  infos.event_id += 1;
  context.adjust_disable_check_list?.();
  context.adjust_self_destroy_set?.();
}

function adjustAll(context) {
  const { infos, core } = context;
  infos.event_id += 1;
  core.readjust_map?.clear?.();
  context.emplace_process?.('Adjust');
}

function refreshLocationInfoInstant(context) {
  const { player, pduel } = context;
  const eset = [];
  const dis1 = player[0].disabled_location | (player[1].disabled_location << 16);
  player[0].disabled_location = 0;
  player[1].disabled_location = 0;
  context.filter_field_effect?.(EFFECT_DISABLE_FIELD, eset);
  for (const peff of eset) {
    const value = peff.get_value();
    player[0].disabled_location |= value & 0xff7f;
    player[1].disabled_location |= (value >> 16) & 0xff7f;
  }
  eset.length = 0;
  context.filter_field_effect?.(EFFECT_USE_EXTRA_MZONE, eset);
  for (const peff of eset) {
    const p = peff.get_handler_player();
    const value = peff.get_value();
    player[p].disabled_location |= (value >> 16) & 0x1f;
  }
  eset.length = 0;
  context.filter_field_effect?.(EFFECT_USE_EXTRA_SZONE, eset);
  for (const peff of eset) {
    const p = peff.get_handler_player();
    const value = peff.get_value();
    player[p].disabled_location |= (value >> 8) & 0x1f00;
  }
  player[0].disabled_location |= (((player[1].disabled_location >> 5) & 1) << 6) | (((player[1].disabled_location >> 6) & 1) << 5);
  player[1].disabled_location |= (((player[0].disabled_location >> 5) & 1) << 6) | (((player[0].disabled_location >> 6) & 1) << 5);
  const dis2 = player[0].disabled_location | (player[1].disabled_location << 16);
  if (dis1 !== dis2) {
    const message = pduel.new_message(MSG_FIELD_DISABLED);
    message.write(dis2);
  }
}

processSolveChain.break_effect = breakEffect;
processSolveChain.adjust_instant = adjustInstant;
processSolveChain.adjust_all = adjustAll;
processSolveChain.refresh_location_info_instant = refreshLocationInfoInstant;

module.exports = processSolveChain;
