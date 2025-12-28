bool field::process(Processors::IdleCommand& arg) {
	switch(arg.step) {
	case 0: {
		bool must_attack = false;
		core.select_chains.clear();
		nil_event.event_code = EVENT_FREE_CHAIN;
		if(core.set_forced_attack) {
			core.set_forced_attack = false;
			arg.step = Processors::restart;
			emplace_process<Processors::ForcedBattle>();
			return FALSE;
		}
		core.to_bp = true;
		core.to_ep = true;
		if((!is_flag(DUEL_ATTACK_FIRST_TURN) && infos.turn_id == 1 && !(is_player_affected_by_effect(infos.turn_player, EFFECT_BP_FIRST_TURN))) || infos.phase == PHASE_MAIN2 || is_player_affected_by_effect(infos.turn_player, EFFECT_CANNOT_BP) || core.force_turn_end)
			core.to_bp = false;
		if(infos.phase == PHASE_MAIN1) {
			for(auto& pcard : player[infos.turn_player].list_mzone) {
				if(pcard && pcard->is_capable_attack() && pcard->is_affected_by_effect(EFFECT_MUST_ATTACK)) {
					must_attack = true;
					break;
				}
			}
			if(core.to_bp && (must_attack || is_player_affected_by_effect(infos.turn_player, EFFECT_CANNOT_EP)))
				core.to_ep = false;
		}
		if((infos.phase == PHASE_MAIN1 && is_player_affected_by_effect(infos.turn_player, EFFECT_SKIP_M1))
		        || (infos.phase == PHASE_MAIN2 && is_player_affected_by_effect(infos.turn_player, EFFECT_SKIP_M2)) || core.force_turn_end) {
			if(core.to_bp && core.to_ep) {
				core.select_options.clear();
				core.select_options.push_back(80);
				core.select_options.push_back(81);
				emplace_process<Processors::SelectOption>(infos.turn_player);
				arg.step = 11;
			} else if(core.to_bp) {
				arg.phase_to_change_to = 6;
				arg.step = 10;
				reset_phase(infos.phase);
				adjust_all();
			} else {
				arg.phase_to_change_to = 7;
				arg.step = 10;
				reset_phase(infos.phase);
				adjust_all();
			}
			return FALSE;
		}
		if((infos.phase == PHASE_MAIN2) && core.skip_m2) {
			core.skip_m2 = false;
			returns.set<int32_t>(0, 7);
			return FALSE;
		}
		auto pr = effects.activate_effect.equal_range(EVENT_FREE_CHAIN);
		for(auto eit = pr.first; eit != pr.second; eit++) {
			effect* peffect = eit->second;
			peffect->set_activate_location();
			if(peffect->is_activateable(infos.turn_player, nil_event)) {
				core.select_chains.emplace_back().triggering_effect = peffect;
			}
		}
		pr = effects.quick_o_effect.equal_range(EVENT_FREE_CHAIN);
		for(auto eit = pr.first; eit != pr.second; eit++) {
			effect* peffect = eit->second;
			peffect->set_activate_location();
			if(peffect->is_activateable(infos.turn_player, nil_event)) {
				core.select_chains.emplace_back().triggering_effect = peffect;
			}
		}
		pr = effects.continuous_effect.equal_range(EVENT_FREE_CHAIN);
		for(auto eit = pr.first; eit != pr.second; eit++) {
			effect* peffect = eit->second;
			if(peffect->get_handler_player() == infos.turn_player && peffect->is_activateable(infos.turn_player, nil_event)) {
				core.select_chains.emplace_back().triggering_effect = peffect;
			}
		}
		for(auto& eit : effects.ignition_effect) {
			effect* peffect = eit.second;
			peffect->set_activate_location();
			if(peffect->is_activateable(infos.turn_player, nil_event)) {
				core.select_chains.emplace_back().triggering_effect = peffect;
			}
		}
		core.summonable_cards.clear();
		for(auto& pcard : player[infos.turn_player].list_hand)
			if(pcard->is_can_be_summoned(infos.turn_player, FALSE, nullptr, 0))
				core.summonable_cards.push_back(pcard);
		for(auto& pcard : player[infos.turn_player].list_mzone) {
			if(pcard && pcard->is_can_be_summoned(infos.turn_player, FALSE, nullptr, 0))
				core.summonable_cards.push_back(pcard);
		}
		core.spsummonable_cards.clear();
		effect_set eset;
		filter_field_effect(EFFECT_SPSUMMON_PROC, &eset);
		for(const auto& peff : eset) {
			card* pcard = peff->get_handler();
			if(!peff->check_count_limit(pcard->current.controler))
				continue;
			if(pcard->current.controler == infos.turn_player && pcard->is_special_summonable(infos.turn_player, 0))
				core.spsummonable_cards.push_back(pcard);
		}
		eset.clear();
		filter_field_effect(EFFECT_SPSUMMON_PROC_G, &eset);
		for(const auto& peff : eset) {
			card* pcard = peff->get_handler();
			if(!peff->check_count_limit(infos.turn_player))
				continue;
			if(pcard->current.controler != infos.turn_player && !peff->is_flag(EFFECT_FLAG_BOTH_SIDE))
				continue;
			effect* oreason = core.reason_effect;
			uint8_t op = core.reason_player;
			core.reason_effect = peff;
			core.reason_player = pcard->current.controler;
			save_lp_cost();
			pduel->lua->add_param<LuaParam::EFFECT>(peff);
			pduel->lua->add_param<LuaParam::CARD>(pcard);
			if(pduel->lua->check_condition(peff->condition, 2))
				core.spsummonable_cards.push_back(pcard);
			restore_lp_cost();
			core.reason_effect = oreason;
			core.reason_player = op;
		}
		core.repositionable_cards.clear();
		for(auto& pcard : player[infos.turn_player].list_mzone) {
			if(pcard && ((pcard->is_position(POS_FACEUP | POS_FACEDOWN_ATTACK) && pcard->is_capable_change_position(infos.turn_player))
		        || (pcard->is_position(POS_FACEDOWN) && pcard->is_can_be_flip_summoned(infos.turn_player))))
				core.repositionable_cards.push_back(pcard);
		}
		core.msetable_cards.clear();
		core.ssetable_cards.clear();
		for(auto& pcard : player[infos.turn_player].list_hand) {
			if(pcard->is_setable_mzone(infos.turn_player, FALSE, nullptr, 0))
				core.msetable_cards.push_back(pcard);
			if(pcard->is_setable_szone(infos.turn_player))
				core.ssetable_cards.push_back(pcard);
		}
		emplace_process<Processors::SelectIdleCmd>(infos.turn_player);
		return FALSE;
	}
	case 1: {
		uint32_t ctype = returns.at<int32_t>(0) & 0xffff;
		uint32_t sel = returns.at<int32_t>(0) >> 16;
		if(ctype == 5) {
			auto newchain = std::next(core.select_chains.begin(), sel);
			effect* peffect = newchain->triggering_effect;
			if(peffect->type & EFFECT_TYPE_CONTINUOUS) {
				core.select_chains.clear();
				solve_continuous(peffect->get_handler_player(), peffect, nil_event);
				arg.step = 2;
				return FALSE;
			}
			card* phandler = peffect->get_handler();
			newchain->flag = 0;
			newchain->chain_id = infos.field_id++;
			newchain->evt.event_code = peffect->code;
			newchain->evt.event_player = PLAYER_NONE;
			newchain->evt.event_value = 0;
			newchain->evt.event_cards = nullptr;
			newchain->evt.reason = 0;
			newchain->evt.reason_effect = nullptr;
			newchain->evt.reason_player = PLAYER_NONE;
			newchain->set_triggering_state(phandler);
			newchain->triggering_player = infos.turn_player;
			core.new_chains.splice(core.new_chains.end(), core.select_chains, newchain);
			phandler->set_status(STATUS_CHAINING, TRUE);
			peffect->dec_count(infos.turn_player);
			core.select_chains.clear();
			emplace_process<Processors::AddChain>();
			emplace_process<Processors::QuickEffect>(false, 1 - infos.turn_player);
			infos.priorities[0] = 0;
			infos.priorities[1] = 0;
			core.select_chains.clear();
			return FALSE;
		} else if(ctype == 0) {
			arg.step = 4;
			return FALSE;
		} else if(ctype == 1) {
			arg.step = 5;
			return FALSE;
		} else if(ctype == 2) {
			arg.step = 6;
			return FALSE;
		} else if(ctype == 3) {
			arg.step = 7;
			return FALSE;
		} else if(ctype == 4) {
			arg.step = 8;
			return FALSE;
		} else if (ctype == 8) {
			arg.step = Processors::restart;
			shuffle(infos.turn_player, LOCATION_HAND);
			infos.can_shuffle = false;
			return FALSE;
		} else {
			arg.step = 9;
			auto message = pduel->new_message(MSG_HINT);
			message->write<uint8_t>(HINT_EVENT);
			message->write<uint8_t>(1 - infos.turn_player);
			message->write<uint64_t>(23);
			core.select_chains.clear();
			core.hint_timing[infos.turn_player] = TIMING_MAIN_END;
			emplace_process<Processors::QuickEffect>(false, 1 - infos.turn_player);
			infos.priorities[infos.turn_player] = 1;
			infos.priorities[1 - infos.turn_player] = 0;
			arg.phase_to_change_to = ctype;
			return FALSE;
		}
		/*if(core.set_forced_attack) {
			core.set_forced_attack = false;
			emplace_process<Processors::ForcedBattle>();
		}*/
		return TRUE;
	}
	case 2: {
		for(auto& ch_lim : core.chain_limit)
			ensure_luaL_stack(luaL_unref, pduel->lua->lua_state, LUA_REGISTRYINDEX, ch_lim.function);
		core.chain_limit.clear();
		for(auto& ch : core.current_chain)
			ch.triggering_effect->get_handler()->set_status(STATUS_CHAINING, FALSE);
		emplace_process<Processors::SolveChain>(false, false, false);
		arg.step = Processors::restart;
		return FALSE;
	}
	case 3: {
		adjust_instant();
		emplace_process<Processors::PointEvent>(false, false, false);
		arg.step = Processors::restart;
		return FALSE;
	}
	case 5: {
		card* target = core.summonable_cards[returns.at<int32_t>(0) >> 16];
		core.summon_cancelable = TRUE;
		summon(infos.turn_player, target, nullptr, FALSE, 0);
		arg.step = Processors::restart;
		return FALSE;
	}
	case 6: {
		card* target = core.spsummonable_cards[returns.at<int32_t>(0) >> 16];
		core.summon_cancelable = TRUE;
		special_summon_rule(infos.turn_player, target, 0);
		arg.step = Processors::restart;
		return FALSE;
	}
	case 7: {
		card* target = core.repositionable_cards[returns.at<int32_t>(0) >> 16];
		if(target->is_position(POS_FACEUP_ATTACK)) {
			core.phase_action = true;
			change_position(target, nullptr, infos.turn_player, POS_FACEUP_DEFENSE, FALSE);
			adjust_all();
			emplace_process<Processors::PointEvent>(false, false, false);
		} else if(target->is_position(POS_FACEUP_DEFENSE)) {
			core.phase_action = true;
			change_position(target, nullptr, infos.turn_player, POS_FACEUP_ATTACK, FALSE);
			adjust_all();
			emplace_process<Processors::PointEvent>(false, false, false);
		} else if(target->is_position(POS_FACEDOWN_ATTACK)) {
			arg.card_to_reposition = target;
			int32_t positions = 0;
			if(target->is_capable_change_position(infos.turn_player))
				positions |= POS_FACEDOWN_DEFENSE;
			if(target->is_can_be_flip_summoned(infos.turn_player))
				positions |= POS_FACEUP_ATTACK;
			emplace_process<Processors::SelectPosition>(infos.turn_player, target->data.code, positions);
			arg.step = 12;
			return FALSE;
		} else
			emplace_process<Processors::FlipSummon>(target->current.controler, target);
		target->set_status(STATUS_FORM_CHANGED, TRUE);
		arg.step = Processors::restart;
		return FALSE;
	}
	case 8: {
		card* target = core.msetable_cards[returns.at<int32_t>(0) >> 16];
		core.summon_cancelable = TRUE;
		mset(target->current.controler, target, nullptr, FALSE, 0);
		arg.step = Processors::restart;
		return FALSE;
	}
	case 9: {
		card* target = core.ssetable_cards[returns.at<int32_t>(0) >> 16];
		emplace_process<Processors::SpellSet>(target->current.controler, target->current.controler, target, nullptr);
		arg.step = Processors::restart;
		return FALSE;
	}
	case 10: {
		//end announce
		for(auto& ch_lim : core.chain_limit)
			ensure_luaL_stack(luaL_unref, pduel->lua->lua_state, LUA_REGISTRYINDEX, ch_lim.function);
		core.chain_limit.clear();
		if(core.current_chain.size()) {
			for(auto& ch : core.current_chain)
				ch.triggering_effect->get_handler()->set_status(STATUS_CHAINING, FALSE);
			emplace_process<Processors::SolveChain>(false, false, false);
			arg.step = Processors::restart;
			return FALSE;
		}
		reset_phase(infos.phase);
		adjust_all();
		return FALSE;
	}
	case 11: {
		returns.set<int32_t>(0, arg.phase_to_change_to);
		infos.can_shuffle = true;
		/*if(core.set_forced_attack) {
			core.set_forced_attack = false;
			emplace_process<Processors::ForcedBattle>();
		}*/
		return TRUE;
	}
	case 12: {
		if(returns.at<int32_t>(0) == 0)
			arg.phase_to_change_to = 6;
		else
			arg.phase_to_change_to = 7;
		reset_phase(infos.phase);
		adjust_all();
		arg.step = 10;
		return FALSE;
	}
	case 13: {
		card* target = arg.card_to_reposition;
		if(returns.at<int32_t>(0) == POS_FACEUP_ATTACK)
			emplace_process<Processors::FlipSummon>(target->current.controler, target);
		else {
			core.phase_action = true;
			change_position(target, nullptr, infos.turn_player, POS_FACEDOWN_DEFENSE, FALSE);
			adjust_all();
			emplace_process<Processors::PointEvent>(false, false, false);
		}
		target->set_status(STATUS_FORM_CHANGED, TRUE);
		arg.step = Processors::restart;
		return FALSE;
	}
	}
	/*if(core.set_forced_attack) {
		core.set_forced_attack = false;
		emplace_process<Processors::ForcedBattle>();
	}*/
	return TRUE;
}
