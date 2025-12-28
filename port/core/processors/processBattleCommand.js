const { EFFECT_CODES, EFFECT_EVENTS, EFFECT_TYPES } = require("../effect");
const { CARD_LOCATIONS, CARD_TYPES, PLAYERS } = require("../card");
const { OCG_CONSTANTS } = require("../ocgapi");

const {
  EFFECT_SKIP_BP,
  EFFECT_BP_TWICE,
  EFFECT_CANNOT_ATTACK_ANNOUNCE,
  EFFECT_FIRST_ATTACK,
  EFFECT_MUST_ATTACK,
  EFFECT_CANNOT_M2,
  EFFECT_PATRICIAN_OF_DARKNESS,
  EFFECT_ATTACK_COST,
  EFFECT_ATTACK_DISABLED,
  EFFECT_INDESTRUCTABLE_BATTLE,
  EFFECT_BATTLE_DESTROY_REDIRECT,
} = EFFECT_CODES;

const { EFFECT_TYPE_CONTINUOUS } = EFFECT_TYPES;

const {
  EVENT_FREE_CHAIN,
  EVENT_BE_BATTLE_TARGET,
  EVENT_ATTACK_ANNOUNCE,
  EVENT_BATTLE_START,
  EVENT_BATTLE_CONFIRM,
  EVENT_PRE_DAMAGE_CALCULATE,
  EVENT_PRE_BATTLE_DAMAGE,
  EVENT_BATTLED,
  EVENT_BATTLE_DESTROYING,
  EVENT_BATTLE_DESTROYED,
  EVENT_DAMAGE_STEP_END,
} = EFFECT_EVENTS;

const { LOCATION_MZONE } = CARD_LOCATIONS;
const { TYPE_MONSTER } = CARD_TYPES;
const { PLAYER_NONE } = PLAYERS;

const { POS_FACEDOWN, POS_FACEUP, POS_FACEUP_DEFENSE } = OCG_CONSTANTS;

const PHASE_BATTLE_STEP = 0x10;
const PHASE_DAMAGE = 0x20;
const PHASE_DAMAGE_CAL = 0x40;
const PHASE_BATTLE = 0x80;

const STATUS_CHAINING = 0x10000;
const STATUS_ATTACK_CANCELED = 0x200000;
const STATUS_OPPO_BATTLE = 0x10000000;
const STATUS_BATTLE_RESULT = 0x40;
const STATUS_BATTLE_DESTROYED = 0x4000;
const STATUS_DESTROY_CONFIRMED = 0x1000;

const TIMING_ATTACK = 0x1000;
const TIMING_DAMAGE_STEP = 0x2000;
const TIMING_DAMAGE_CAL = 0x4000;
const TIMING_BATTLE_PHASE = 0x1000000;
const TIMING_BATTLE_STEP_END = 0x4000000;
const TIMING_BATTLED = 0x8000000;

const MSG_HINT = 2;
const MSG_CARD_SELECTED = 80;
const MSG_ATTACK = 110;
const MSG_BATTLE = 111;
const MSG_ATTACK_DISABLED = 112;
const MSG_DAMAGE_STEP_START = 113;
const MSG_DAMAGE_STEP_END = 114;

const HINT_EVENT = 1;
const HINT_SELECTMSG = 3;
const HINT_CARD = 10;

const RESET_CODE = 0x4000;

const REASON_BATTLE = 0x20;
const REASON_EFFECT = 0x40;
const REASON_REPLACE = 0x1000000;

const DUEL_NO_MAIN_PHASE_2 = 0x200000;
const DUEL_6_STEP_BATLLE_STEP = 0x08;
const DUEL_STORE_ATTACK_REPLAYS = 0x20000000;
const DUEL_SINGLE_CHAIN_IN_DAMAGE_SUBSTEP = 0x40000000;

const PROCESS_RESTART = 0xffff;

const getSize = (value) => {
  if (!value) return 0;
  if (typeof value.size === "number") return value.size;
  if (typeof value.size === "function") return value.size();
  if (typeof value.length === "number") return value.length;
  return 0;
};

const forEachEffect = (collection, code, handler) => {
  if (!collection) return;
  if (typeof collection.equal_range === "function") {
    const range = collection.equal_range(code);
    if (range) {
      if (Array.isArray(range)) {
        for (const entry of range) handler(entry?.second ?? entry);
        return;
      }
      if (typeof range[Symbol.iterator] === "function") {
        for (const entry of range) handler(entry?.second ?? entry);
        return;
      }
    }
  }
  if (collection instanceof Map) {
    const list = collection.get(code);
    if (Array.isArray(list)) {
      for (const effect of list) handler(effect);
    } else if (list) {
      handler(list);
    }
    return;
  }
  const list = collection[code];
  if (Array.isArray(list)) {
    for (const effect of list) handler(effect);
  } else if (list) {
    handler(list);
  }
};
const resetReturnCards = (returnCards) => {
  if (!returnCards) return;
  if (typeof returnCards.clear === "function") {
    returnCards.clear();
    return;
  }
  returnCards.canceled = false;
  returnCards.list = [];
};

const resetMustAttackMap = (mustAttackMap) => {
  if (!mustAttackMap) return [];
  if (typeof mustAttackMap.clear === "function") {
    mustAttackMap.clear();
    return mustAttackMap;
  }
  if (Array.isArray(mustAttackMap)) {
    mustAttackMap.length = 0;
    return mustAttackMap;
  }
  return [];
};

const normalizeMustAttackPairs = (mustAttackMap) => {
  if (!mustAttackMap) return [];
  if (Array.isArray(mustAttackMap)) {
    return mustAttackMap.map((pair) => {
      if (Array.isArray(pair)) return { effect: pair[0], card: pair[1] };
      return {
        effect: pair.effect,
        card: pair.card ?? pair.value ?? pair.second,
      };
    });
  }
  if (mustAttackMap instanceof Map) {
    const pairs = [];
    for (const [effect, cards] of mustAttackMap.entries()) {
      if (Array.isArray(cards)) {
        for (const card of cards) pairs.push({ effect, card });
      } else if (cards) {
        pairs.push({ effect, card: cards });
      }
    }
    return pairs;
  }
  return [];
};

const spliceFront = (target, source) => {
  if (!target || !source) return;
  if (Array.isArray(target) && Array.isArray(source) && source.length) {
    target.unshift(...source);
    source.length = 0;
  }
};

/**
 * Ports the native `field::process(Processors::BattleCommand&)` control flow.
 * @param {import('../processor').ProcessDescriptor|import('../field').Field} unit Process descriptor or field instance.
 * @param {import('../field').Field} field Field instance driving resolution.
 * @returns {boolean} True when processing completes for the current step.
 */
