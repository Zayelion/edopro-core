bool field::process(Processors::PointEvent& arg) {
	auto skip_trigger = arg.skip_trigger;
	auto skip_freechain = arg.skip_freechain;
	auto skip_new = arg.skip_new;
	switch(arg.step) {
	case 0: {
		core.select_chains.clear();
		core.point_event.splice(core.point_event.end(), core.instant_event);
		if(skip_trigger) {
			arg.step = 7;
			return FALSE;
		}
		core.new_fchain_s.splice(core.new_fchain_s.begin(), core.new_fchain);
		core.new_ochain_s.splice(core.new_ochain_s.begin(), core.new_ochain);
		core.full_event.splice(core.full_event.end(), core.delayed_activate_event);
		core.delayed_quick.clear();
		core.delayed_quick_tmp.swap(core.delayed_quick);
		core.current_player = infos.turn_player;
		arg.step = 1;
		return FALSE;
	}
	case 1: {
		return FALSE;
	}
	case 2: {
		//forced trigger
		core.select_chains.clear();
		for (auto clit = core.new_fchain_s.begin(); clit != core.new_fchain_s.end(); ) {
			effect* peffect = clit->triggering_effect;
			card* phandler = peffect->get_handler();
			auto update_triggering_state = [&, updated_state = false]() mutable {
				if(std::exchange(updated_state, true))
					return;
				clit->set_triggering_state(phandler);
			};
			if(phandler->is_has_relation(*clit)) //work around: position and control should be refreshed before raising event
				update_triggering_state();
			if(clit->triggering_player != phandler->current.controler && !peffect->is_flag(EFFECT_FLAG_EVENT_PLAYER)) {
				clit->triggering_player = phandler->current.controler;
				update_triggering_state();
			}
			uint8_t tp = clit->triggering_player;
			if((!clit->was_just_sent || phandler->current.location == LOCATION_HAND)
			   && check_trigger_effect(*clit)
			   && peffect->is_chainable(tp)
			   && peffect->is_activateable(tp, clit->evt, TRUE, FALSE, FALSE, is_flag(DUEL_TRIGGER_WHEN_PRIVATE_KNOWLEDGE), is_flag(DUEL_TRIGGER_WHEN_PRIVATE_KNOWLEDGE))) {
				if(tp == core.current_player)
					core.select_chains.push_back(*clit);
			} else {
				peffect->active_type = 0;
				core.new_fchain_s.erase(clit++);
				continue;
			}
			++clit;
		}
		//TCG SEGOC
		if(core.select_chains.size() == 0) {
			returns.set<int32_t>(0, -1);
		} else {
			if(is_flag(DUEL_TCG_SEGOC_FIRSTTRIGGER)) { //tcg segoc
				core.select_chains.sort([](const chain& c1, const chain& c2) {return c1.event_id < c2.event_id; });
				auto pred = [id = core.select_chains.front().event_id](const chain& ch) {
					return ch.event_id == id;
				};
				auto endit = std::find_if_not(core.select_chains.begin(), core.select_chains.end(), pred);
				core.select_chains.erase(endit, core.select_chains.end());
			}
			if(core.select_chains.size() == 1) {
				returns.set<int32_t>(0, 0);
			} else {
				emplace_process<Processors::SelectChain>(core.current_player, 0x7f, true);
			}
		}
		return FALSE;
	}
	case 3: {
		if(returns.at<int32_t>(0) == -1) {
			if(core.new_fchain_s.size()) {
				core.current_player = 1 - infos.turn_player;
				arg.step = 1;
			} else {
				core.current_player = infos.turn_player;
			}
			return FALSE;
		}
		auto newchain = std::next(core.select_chains.begin(), returns.at<int32_t>(0));
		effect* peffect = newchain->triggering_effect;
		uint8_t tp = newchain->triggering_player;
		peffect->get_handler()->set_status(STATUS_CHAINING, TRUE);
		peffect->dec_count(tp);
		auto chain_id = newchain->chain_id;
		core.new_chains.splice(core.new_chains.end(), core.select_chains, newchain);
		emplace_process<Processors::AddChain>();
		core.new_fchain_s.remove_if([chain_id](const chain& ch) { return ch.chain_id == chain_id; });
		arg.step = 1;
		return FALSE;
	}
	case 4: {
		//optional trigger
		core.select_chains.clear();
		for (auto clit = core.new_ochain_s.begin(); clit != core.new_ochain_s.end(); ) {
			effect* peffect = clit->triggering_effect;
			card* phandler = peffect->get_handler();
			auto update_triggering_state = [&, updated_state = false]() mutable {
				if(std::exchange(updated_state, true))
					return;
				clit->set_triggering_state(phandler);
			};
			if(phandler->is_has_relation(*clit)) //work around: position and control should be refreshed before raising event
				update_triggering_state();
			if(!peffect->is_flag(EFFECT_FLAG_FIELD_ONLY) && (peffect->type & EFFECT_TYPE_FIELD)
				&& (peffect->range & LOCATION_HAND) && phandler->current.location == LOCATION_HAND) {
				if(!phandler->is_has_relation(*clit) && peffect->is_condition_check(phandler->current.controler, clit->evt))
					phandler->create_relation(*clit);
				peffect->set_activate_location();
				clit->triggering_player = phandler->current.controler;
				update_triggering_state();
			}
			if(clit->triggering_player != phandler->current.controler && !peffect->is_flag(EFFECT_FLAG_EVENT_PLAYER)) {
				clit->triggering_player = phandler->current.controler;
				update_triggering_state();
			}
			uint8_t tp = clit->triggering_player;
			if((!clit->was_just_sent || phandler->current.location == LOCATION_HAND)
			   && (is_flag(DUEL_TRIGGER_WHEN_PRIVATE_KNOWLEDGE) || check_nonpublic_trigger(*clit))
			   && check_trigger_effect(*clit)
			   && peffect->is_chainable(tp)
			   && peffect->is_activateable(tp, clit->evt, TRUE, FALSE, FALSE, is_flag(DUEL_TRIGGER_WHEN_PRIVATE_KNOWLEDGE), is_flag(DUEL_TRIGGER_WHEN_PRIVATE_KNOWLEDGE))
			   && check_spself_from_hand_trigger(*clit)) {
				if(tp == core.current_player)
					core.select_chains.push_back(*clit);
			} else {
				peffect->active_type = 0;
				core.new_ochain_s.erase(clit++);
				continue;
			}
			++clit;
		}
		//TCG SEGOC
		if(core.select_chains.size() == 0) {
			returns.set<int32_t>(0, -2);
			arg.step = 5;
			return FALSE;
		} else {
			if(is_flag(DUEL_TCG_SEGOC_NONPUBLIC))
				core.new_ochain_h.clear();
			//tcg segoc
			if(is_flag(DUEL_TCG_SEGOC_FIRSTTRIGGER)) {
				core.select_chains.sort([](const chain& c1, const chain& c2) {return c1.event_id < c2.event_id; });
				auto pred = [id = core.select_chains.front().event_id](const chain& ch) {
					return ch.event_id == id;
				};
				auto endit = std::find_if_not(core.select_chains.begin(), core.select_chains.end(), pred);
				core.select_chains.erase(endit, core.select_chains.end());
			}
			if(core.select_chains.size() == 1 && !core.current_chain.size()) {
				emplace_process<Processors::SelectEffectYesNo>(core.current_player, 221, core.select_chains.front().triggering_effect->get_handler());
				return FALSE;
			} else {
				emplace_process<Processors::SelectChain>(core.current_player, 0x7f, false);
				arg.step = 5;
				return FALSE;
			}
		}
		return FALSE;
	}
	case 5: {
		returns.set<int32_t>(0, returns.at<int32_t>(0) - 1);
		return FALSE;
	}
	case 6: {
		const auto ret = returns.at<int32_t>(0);
		if(ret == -2 || (ret == -1 && !is_flag(DUEL_TCG_SEGOC_FIRSTTRIGGER))) {
			for(const auto& ch : core.select_chains) {
				ch.triggering_effect->active_type = 0;
				core.new_ochain_s.remove_if([chain_id = ch.chain_id](const chain& ch) { return ch.chain_id == chain_id; });
			}
			if(core.new_ochain_s.size()) {
				core.current_player = 1 - infos.turn_player;
				arg.step = 3;
			} else {
				core.current_player = infos.turn_player;
				arg.step = 6;
			}
			return FALSE;
		} else if(ret == -1) {
			//TCG SEGOC
			auto discardedid = core.select_chains.front().event_id;
			core.new_ochain_s.remove_if([&](const chain& ch) { return ch.event_id == discardedid && ch.triggering_player == core.current_player; });
			arg.step = 3;
			return FALSE;
		}
		auto newchain = std::next(core.select_chains.begin(), returns.at<int32_t>(0));
		effect* peffect = newchain->triggering_effect;
		uint8_t tp = newchain->triggering_player;
		peffect->get_handler()->set_status(STATUS_CHAINING, TRUE);
		peffect->dec_count(tp);
		auto chain_id = newchain->chain_id;
		core.new_chains.splice(core.new_chains.end(), core.select_chains, newchain);
		emplace_process<Processors::AddChain>();
		core.new_ochain_s.remove_if([chain_id](const chain& ch) { return ch.chain_id == chain_id; });
		core.new_ochain_h.remove_if([chain_id](const chain& ch) { return ch.chain_id == chain_id; });
		arg.step = 3;
		return FALSE;
	}
	case 7: {
		core.select_chains.clear();
		return FALSE;
	}
	case 8: {
		if(skip_freechain || !(is_flag(DUEL_OCG_OBSOLETE_IGNITION) || is_flag(DUEL_TCG_FAST_EFFECT_IGNITION)) || (infos.phase != PHASE_MAIN1 && infos.phase != PHASE_MAIN2))
			return FALSE;
		// Obsolete ignition effect ruling
		auto check_events_ocg = [&] {
			if(check_event(EVENT_CHAIN_END))
				return true;
			tevent _e;
			if(!check_event(EVENT_SUMMON_SUCCESS, &_e) && !check_event(EVENT_SPSUMMON_SUCCESS, &_e) &&
			   !check_event(EVENT_FLIP_SUMMON_SUCCESS, &_e))
				return false;
			return _e.reason_player == infos.turn_player;
		};
		if(core.current_chain.size() == 0 && (is_flag(DUEL_TCG_FAST_EFFECT_IGNITION) || check_events_ocg())) {
			chain newchain;
			{
				newchain.evt.event_cards = nullptr;
				newchain.evt.event_value = 0;
				newchain.evt.event_player = PLAYER_NONE;
				newchain.evt.reason_effect = nullptr;
				newchain.evt.reason = 0;
				newchain.evt.reason_player = PLAYER_NONE;
			}
			newchain.flag = 0;
			newchain.triggering_player = infos.turn_player;
			for(auto eit = effects.ignition_effect.begin(); eit != effects.ignition_effect.end();) {
				effect* peffect = eit->second;
				++eit;
				card* phandler = peffect->get_handler();
				newchain.evt.event_code = peffect->code;
				if((is_flag(DUEL_TCG_FAST_EFFECT_IGNITION) || phandler->current.location == LOCATION_MZONE)
				   && peffect->is_chainable(infos.turn_player)
				   && peffect->is_activateable(infos.turn_player, newchain.evt)) {
					newchain.chain_id = infos.field_id++;
					newchain.triggering_effect = peffect;
					newchain.set_triggering_state(phandler);
					core.ignition_priority_chains.push_back(newchain);
				}
			}
		}
		return FALSE;
	}
	case 9: {
		infos.priorities[0] = 0;
		infos.priorities[1] = 0;
		if(core.current_chain.size() == 0) {
			if(!core.hand_adjusted) {
				if(is_flag(DUEL_INVERTED_QUICK_PRIORITY))
					emplace_process<Processors::QuickEffect>(skip_freechain, 1 - infos.turn_player);
				else
					emplace_process<Processors::QuickEffect>(skip_freechain, infos.turn_player);
			}
		} else
			emplace_process<Processors::QuickEffect>(skip_freechain, 1 - core.current_chain.back().triggering_player);
		return FALSE;
	}
	case 10: {
		core.new_ochain_h.clear();
		core.full_event.clear();
		core.delayed_quick.clear();
		for(auto& ch_lim : core.chain_limit)
			ensure_luaL_stack(luaL_unref, pduel->lua->lua_state, LUA_REGISTRYINDEX, ch_lim.function);
		core.chain_limit.clear();
		if(core.current_chain.size()) {
			for(auto& ch : core.current_chain)
				ch.triggering_effect->get_handler()->set_status(STATUS_CHAINING, FALSE);
			emplace_process<Processors::SolveChain>(skip_trigger, skip_freechain, skip_new);
		} else {
			core.used_event.splice(core.used_event.end(), core.point_event);
			reset_chain();
			returns.set<int32_t>(0, FALSE);
		}
		if(core.set_forced_attack) {
			core.set_forced_attack = false;
			emplace_process<Processors::ForcedBattle>();
		}
		return TRUE;
	}
	case 30: {
		int32_t check_player = infos.turn_player;
		nil_event.event_code = EVENT_FREE_CHAIN;
		core.select_chains.clear();
		core.spe_effect[check_player] = 0;
		auto pr = effects.continuous_effect.equal_range(EVENT_FREE_CHAIN);
		for(auto eit = pr.first; eit != pr.second;) {
			effect* peffect = eit->second;
			++eit;
			if(peffect->get_handler_player() == check_player && peffect->is_activateable(check_player, nil_event)) {
				core.select_chains.emplace_back().triggering_effect = peffect;
				++core.spe_effect[check_player];
			}
		}
		if(!core.select_chains.empty())
			emplace_process<Processors::SelectChain>(check_player, core.spe_effect[check_player], false);
		else
			arg.step = 31;
		return FALSE;
	}
	case 31: {
		if(returns.at<int32_t>(0) == -1)
			return FALSE;
		auto newchain = std::next(core.select_chains.begin(), returns.at<int32_t>(0));
		effect* peffect = newchain->triggering_effect;
		core.select_chains.clear();
		solve_continuous(peffect->get_handler_player(), peffect, nil_event);
		arg.step = 29;
		return FALSE;
	}
	case 32: {
		int32_t check_player = 1 - infos.turn_player;
		nil_event.event_code = EVENT_FREE_CHAIN;
		core.select_chains.clear();
		core.spe_effect[check_player] = 0;
		auto pr = effects.continuous_effect.equal_range(EVENT_FREE_CHAIN);
		for(auto eit = pr.first; eit != pr.second;) {
			effect* peffect = eit->second;
			++eit;
			if(peffect->get_handler_player() == check_player && peffect->is_activateable(check_player, nil_event)) {
				core.select_chains.emplace_back().triggering_effect = peffect;
				++core.spe_effect[check_player];
			}
		}
		if(!core.select_chains.empty())
			emplace_process<Processors::SelectChain>(check_player, core.spe_effect[check_player], false);
		else
			arg.step = Processors::restart;
		return FALSE;
	}
	case 33: {
		if(returns.at<int32_t>(0) == -1) {
			arg.step = Processors::restart;
			return FALSE;
		}
		auto newchain = std::next(core.select_chains.begin(), returns.at<int32_t>(0));
		effect* peffect = newchain->triggering_effect;
		core.select_chains.clear();
		solve_continuous(peffect->get_handler_player(), peffect, nil_event);
		arg.step = 31;
		return FALSE;
	}
	}
	if(core.set_forced_attack) {
		core.set_forced_attack = false;
		emplace_process<Processors::ForcedBattle>();
	}
	return TRUE;
}
