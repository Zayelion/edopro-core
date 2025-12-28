export default function processTurn(arg) {
  const field = this;
  const { core, player, effects, infos } = field;
  const turnPlayer = arg.turn_player;

  switch (arg.step) {
    case 0: {
      core.used_event.clear();
      for (const peffect of core.reseted_effects) {
        field.pduel.delete_effect(peffect);
      }
      core.reseted_effects.clear();
      core.effect_count_code.clear();
      for (let p = 0; p < 2; ++p) {
        for (const pcard of player[p].list_mzone) {
          if (!pcard) continue;
          pcard.set_status(field.STATUS_SUMMON_TURN, false);
          pcard.set_status(field.STATUS_FLIP_SUMMON_TURN, false);
          pcard.set_status(field.STATUS_SPSUMMON_TURN, false);
          pcard.set_status(field.STATUS_SET_TURN, false);
          pcard.set_status(field.STATUS_FORM_CHANGED, false);
          pcard.indestructable_effects.clear();
          pcard.attack_announce_count = 0;
          pcard.announce_count = 0;
          pcard.attacked_count = 0;
          pcard.announced_cards.clear();
          pcard.attacked_cards.clear();
          pcard.battled_cards.clear();
          pcard.attack_all_target = true;
        }
        for (const pcard of player[p].list_szone) {
          if (!pcard) continue;
          pcard.set_status(field.STATUS_SET_TURN, false);
          pcard.indestructable_effects.clear();
        }
        core.summon_state_count[p] = 0;
        core.normalsummon_state_count[p] = 0;
        core.flipsummon_state_count[p] = 0;
        core.spsummon_state_count[p] = 0;
        core.spsummon_state_count_rst[p] = 0;
        core.attack_state_count[p] = 0;
        core.battle_phase_count[p] = 0;
        core.battled_count[p] = 0;
        core.summon_count[p] = 0;
        core.extra_summon[p] = 0;
        core.spsummon_once_map[p].clear();
        core.spsummon_once_map_rst[p].clear();
      }
      field.emplace_process?.("RefreshRelay");
      return false;
    }
    case 1: {
      core.force_turn_end = false;
      core.spsummon_rst = false;
      for (const peffect of effects.rechargeable) {
        if (!peffect.is_flag(field.EFFECT_FLAG_NO_TURN_RESET)) peffect.recharge();
      }
      const clearCounter = (counter) => {
        for (const iter of counter.values()) {
          iter.player_amount[0] = 0;
          iter.player_amount[1] = 0;
        }
      };
      clearCounter(core.summon_counter);
      clearCounter(core.normalsummon_counter);
      clearCounter(core.spsummon_counter);
      clearCounter(core.flipsummon_counter);
      clearCounter(core.attack_counter);
      clearCounter(core.chain_counter);
      for (const peffect of effects.spsummon_count_eff) {
        const pcard = peffect.get_handler();
        if (!peffect.is_flag(field.EFFECT_FLAG_NO_TURN_RESET)) {
          pcard.spsummon_counter[0] = 0;
          pcard.spsummon_counter[1] = 0;
          pcard.spsummon_counter_rst[0] = 0;
          pcard.spsummon_counter_rst[1] = 0;
        }
      }
      ++infos.turn_id;
      ++infos.turn_id_by_player[turnPlayer];
      infos.turn_player = turnPlayer;
      let message = field.pduel.new_message("MSG_NEW_TURN");
      message.write(turnPlayer);
      if (!field.is_flag?.(field.DUEL_RELAY) && infos.turn_id !== 1) {
        field.tag_swap?.(turnPlayer);
      }
      if (field.is_player_affected_by_effect(turnPlayer, field.EFFECT_SKIP_TURN)) {
        arg.step = 18;
        field.reset_phase?.(field.PHASE_DRAW);
        field.reset_phase?.(field.PHASE_STANDBY);
        field.reset_phase?.(field.PHASE_END);
        field.adjust_all?.();
        return false;
      }
      infos.phase = field.PHASE_DRAW;
      core.phase_action = false;
      core.hand_adjusted = false;
      field.raise_event?.(null, field.EVENT_PHASE_START + field.PHASE_DRAW, null, 0, 0, turnPlayer, 0);
      field.process_instant_event?.();
      field.adjust_all?.();
      return false;
    }
    case 2: {
      core.new_fchain.clear();
      core.new_ochain.clear();
      core.quick_f_chain.clear();
      core.delayed_quick_tmp.clear();
      if (field.is_player_affected_by_effect(infos.turn_player, field.EFFECT_SKIP_DP) || core.force_turn_end) {
        arg.step = 3;
        field.reset_phase?.(field.PHASE_DRAW);
        field.adjust_all?.();
        return false;
      }
      let message = field.pduel.new_message("MSG_NEW_PHASE");
      message.write(infos.phase);
      field.raise_event?.(null, field.EVENT_PREDRAW, null, 0, 0, turnPlayer, 0);
      field.process_instant_event?.();
      message = field.pduel.new_message("MSG_HINT");
      message.write(field.HINT_EVENT);
      message.write(turnPlayer);
      message.write(27n);
      if (core.new_fchain.size() || core.new_ochain.size()) {
        field.emplace_process?.("PointEvent", false, true, false);
      }
      return false;
    }
    case 3: {
      if (field.is_flag?.(field.DUEL_1ST_TURN_DRAW) || infos.turn_id > 1) {
        let count = field.get_draw_count?.(infos.turn_player) ?? 0;
        if (count > 0 && field.is_flag?.(field.DUEL_DRAW_UNTIL_5)) {
          count = Math.max(5 - player[turnPlayer].list_hand.length, count);
        }
        if (count > 0) {
          field.draw?.(null, field.REASON_RULE, turnPlayer, turnPlayer, count);
          field.emplace_process?.("PointEvent", false, false, false);
        }
      }
      field.emplace_process?.("PhaseEvent", field.PHASE_DRAW);
      return false;
    }
    case 4:
      return false;
    case 5: {
      infos.phase = field.PHASE_STANDBY;
      core.phase_action = false;
      core.new_fchain.clear();
      core.new_ochain.clear();
      core.quick_f_chain.clear();
      core.delayed_quick_tmp.clear();
      if (field.is_flag?.(field.DUEL_NO_STANDBY_PHASE) || field.is_player_affected_by_effect(infos.turn_player, field.EFFECT_SKIP_SP) || core.force_turn_end) {
        arg.step = 6;
        field.reset_phase?.(field.PHASE_STANDBY);
        field.adjust_all?.();
        return false;
      }
      const message = field.pduel.new_message("MSG_NEW_PHASE");
      message.write(infos.phase);
      field.raise_event?.(null, field.EVENT_PHASE_START + field.PHASE_STANDBY, null, 0, 0, turnPlayer, 0);
      field.process_instant_event?.();
      return false;
    }
    case 6: {
      if (core.new_fchain.size() || core.new_ochain.size() || core.instant_event.back().event_code !== field.EVENT_PHASE_START + field.PHASE_STANDBY) {
        field.emplace_process?.("PointEvent", false, false, false);
      }
      field.emplace_process?.("PhaseEvent", field.PHASE_STANDBY);
      return false;
    }
    case 7: {
      infos.phase = field.PHASE_MAIN1;
      core.phase_action = false;
      field.raise_event?.(null, field.EVENT_PHASE_START + field.PHASE_MAIN1, null, 0, 0, turnPlayer, 0);
      field.process_instant_event?.();
      field.adjust_all?.();
      return false;
    }
    case 8:
      return false;
    case 9: {
      core.new_fchain.clear();
      core.new_ochain.clear();
      core.quick_f_chain.clear();
      core.delayed_quick_tmp.clear();
      const message = field.pduel.new_message("MSG_NEW_PHASE");
      message.write(infos.phase);
      field.emplace_process?.("IdleCommand");
      return false;
    }
    case 10: {
      if (field.returns.at(0) === 7) {
        arg.step = 15;
        return false;
      }
      infos.phase = field.PHASE_BATTLE_START;
      core.new_fchain.clear();
      core.new_ochain.clear();
      core.quick_f_chain.clear();
      core.delayed_quick_tmp.clear();
      core.phase_action = false;
      ++core.battle_phase_count[infos.turn_player];
      const message = field.pduel.new_message("MSG_NEW_PHASE");
      message.write(infos.phase);
      if (field.is_player_affected_by_effect(infos.turn_player, field.EFFECT_SKIP_BP) || core.force_turn_end) {
        arg.step = 15;
        field.reset_phase?.(field.PHASE_BATTLE_START);
        field.reset_phase?.(field.PHASE_BATTLE_STEP);
        field.reset_phase?.(field.PHASE_BATTLE);
        field.adjust_all?.();
        return false;
      }
      field.raise_event?.(null, field.EVENT_PHASE_START + field.PHASE_BATTLE_START, null, 0, 0, turnPlayer, 0);
      field.process_instant_event?.();
      field.adjust_all?.();
      return false;
    }
    case 11: {
      if (core.new_fchain.size() || core.new_ochain.size()) field.emplace_process?.("PointEvent", false, false, false);
      field.emplace_process?.("PhaseEvent", field.PHASE_BATTLE_START);
      return false;
    }
    case 12: {
      infos.phase = field.PHASE_BATTLE_STEP;
      core.new_fchain.clear();
      core.new_ochain.clear();
      core.quick_f_chain.clear();
      core.delayed_quick_tmp.clear();
      core.phase_action = false;
      core.chain_attack = false;
      field.emplace_process?.("BattleCommand");
      return false;
    }
    case 13: {
      if (!arg.has_performed_second_battle_phase && field.returns.at(1)) {
        arg.has_performed_second_battle_phase = true;
        arg.step = 9;
        for (let p = 0; p < 2; ++p) {
          for (const pcard of player[p].list_mzone) {
            if (!pcard) continue;
            pcard.attack_announce_count = 0;
            pcard.announce_count = 0;
            pcard.attacked_count = 0;
            pcard.announced_cards.clear();
            pcard.attacked_cards.clear();
            pcard.battled_cards.clear();
          }
        }
        return false;
      }
      arg.has_performed_second_battle_phase = false;
      if (field.is_flag?.(field.DUEL_NO_MAIN_PHASE_2)) {
        arg.step = 15;
        field.adjust_all?.();
        return false;
      }
      core.skip_m2 = false;
      if (field.returns.at(0) === 3 || core.force_turn_end) core.skip_m2 = true;
      infos.phase = field.PHASE_MAIN2;
      core.phase_action = false;
      field.raise_event?.(null, field.EVENT_PHASE_START + field.PHASE_MAIN2, null, 0, 0, turnPlayer, 0);
      field.process_instant_event?.();
      field.adjust_all?.();
      return false;
    }
    case 14:
      if (core.new_fchain.size() || core.new_ochain.size()) field.emplace_process?.("PointEvent", false, false, false);
      return false;
    case 15: {
      core.new_fchain.clear();
      core.new_ochain.clear();
      core.quick_f_chain.clear();
      core.delayed_quick_tmp.clear();
      const message = field.pduel.new_message("MSG_NEW_PHASE");
      message.write(infos.phase);
      infos.can_shuffle = true;
      field.emplace_process?.("IdleCommand");
      return false;
    }
    case 16: {
      infos.phase = field.PHASE_END;
      core.phase_action = false;
      if (field.is_player_affected_by_effect(infos.turn_player, field.EFFECT_SKIP_EP)) {
        arg.step = 18;
        field.reset_phase?.(field.PHASE_END);
        field.adjust_all?.();
        return false;
      }
      const message = field.pduel.new_message("MSG_NEW_PHASE");
      message.write(infos.phase);
      field.raise_event?.(null, field.EVENT_PHASE_START + field.PHASE_END, null, 0, 0, turnPlayer, 0);
      field.process_instant_event?.();
      field.adjust_all?.();
      return false;
    }
    case 17:
      if (core.new_fchain.size() || core.new_ochain.size()) field.emplace_process?.("PointEvent", false, false, false);
      return false;
    case 18: {
      core.new_fchain.clear();
      core.new_ochain.clear();
      core.quick_f_chain.clear();
      core.delayed_quick_tmp.clear();
      field.emplace_process?.("PhaseEvent", field.PHASE_END);
      return false;
    }
    case 19: {
      field.raise_event?.(null, field.EVENT_TURN_END, null, 0, 0, turnPlayer, 0);
      field.process_instant_event?.();
      field.adjust_all?.();
      return false;
    }
    case 20: {
      core.new_fchain.clear();
      core.new_ochain.clear();
      core.quick_f_chain.clear();
      core.delayed_quick_tmp.clear();
      arg.step = "restart";
      arg.turn_player = 1 - arg.turn_player;
      return false;
    }
    default:
      return true;
  }
}