function processBattleCommand(unit, field) {
  const isFieldArg = unit && unit.core && unit.infos && unit.player;
  const context = isFieldArg ? unit : field ?? this;
  const arg = (isFieldArg ? field : unit) ?? {};
  const { core, infos, effects, pduel, player, returns } = context;
  const returnCards = context.return_cards ?? context.returnCards ?? {};

  switch (arg.step) {
    case 0: {
      core.select_chains = [];
      context.nil_event.event_code = EVENT_FREE_CHAIN;
      if (!core.chain_attack) {
        core.chain_attacker_id = 0;
        core.chain_attack_target = null;
      }
      core.attack_player = false;
      core.attacker = null;
      core.attack_target = null;
      const skipEffect = context.is_player_affected_by_effect(
        infos.turn_player,
        EFFECT_SKIP_BP
      );
      if (skipEffect || core.force_turn_end) {
        arg.step = 41;
        arg.phase_to_change_to = 2;
        arg.repeat_battle_phase = Boolean(
          context.is_player_affected_by_effect(
            infos.turn_player,
            EFFECT_BP_TWICE
          )
        );
        if (core.force_turn_end || !skipEffect?.value) {
          context.reset_phase(PHASE_BATTLE_STEP);
          context.adjust_all();
          infos.phase = PHASE_BATTLE;
          context.emplace_process("PhaseEvent", PHASE_BATTLE);
        } else {
          core.hint_timing[infos.turn_player] = 0;
          context.reset_phase(PHASE_BATTLE);
          context.adjust_all();
        }
        return false;
      }

      forEachEffect(effects.activate_effect, EVENT_FREE_CHAIN, (peffect) => {
        peffect.set_activate_location();
        if (
          peffect.is_activateable(infos.turn_player, context.nil_event) &&
          peffect.get_speed() > 1
        ) {
          core.select_chains.push({ triggering_effect: peffect });
        }
      });
      forEachEffect(effects.quick_o_effect, EVENT_FREE_CHAIN, (peffect) => {
        peffect.set_activate_location();
        if (peffect.is_activateable(infos.turn_player, context.nil_event)) {
          core.select_chains.push({ triggering_effect: peffect });
        }
      });
      forEachEffect(effects.continuous_effect, EVENT_FREE_CHAIN, (peffect) => {
        if (
          peffect.get_handler_player() === infos.turn_player &&
          peffect.is_activateable(infos.turn_player, context.nil_event)
        ) {
          core.select_chains.push({ triggering_effect: peffect });
        }
      });

      core.attackable_cards = [];
      const firstAttack = [];
      const mustAttack = [];
      if (
        !context.is_player_affected_by_effect(
          infos.turn_player,
          EFFECT_CANNOT_ATTACK_ANNOUNCE
        )
      ) {
        for (const pcard of player[infos.turn_player].list_mzone) {
          if (!pcard) continue;
          if (!pcard.is_capable_attack_announce(infos.turn_player)) continue;
          let chainAttack = false;
          if (core.chain_attack && core.chain_attacker_id === pcard.fieldid)
            chainAttack = true;
          const cv = [];
          context.get_attack_target(pcard, cv, chainAttack);
          if (!cv.length && pcard.direct_attackable === 0) continue;
          core.attackable_cards.push(pcard);
          if (pcard.is_affected_by_effect(EFFECT_FIRST_ATTACK))
            firstAttack.push(pcard);
          if (pcard.is_affected_by_effect(EFFECT_MUST_ATTACK))
            mustAttack.push(pcard);
        }
        if (firstAttack.length) core.attackable_cards = [...firstAttack];
      }
      core.to_m2 = !context.is_flag(DUEL_NO_MAIN_PHASE_2);
      core.to_ep = true;
      if (
        mustAttack.length ||
        context.is_player_affected_by_effect(
          infos.turn_player,
          EFFECT_CANNOT_M2
        ) ||
        core.force_turn_end
      )
        core.to_m2 = false;
      if (mustAttack.length) core.to_ep = false;
      core.attack_cancelable = true;
      core.attack_cost_paid = false;
      context.emplace_process("SelectBattleCmd", infos.turn_player);
      return false;
    }
    case 1: {
      const ret = returns.at(0);
      const ctype = ret & 0xffff;
      const sel = ret >> 16;
      if (arg.forced_attack_done || (ctype !== 0 && ctype !== 1)) {
        arg.step = 39;
        arg.phase_to_change_to = ctype;
        let message = pduel.new_message(MSG_HINT);
        message.write(HINT_EVENT);
        message.write(1 - infos.turn_player);
        message.write(29);
        core.select_chains = [];
        core.hint_timing[infos.turn_player] = TIMING_BATTLE_STEP_END;
        context.emplace_process("QuickEffect", false, 1 - infos.turn_player);
        infos.priorities[infos.turn_player] = 1;
        infos.priorities[1 - infos.turn_player] = 0;
        return false;
      }
      if (ctype === 0) {
        const newchain = core.select_chains[sel];
        const peffect = newchain?.triggering_effect;
        if (peffect?.type & EFFECT_TYPE_CONTINUOUS) {
          core.select_chains = [];
          context.solve_continuous(
            peffect.get_handler_player(),
            peffect,
            context.nil_event
          );
          arg.step = 14;
          return false;
        }
        const phandler = peffect.get_handler();
        newchain.flag = 0;
        newchain.chain_id = infos.field_id++;
        newchain.evt = newchain.evt ?? {};
        newchain.evt.event_code = peffect.code;
        newchain.evt.event_player = PLAYER_NONE;
        newchain.evt.event_value = 0;
        newchain.evt.event_cards = null;
        newchain.evt.reason = 0;
        newchain.evt.reason_effect = null;
        newchain.evt.reason_player = PLAYER_NONE;
        newchain.set_triggering_state(phandler);
        newchain.triggering_player = infos.turn_player;
        core.new_chains = core.new_chains ?? [];
        core.new_chains.push(...core.select_chains.splice(sel, 1));
        phandler.set_status(STATUS_CHAINING, true);
        peffect.dec_count(infos.turn_player);
        core.select_chains = [];
        context.emplace_process("AddChain");
        context.emplace_process("QuickEffect", false, 1 - infos.turn_player);
        infos.priorities[0] = 0;
        infos.priorities[1] = 0;
        core.select_chains = [];
        return false;
      }
      if (ctype === 1) {
        arg.step = 2;
        arg.attack_announce_failed = false;
        if (!arg.forced_attack) core.attacker = core.attackable_cards[sel];
        core.attacker.set_status(STATUS_ATTACK_CANCELED, false);
        core.attacker.attack_controler = core.attacker.current.controler;
        core.pre_field[0] = core.attacker.fieldid_r;
        if (
          core.chain_attack &&
          core.chain_attacker_id !== core.attacker.fieldid
        ) {
          core.chain_attack = false;
          core.chain_attacker_id = 0;
        }
        const eset = [];
        core.tpchain = [];
        context.filter_player_effect(
          infos.turn_player,
          EFFECT_ATTACK_COST,
          eset,
          false
        );
        core.attacker.filter_effect(EFFECT_ATTACK_COST, eset);
        for (const peff of eset) {
          if (peff.operation) {
            core.tpchain.push({ triggering_effect: peff });
            core.attack_cancelable = false;
          }
        }
        if (core.tpchain.length > 1) {
          context.emplace_process("SortChain", infos.turn_player);
          arg.step = 13;
        } else if (core.tpchain.length === 1) {
          core.sub_solving_event.push(context.nil_event);
          context.emplace_process(
            "ExecuteOperation",
            core.tpchain[0].triggering_effect,
            infos.turn_player
          );
          context.adjust_all();
        }
        return false;
      }
      return true;
    }
    case 2: {
      if (Array.isArray(core.chain_limit)) {
        for (const chLim of core.chain_limit) {
          pduel.lua.ensure_luaL_stack(chLim.function);
        }
      }
      core.chain_limit = [];
      for (const ch of core.current_chain ?? []) {
        ch.triggering_effect.get_handler().set_status(STATUS_CHAINING, false);
      }
      context.emplace_process("SolveChain", false, false, false);
      arg.step = PROCESS_RESTART;
      return false;
    }
    case 3: {
      arg.is_replaying_attack = false;
      if (core.attacker.is_status(STATUS_ATTACK_CANCELED)) {
        arg.attack_announce_failed = true;
        arg.step = 6;
        return false;
      }
      if (core.attack_cost_paid !== 1 && !core.attack_cancelable) {
        if (arg.forced_attack) {
          returns.set(0, 2);
          arg.step = 0;
        } else {
          arg.step = PROCESS_RESTART;
        }
        return false;
      }
      if (arg.forced_attack) arg.step = 6;
      return false;
    }
    case 4: {
      core.attack_player = false;
      core.select_cards = [];
      resetReturnCards(returnCards);
      arg.must_attack_map = resetMustAttackMap(arg.must_attack_map);
      const atype = context.get_attack_target(
        core.attacker,
        core.select_cards,
        core.chain_attack,
        true,
        arg.must_attack_map
      );
      if (core.attacker.direct_attackable) {
        if (!core.select_cards.length) {
          returns.set(0, -2);
          arg.step = 5;
          return false;
        }
        if (
          context.is_player_affected_by_effect(
            infos.turn_player,
            EFFECT_PATRICIAN_OF_DARKNESS
          )
        ) {
          context.emplace_process(
            "SelectEffectYesNo",
            1 - infos.turn_player,
            31,
            core.attacker
          );
        } else {
          context.emplace_process("SelectYesNo", infos.turn_player, 31);
        }
        return false;
      }
      if (!core.select_cards.length) {
        arg.attack_announce_failed = true;
        arg.step = 6;
        return false;
      }
      const mustAttackPairs = normalizeMustAttackPairs(arg.must_attack_map);
      const distinctEffects = new Set(
        mustAttackPairs.map((pair) => pair.effect)
      ).size;
      const patrician =
        context.is_player_affected_by_effect(
          infos.turn_player,
          EFFECT_PATRICIAN_OF_DARKNESS
        ) != null;
      if (patrician || (atype === 3 && distinctEffects !== 1)) {
        if (core.select_cards.length === 1) {
          returnCards.list.push(core.select_cards[0]);
        } else {
          let message = pduel.new_message(MSG_CARD_SELECTED);
          message.write(1);
          message.write(core.attacker.get_info_location());
          message = pduel.new_message(MSG_HINT);
          message.write(HINT_SELECTMSG);
          message.write(1 - infos.turn_player);
          message.write(549);
          context.emplace_process(
            "SelectCard",
            1 - infos.turn_player,
            false,
            1,
            1
          );
          if (
            !patrician &&
            atype === 3 &&
            getSize(arg.must_attack_map) !== distinctEffects
          ) {
            arg.step = 15;
            return false;
          }
        }
      } else {
        const message = pduel.new_message(MSG_HINT);
        message.write(HINT_SELECTMSG);
        message.write(infos.turn_player);
        message.write(549);
        context.emplace_process(
          "SelectCard",
          infos.turn_player,
          core.attack_cancelable,
          1,
          1
        );
      }
      arg.step = 5;
      return false;
    }
    case 5: {
      if (returns.at(0)) {
        returns.set(0, -2);
      } else {
        if (core.select_cards.length) {
          const opposel = Boolean(
            context.is_player_affected_by_effect(
              infos.turn_player,
              EFFECT_PATRICIAN_OF_DARKNESS
            )
          );
          const selPlayer = opposel ? 1 - infos.turn_player : infos.turn_player;
          const cancelable = core.attack_cancelable && !opposel;
          const message = pduel.new_message(MSG_HINT);
          message.write(HINT_SELECTMSG);
          message.write(opposel ? 1 - infos.turn_player : infos.turn_player);
          message.write(549);
          context.emplace_process("SelectCard", selPlayer, cancelable, 1, 1);
        } else {
          arg.attack_announce_failed = true;
          arg.step = 6;
        }
      }
      return false;
    }
    case 6: {
      if (returnCards.canceled) {
        if (arg.is_replaying_attack) {
          arg.step = 12;
          return false;
        }
        if (arg.forced_attack) {
          returns.set(0, 2);
          arg.step = 0;
        } else {
          arg.step = PROCESS_RESTART;
        }
        return false;
      }
      if (returns.at(0) === -2) core.attack_target = null;
      else core.attack_target = returnCards.list[0];
      if (core.attack_target) core.pre_field[1] = core.attack_target.fieldid_r;
      else core.pre_field[1] = 0;
      return false;
    }
    case 7: {
      if (!arg.is_replaying_attack) {
        core.phase_action = true;
        core.attack_state_count[infos.turn_player] += 1;
        context.check_card_counter(
          core.attacker,
          context.ACTIVITY_ATTACK,
          infos.turn_player
        );
        core.attacker.attack_announce_count += 1;
      }
      if (arg.attack_announce_failed) {
        core.attacker.announce_count += 1;
        core.chain_attack = false;
        if (arg.forced_attack) {
          returns.set(0, 2);
          arg.step = 0;
        } else {
          arg.step = PROCESS_RESTART;
        }
      }
      return false;
    }
    case 8: {
      core.attack_cancelable = true;
      const message = pduel.new_message(MSG_ATTACK);
      message.write(core.attacker.get_info_location());
      if (core.attack_target) {
        context.raise_single_event(
          core.attack_target,
          null,
          EVENT_BE_BATTLE_TARGET,
          null,
          0,
          0,
          1 - infos.turn_player,
          0
        );
        context.raise_event(
          core.attack_target,
          EVENT_BE_BATTLE_TARGET,
          null,
          0,
          0,
          1 - infos.turn_player,
          0
        );
        message.write(core.attack_target.get_info_location());
      } else {
        message.write({});
      }
      core.attack_rollback = false;
      if (core.opp_mzone?.clear) core.opp_mzone.clear();
      else core.opp_mzone = new Set();
      for (const pcard of player[1 - infos.turn_player].list_mzone) {
        if (pcard) core.opp_mzone.add(pcard.fieldid_r);
      }
      if (!arg.is_replaying_attack) {
        context.raise_single_event(
          core.attacker,
          null,
          EVENT_ATTACK_ANNOUNCE,
          null,
          0,
          0,
          infos.turn_player,
          0
        );
        context.raise_event(
          core.attacker,
          EVENT_ATTACK_ANNOUNCE,
          null,
          0,
          0,
          infos.turn_player,
          0
        );
      }
      core.attacker.attack_controler = core.attacker.current.controler;
      core.pre_field[0] = core.attacker.fieldid_r;
      context.process_single_event();
      context.process_instant_event();
      core.hint_timing[infos.turn_player] = TIMING_ATTACK;
      context.emplace_process("PointEvent", false, false, false);
      return false;
    }
    case 9: {
      if (
        context.is_player_affected_by_effect(
          infos.turn_player,
          EFFECT_SKIP_BP
        ) ||
        core.attacker.is_status(STATUS_ATTACK_CANCELED) ||
        core.attack_rollback
      ) {
        arg.step = 10;
        return false;
      }
      let message = pduel.new_message(MSG_HINT);
      message.write(HINT_EVENT);
      message.write(0);
      message.write(24);
      message = pduel.new_message(MSG_HINT);
      message.write(HINT_EVENT);
      message.write(1);
      message.write(24);
      core.hint_timing[0] = TIMING_BATTLE_PHASE;
      core.hint_timing[1] = TIMING_BATTLE_PHASE;
      context.emplace_process("PointEvent", { step: 30 }, false, false, false);
      return false;
    }
    case 10: {
      if (returns.at(0)) arg.step = 8;
      else context.adjust_all();
      return false;
    }
    case 11: {
      if (core.attacker.is_affected_by_effect(EFFECT_ATTACK_DISABLED)) {
        core.attacker.reset(EFFECT_ATTACK_DISABLED, RESET_CODE);
        pduel.new_message(MSG_ATTACK_DISABLED);
        core.attacker.set_status(STATUS_ATTACK_CANCELED, true);
      }
      if (
        context.is_player_affected_by_effect(
          infos.turn_player,
          EFFECT_SKIP_BP
        ) ||
        core.attacker.is_status(STATUS_ATTACK_CANCELED)
      ) {
        arg.step = 12;
        return false;
      }
      if (!core.attack_rollback) {
        core.attacker.announce_count += 1;
        core.attacker.announced_cards.addcard(core.attack_target);
        context.attack_all_target_check();
        arg.step = 18;
        return false;
      }
      const cv = [];
      context.get_attack_target(core.attacker, cv, core.chain_attack);
      if (!cv.length && !core.attacker.direct_attackable) {
        arg.step = 12;
        return false;
      }
      if (context.is_flag(DUEL_STORE_ATTACK_REPLAYS) && !core.chain_attack) {
        returns.set(0, false);
      } else if (!core.attacker.is_affected_by_effect(EFFECT_MUST_ATTACK)) {
        context.emplace_process("SelectYesNo", infos.turn_player, 30);
      } else {
        returns.set(0, true);
        core.attack_cancelable = false;
      }
      return false;
    }
    case 12: {
      if (returns.at(0)) {
        arg.is_replaying_attack = true;
        arg.attack_announce_failed = false;
        arg.step = 3;
      }
      return false;
    }
    case 13: {
      if (
        core.attacker.fieldid_r === core.pre_field[0] &&
        (!(context.is_flag(DUEL_STORE_ATTACK_REPLAYS) && !core.chain_attack) ||
          core.attacker.is_status(STATUS_ATTACK_CANCELED))
      ) {
        core.attacker.announce_count += 1;
        core.attacker.announced_cards.addcard(core.attack_target);
        context.attack_all_target_check();
      }
      core.chain_attack = false;
      if (arg.forced_attack) {
        returns.set(0, 2);
        arg.step = 0;
      } else {
        arg.step = PROCESS_RESTART;
      }
      context.reset_phase(PHASE_DAMAGE);
      context.adjust_all();
      return false;
    }
    case 14: {
      for (const clit of core.tpchain ?? []) {
        core.sub_solving_event.push(context.nil_event);
        context.emplace_process(
          "ExecuteOperation",
          clit.triggering_effect,
          infos.turn_player
        );
        context.adjust_all();
      }
      core.tpchain = [];
      arg.step = 2;
      return false;
    }
    case 15: {
      context.adjust_instant();
      context.emplace_process("PointEvent", false, false, false);
      arg.step = PROCESS_RESTART;
      return false;
    }
    case 16: {
      const selectedCard = returnCards.list[0];
      const mustAttackPairs = normalizeMustAttackPairs(arg.must_attack_map);
      const selectedPair = mustAttackPairs.find(
        (pair) => pair.card === selectedCard
      );
      const effectKey = selectedPair?.effect;
      const matching = mustAttackPairs
        .filter((pair) => pair.effect === effectKey)
        .map((pair) => pair.card);
      if (matching.length < 2) {
        core.attack_target = selectedCard;
        core.pre_field[1] = core.attack_target.fieldid_r;
        arg.step = 5;
        return false;
      }
      core.select_cards = [...matching];
      const message = pduel.new_message(MSG_HINT);
      message.write(HINT_SELECTMSG);
      message.write(infos.turn_player);
      message.write(549);
      context.emplace_process(
        "SelectCard",
        infos.turn_player,
        core.attack_cancelable,
        1,
        1
      );
      arg.step = 5;
      return false;
    }
    case 19: {
      infos.phase = PHASE_DAMAGE;
      core.chain_attack = false;
      arg.is_replaying_attack = false;
      core.damage_calculated = false;
      core.selfdes_disabled = true;
      core.flip_delayed = true;
      core.attacker.attack_controler = core.attacker.current.controler;
      core.pre_field[0] = core.attacker.fieldid_r;
      if (core.attack_target) {
        core.attack_target.attack_controler =
          core.attack_target.current.controler;
        core.pre_field[1] = core.attack_target.fieldid_r;
      } else {
        core.pre_field[1] = 0;
      }
      core.attacker.attacked_count += 1;
      core.attacker.attacked_cards.addcard(core.attack_target);
      core.battled_count[infos.turn_player] += 1;
      context.adjust_all();
      return false;
    }
    case 20: {
      pduel.new_message(MSG_DAMAGE_STEP_START);
      context.raise_single_event(
        core.attacker,
        null,
        EVENT_BATTLE_START,
        null,
        0,
        0,
        0,
        0
      );
      if (core.attack_target) {
        context.raise_single_event(
          core.attack_target,
          null,
          EVENT_BATTLE_START,
          null,
          0,
          0,
          0,
          1
        );
      }
      context.raise_event(null, EVENT_BATTLE_START, null, 0, 0, 0, 0);
      context.process_single_event();
      context.process_instant_event();
      arg.previous_point_event_had_any_trigger_to_resolve = false;
      if (
        !context.is_flag(DUEL_6_STEP_BATLLE_STEP) ||
        getSize(core.new_fchain) ||
        getSize(core.new_ochain)
      ) {
        arg.previous_point_event_had_any_trigger_to_resolve = Boolean(
          getSize(core.new_fchain) || getSize(core.new_ochain)
        );
        let message = pduel.new_message(MSG_HINT);
        message.write(HINT_EVENT);
        message.write(0);
        message.write(40);
        message = pduel.new_message(MSG_HINT);
        message.write(HINT_EVENT);
        message.write(1);
        message.write(40);
        context.emplace_process(
          "PointEvent",
          false,
          false,
          context.is_flag(DUEL_SINGLE_CHAIN_IN_DAMAGE_SUBSTEP)
        );
      }
      return false;
    }
    case 21: {
      if (core.attacker.is_status(STATUS_ATTACK_CANCELED)) {
        arg.step = 33;
        return false;
      }
      if (!core.attack_target) return false;
      core.attacker.temp.position = core.attacker.current.position;
      core.attack_target.temp.position = core.attack_target.current.position;
      if (core.attack_target.is_position(POS_FACEDOWN)) {
        context.change_position(
          core.attack_target,
          null,
          PLAYER_NONE,
          core.attack_target.current.position >> 1,
          0,
          true
        );
        context.adjust_all();
      }
      return false;
    }
    case 22: {
      context.raise_single_event(
        core.attacker,
        null,
        EVENT_BATTLE_CONFIRM,
        null,
        0,
        0,
        0,
        0
      );
      if (core.attack_target) {
        if (core.attack_target.temp.position & POS_FACEDOWN)
          core.pre_field[1] = core.attack_target.fieldid_r;
        context.raise_single_event(
          core.attack_target,
          null,
          EVENT_BATTLE_CONFIRM,
          null,
          0,
          0,
          0,
          1
        );
      }
      context.raise_event(null, EVENT_BATTLE_CONFIRM, null, 0, 0, 0, 0);
      context.process_single_event();
      context.process_instant_event();
      if (
        !context.is_flag(DUEL_6_STEP_BATLLE_STEP) ||
        !arg.previous_point_event_had_any_trigger_to_resolve ||
        getSize(core.new_fchain) ||
        getSize(core.new_ochain)
      ) {
        let message = pduel.new_message(MSG_HINT);
        message.write(HINT_EVENT);
        message.write(0);
        message.write(41);
        message = pduel.new_message(MSG_HINT);
        message.write(HINT_EVENT);
        message.write(1);
        message.write(41);
        core.hint_timing[infos.turn_player] = TIMING_DAMAGE_STEP;
        context.emplace_process(
          "PointEvent",
          false,
          false,
          context.is_flag(DUEL_SINGLE_CHAIN_IN_DAMAGE_SUBSTEP)
        );
      }
      return false;
    }
    case 23: {
      if (core.attacker.is_status(STATUS_ATTACK_CANCELED)) {
        arg.step = 33;
        return false;
      }
      infos.phase = PHASE_DAMAGE_CAL;
      context.adjust_all();
      return false;
    }
    case 24: {
      context.calculate_battle_damage?.(null, null, null);
      context.raise_single_event(
        core.attacker,
        null,
        EVENT_PRE_DAMAGE_CALCULATE,
        null,
        0,
        0,
        0,
        0
      );
      if (core.attack_target)
        context.raise_single_event(
          core.attack_target,
          null,
          EVENT_PRE_DAMAGE_CALCULATE,
          null,
          0,
          0,
          0,
          1
        );
      context.raise_event(null, EVENT_PRE_DAMAGE_CALCULATE, null, 0, 0, 0, 0);
      context.process_single_event();
      context.process_instant_event();
      let message = pduel.new_message(MSG_HINT);
      message.write(HINT_EVENT);
      message.write(0);
      message.write(42);
      message = pduel.new_message(MSG_HINT);
      message.write(HINT_EVENT);
      message.write(1);
      message.write(42);
      core.hint_timing[infos.turn_player] = TIMING_DAMAGE_CAL;
      context.emplace_process(
        "PointEvent",
        false,
        false,
        context.is_flag(DUEL_SINGLE_CHAIN_IN_DAMAGE_SUBSTEP)
      );
      return false;
    }
    case 25: {
      if (core.attacker.is_status(STATUS_ATTACK_CANCELED)) {
        context.reset_phase(PHASE_DAMAGE_CAL);
        context.adjust_all();
        infos.phase = PHASE_DAMAGE;
        arg.step = 33;
        return false;
      }
      return false;
    }
    case 26: {
      const aa = core.attacker.get_attack();
      const ad = core.attacker.get_defense();
      let da = 0;
      let dd = 0;
      const pa = core.attacker.current.controler;
      let pd;
      core.attacker.set_status(STATUS_BATTLE_RESULT, false);
      core.attacker.set_status(STATUS_BATTLE_DESTROYED, false);
      if (core.attack_target) {
        da = core.attack_target.get_attack();
        dd = core.attack_target.get_defense();
        core.attack_target.set_status(STATUS_BATTLE_RESULT, false);
        core.attack_target.set_status(STATUS_BATTLE_DESTROYED, false);
        pd = core.attack_target.current.controler;
        if (pa !== pd) {
          core.attacker.set_status(STATUS_OPPO_BATTLE, true);
          core.attack_target.set_status(STATUS_OPPO_BATTLE, true);
        }
      }
      const battleContext = {
        damage_change_effect: null,
        reason_card: null,
        battle_destroyed: [false, false],
      };
      if (typeof context.calculate_battle_damage === "function") {
        const result = context.calculate_battle_damage(battleContext);
        if (result && typeof result === "object") {
          if (result.damage_change_effect !== undefined)
            battleContext.damage_change_effect = result.damage_change_effect;
          if (result.reason_card !== undefined)
            battleContext.reason_card = result.reason_card;
          if (Array.isArray(result.battle_destroyed))
            battleContext.battle_destroyed = result.battle_destroyed;
        }
      }
      let damchange = battleContext.damage_change_effect;
      let reasonCard = battleContext.reason_card;
      const bd = battleContext.battle_destroyed;
      if (bd[0]) {
        const indestructable = core.attacker.is_affected_by_effect(
          EFFECT_INDESTRUCTABLE_BATTLE,
          core.attack_target
        );
        if (indestructable) {
          const message = pduel.new_message(MSG_HINT);
          message.write(HINT_CARD);
          message.write(0);
          message.write(indestructable.owner.data.code);
          bd[0] = false;
        } else {
          core.attacker.set_status(STATUS_BATTLE_RESULT, true);
        }
      }
      if (bd[1]) {
        const indestructable = core.attack_target.is_affected_by_effect(
          EFFECT_INDESTRUCTABLE_BATTLE,
          core.attacker
        );
        if (indestructable) {
          const message = pduel.new_message(MSG_HINT);
          message.write(HINT_CARD);
          message.write(0);
          message.write(indestructable.owner.data.code);
          bd[1] = false;
        } else {
          core.attack_target.set_status(STATUS_BATTLE_RESULT, true);
        }
      }
      const message = pduel.new_message(MSG_BATTLE);
      message.write(core.attacker.get_info_location());
      message.write(aa);
      message.write(ad);
      message.write(Number(bd[0]));
      if (core.attack_target) {
        message.write(core.attack_target.get_info_location());
        message.write(da);
        message.write(dd);
        message.write(Number(bd[1]));
      } else {
        message.write({});
        message.write(0);
        message.write(0);
        message.write(0);
      }
      arg.damage_change_effect = damchange;
      arg.reason_card = reasonCard;
      if (reasonCard) arg.reason_player = reasonCard.current.controler;
      if (!damchange) {
        const reasonPlayer = reasonCard?.current?.controler ?? PLAYER_NONE;
        if (core.battle_damage[infos.turn_player]) {
          context.raise_single_event(
            core.attacker,
            null,
            EVENT_PRE_BATTLE_DAMAGE,
            null,
            0,
            reasonPlayer,
            infos.turn_player,
            core.battle_damage[infos.turn_player]
          );
          if (core.attack_target) {
            context.raise_single_event(
              core.attack_target,
              null,
              EVENT_PRE_BATTLE_DAMAGE,
              null,
              0,
              reasonPlayer,
              infos.turn_player,
              core.battle_damage[infos.turn_player]
            );
          }
          context.raise_event(
            reasonCard,
            EVENT_PRE_BATTLE_DAMAGE,
            null,
            0,
            reasonPlayer,
            infos.turn_player,
            core.battle_damage[infos.turn_player]
          );
        }
        if (core.battle_damage[1 - infos.turn_player]) {
          context.raise_single_event(
            core.attacker,
            null,
            EVENT_PRE_BATTLE_DAMAGE,
            null,
            0,
            reasonPlayer,
            1 - infos.turn_player,
            core.battle_damage[1 - infos.turn_player]
          );
          if (core.attack_target) {
            context.raise_single_event(
              core.attack_target,
              null,
              EVENT_PRE_BATTLE_DAMAGE,
              null,
              0,
              reasonPlayer,
              1 - infos.turn_player,
              core.battle_damage[1 - infos.turn_player]
            );
          }
          context.raise_event(
            reasonCard,
            EVENT_PRE_BATTLE_DAMAGE,
            null,
            0,
            reasonPlayer,
            1 - infos.turn_player,
            core.battle_damage[1 - infos.turn_player]
          );
        }
      }
      context.process_single_event();
      context.process_instant_event();
      core.damage_calculated = true;
      return false;
    }
    case 27: {
      infos.phase = PHASE_DAMAGE;
      core.hint_timing[infos.turn_player] = 0;
      core.chain_attack = false;
      core.attacker.battled_cards.addcard(core.attack_target);
      if (core.attack_target)
        core.attack_target.battled_cards.addcard(core.attacker);
      const reasonCard = arg.reason_card;
      const damchange = arg.damage_change_effect;
      arg.damage_change_effect = null;
      if (!damchange) {
        if (core.battle_damage[0])
          context.damage(
            null,
            REASON_BATTLE,
            arg.reason_player,
            reasonCard,
            0,
            core.battle_damage[0]
          );
        if (core.battle_damage[1])
          context.damage(
            null,
            REASON_BATTLE,
            arg.reason_player,
            reasonCard,
            1,
            core.battle_damage[1]
          );
      } else {
        if (core.battle_damage[0])
          context.damage(
            damchange,
            REASON_EFFECT,
            arg.reason_player,
            reasonCard,
            0,
            core.battle_damage[0]
          );
        if (core.battle_damage[1])
          context.damage(
            damchange,
            REASON_EFFECT,
            arg.reason_player,
            reasonCard,
            1,
            core.battle_damage[1]
          );
      }
      context.reset_phase(PHASE_DAMAGE_CAL);
      context.adjust_all();
      return false;
    }
    case 28: {
      const des = new Set();
      let peffect;
      if (
        core.attacker.is_status(STATUS_BATTLE_RESULT) &&
        core.attacker.current.location === LOCATION_MZONE &&
        core.attacker.fieldid_r === core.pre_field[0]
      ) {
        des.add(core.attacker);
        core.attacker.temp.reason = core.attacker.current.reason;
        core.attacker.temp.reason_card = core.attacker.current.reason_card;
        core.attacker.temp.reason_effect = core.attacker.current.reason_effect;
        core.attacker.temp.reason_player = core.attacker.current.reason_player;
        core.attacker.current.reason_effect = null;
        core.attacker.current.reason = REASON_BATTLE;
        core.attacker.current.reason_card = core.attack_target;
        core.attacker.current.reason_player =
          core.attack_target.current.controler;
        let dest = CARD_LOCATIONS.LOCATION_GRAVE;
        let seq = 0;
        peffect = core.attack_target.is_affected_by_effect(
          EFFECT_BATTLE_DESTROY_REDIRECT
        );
        if (peffect && core.attacker.data.type & TYPE_MONSTER) {
          dest = peffect.get_value(core.attacker);
          seq = dest >> 16;
          dest &= 0xffff;
        }
        core.attacker.sendto_param.set(
          core.attacker.owner,
          POS_FACEUP,
          dest,
          seq
        );
        core.attacker.set_status(STATUS_DESTROY_CONFIRMED, true);
      }
      if (
        core.attack_target &&
        core.attack_target.is_status(STATUS_BATTLE_RESULT) &&
        core.attack_target.current.location === LOCATION_MZONE &&
        core.attack_target.fieldid_r === core.pre_field[1]
      ) {
        des.add(core.attack_target);
        core.attack_target.temp.reason = core.attack_target.current.reason;
        core.attack_target.temp.reason_card =
          core.attack_target.current.reason_card;
        core.attack_target.temp.reason_effect =
          core.attack_target.current.reason_effect;
        core.attack_target.temp.reason_player =
          core.attack_target.current.reason_player;
        core.attack_target.current.reason_effect = null;
        core.attack_target.current.reason = REASON_BATTLE;
        core.attack_target.current.reason_card = core.attacker;
        core.attack_target.current.reason_player =
          core.attacker.current.controler;
        let dest = CARD_LOCATIONS.LOCATION_GRAVE;
        let seq = 0;
        peffect = core.attacker.is_affected_by_effect(
          EFFECT_BATTLE_DESTROY_REDIRECT
        );
        if (peffect && core.attack_target.data.type & TYPE_MONSTER) {
          dest = peffect.get_value(core.attack_target);
          seq = dest >> 16;
          dest &= 0xffff;
        }
        core.attack_target.sendto_param.set(
          core.attack_target.owner,
          POS_FACEUP,
          dest,
          seq
        );
        core.attack_target.set_status(STATUS_DESTROY_CONFIRMED, true);
      }
      core.attacker.set_status(STATUS_BATTLE_RESULT, false);
      if (core.attack_target)
        core.attack_target.set_status(STATUS_BATTLE_RESULT, false);
      if (core.battle_destroy_rep?.clear) core.battle_destroy_rep.clear();
      else core.battle_destroy_rep = [];
      if (core.desrep_chain?.clear) core.desrep_chain.clear();
      else core.desrep_chain = [];
      if (des.size) {
        const ng = pduel.new_group();
        ng.container = des;
        ng.is_readonly = true;
        context.emplace_process(
          "Destroy",
          { step: 10 },
          ng,
          null,
          REASON_BATTLE,
          PLAYER_NONE
        );
        arg.cards_destroyed_by_battle = ng;
      }
      return false;
    }
    case 29: {
      if (getSize(core.battle_destroy_rep))
        context.destroy(
          core.battle_destroy_rep,
          null,
          REASON_EFFECT | REASON_REPLACE,
          PLAYER_NONE
        );
      if (getSize(core.desrep_chain))
        context.emplace_process(
          "OperationReplace",
          { step: 15 },
          null,
          null,
          null,
          false
        );
      context.adjust_all();
      return false;
    }
    case 30: {
      const des = arg.cards_destroyed_by_battle;
      if (des?.container?.size) {
        for (const pcard of des.container) {
          pcard.set_status(STATUS_BATTLE_DESTROYED, true);
          pcard.set_status(STATUS_DESTROY_CONFIRMED, false);
          pcard.filter_disable_related_cards();
        }
      }
      core.selfdes_disabled = false;
      context.adjust_all();
      if (context.is_flag(DUEL_6_STEP_BATLLE_STEP)) {
        if (!core.effect_damage_step) {
          let message = pduel.new_message(MSG_HINT);
          message.write(HINT_EVENT);
          message.write(0);
          message.write(45);
          message = pduel.new_message(MSG_HINT);
          message.write(HINT_EVENT);
          message.write(1);
          message.write(45);
          core.hint_timing[infos.turn_player] = TIMING_DAMAGE_CAL;
          context.emplace_process(
            "PointEvent",
            false,
            false,
            context.is_flag(DUEL_SINGLE_CHAIN_IN_DAMAGE_SUBSTEP)
          );
        } else {
          context.break_effect();
        }
      }
      return false;
    }
    case 31: {
      core.flip_delayed = false;
      spliceFront(core.new_fchain, core.new_fchain_b);
      spliceFront(core.new_ochain, core.new_ochain_b);
      context.raise_single_event(
        core.attacker,
        null,
        EVENT_BATTLED,
        null,
        0,
        PLAYER_NONE,
        0,
        0
      );
      const battledCards = new Set([core.attacker]);
      if (core.attack_target) {
        battledCards.add(core.attack_target);
        context.raise_single_event(
          core.attack_target,
          null,
          EVENT_BATTLED,
          null,
          0,
          PLAYER_NONE,
          0,
          1
        );
      }
      context.raise_event(
        battledCards,
        EVENT_BATTLED,
        null,
        0,
        PLAYER_NONE,
        0,
        0
      );
      context.process_single_event();
      context.process_instant_event();
      if (core.effect_damage_step) {
        if (core.reserved) {
          const damageStep = core.reserved.payload ?? core.reserved;
          if (damageStep)
            damageStep.cards_destroyed_by_battle =
              arg.cards_destroyed_by_battle;
        }
        return true;
      }
      arg.step = 32;
      return false;
    }
    case 32: {
      let message = pduel.new_message(MSG_HINT);
      message.write(HINT_EVENT);
      message.write(0);
      message.write(43);
      message = pduel.new_message(MSG_HINT);
      message.write(HINT_EVENT);
      message.write(1);
      message.write(43);
      core.hint_timing[0] |= TIMING_BATTLED;
      core.hint_timing[1] |= TIMING_BATTLED;
      context.emplace_process(
        "PointEvent",
        false,
        false,
        context.is_flag(DUEL_SINGLE_CHAIN_IN_DAMAGE_SUBSTEP)
      );
      return false;
    }
    case 33: {
      const des = arg.cards_destroyed_by_battle;
      if (des?.container) {
        for (const card of Array.from(des.container)) {
          if (
            card.current.location !== LOCATION_MZONE ||
            (card.fieldid_r !== core.pre_field[0] &&
              card.fieldid_r !== core.pre_field[1])
          ) {
            des.container.delete(card);
          }
        }
        context.emplace_process(
          "Destroy",
          { step: 3 },
          des,
          null,
          REASON_BATTLE,
          PLAYER_NONE
        );
      }
      context.adjust_all();
      return false;
    }
    case 34: {
      arg.cards_destroyed_by_battle = null;
      core.damage_calculated = true;
      core.selfdes_disabled = false;
      core.flip_delayed = false;
      spliceFront(core.new_fchain, core.new_fchain_b);
      spliceFront(core.new_ochain, core.new_ochain_b);
      const ing = new Set();
      const ed = new Set();
      if (
        core.attacker.is_status(STATUS_BATTLE_DESTROYED) &&
        core.attacker.current.reason & REASON_BATTLE
      ) {
        context.raise_single_event(
          core.attack_target,
          null,
          EVENT_BATTLE_DESTROYING,
          null,
          core.attacker.current.reason,
          core.attack_target.current.controler,
          0,
          1
        );
        context.raise_single_event(
          core.attacker,
          null,
          EVENT_BATTLE_DESTROYED,
          null,
          core.attacker.current.reason,
          core.attack_target.current.controler,
          0,
          0
        );
        context.raise_single_event(
          core.attacker,
          null,
          EFFECT_EVENTS.EVENT_DESTROYED,
          null,
          core.attacker.current.reason,
          core.attack_target.current.controler,
          0,
          0
        );
        ing.add(core.attack_target);
        ed.add(core.attacker);
      }
      if (
        core.attack_target &&
        core.attack_target.is_status(STATUS_BATTLE_DESTROYED) &&
        core.attack_target.current.reason & REASON_BATTLE
      ) {
        context.raise_single_event(
          core.attacker,
          null,
          EVENT_BATTLE_DESTROYING,
          null,
          core.attack_target.current.reason,
          core.attacker.current.controler,
          0,
          0
        );
        context.raise_single_event(
          core.attack_target,
          null,
          EVENT_BATTLE_DESTROYED,
          null,
          core.attack_target.current.reason,
          core.attacker.current.controler,
          0,
          1
        );
        context.raise_single_event(
          core.attack_target,
          null,
          EFFECT_EVENTS.EVENT_DESTROYED,
          null,
          core.attack_target.current.reason,
          core.attacker.current.controler,
          0,
          1
        );
        ing.add(core.attacker);
        ed.add(core.attack_target);
      }
      if (ing.size)
        context.raise_event(ing, EVENT_BATTLE_DESTROYING, null, 0, 0, 0, 0);
      if (ed.size) {
        context.raise_event(ed, EVENT_BATTLE_DESTROYED, null, 0, 0, 0, 0);
        context.raise_event(
          ed,
          EFFECT_EVENTS.EVENT_DESTROYED,
          null,
          0,
          0,
          0,
          0
        );
      }
      context.raise_single_event(
        core.attacker,
        null,
        EVENT_DAMAGE_STEP_END,
        null,
        0,
        0,
        0,
        0
      );
      if (core.attack_target)
        context.raise_single_event(
          core.attack_target,
          null,
          EVENT_DAMAGE_STEP_END,
          null,
          0,
          0,
          0,
          1
        );
      context.raise_event(null, EVENT_DAMAGE_STEP_END, null, 0, 0, 0, 0);
      core.attacker.set_status(STATUS_BATTLE_DESTROYED, false);
      if (core.attack_target)
        core.attack_target.set_status(STATUS_BATTLE_DESTROYED, false);
      context.process_single_event();
      context.process_instant_event();
      let message = pduel.new_message(MSG_HINT);
      message.write(HINT_EVENT);
      message.write(0);
      message.write(44);
      message = pduel.new_message(MSG_HINT);
      message.write(HINT_EVENT);
      message.write(1);
      message.write(44);
      context.emplace_process("PointEvent", false, false, true);
      arg.step = 38;
      return false;
    }
    case 38: {
      return false;
    }
    case 39: {
      core.attacker.set_status(STATUS_OPPO_BATTLE, false);
      if (core.attack_target)
        core.attack_target.set_status(STATUS_OPPO_BATTLE, false);
      if (arg.forced_attack) {
        arg.forced_attack_done = true;
        arg.step = 0;
      } else {
        arg.step = PROCESS_RESTART;
      }
      infos.phase = PHASE_BATTLE_STEP;
      pduel.new_message(MSG_DAMAGE_STEP_END);
      context.reset_phase(PHASE_DAMAGE);
      context.adjust_all();
      if (core.effect_damage_step) return true;
      return false;
    }
    case 40: {
      if (Array.isArray(core.chain_limit)) {
        for (const chLim of core.chain_limit) {
          pduel.lua.ensure_luaL_stack(chLim.function);
        }
      }
      core.chain_limit = [];
      if (getSize(core.current_chain)) {
        for (const ch of core.current_chain) {
          ch.triggering_effect.get_handler().set_status(STATUS_CHAINING, false);
        }
        context.emplace_process("SolveChain", false, false, false);
        if (!arg.forced_attack) arg.step = PROCESS_RESTART;
        return false;
      }
      context.reset_phase(PHASE_BATTLE_STEP);
      context.adjust_all();
      return false;
    }
    case 41: {
      arg.second_battle_phase_is_optional = true;
      const eset = [];
      context.filter_player_effect(
        infos.turn_player,
        EFFECT_BP_TWICE,
        eset,
        false
      );
      for (const peff of eset) {
        const value =
          typeof peff.get_value === "function" ? peff.get_value() : peff.value;
        if (!peff.value || value !== 1) {
          arg.second_battle_phase_is_optional = false;
          break;
        }
      }
      arg.repeat_battle_phase = Boolean(eset.length);
      infos.phase = PHASE_BATTLE;
      context.emplace_process("PhaseEvent", PHASE_BATTLE);
      context.adjust_all();
      return false;
    }
    case 42: {
      core.attacker = null;
      core.attack_target = null;
      if (arg.repeat_battle_phase && arg.second_battle_phase_is_optional) {
        context.emplace_process("SelectYesNo", infos.turn_player, 32);
        return false;
      }
      returns.set(0, arg.phase_to_change_to);
      returns.set(1, arg.repeat_battle_phase);
      return true;
    }
    case 43: {
      const bpTwice = returns.at(0);
      returns.set(0, arg.phase_to_change_to);
      returns.set(1, bpTwice);
      return true;
    }
    default:
      return true;
  }
}

module.exports = processBattleCommand;
