const { EFFECT_CODES } = require('../effect');
const { CARD_TYPES, CARD_LOCATIONS, PLAYERS } = require('../card');
const { ADJUST_CONSTANTS } = require('../processor');

const {
  EFFECT_CANNOT_LOSE_LP,
  EFFECT_CANNOT_LOSE_DECK,
  EFFECT_DISABLE_TRAPMONSTER,
  EFFECT_REMOVE_BRAINWASHING,
  EFFECT_SET_CONTROL,
  EFFECT_EQUIP_LIMIT,
  EFFECT_CANNOT_CHANGE_POS_E,
  EFFECT_SET_POSITION,
  EFFECT_PUBLIC,
  EFFECT_REVERSE_DECK,
  EFFECT_UNSTOPPABLE_ATTACK,
  EFFECT_DEFENSE_ATTACK,
} = EFFECT_CODES;

const { TYPE_TRAPMONSTER, TYPE_MONSTER, TYPE_LINK } = CARD_TYPES;

const { LOCATION_HAND, LOCATION_MZONE, LOCATION_SZONE, LOCATION_DECK } = CARD_LOCATIONS;

const {
  POS_FACEUP_ATTACK,
  POS_FACEDOWN_ATTACK,
  POS_FACEUP_DEFENSE,
  POS_FACEDOWN_DEFENSE,
  POS_FACEUP,
  POS_FACEDOWN,
  POS_DEFENSE,
  STATUS_ATTACK_CANCELED,
  STATUS_JUST_POS,
  STATUS_CONTINUOUS_POS,
  PHASE_DAMAGE,
  PHASE_DAMAGE_CAL,
  MSG_WIN,
  MSG_REVERSE_DECK,
  MSG_DECK_TOP,
  REASON_RULE,
  DUEL_RELAY,
  GLOBALFLAG_DECK_REVERSE_CHECK,
  GLOBALFLAG_BRAINWASHING_CHECK,
} = ADJUST_CONSTANTS;

/**
 * Ports the native `field::process(Processors::Adjust)` routine.
 * @param {import('../field')} field Active duel field instance.
 * @param {{step:number}} arg Processor payload mirrored from the engine.
 * @returns {boolean} True when the processor finishes, false when yielding.
 */
