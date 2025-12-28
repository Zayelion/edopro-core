bool field::process(Processors::Turn& arg) {
	const auto& turn_player = arg.turn_player;
	switch(arg.step) {
	case 0: {
		//Pre Draw
		core.used_event.clear();
		for(auto& peffect : core.reseted_effects) {
			pduel->delete_effect(peffect);
		}
		core.reseted_effects.clear();
		core.effect_count_code.clear();
		for(uint8_t p = 0; p < 2; ++p) {
			for(auto& pcard : player[p].list_mzone) {
				if(!pcard)
					continue;
				pcard->set_status(STATUS_SUMMON_TURN, FALSE);
				pcard->set_status(STATUS_FLIP_SUMMON_TURN, FALSE);
				pcard->set_status(STATUS_SPSUMMON_TURN, FALSE);
				pcard->set_status(STATUS_SET_TURN, FALSE);
				pcard->set_status(STATUS_FORM_CHANGED, FALSE);
				pcard->indestructable_effects.clear();
				pcard->attack_announce_count = 0;
				pcard->announce_count = 0;
				pcard->attacked_count = 0;
				pcard->announced_cards.clear();
				pcard->attacked_cards.clear();
				pcard->battled_cards.clear();
				pcard->attack_all_target = TRUE;
			}
			for(auto& pcard : player[p].list_szone) {
				if(!pcard)
					continue;
				pcard->set_status(STATUS_SET_TURN, FALSE);
				pcard->indestructable_effects.clear();
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
		emplace_process<Processors::RefreshRelay>();
		return FALSE;
	}
	case 1:	{
		core.force_turn_end = false;
		core.spsummon_rst = false;
		for(auto& peffect : effects.rechargeable)
			if(!peffect->is_flag(EFFECT_FLAG_NO_TURN_RESET))
				peffect->recharge();
		auto clear_counter = [](processor::action_counter_t& counter) {
			for(auto& iter : counter)
				iter.second.player_amount[0] = iter.second.player_amount[1] = 0;
		};
		clear_counter(core.summon_counter);
		clear_counter(core.normalsummon_counter);
		clear_counter(core.spsummon_counter);
		clear_counter(core.flipsummon_counter);
		clear_counter(core.attack_counter);
		clear_counter(core.chain_counter);
		for(auto& peffect : effects.spsummon_count_eff) {
			card* pcard = peffect->get_handler();
			if(!peffect->is_flag(EFFECT_FLAG_NO_TURN_RESET)) {
				pcard->spsummon_counter[0] = pcard->spsummon_counter[1] = 0;
				pcard->spsummon_counter_rst[0] = pcard->spsummon_counter_rst[1] = 0;
			}
		}
		++infos.turn_id;
		++infos.turn_id_by_player[turn_player];
		infos.turn_player = turn_player;
		auto message = pduel->new_message(MSG_NEW_TURN);
		message->write<uint8_t>(turn_player);
		if(!is_flag(DUEL_RELAY) && infos.turn_id != 1)
			tag_swap(turn_player);
		if(is_player_affected_by_effect(infos.turn_player, EFFECT_SKIP_TURN)) {
			arg.step = 18;
			reset_phase(PHASE_DRAW);
			reset_phase(PHASE_STANDBY);
			reset_phase(PHASE_END);
			adjust_all();
			return FALSE;
		}
		infos.phase = PHASE_DRAW;
		core.phase_action = false;
		core.hand_adjusted = false;
		raise_event(nullptr, EVENT_PHASE_START + PHASE_DRAW, nullptr, 0, 0, turn_player, 0);
		process_instant_event();
		adjust_all();
		return FALSE;
	}
	case 2: {
		core.new_fchain.clear();
		core.new_ochain.clear();
		core.quick_f_chain.clear();
		core.delayed_quick_tmp.clear();
		if(is_player_affected_by_effect(infos.turn_player, EFFECT_SKIP_DP) || core.force_turn_end) {
			arg.step = 3;
			reset_phase(PHASE_DRAW);
			adjust_all();
			return FALSE;
		}
		auto message = pduel->new_message(MSG_NEW_PHASE);
		message->write<uint16_t>(infos.phase);
		raise_event(nullptr, EVENT_PREDRAW, nullptr, 0, 0, turn_player, 0);
		process_instant_event();
		message = pduel->new_message(MSG_HINT);
		message->write<uint8_t>(HINT_EVENT);
		message->write<uint8_t>(turn_player);
		message->write<uint64_t>(27);
		if(core.new_fchain.size() || core.new_ochain.size())
			emplace_process<Processors::PointEvent>(false, true, false);
		/*if(core.set_forced_attack)
			emplace_process<Processors::ForcedBattle>();*/
		return FALSE;
	}
	case 3: {
		// Draw, new ruling
		if(is_flag(DUEL_1ST_TURN_DRAW) || (infos.turn_id > 1)) {
			int32_t count = get_draw_count(infos.turn_player);
			if(count > 0 && is_flag(DUEL_DRAW_UNTIL_5)) {
				count = std::max<int32_t>(static_cast<int32_t>(5 - player[turn_player].list_hand.size()), count);
			}
			if(count > 0) {
				draw(nullptr, REASON_RULE, turn_player, turn_player, count);
				emplace_process<Processors::PointEvent>(false, false, false);
			}
		}
		emplace_process<Processors::PhaseEvent>(PHASE_DRAW);
		/*if(core.set_forced_attack)
			emplace_process<Processors::ForcedBattle>();*/
		return FALSE;
	}
	case 4: {
		// EVENT_PHASE_PRESTART is removed
		return FALSE;
	}
	case 5: {
		//Standby Phase
		infos.phase = PHASE_STANDBY;
		core.phase_action = false;
		core.new_fchain.clear();
		core.new_ochain.clear();
		core.quick_f_chain.clear();
		core.delayed_quick_tmp.clear();
		if(is_flag(DUEL_NO_STANDBY_PHASE) || is_player_affected_by_effect(infos.turn_player, EFFECT_SKIP_SP) || core.force_turn_end) {
			arg.step = 6;
			reset_phase(PHASE_STANDBY);
			adjust_all();
			return FALSE;
		}
		auto message = pduel->new_message(MSG_NEW_PHASE);
		message->write<uint16_t>(infos.phase);
		raise_event(nullptr, EVENT_PHASE_START + PHASE_STANDBY, nullptr, 0, 0, turn_player, 0);
		process_instant_event();
		/*if(core.set_forced_attack)
			emplace_process<Processors::ForcedBattle>();*/
		return FALSE;
	}
	case 6: {
		// EVENT_PHASE_START + PHASE_STANDBY is a special case(c89642993)
		if(core.new_fchain.size() || core.new_ochain.size() || core.instant_event.back().event_code != EVENT_PHASE_START + PHASE_STANDBY)
			emplace_process<Processors::PointEvent>(false, false, false);
		emplace_process<Processors::PhaseEvent>(PHASE_STANDBY);
		/*if(core.set_forced_attack)
			emplace_process<Processors::ForcedBattle>();*/
		return FALSE;
	}
	case 7: {
		//Main1
		infos.phase = PHASE_MAIN1;
		core.phase_action = false;
		raise_event(nullptr, EVENT_PHASE_START + PHASE_MAIN1, nullptr, 0, 0, turn_player, 0);
		process_instant_event();
		adjust_all();
		/*if(core.set_forced_attack)
			emplace_process<Processors::ForcedBattle>();*/
		return FALSE;
	}
	case 8: {
		return FALSE;
	}
	case 9: {
		core.new_fchain.clear();
		core.new_ochain.clear();
		core.quick_f_chain.clear();
		core.delayed_quick_tmp.clear();
		auto message = pduel->new_message(MSG_NEW_PHASE);
		message->write<uint16_t>(infos.phase);
		emplace_process<Processors::IdleCommand>();
		/*if(core.set_forced_attack)
			emplace_process<Processors::ForcedBattle>();*/
		return FALSE;
	}
	case 10: {
		if(returns.at<int32_t>(0) == 7) { // End Phase
			arg.step = 15;
			return FALSE;
		}
		infos.phase = PHASE_BATTLE_START;
		core.new_fchain.clear();
		core.new_ochain.clear();
		core.quick_f_chain.clear();
		core.delayed_quick_tmp.clear();
		core.phase_action = false;
		++core.battle_phase_count[infos.turn_player];
		auto message = pduel->new_message(MSG_NEW_PHASE);
		message->write<uint16_t>(infos.phase);
		// Show the texts to indicate that BP is entered and skipped
		if(is_player_affected_by_effect(infos.turn_player, EFFECT_SKIP_BP) || core.force_turn_end) {
			arg.step = 15;
			reset_phase(PHASE_BATTLE_START);
			reset_phase(PHASE_BATTLE_STEP);
			reset_phase(PHASE_BATTLE);
			adjust_all();
			/*if(core.set_forced_attack)
				emplace_process<Processors::ForcedBattle>();*/
			return FALSE;
		}
		raise_event(nullptr, EVENT_PHASE_START + PHASE_BATTLE_START, nullptr, 0, 0, turn_player, 0);
		process_instant_event();
		adjust_all();
		/*if(core.set_forced_attack)
			emplace_process<Processors::ForcedBattle>();*/
		return FALSE;
	}
	case 11: {
		if(core.new_fchain.size() || core.new_ochain.size())
			emplace_process<Processors::PointEvent>(false, false, false);
		emplace_process<Processors::PhaseEvent>(PHASE_BATTLE_START);
		/*if(core.set_forced_attack)
			emplace_process<Processors::ForcedBattle>();*/
		return FALSE;
	}
	case 12: {
		infos.phase = PHASE_BATTLE_STEP;
		core.new_fchain.clear();
		core.new_ochain.clear();
		core.quick_f_chain.clear();
		core.delayed_quick_tmp.clear();
		core.phase_action = false;
		core.chain_attack = false;
		emplace_process<Processors::BattleCommand>();
		/*if(core.set_forced_attack)
			emplace_process<Processors::ForcedBattle>();*/
		return FALSE;
	}
	case 13: {
		if(!arg.has_performed_second_battle_phase && returns.at<int32_t>(1)) { // 2nd Battle Phase
			arg.has_performed_second_battle_phase = true;
			arg.step = 9;
			for(uint8_t p = 0; p < 2; ++p) {
				for(auto& pcard : player[p].list_mzone) {
					if(!pcard)
						continue;
					pcard->attack_announce_count = 0;
					pcard->announce_count = 0;
					pcard->attacked_count = 0;
					pcard->announced_cards.clear();
					pcard->attacked_cards.clear();
					pcard->battled_cards.clear();
				}
			}
			return FALSE;
		}
		arg.has_performed_second_battle_phase = false;
		if(is_flag(DUEL_NO_MAIN_PHASE_2)) {
			arg.step = 15;
			adjust_all();
			/*if(core.set_forced_attack)
				emplace_process<Processors::ForcedBattle>();*/
			return FALSE;
		}
		core.skip_m2 = false;
		if(returns.at<int32_t>(0) == 3 || core.force_turn_end) { // End Phase
			core.skip_m2 = true;
		}
		//Main2
		infos.phase = PHASE_MAIN2;
		core.phase_action = false;
		raise_event(nullptr, EVENT_PHASE_START + PHASE_MAIN2, nullptr, 0, 0, turn_player, 0);
		process_instant_event();
		adjust_all();
		/*if(core.set_forced_attack)
			emplace_process<Processors::ForcedBattle>();*/
		return FALSE;
	}
	case 14: {
		if(core.new_fchain.size() || core.new_ochain.size())
			emplace_process<Processors::PointEvent>(false, false, false);
		/*if(core.set_forced_attack)
			emplace_process<Processors::ForcedBattle>();*/
		return FALSE;
	}
	case 15: {
		core.new_fchain.clear();
		core.new_ochain.clear();
		core.quick_f_chain.clear();
		core.delayed_quick_tmp.clear();
		auto message = pduel->new_message(MSG_NEW_PHASE);
		message->write<uint16_t>(infos.phase);
		infos.can_shuffle = true;
		emplace_process<Processors::IdleCommand>();
		/*if(core.set_forced_attack)
			emplace_process<Processors::ForcedBattle>();*/
		return FALSE;
	}
	case 16: {
		//End Phase
		infos.phase = PHASE_END;
		core.phase_action = false;
		if(is_player_affected_by_effect(infos.turn_player, EFFECT_SKIP_EP)) {
			arg.step = 18;
			reset_phase(PHASE_END);
			adjust_all();
			return FALSE;
		}
		auto message = pduel->new_message(MSG_NEW_PHASE);
		message->write<uint16_t>(infos.phase);
		raise_event(nullptr, EVENT_PHASE_START + PHASE_END, nullptr, 0, 0, turn_player, 0);
		process_instant_event();
		adjust_all();
		/*if(core.set_forced_attack)
			emplace_process<Processors::ForcedBattle>();*/
		return FALSE;
	}
	case 17: {
		if(core.new_fchain.size() || core.new_ochain.size())
			emplace_process<Processors::PointEvent>(false, false, false);
		/*if(core.set_forced_attack)
			emplace_process<Processors::ForcedBattle>();*/
		return FALSE;
	}
	case 18: {
		core.new_fchain.clear();
		core.new_ochain.clear();
		core.quick_f_chain.clear();
		core.delayed_quick_tmp.clear();
		emplace_process<Processors::PhaseEvent>(PHASE_END);
		/*if(core.set_forced_attack)
			emplace_process<Processors::ForcedBattle>();*/
		return FALSE;
	}
	case 19: {
		raise_event(nullptr, EVENT_TURN_END, nullptr, 0, 0, turn_player, 0);
		process_instant_event();
		adjust_all();
		/*if(core.set_forced_attack)
			emplace_process<Processors::ForcedBattle>();*/
		return FALSE;
	}
	case 20: {
		core.new_fchain.clear();
		core.new_ochain.clear();
		core.quick_f_chain.clear();
		core.delayed_quick_tmp.clear();
		arg.step = Processors::restart;
		arg.turn_player = 1 - arg.turn_player;
		return FALSE;
	}
	}
	return TRUE;
}
