bool field::process(Processors::PhaseEvent& arg) {
	auto phase = arg.phase;
	switch(arg.step) {
	case 0: {
		if((phase == PHASE_DRAW && (core.force_turn_end || is_player_affected_by_effect(infos.turn_player, EFFECT_SKIP_DP)))
				|| (phase == PHASE_STANDBY && (core.force_turn_end || is_player_affected_by_effect(infos.turn_player, EFFECT_SKIP_SP)))
				|| (phase == PHASE_BATTLE_START && (core.force_turn_end || is_player_affected_by_effect(infos.turn_player, EFFECT_SKIP_BP)))
				|| (phase == PHASE_BATTLE && (core.force_turn_end || is_player_affected_by_effect(infos.turn_player, EFFECT_SKIP_BP)))
				|| (phase == PHASE_END && (core.force_turn_end || is_player_affected_by_effect(infos.turn_player, EFFECT_SKIP_EP)))) {
			arg.step = 24;
			return FALSE;
		}
		int32_t phase_event = EVENT_PHASE + phase;
		nil_event.event_code = phase_event;
		nil_event.event_player = infos.turn_player;
		int32_t check_player = infos.turn_player;
		if(arg.is_opponent)
			check_player = 1 - infos.turn_player;
		core.select_chains.clear();
		int32_t tf_count = 0, to_count = 0, fc_count = 0, cn_count = 0;
		auto pr = effects.trigger_f_effect.equal_range(phase_event);
		for(auto eit = pr.first; eit != pr.second;) {
			effect* peffect = eit->second;
			++eit;
			peffect->set_activate_location();
			if(!peffect->is_activateable(check_player, nil_event))
				continue;
			peffect->id = infos.field_id++;
			core.select_chains.emplace_back().triggering_effect = peffect;
			++tf_count;
		}
		pr = effects.continuous_effect.equal_range(phase_event);
		for(auto eit = pr.first; eit != pr.second;) {
			effect* peffect = eit->second;
			++eit;
			//effects.continuous_effect may be changed in is_activateable (e.g. Rescue Cat)
			if(peffect->get_handler_player() != check_player || !peffect->is_activateable(check_player, nil_event))
				continue;
			peffect->id = infos.field_id++;
			core.select_chains.emplace_back().triggering_effect = peffect;
			++cn_count;
		}
		//all effects taking control non-permanently are only until End Phase, not until Turn end
		for(auto* peffect : effects.pheff) {
			if(peffect->code != EFFECT_SET_CONTROL)
				continue;
			if(!(peffect->reset_flag & phase))
				continue;
			uint8_t pid = peffect->get_handler_player();
			if(pid != check_player)
				continue;
			uint8_t tp = infos.turn_player;
			if(!(((peffect->reset_flag & RESET_SELF_TURN) && pid == tp) || ((peffect->reset_flag & RESET_OPPO_TURN) && pid != tp)))
				continue;
			if(peffect->reset_count != 1)
				continue;
			card* phandler = peffect->get_handler();
			if(peffect->get_value(phandler) != phandler->current.controler)
				continue;
			core.select_chains.emplace_back().triggering_effect = peffect;
			++cn_count;
		}
		core.spe_effect[check_player] = 0;
		if(!core.hand_adjusted) {
			pr = effects.trigger_o_effect.equal_range(phase_event);
			for(auto eit = pr.first; eit != pr.second;) {
				effect* peffect = eit->second;
				++eit;
				peffect->set_activate_location();
				if(!peffect->is_activateable(check_player, nil_event))
					continue;
				peffect->id = infos.field_id++;
				core.select_chains.emplace_back().triggering_effect = peffect;
				++to_count;
				++core.spe_effect[check_player];
			}
			if(phase == PHASE_DRAW)
				core.hint_timing[infos.turn_player] = TIMING_DRAW_PHASE;
			else if(phase == PHASE_STANDBY)
				core.hint_timing[infos.turn_player] = TIMING_STANDBY_PHASE;
			else if(phase == PHASE_BATTLE_START)
				core.hint_timing[infos.turn_player] = TIMING_BATTLE_START;
			else if(phase == PHASE_BATTLE)
				core.hint_timing[infos.turn_player] = TIMING_BATTLE_END;
			else
				core.hint_timing[infos.turn_player] = TIMING_END_PHASE;
			pr = effects.activate_effect.equal_range(EVENT_FREE_CHAIN);
			for(auto eit = pr.first; eit != pr.second;) {
				effect* peffect = eit->second;
				++eit;
				peffect->set_activate_location();
				if(!peffect->is_chainable(check_player) || !peffect->is_activateable(check_player, nil_event))
					continue;
				peffect->id = infos.field_id++;
				core.select_chains.emplace_back().triggering_effect = peffect;
				if(check_hint_timing(peffect) || check_cteffect_hint(peffect, check_player))
					++core.spe_effect[check_player];
				++fc_count;
			}
			pr = effects.quick_o_effect.equal_range(EVENT_FREE_CHAIN);
			for(auto eit = pr.first; eit != pr.second;) {
				effect* peffect = eit->second;
				++eit;
				peffect->set_activate_location();
				if(!peffect->is_chainable(check_player) || !peffect->is_activateable(check_player, nil_event))
					continue;
				peffect->id = infos.field_id++;
				core.select_chains.emplace_back().triggering_effect = peffect;
				if(check_hint_timing(peffect))
					++core.spe_effect[check_player];
				++fc_count;
			}
			pr = effects.continuous_effect.equal_range(EVENT_FREE_CHAIN);
			for(auto eit = pr.first; eit != pr.second;) {
				effect* peffect = eit->second;
				++eit;
				if(peffect->get_handler_player() != check_player || !peffect->is_activateable(check_player, nil_event))
					continue;
				peffect->id = infos.field_id++;
				core.select_chains.emplace_back().triggering_effect = peffect;
				++fc_count;
			}
		}
		if(core.select_chains.size() == 0) {
			returns.set<int32_t>(0, -1);
			arg.step = 1;
			return FALSE;
		} else if(tf_count == 0 && cn_count == 1 && to_count == 0 && fc_count == 0) {
			returns.set<int32_t>(0, 0);
			arg.step = 1;
			return FALSE;
		} else {
			auto message = pduel->new_message(MSG_HINT);
			message->write<uint8_t>(HINT_EVENT);
			message->write<uint8_t>(check_player);
			if(infos.phase == PHASE_DRAW)
				message->write<uint64_t>(20);
			else if(infos.phase == PHASE_STANDBY)
				message->write<uint64_t>(21);
			else if(infos.phase == PHASE_BATTLE_START)
				message->write<uint64_t>(28);
			else if(infos.phase == PHASE_BATTLE)
				message->write<uint64_t>(25);
			else
				message->write<uint64_t>(26);
			if(tf_count == 0 && to_count == 1 && fc_count == 0 && cn_count == 0) {
				emplace_process<Processors::SelectEffectYesNo>(check_player, 0, core.select_chains.front().triggering_effect->get_handler());
				return FALSE;
			} else {
				emplace_process<Processors::SelectChain>(check_player, core.spe_effect[check_player], (tf_count + cn_count) > 0);
				arg.step = 1;
				return FALSE;
			}
		}
		return FALSE;
	}
	case 1: {
		returns.set<int32_t>(0, returns.at<int32_t>(0) - 1);
		return FALSE;
	}
	case 2: {
		if(returns.at<int32_t>(0) == -1) {
			if(arg.priority_passed)
				arg.step = 19;
			else {
				arg.priority_passed = true;
				arg.is_opponent = !arg.is_opponent;
				arg.step = Processors::restart;
			}
			return FALSE;
		}
		arg.priority_passed = false;
		auto selected_chain = std::next(core.select_chains.begin(), returns.at<int32_t>(0));
		effect* peffect = selected_chain->triggering_effect;
		card* phandler = peffect->get_handler();
		if(!(peffect->type & EFFECT_TYPE_ACTIONS)) {
			if(peffect->is_flag(EFFECT_FLAG_FIELD_ONLY))
				remove_effect(peffect);
			else
				peffect->handler->remove_effect(peffect);
			adjust_all();
			arg.step = 3;
		} else if(!(peffect->type & EFFECT_TYPE_CONTINUOUS)) {
			int32_t check_player = infos.turn_player;
			if(arg.is_opponent)
				check_player = 1 - infos.turn_player;
			core.new_chains.splice(core.new_chains.end(), core.select_chains, selected_chain);
			selected_chain->flag = 0;
			selected_chain->chain_id = infos.field_id++;
			selected_chain->evt = nil_event;
			selected_chain->set_triggering_state(phandler);
			selected_chain->triggering_player = check_player;
			phandler->set_status(STATUS_CHAINING, TRUE);
			peffect->dec_count(check_player);
			core.select_chains.clear();
			emplace_process<Processors::AddChain>();
			if(is_flag(DUEL_INVERTED_QUICK_PRIORITY))
				emplace_process<Processors::QuickEffect>(false, check_player);
			else
				emplace_process<Processors::QuickEffect>(false, 1 - check_player);
			infos.priorities[0] = 0;
			infos.priorities[1] = 0;
		} else {
			core.select_chains.clear();
			solve_continuous(peffect->get_handler_player(), peffect, nil_event);
			arg.step = 3;
		}
		return FALSE;
	}
	case 3: {
		for(auto& ch_lim : core.chain_limit)
			ensure_luaL_stack(luaL_unref, pduel->lua->lua_state, LUA_REGISTRYINDEX, ch_lim.function);
		core.chain_limit.clear();
		for(auto& ch : core.current_chain)
			ch.triggering_effect->get_handler()->set_status(STATUS_CHAINING, FALSE);
		emplace_process<Processors::SolveChain>(false, false, false);
		arg.step = Processors::restart;
		return FALSE;
	}
	case 4: {
		adjust_instant();
		emplace_process<Processors::PointEvent>(false, false, false);
		arg.step = Processors::restart;
		return FALSE;
	}
	case 20: {
		if(phase != PHASE_END) {
			arg.step = 24;
			return FALSE;
		}
		int32_t limit = 6;
		effect_set eset;
		filter_player_effect(infos.turn_player, EFFECT_HAND_LIMIT, &eset);
		if(eset.size())
			limit = eset.back()->get_value();
		int32_t hd = static_cast<int32_t>(player[infos.turn_player].list_hand.size());
		if(hd <= limit || is_flag(DUEL_NO_HAND_LIMIT)) {
			arg.step = 24;
			return FALSE;
		}
		core.select_cards.clear();
		for(auto& pcard : player[infos.turn_player].list_hand)
			core.select_cards.push_back(pcard);
		auto message = pduel->new_message(MSG_HINT);
		message->write<uint8_t>(HINT_SELECTMSG);
		message->write<uint8_t>(infos.turn_player);
		message->write<uint64_t>(501);
		auto to_discard = hd - limit;
		emplace_process<Processors::SelectCard>(infos.turn_player, false, to_discard, to_discard);
		return FALSE;
	}
	case 21: {
		if(return_cards.list.size())
			send_to(card_set{ return_cards.list.begin(), return_cards.list.end() }, nullptr, REASON_RULE + REASON_DISCARD + REASON_ADJUST, infos.turn_player, PLAYER_NONE, LOCATION_GRAVE, 0, POS_FACEUP);
		return FALSE;
	}
	case 22: {
		core.hand_adjusted = true;
		emplace_process<Processors::PointEvent>(false, false, false);
		arg.step = Processors::restart;
		arg.is_opponent = false;
		arg.priority_passed = false;
		return FALSE;
	}
	case 25: {
		core.hint_timing[infos.turn_player] = 0;
		reset_phase(phase);
		adjust_all();
		return FALSE;
	}
	case 26: {
		core.quick_f_chain.clear();
		core.instant_event.clear();
		core.point_event.clear();
		core.delayed_activate_event.clear();
		core.full_event.clear();
		/*if(core.set_forced_attack) {
			core.set_forced_attack = false;
			emplace_process<Processors::ForcedBattle>();
		}*/
		return TRUE;
	}
	}
	/*if(core.set_forced_attack) {
		core.set_forced_attack = false;
		emplace_process<Processors::ForcedBattle>();
	}*/
	return TRUE;
}
// core.ignition_priority_chains: used in step 8 (obsolete ignition effect ruling)