function processAdjust(field, arg) {
  const { core, player, infos, pduel } = field;

  const isPlayerAffected = (pid, effectCode) => field.is_player_affected_by_effect(pid, effectCode);

  switch (arg.step) {
    case 0:
      core.re_adjust = false;
      return false;
    case 1: {
      if (!core.force_turn_end) {
        let winp = 5;
        let rea = 1;
        if (player[0].lp <= 0 && player[1].lp > 0 && !isPlayerAffected(0, EFFECT_CANNOT_LOSE_LP)) {
          winp = 1;
          rea = 1;
        }
        if (core.overdraw[0] && !core.overdraw[1] && !isPlayerAffected(0, EFFECT_CANNOT_LOSE_DECK)) {
          winp = 1;
          rea = 2;
        }
        if (player[1].lp <= 0 && player[0].lp > 0 && !isPlayerAffected(1, EFFECT_CANNOT_LOSE_LP)) {
          winp = 0;
          rea = 1;
        }
        if (core.overdraw[1] && !core.overdraw[0] && !isPlayerAffected(1, EFFECT_CANNOT_LOSE_DECK)) {
          winp = 0;
          rea = 2;
        }
        if (
          player[1].lp <= 0
          && player[0].lp <= 0
          && !(isPlayerAffected(0, EFFECT_CANNOT_LOSE_LP) && isPlayerAffected(1, EFFECT_CANNOT_LOSE_LP))
        ) {
          if (isPlayerAffected(0, EFFECT_CANNOT_LOSE_LP)) winp = 0;
          if (!isPlayerAffected(0, EFFECT_CANNOT_LOSE_LP) && isPlayerAffected(1, EFFECT_CANNOT_LOSE_LP)) winp = 1;
          if (!isPlayerAffected(0, EFFECT_CANNOT_LOSE_LP) && !isPlayerAffected(1, EFFECT_CANNOT_LOSE_LP)) winp = PLAYERS.PLAYER_NONE;
          rea = 1;
        }
        if (
          core.overdraw[1]
          && core.overdraw[0]
          && !(isPlayerAffected(0, EFFECT_CANNOT_LOSE_DECK) && isPlayerAffected(1, EFFECT_CANNOT_LOSE_DECK))
        ) {
          if (isPlayerAffected(0, EFFECT_CANNOT_LOSE_DECK)) winp = 0;
          if (!isPlayerAffected(0, EFFECT_CANNOT_LOSE_DECK) && isPlayerAffected(1, EFFECT_CANNOT_LOSE_DECK)) winp = 1;
          if (!isPlayerAffected(0, EFFECT_CANNOT_LOSE_DECK) && !isPlayerAffected(1, EFFECT_CANNOT_LOSE_DECK)) winp = PLAYERS.PLAYER_NONE;
          rea = 2;
        }
        if (field.is_flag(DUEL_RELAY)) {
          if (winp === PLAYERS.PLAYER_NONE) {
            const p1 = field.relay_check(0);
            const p2 = field.relay_check(1);
            if (p1 && !p2) winp = 0;
            if (!p1 && p2) winp = 1;
            if (p1 && p2) {
              winp = 5;
              core.overdraw[0] = false;
              core.overdraw[1] = false;
            }
          }
          if (winp < PLAYERS.PLAYER_NONE && field.relay_check(1 - winp)) {
            winp = 5;
            core.overdraw[0] = false;
            core.overdraw[1] = false;
          }
        }
        if (winp !== 5) {
          const message = pduel.new_message(MSG_WIN);
          message.write_uint8(winp);
          message.write_uint8(rea);
          core.overdraw[0] = false;
          core.overdraw[1] = false;
          core.win_player = 5;
          core.win_reason = 0;
        }
        if (winp === 5 && core.win_player !== 5) {
          const message = pduel.new_message(MSG_WIN);
          message.write_uint8(core.win_player);
          message.write_uint8(core.win_reason);
          core.win_player = 5;
          core.win_reason = 0;
          core.overdraw[0] = false;
          core.overdraw[1] = false;
        }
      }
      return false;
    }
    case 2: {
      let tp = infos.turn_player;
      for (let p = 0; p < 2; p += 1) {
        for (const pcard of player[tp].list_mzone) {
          if (pcard) field.add_to_disable_check_list(pcard);
        }
        for (const pcard of player[tp].list_szone) {
          if (pcard) field.add_to_disable_check_list(pcard);
        }
        tp = 1 - tp;
      }
      field.adjust_disable_check_list();
      field.emplace_process('RefreshLoc');
      return false;
    }
    case 3: {
      core.trap_monster_adjust_set[0].clear();
      core.trap_monster_adjust_set[1].clear();
      for (let p = 0; p < 2; p += 1) {
        for (const pcard of player[p].list_mzone) {
          if (!pcard) continue;
          if ((pcard.get_type() & TYPE_TRAPMONSTER) && pcard.is_affected_by_effect(EFFECT_DISABLE_TRAPMONSTER)) {
            core.trap_monster_adjust_set[p].add(pcard);
          }
        }
      }
      if (core.trap_monster_adjust_set[0].size || core.trap_monster_adjust_set[1].size) {
        core.re_adjust = true;
        field.emplace_process('TrapMonsterAdjust');
      }
      return false;
    }
    case 4: {
      core.control_adjust_set[0].clear();
      core.control_adjust_set[1].clear();
      const reasonCards = new Set();
      for (let p = 0; p < 2; p += 1) {
        for (const pcard of player[p].list_mzone) {
          if (!pcard) continue;
          const cur = pcard.current.controler;
          const [ref, peffect] = pcard.refresh_control_status();
          if (cur !== ref && pcard.is_capable_change_control()) {
            core.control_adjust_set[p].add(pcard);
            if (peffect && (!(peffect.type & EFFECT_CODES.EFFECT_TYPE_SINGLE) || peffect.condition)) {
              reasonCards.add(peffect.get_handler());
            }
          }
        }
      }
      if (core.control_adjust_set[0].size || core.control_adjust_set[1].size) {
        core.re_adjust = true;
        field.get_control(core.control_adjust_set[1 - infos.turn_player], undefined, PLAYERS.PLAYER_NONE, infos.turn_player, 0, 0, 0xff);
        field.get_control(core.control_adjust_set[infos.turn_player], undefined, PLAYERS.PLAYER_NONE, 1 - infos.turn_player, 0, 0, 0xff);
        for (const rcard of reasonCards) {
          core.readjust_map[rcard] = (core.readjust_map[rcard] || 0) + 1;
          if (core.readjust_map[rcard] > 3) field.destroy(rcard, undefined, REASON_RULE, PLAYERS.PLAYER_NONE);
        }
      }
      core.last_control_changed_id = infos.field_id;
      return false;
    }
    case 5: {
      if (core.global_flag & GLOBALFLAG_BRAINWASHING_CHECK) {
        core.control_adjust_set[0].clear();
        core.control_adjust_set[1].clear();
        const eset = new Set();
        field.filter_field_effect(EFFECT_REMOVE_BRAINWASHING, eset, false);
        core.remove_brainwashing = eset.size > 0;
        if (core.remove_brainwashing) {
          for (let p = 0; p < 2; p += 1) {
            for (const pcard of player[p].list_mzone) {
              if (!pcard || !pcard.is_affected_by_effect(EFFECT_REMOVE_BRAINWASHING)) continue;
              const pr = pcard.single_effect.equal_range(EFFECT_SET_CONTROL) || [];
              for (const peffect of pr) {
                if (!peffect?.condition) peffect?.handler?.remove_effect?.(peffect);
              }
              if (p !== pcard.owner && pcard.is_capable_change_control()) core.control_adjust_set[p].add(pcard);
            }
          }
        }
        if (core.control_adjust_set[0].size || core.control_adjust_set[1].size) {
          core.re_adjust = true;
          field.get_control(core.control_adjust_set[1 - infos.turn_player], undefined, PLAYERS.PLAYER_NONE, infos.turn_player, 0, 0, 0xff);
          field.get_control(core.control_adjust_set[infos.turn_player], undefined, PLAYERS.PLAYER_NONE, 1 - infos.turn_player, 0, 0, 0xff);
        }
      }
      arg.step = 7;
      return false;
    }
    case 8:
      if (field.adjust_grant_effect()) core.re_adjust = true;
      return false;
    case 9:
      if (core.selfdes_disabled) {
        arg.step = 10;
        return false;
      }
      field.adjust_self_destroy_set();
      return false;
    case 10: {
      let tp = infos.turn_player;
      const destroySet = new Set();
      for (let p = 0; p < 2; p += 1) {
        for (let i = 0; i < 5; i += 1) {
          const pcard = player[tp].list_szone[i];
          if (pcard && pcard.equiping_target && !pcard.is_affected_by_effect(EFFECT_EQUIP_LIMIT, pcard.equiping_target)) {
            destroySet.add(pcard);
          }
        }
        tp = 1 - tp;
      }
      if (destroySet.size) {
        core.re_adjust = true;
        field.destroy(destroySet, undefined, REASON_RULE, PLAYERS.PLAYER_NONE);
      }
      return false;
    }
    case 11: {
      let tp = infos.turn_player;
      const posAdjust = new Set();
      const eset = new Set();
      let pos = 0;
      for (let p = 0; p < 2; p += 1) {
        for (const pcard of player[tp].list_mzone) {
          if (!pcard) continue;
          const isLinkMonster = (pcard.data.type & TYPE_LINK) && (pcard.data.type & TYPE_MONSTER);
          if (isLinkMonster || pcard.is_affected_by_effect(EFFECT_CANNOT_CHANGE_POS_E)) continue;
          eset.clear();
          pcard.filter_effect(EFFECT_SET_POSITION, eset);
          if (!eset.size) continue;
          pos = Array.from(eset).pop().get_value();
          if ((pos & 0xff) !== pcard.current.position) {
            posAdjust.add(pcard);
            pcard.position_param = pos;
            if (pcard.is_status(STATUS_JUST_POS)) pcard.set_status(STATUS_CONTINUOUS_POS, true);
            if (!pcard.is_status(STATUS_JUST_POS)) pcard.set_status(STATUS_CONTINUOUS_POS, false);
          }
          if ((pos & 0xff) === pcard.current.position) pcard.set_status(STATUS_CONTINUOUS_POS, false);
          pcard.set_status(STATUS_JUST_POS, false);
        }
        tp = 1 - tp;
      }
      if (posAdjust.size) {
        core.re_adjust = true;
        const ng = pduel.new_group();
        ng.container = posAdjust;
        ng.is_readonly = true;
        field.emplace_process('ChangePos', ng, undefined, PLAYERS.PLAYER_NONE, true);
      }
      return false;
    }
    case 12: {
      for (const pcard of player[0].list_hand) {
        const pub = pcard.is_affected_by_effect(EFFECT_PUBLIC);
        if (!pub && pcard.is_position(POS_FACEUP)) core.shuffle_hand_check[0] = true;
        pcard.current.position = pub ? POS_FACEUP : POS_FACEDOWN;
      }
      for (const pcard of player[1].list_hand) {
        const pub = pcard.is_affected_by_effect(EFFECT_PUBLIC);
        if (!pub && pcard.is_position(POS_FACEUP)) core.shuffle_hand_check[1] = true;
        pcard.current.position = pub ? POS_FACEUP : POS_FACEDOWN;
      }
      if (core.shuffle_hand_check[infos.turn_player]) field.shuffle(infos.turn_player, LOCATION_HAND);
      if (core.shuffle_hand_check[1 - infos.turn_player]) field.shuffle(1 - infos.turn_player, LOCATION_HAND);
      return false;
    }
    case 13: {
      if (core.global_flag & GLOBALFLAG_DECK_REVERSE_CHECK) {
        const eset = new Set();
        field.filter_field_effect(EFFECT_REVERSE_DECK, eset, false);
        const reversed = eset.size > 0;
        if (core.deck_reversed !== reversed) {
          core.deck_reversed = reversed;
          field.reverse_deck(0);
          field.reverse_deck(1);
          pduel.new_message(MSG_REVERSE_DECK);
          if (reversed) {
            if (player[0].list_main.length) {
              const ptop = player[0].list_main[player[0].list_main.length - 1];
              const message = pduel.new_message(MSG_DECK_TOP);
              message.write_uint8(0);
              message.write_uint32(0);
              message.write_uint32(ptop.data.code);
              message.write_uint32(ptop.current.position);
            }
            if (player[1].list_main.length) {
              const ptop = player[1].list_main[player[1].list_main.length - 1];
              const message = pduel.new_message(MSG_DECK_TOP);
              message.write_uint8(1);
              message.write_uint32(0);
              message.write_uint32(ptop.data.code);
              message.write_uint32(ptop.current.position);
            }
          }
        }
      }
      return false;
    }
    case 14: {
      const attacker = core.attacker;
      if (!attacker) return false;
      if (!attacker.is_affected_by_effect(EFFECT_UNSTOPPABLE_ATTACK) && attacker.is_status(STATUS_ATTACK_CANCELED)) return false;
      if (infos.phase !== PHASE_DAMAGE && infos.phase !== PHASE_DAMAGE_CAL) {
        if (
          !core.attacker.is_capable_attack()
          || core.attacker.current.controler !== core.attacker.attack_controler
          || core.attacker.fieldid_r !== core.pre_field[0]
        ) {
          attacker.set_status(STATUS_ATTACK_CANCELED, true);
          return false;
        }
        if (core.attack_rollback) return false;
        const fidset = new Set();
        for (const pcard of player[1 - infos.turn_player].list_mzone) {
          if (pcard) fidset.add(pcard.fieldid_r);
        }
        if (fidset.size !== core.opp_mzone.size) core.attack_rollback = true;
        if (fidset.size === core.opp_mzone.size) {
          let diff = false;
          for (const fid of fidset) {
            if (!core.opp_mzone.has(fid)) diff = true;
          }
          if (diff || !field.confirm_attack_target()) core.attack_rollback = true;
        }
        return false;
      }
      if (
        core.attacker.current.location !== LOCATION_MZONE
        || core.attacker.fieldid_r !== core.pre_field[0]
        || ((core.attacker.current.position & POS_DEFENSE) && !core.attacker.is_affected_by_effect(EFFECT_DEFENSE_ATTACK))
        || core.attacker.current.controler !== core.attacker.attack_controler
        || (core.attack_target
          && (
            core.attack_target.current.location !== LOCATION_MZONE
            || core.attack_target.current.controler !== core.attack_target.attack_controler
            || core.attack_target.fieldid_r !== core.pre_field[1]
          ))
      ) {
        core.attacker.set_status(STATUS_ATTACK_CANCELED, true);
      }
      return false;
    }
    case 15:
      field.raise_event(undefined, 'EVENT_ADJUST', undefined, 0, PLAYERS.PLAYER_NONE, PLAYERS.PLAYER_NONE, 0);
      field.process_instant_event();
      return false;
    case 16:
      if (core.re_adjust) {
        arg.step = 'restart';
        return false;
      }
      if (core.shuffle_hand_check[0]) field.shuffle(0, LOCATION_HAND);
      if (core.shuffle_hand_check[1]) field.shuffle(1, LOCATION_HAND);
      if (core.shuffle_deck_check[0]) field.shuffle(0, LOCATION_DECK);
      if (core.shuffle_deck_check[1]) field.shuffle(1, LOCATION_DECK);
      return true;
    default:
      return true;
  }
}

module.exports = processAdjust;
