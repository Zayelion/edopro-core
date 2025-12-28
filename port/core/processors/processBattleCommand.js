/**
  bool field::process(Processors::BattleCommand& arg) {
	switch(arg.step) {
	case 0: {
		core.select_chains.clear();
		nil_event.event_code = EVENT_FREE_CHAIN;
		if(!core.chain_attack) {
			core.chain_attacker_id = 0;
			core.chain_attack_target = nullptr;
		}
		core.attack_player = FALSE;
		core.attacker = nullptr;
		core.attack_target = nullptr;
		if(auto peffect = is_player_affected_by_effect(infos.turn_player, EFFECT_SKIP_BP); peffect != nullptr || core.force_turn_end) {
			arg.step = 41;
			arg.phase_to_change_to = 2;
			arg.repeat_battle_phase = static_cast<bool>(is_player_affected_by_effect(infos.turn_player, EFFECT_BP_TWICE));
			if(core.force_turn_end || !peffect->value) {
				reset_phase(PHASE_BATTLE_STEP);
				adjust_all();
				infos.phase = PHASE_BATTLE;
				emplace_process<Processors::PhaseEvent>(PHASE_BATTLE);
			} else {
				core.hint_timing[infos.turn_player] = 0;
				reset_phase(PHASE_BATTLE);
				adjust_all();
			}
			return FALSE;
		}
		auto pr = effects.activate_effect.equal_range(EVENT_FREE_CHAIN);
		for(auto eit = pr.first; eit != pr.second; eit++) {
			auto peffect = eit->second;
			peffect->set_activate_location();
			if(peffect->is_activateable(infos.turn_player, nil_event) && peffect->get_speed() > 1) {
				core.select_chains.emplace_back().triggering_effect = peffect;
			}
		}
		pr = effects.quick_o_effect.equal_range(EVENT_FREE_CHAIN);
		for(auto eit = pr.first; eit != pr.second; eit++) {
			auto peffect = eit->second;
			peffect->set_activate_location();
			if(peffect->is_activateable(infos.turn_player, nil_event)) {
				core.select_chains.emplace_back().triggering_effect = peffect;
			}
		}
		pr = effects.continuous_effect.equal_range(EVENT_FREE_CHAIN);
		for(auto eit = pr.first; eit != pr.second; eit++) {
			auto peffect = eit->second;
			if(peffect->get_handler_player() == infos.turn_player && peffect->is_activateable(infos.turn_player, nil_event)) {
				core.select_chains.emplace_back().triggering_effect = peffect;
			}
		}
		core.attackable_cards.clear();
		card_vector first_attack;
		card_vector must_attack;
		if(!is_player_affected_by_effect(infos.turn_player, EFFECT_CANNOT_ATTACK_ANNOUNCE)) {
			for(auto& pcard : player[infos.turn_player].list_mzone) {
				if(!pcard)
					continue;
				if(!pcard->is_capable_attack_announce(infos.turn_player))
					continue;
				uint8_t chain_attack = FALSE;
				if(core.chain_attack && core.chain_attacker_id == pcard->fieldid)
					chain_attack = TRUE;
				card_vector cv;
				get_attack_target(pcard, &cv, chain_attack);
				if(cv.size() == 0 && pcard->direct_attackable == 0)
					continue;
				core.attackable_cards.push_back(pcard);
				if(pcard->is_affected_by_effect(EFFECT_FIRST_ATTACK))
					first_attack.push_back(pcard);
				if(pcard->is_affected_by_effect(EFFECT_MUST_ATTACK))
					must_attack.push_back(pcard);
			}
			if(first_attack.size())
				core.attackable_cards = first_attack;
		}
		core.to_m2 = !is_flag(DUEL_NO_MAIN_PHASE_2);
		core.to_ep = true;
		if(must_attack.size() || is_player_affected_by_effect(infos.turn_player, EFFECT_CANNOT_M2) || core.force_turn_end)
			core.to_m2 = false;
		if(must_attack.size())
			core.to_ep = false;
		core.attack_cancelable = true;
		core.attack_cost_paid = FALSE;
		emplace_process<Processors::SelectBattleCmd>(infos.turn_player);
		return FALSE;
	}
	case 1: {
		int32_t ctype = returns.at<int32_t>(0) & 0xffff;
		int32_t sel = returns.at<int32_t>(0) >> 16;
		if(arg.forced_attack_done || (ctype != 0 && ctype != 1)) {
			arg.step = 39;
			// ignored when arg.forced_attack_done, so can be anything
			arg.phase_to_change_to = ctype;
			auto message = pduel->new_message(MSG_HINT);
			message->write<uint8_t>(HINT_EVENT);
			message->write<uint8_t>(1 - infos.turn_player);
			message->write<uint64_t>(29);
			core.select_chains.clear();
			core.hint_timing[infos.turn_player] = TIMING_BATTLE_STEP_END;
			emplace_process<Processors::QuickEffect>(false, 1 - infos.turn_player);
			infos.priorities[infos.turn_player] = 1;
			infos.priorities[1 - infos.turn_player] = 0;
			return FALSE;
		} else if(ctype == 0) {
			auto newchain = std::next(core.select_chains.begin(), sel);
			effect* peffect = newchain->triggering_effect;
			if(peffect->type & EFFECT_TYPE_CONTINUOUS) {
				core.select_chains.clear();
				solve_continuous(peffect->get_handler_player(), peffect, nil_event);
				arg.step = 14;
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
		} else if(ctype == 1) {
			arg.step = 2;
			arg.attack_announce_failed = false;
			if(!arg.forced_attack)
				core.attacker = core.attackable_cards[sel];
			core.attacker->set_status(STATUS_ATTACK_CANCELED, FALSE);
			core.attacker->attack_controler = core.attacker->current.controler;
			core.pre_field[0] = core.attacker->fieldid_r;
			if(core.chain_attack && core.chain_attacker_id != core.attacker->fieldid) {
				core.chain_attack = false;
				core.chain_attacker_id = 0;
			}
			effect_set eset;
			core.tpchain.clear();
			filter_player_effect(infos.turn_player, EFFECT_ATTACK_COST, &eset, false);
			core.attacker->filter_effect(EFFECT_ATTACK_COST, &eset);
			for(const auto& peff : eset) {
				if(peff->operation) {
					core.tpchain.emplace_back().triggering_effect = peff;
					core.attack_cancelable = false;
				}
			}
			if(core.tpchain.size() > 1) {
				emplace_process<Processors::SortChain>(infos.turn_player);
				arg.step = 13;
			}
			else if(core.tpchain.size() == 1){
				core.sub_solving_event.push_back(nil_event);
				emplace_process<Processors::ExecuteOperation>(core.tpchain.front().triggering_effect, infos.turn_player);
				adjust_all();
			}
			return FALSE;
		}

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
		arg.is_replaying_attack = false;
		if(core.attacker->is_status(STATUS_ATTACK_CANCELED)) {
			arg.attack_announce_failed = true;
			arg.step = 6;
			return FALSE;
		}
		//Cancel the attack cost
		if(core.attack_cost_paid != 1 && !core.attack_cancelable) {
			if(arg.forced_attack) {
				returns.set<int32_t>(0, 2);
				arg.step = 0;
			} else
				arg.step = Processors::restart;
			return FALSE;
		}
		if(arg.forced_attack)
			arg.step = 6;
		return FALSE;
	}
	case 4: {
		// select attack target(replay start point)
		core.attack_player = FALSE;
		core.select_cards.clear();
		return_cards.clear();
		arg.must_attack_map.clear();
		auto atype = get_attack_target(core.attacker, &core.select_cards, core.chain_attack, true, &arg.must_attack_map);
		// direct attack
		if(core.attacker->direct_attackable) {
			if(core.select_cards.size() == 0) {
				returns.set<int32_t>(0, -2);
				arg.step = 5;
				return FALSE;
			}
			if(is_player_affected_by_effect(infos.turn_player, EFFECT_PATRICIAN_OF_DARKNESS))
				emplace_process<Processors::SelectEffectYesNo>(1 - infos.turn_player, 31, core.attacker);
			else
				emplace_process<Processors::SelectYesNo>(infos.turn_player, 31);
			return FALSE;
		}
		// no target and not direct attackable
		if(core.select_cards.size() == 0) {
			arg.attack_announce_failed = true;
			arg.step = 6;
			return FALSE;
		}
		auto differentMustAttackMonsterEffects = [&] {
			size_t count = 0;
			const auto& must = arg.must_attack_map;
			for(auto it = must.begin(), end = must.end(); it != end; it = must.upper_bound(it->first))
				++count;
			return count;
		}();

		auto patrician = is_player_affected_by_effect(infos.turn_player, EFFECT_PATRICIAN_OF_DARKNESS) != nullptr;
		if(patrician || (atype == 3 && differentMustAttackMonsterEffects != 1)) {
			if(core.select_cards.size() == 1)
				return_cards.list.push_back(core.select_cards.front());
			else {
				auto message = pduel->new_message(MSG_CARD_SELECTED);
				message->write<uint32_t>(1);
				message->write(core.attacker->get_info_location());
				message = pduel->new_message(MSG_HINT);
				message->write<uint8_t>(HINT_SELECTMSG);
				message->write<uint8_t>(1 - infos.turn_player);
				message->write<uint64_t>(549);
				emplace_process<Processors::SelectCard>(1 - infos.turn_player, false, 1, 1);
				if(!patrician && atype == 3 && arg.must_attack_map.size() != differentMustAttackMonsterEffects) {
					arg.step = 15;
					return FALSE;
				}
			}
		} else {
			auto message = pduel->new_message(MSG_HINT);
			message->write<uint8_t>(HINT_SELECTMSG);
			message->write<uint8_t>(infos.turn_player);
			message->write<uint64_t>(549);
			emplace_process<Processors::SelectCard>(infos.turn_player, core.attack_cancelable, 1, 1);
		}
		arg.step = 5;
		return FALSE;
	}
	case 5: {
		// the answer of "direct attack or not"
		if(returns.at<int32_t>(0)) {
			returns.set<int32_t>(0, -2);
		} else {
			if(core.select_cards.size()) {
				auto opposel = !!is_player_affected_by_effect(infos.turn_player, EFFECT_PATRICIAN_OF_DARKNESS);
				const auto sel_player = opposel ? 1 - infos.turn_player : infos.turn_player;
				const auto cancelable = (core.attack_cancelable && !opposel);
				auto message = pduel->new_message(MSG_HINT);
				message->write<uint8_t>(HINT_SELECTMSG);
				message->write<uint8_t>(opposel ? 1 - infos.turn_player : infos.turn_player);
				message->write<uint64_t>(549);
				emplace_process<Processors::SelectCard>(sel_player, cancelable, 1, 1);
			} else {
				arg.attack_announce_failed = true;
				arg.step = 6;
			}
		}
		return FALSE;
	}
	case 6: {
		if(return_cards.canceled) {//cancel attack manually
			if(arg.is_replaying_attack) {
				arg.step = 12;
				return FALSE;
			}
			if(arg.forced_attack) {
				returns.set<int32_t>(0, 2);
				arg.step = 0;
			} else
				arg.step = Processors::restart;
			return FALSE;
		}
		if(returns.at<int32_t>(0) == -2)
			core.attack_target = nullptr;
		else
			core.attack_target = return_cards.list[0];
		if(core.attack_target)
			core.pre_field[1] = core.attack_target->fieldid_r;
		else
			core.pre_field[1] = 0;
		return FALSE;
	}
	case 7: {
		if(!arg.is_replaying_attack) {
			core.phase_action = true;
			++core.attack_state_count[infos.turn_player];
			check_card_counter(core.attacker, ACTIVITY_ATTACK, infos.turn_player);
			++core.attacker->attack_announce_count;
		}
		if(arg.attack_announce_failed) {
			++core.attacker->announce_count;
			core.chain_attack = false;
			if(arg.forced_attack) {
				returns.set<int32_t>(0, 2);
				arg.step = 0;
			} else
				arg.step = Processors::restart;
		}
		return FALSE;
	}
	case 8: {
		core.attack_cancelable = true;
		auto message = pduel->new_message(MSG_ATTACK);
		message->write(core.attacker->get_info_location());
		if(core.attack_target) {
			raise_single_event(core.attack_target, nullptr, EVENT_BE_BATTLE_TARGET, nullptr, 0, 0, 1 - infos.turn_player, 0);
			raise_event(core.attack_target, EVENT_BE_BATTLE_TARGET, nullptr, 0, 0, 1 - infos.turn_player, 0);
			message->write(core.attack_target->get_info_location());
		} else {
			message->write(loc_info{});
		}
		core.attack_rollback = false;
		core.opp_mzone.clear();
		for(auto& pcard : player[1 - infos.turn_player].list_mzone) {
			if(pcard)
				core.opp_mzone.insert(pcard->fieldid_r);
		}
		if(!arg.is_replaying_attack) {
			raise_single_event(core.attacker, nullptr, EVENT_ATTACK_ANNOUNCE, nullptr, 0, 0, infos.turn_player, 0);
			raise_event(core.attacker, EVENT_ATTACK_ANNOUNCE, nullptr, 0, 0, infos.turn_player, 0);
		}
		core.attacker->attack_controler = core.attacker->current.controler;
		core.pre_field[0] = core.attacker->fieldid_r;
		process_single_event();
		process_instant_event();
		core.hint_timing[infos.turn_player] = TIMING_ATTACK;
		emplace_process<Processors::PointEvent>(false, false, false);
		return FALSE;
	}
	case 9: {
		if(is_player_affected_by_effect(infos.turn_player, EFFECT_SKIP_BP)
			|| core.attacker->is_status(STATUS_ATTACK_CANCELED) || core.attack_rollback) {
			arg.step = 10;
			return FALSE;
		}
		auto message = pduel->new_message(MSG_HINT);
		message->write<uint8_t>(HINT_EVENT);
		message->write<uint8_t>(0);
		message->write<uint64_t>(24);
		message = pduel->new_message(MSG_HINT);
		message->write<uint8_t>(HINT_EVENT);
		message->write<uint8_t>(1);
		message->write<uint64_t>(24);
		core.hint_timing[0] = TIMING_BATTLE_PHASE;
		core.hint_timing[1] = TIMING_BATTLE_PHASE;
		emplace_process<Processors::PointEvent>(Step{ 30 }, false, false, false);
		return FALSE;
	}
	case 10: {
		if(returns.at<int32_t>(0))
			arg.step = 8;
		else
			adjust_all();
		return FALSE;
	}
	case 11: {
		if(core.attacker->is_affected_by_effect(EFFECT_ATTACK_DISABLED)) {
			core.attacker->reset(EFFECT_ATTACK_DISABLED, RESET_CODE);
			pduel->new_message(MSG_ATTACK_DISABLED);
			core.attacker->set_status(STATUS_ATTACK_CANCELED, TRUE);
		}
		if(is_player_affected_by_effect(infos.turn_player, EFFECT_SKIP_BP)
			|| core.attacker->is_status(STATUS_ATTACK_CANCELED)) {
			arg.step = 12;
			return FALSE;
		}
		// go to damage step
		if(!core.attack_rollback) {
			++core.attacker->announce_count;
			core.attacker->announced_cards.addcard(core.attack_target);
			attack_all_target_check();
			arg.step = 18;
			return FALSE;
		}
		card_vector cv;
		get_attack_target(core.attacker, &cv, core.chain_attack);
		if(!cv.size() && !core.attacker->direct_attackable) {
			arg.step = 12;
			return FALSE;
		}
		// replay
		if(is_flag(DUEL_STORE_ATTACK_REPLAYS) && !core.chain_attack) {
			returns.set<int32_t>(0, FALSE);
		} else if(!core.attacker->is_affected_by_effect(EFFECT_MUST_ATTACK))
			emplace_process<Processors::SelectYesNo>(infos.turn_player, 30);
		else {
			returns.set<int32_t>(0, TRUE);
			core.attack_cancelable = false;
		}
		return FALSE;
	}
	case 12: {
		// answer of "replay or not"
		if(returns.at<int32_t>(0)) {
			arg.is_replaying_attack = true;
			arg.attack_announce_failed = false;
			arg.step = 3;
		}
		return FALSE;
	}
	case 13: {
		if(core.attacker->fieldid_r == core.pre_field[0] && (!(is_flag(DUEL_STORE_ATTACK_REPLAYS) && !core.chain_attack) || core.attacker->is_status(STATUS_ATTACK_CANCELED))) {
			++core.attacker->announce_count;
			core.attacker->announced_cards.addcard(core.attack_target);
			attack_all_target_check();
		}
		core.chain_attack = false;
		if(arg.forced_attack) {
			returns.set<int32_t>(0, 2);
			arg.step = 0;
		} else
			arg.step = Processors::restart;
		reset_phase(PHASE_DAMAGE);
		adjust_all();
		return FALSE;
	}
	case 14: {
		for(auto clit = core.tpchain.begin(); clit != core.tpchain.end(); ++clit) {
			core.sub_solving_event.push_back(nil_event);
			emplace_process<Processors::ExecuteOperation>(clit->triggering_effect, infos.turn_player);
			adjust_all();
		}
		core.tpchain.clear();
		arg.step = 2;
		return FALSE;
	}
	case 15: {
		adjust_instant();
		emplace_process<Processors::PointEvent>(false, false, false);
		arg.step = Processors::restart;
		return FALSE;
	}
	// EFFECT_MUST_ATTACK_MONSTER where an effect affects more than 1 monster
	case 16: {
		auto selected_card = return_cards.list.front();
		const auto range = arg.must_attack_map.equal_range(
			std::find_if(arg.must_attack_map.begin(), arg.must_attack_map.end(),
						[selected_card](const auto& must_pair) {
							return must_pair.second == selected_card;
						})->first);
		if(std::distance(range.first, range.second) < 2) {
			core.attack_target = selected_card;
			core.pre_field[1] = core.attack_target->fieldid_r;
			arg.step = 5;
			return FALSE;
		}
		core.select_cards.clear();
		std::transform(range.first, range.second, std::back_inserter(core.select_cards), [](const auto& pair) {
			return pair.second;
		});
		auto message = pduel->new_message(MSG_HINT);
		message->write<uint8_t>(HINT_SELECTMSG);
		message->write<uint8_t>(infos.turn_player);
		message->write<uint64_t>(549);
		emplace_process<Processors::SelectCard>(infos.turn_player, core.attack_cancelable, 1, 1);
		arg.step = 5;
		return FALSE;
	}
	case 19: {
		infos.phase = PHASE_DAMAGE;
		core.chain_attack = false;
		arg.is_replaying_attack = false;
		core.damage_calculated = false;
		core.selfdes_disabled = true;
		core.flip_delayed = true;
		core.attacker->attack_controler = core.attacker->current.controler;
		core.pre_field[0] = core.attacker->fieldid_r;
		if(core.attack_target) {
			core.attack_target->attack_controler = core.attack_target->current.controler;
			core.pre_field[1] = core.attack_target->fieldid_r;
		} else
			core.pre_field[1] = 0;
		++core.attacker->attacked_count;
		core.attacker->attacked_cards.addcard(core.attack_target);
		++core.battled_count[infos.turn_player];
		adjust_all();
		return FALSE;
	}
	case 20: {
		// start of PHASE_DAMAGE;
		(void)pduel->new_message(MSG_DAMAGE_STEP_START);
		raise_single_event(core.attacker, nullptr, EVENT_BATTLE_START, nullptr, 0, 0, 0, 0);
		if(core.attack_target) {
			raise_single_event(core.attack_target, nullptr, EVENT_BATTLE_START, nullptr, 0, 0, 0, 1);
		}
		raise_event(nullptr, EVENT_BATTLE_START, nullptr, 0, 0, 0, 0);
		process_single_event();
		process_instant_event();
		arg.previous_point_event_had_any_trigger_to_resolve = false;
		if(!is_flag(DUEL_6_STEP_BATLLE_STEP) || (core.new_fchain.size() || core.new_ochain.size())) {
			arg.previous_point_event_had_any_trigger_to_resolve = core.new_fchain.size() || core.new_ochain.size();
			auto message = pduel->new_message(MSG_HINT);
			message->write<uint8_t>(HINT_EVENT);
			message->write<uint8_t>(0);
			message->write<uint64_t>(40);
			message = pduel->new_message(MSG_HINT);
			message->write<uint8_t>(HINT_EVENT);
			message->write<uint8_t>(1);
			message->write<uint64_t>(40);
			emplace_process<Processors::PointEvent>(false, false, is_flag(DUEL_SINGLE_CHAIN_IN_DAMAGE_SUBSTEP));
		}
		return FALSE;
	}
	case 21: {
		if(core.attacker->is_status(STATUS_ATTACK_CANCELED)) {
			arg.step = 33;
			return FALSE;
		}
		if(!core.attack_target) {
			return FALSE;
		}
		core.attacker->temp.position = core.attacker->current.position;
		core.attack_target->temp.position = core.attack_target->current.position;
		if(core.attack_target->is_position(POS_FACEDOWN)) {
			change_position(core.attack_target, nullptr, PLAYER_NONE, core.attack_target->current.position >> 1, 0, TRUE);
			adjust_all();
		}
		return FALSE;
	}
	case 22: {
		raise_single_event(core.attacker, nullptr, EVENT_BATTLE_CONFIRM, nullptr, 0, 0, 0, 0);
		if(core.attack_target) {
			if(core.attack_target->temp.position & POS_FACEDOWN)
				core.pre_field[1] = core.attack_target->fieldid_r;
			raise_single_event(core.attack_target, nullptr, EVENT_BATTLE_CONFIRM, nullptr, 0, 0, 0, 1);
		}
		raise_event(nullptr, EVENT_BATTLE_CONFIRM, nullptr, 0, 0, 0, 0);
		process_single_event();
		process_instant_event();
		if(!is_flag(DUEL_6_STEP_BATLLE_STEP) || !arg.previous_point_event_had_any_trigger_to_resolve
		   || core.new_fchain.size() || core.new_ochain.size()) {
			auto message = pduel->new_message(MSG_HINT);
			message->write<uint8_t>(HINT_EVENT);
			message->write<uint8_t>(0);
			message->write<uint64_t>(41);
			message = pduel->new_message(MSG_HINT);
			message->write<uint8_t>(HINT_EVENT);
			message->write<uint8_t>(1);
			message->write<uint64_t>(41);
			core.hint_timing[infos.turn_player] = TIMING_DAMAGE_STEP;
			emplace_process<Processors::PointEvent>(false, false, is_flag(DUEL_SINGLE_CHAIN_IN_DAMAGE_SUBSTEP));
		}
		return FALSE;
	}
	case 23: {
		if(core.attacker->is_status(STATUS_ATTACK_CANCELED)) {
			arg.step = 33;
			return FALSE;
		}
		infos.phase = PHASE_DAMAGE_CAL;
		adjust_all();
		return FALSE;
	}
	case 24: {
		// PHASE_DAMAGE_CAL;
		calculate_battle_damage(nullptr, nullptr, nullptr);
		raise_single_event(core.attacker, nullptr, EVENT_PRE_DAMAGE_CALCULATE, nullptr, 0, 0, 0, 0);
		if(core.attack_target)
			raise_single_event(core.attack_target, nullptr, EVENT_PRE_DAMAGE_CALCULATE, nullptr, 0, 0, 0, 1);
		raise_event(nullptr, EVENT_PRE_DAMAGE_CALCULATE, nullptr, 0, 0, 0, 0);
		process_single_event();
		process_instant_event();
		auto message = pduel->new_message(MSG_HINT);
		message->write<uint8_t>(HINT_EVENT);
		message->write<uint8_t>(0);
		message->write<uint64_t>(42);
		message = pduel->new_message(MSG_HINT);
		message->write<uint8_t>(HINT_EVENT);
		message->write<uint8_t>(1);
		message->write<uint64_t>(42);
		core.hint_timing[infos.turn_player] = TIMING_DAMAGE_CAL;
		emplace_process<Processors::PointEvent>(false, false, is_flag(DUEL_SINGLE_CHAIN_IN_DAMAGE_SUBSTEP));
		return FALSE;
	}
	case 25: {
		if(core.attacker->is_status(STATUS_ATTACK_CANCELED)) {
			reset_phase(PHASE_DAMAGE_CAL);
			adjust_all();
			infos.phase = PHASE_DAMAGE;
			arg.step = 33;
			return FALSE;
		}
		return FALSE;
	}
	case 26: {
		// Duel.CalculateDamage() goes here
		uint32_t aa = core.attacker->get_attack(), ad = core.attacker->get_defense();
		uint32_t da = 0, dd = 0;
		uint8_t pa = core.attacker->current.controler, pd;
		core.attacker->set_status(STATUS_BATTLE_RESULT, FALSE);
		core.attacker->set_status(STATUS_BATTLE_DESTROYED, FALSE);
		if(core.attack_target) {
			da = core.attack_target->get_attack();
			dd = core.attack_target->get_defense();
			core.attack_target->set_status(STATUS_BATTLE_RESULT, FALSE);
			core.attack_target->set_status(STATUS_BATTLE_DESTROYED, FALSE);
			pd = core.attack_target->current.controler;
			if(pa != pd) {
				core.attacker->set_status(STATUS_OPPO_BATTLE, TRUE);
				core.attack_target->set_status(STATUS_OPPO_BATTLE, TRUE);
			}
		}
		effect* damchange = nullptr;
		card* reason_card = nullptr;
		std::array<bool, 2> bd;
		calculate_battle_damage(&damchange, &reason_card, &bd);
		if(bd[0]) {
			effect* indestructable_effect = core.attacker->is_affected_by_effect(EFFECT_INDESTRUCTABLE_BATTLE, core.attack_target);
			if(indestructable_effect) {
				auto message = pduel->new_message(MSG_HINT);
				message->write<uint8_t>(HINT_CARD);
				message->write<uint8_t>(0);
				message->write<uint64_t>(indestructable_effect->owner->data.code);
				bd[0] = false;
			} else
				core.attacker->set_status(STATUS_BATTLE_RESULT, TRUE);
		}
		if(bd[1]) {
			effect* indestructable_effect = core.attack_target->is_affected_by_effect(EFFECT_INDESTRUCTABLE_BATTLE, core.attacker);
			if(indestructable_effect) {
				auto message = pduel->new_message(MSG_HINT);
				message->write<uint8_t>(HINT_CARD);
				message->write<uint8_t>(0);
				message->write<uint64_t>(indestructable_effect->owner->data.code);
				bd[1] = false;
			} else
				core.attack_target->set_status(STATUS_BATTLE_RESULT, TRUE);
		}
		auto message = pduel->new_message(MSG_BATTLE);
		message->write(core.attacker->get_info_location());
		message->write<uint32_t>(aa);
		message->write<uint32_t>(ad);
		message->write<uint8_t>(bd[0]);
		if(core.attack_target) {
			message->write(core.attack_target->get_info_location());
			message->write<uint32_t>(da);
			message->write<uint32_t>(dd);
			message->write<uint8_t>(bd[1]);
		} else {
			message->write(loc_info{});
			message->write<uint32_t>(0);
			message->write<uint32_t>(0);
			message->write<uint8_t>(0);
		}
		arg.damage_change_effect = damchange;
		arg.reason_card = reason_card;
		if(reason_card)
			arg.reason_player = reason_card->current.controler;
		if(!damchange) {
			if(core.battle_damage[infos.turn_player]) {
				raise_single_event(core.attacker, nullptr, EVENT_PRE_BATTLE_DAMAGE, nullptr, 0, reason_card->current.controler, infos.turn_player, core.battle_damage[infos.turn_player]);
				if(core.attack_target)
					raise_single_event(core.attack_target, nullptr, EVENT_PRE_BATTLE_DAMAGE, nullptr, 0, reason_card->current.controler, infos.turn_player, core.battle_damage[infos.turn_player]);
				raise_event(reason_card, EVENT_PRE_BATTLE_DAMAGE, nullptr, 0, reason_card->current.controler, infos.turn_player, core.battle_damage[infos.turn_player]);
			}
			if(core.battle_damage[1 - infos.turn_player]) {
				raise_single_event(core.attacker, nullptr, EVENT_PRE_BATTLE_DAMAGE, nullptr, 0, reason_card->current.controler, 1 - infos.turn_player, core.battle_damage[1 - infos.turn_player]);
				if(core.attack_target)
					raise_single_event(core.attack_target, nullptr, EVENT_PRE_BATTLE_DAMAGE, nullptr, 0, reason_card->current.controler, 1 - infos.turn_player, core.battle_damage[1 - infos.turn_player]);
				raise_event(reason_card, EVENT_PRE_BATTLE_DAMAGE, nullptr, 0, reason_card->current.controler, 1 - infos.turn_player, core.battle_damage[1 - infos.turn_player]);
			}
		}
		process_single_event();
		process_instant_event();
		core.damage_calculated = true;
		return FALSE;
	}
	case 27: {
		infos.phase = PHASE_DAMAGE;
		core.hint_timing[infos.turn_player] = 0;
		core.chain_attack = false;
		core.attacker->battled_cards.addcard(core.attack_target);
		if(core.attack_target)
			core.attack_target->battled_cards.addcard(core.attacker);
		auto* reason_card = arg.reason_card;
		effect* damchange = std::exchange(arg.damage_change_effect, nullptr);
		if(!damchange) {
			if(core.battle_damage[0])
				damage(nullptr, REASON_BATTLE, arg.reason_player, reason_card, 0, core.battle_damage[0]);
			if(core.battle_damage[1])
				damage(nullptr, REASON_BATTLE, arg.reason_player, reason_card, 1, core.battle_damage[1]);
		} else {
			if(core.battle_damage[0])
				damage(damchange, REASON_EFFECT, arg.reason_player, reason_card, 0, core.battle_damage[0]);
			if(core.battle_damage[1])
				damage(damchange, REASON_EFFECT, arg.reason_player, reason_card, 1, core.battle_damage[1]);
		}
		reset_phase(PHASE_DAMAGE_CAL);
		adjust_all();
		return FALSE;
	}
	case 28: {
		card_set des;
		effect* peffect;
		if(core.attacker->is_status(STATUS_BATTLE_RESULT)
		        && core.attacker->current.location == LOCATION_MZONE && core.attacker->fieldid_r == core.pre_field[0]) {
			des.insert(core.attacker);
			core.attacker->temp.reason = core.attacker->current.reason;
			core.attacker->temp.reason_card = core.attacker->current.reason_card;
			core.attacker->temp.reason_effect = core.attacker->current.reason_effect;
			core.attacker->temp.reason_player = core.attacker->current.reason_player;
			core.attacker->current.reason_effect = nullptr;
			core.attacker->current.reason = REASON_BATTLE;
			core.attacker->current.reason_card = core.attack_target;
			core.attacker->current.reason_player = core.attack_target->current.controler;
			uint32_t dest = LOCATION_GRAVE;
			uint32_t seq = 0;
			if((peffect = core.attack_target->is_affected_by_effect(EFFECT_BATTLE_DESTROY_REDIRECT)) != nullptr && (core.attacker->data.type & TYPE_MONSTER)) {
				dest = peffect->get_value(core.attacker);
				seq = dest >> 16;
				dest &= 0xffff;
			}
			core.attacker->sendto_param.set(core.attacker->owner, POS_FACEUP, dest, seq);
			core.attacker->set_status(STATUS_DESTROY_CONFIRMED, TRUE);
		}
		if(core.attack_target && core.attack_target->is_status(STATUS_BATTLE_RESULT)
		        && core.attack_target->current.location == LOCATION_MZONE && core.attack_target->fieldid_r == core.pre_field[1]) {
			des.insert(core.attack_target);
			core.attack_target->temp.reason = core.attack_target->current.reason;
			core.attack_target->temp.reason_card = core.attack_target->current.reason_card;
			core.attack_target->temp.reason_effect = core.attack_target->current.reason_effect;
			core.attack_target->temp.reason_player = core.attack_target->current.reason_player;
			core.attack_target->current.reason_effect = nullptr;
			core.attack_target->current.reason = REASON_BATTLE;
			core.attack_target->current.reason_card = core.attacker;
			core.attack_target->current.reason_player = core.attacker->current.controler;
			uint32_t dest = LOCATION_GRAVE;
			uint32_t seq = 0;
			if((peffect = core.attacker->is_affected_by_effect(EFFECT_BATTLE_DESTROY_REDIRECT)) != nullptr && (core.attack_target->data.type & TYPE_MONSTER)) {
				dest = peffect->get_value(core.attack_target);
				seq = dest >> 16;
				dest &= 0xffff;
			}
			core.attack_target->sendto_param.set(core.attack_target->owner, POS_FACEUP, dest, seq);
			core.attack_target->set_status(STATUS_DESTROY_CONFIRMED, TRUE);
		}
		core.attacker->set_status(STATUS_BATTLE_RESULT, FALSE);
		if(core.attack_target)
			core.attack_target->set_status(STATUS_BATTLE_RESULT, FALSE);
		core.battle_destroy_rep.clear();
		core.desrep_chain.clear();
		if(des.size()) {
			auto ng = pduel->new_group();
			ng->container.swap(des);
			ng->is_readonly = true;
			emplace_process<Processors::Destroy>(Step{ 10 }, ng, nullptr, REASON_BATTLE, PLAYER_NONE);
			arg.cards_destroyed_by_battle = ng;
		}
		return FALSE;
	}
	case 29: {
		if(core.battle_destroy_rep.size())
			destroy(core.battle_destroy_rep, nullptr, REASON_EFFECT | REASON_REPLACE, PLAYER_NONE);
		if(core.desrep_chain.size())
			emplace_process<Processors::OperationReplace>(Step{ 15 }, nullptr, nullptr, nullptr, false);
		adjust_all();
		return FALSE;
	}
	case 30: {
		auto des = arg.cards_destroyed_by_battle;
		if(des && des->container.size()) {
			for(auto& pcard : des->container) {
				pcard->set_status(STATUS_BATTLE_DESTROYED, TRUE);
				pcard->set_status(STATUS_DESTROY_CONFIRMED, FALSE);
				pcard->filter_disable_related_cards();
			}
		}
		core.selfdes_disabled = false;
		adjust_all();
		if(is_flag(DUEL_6_STEP_BATLLE_STEP)) {
			//EVENT_BATTLE_END was here, but this timing does not exist in Master Rule 3+
			if(!core.effect_damage_step) {
				auto message = pduel->new_message(MSG_HINT);
				message->write<uint8_t>(HINT_EVENT);
				message->write<uint8_t>(0);
				message->write<uint64_t>(45);
				message = pduel->new_message(MSG_HINT);
				message->write<uint8_t>(HINT_EVENT);
				message->write<uint8_t>(1);
				message->write<uint64_t>(45);
				core.hint_timing[infos.turn_player] = TIMING_DAMAGE_CAL;
				emplace_process<Processors::PointEvent>(false, false, is_flag(DUEL_SINGLE_CHAIN_IN_DAMAGE_SUBSTEP));
			} else {
				break_effect();
			}
		}
		return FALSE;
	}
	case 31: {
		core.flip_delayed = false;
		core.new_fchain.splice(core.new_fchain.begin(), core.new_fchain_b);
		core.new_ochain.splice(core.new_ochain.begin(), core.new_ochain_b);
		raise_single_event(core.attacker, nullptr, EVENT_BATTLED, nullptr, 0, PLAYER_NONE, 0, 0);
		card_set battled_cards{ core.attacker };
		if(core.attack_target) {
			battled_cards.insert(core.attack_target);
			raise_single_event(core.attack_target, nullptr, EVENT_BATTLED, nullptr, 0, PLAYER_NONE, 0, 1);
		}
		raise_event(std::move(battled_cards), EVENT_BATTLED, nullptr, 0, PLAYER_NONE, 0, 0);
		process_single_event();
		process_instant_event();
		if(core.effect_damage_step) {
			if(core.reserved) {
				auto* damage_step = Processors::get_opt_variant<Processors::DamageStep>(*core.reserved);
				if(damage_step)
					damage_step->cards_destroyed_by_battle = arg.cards_destroyed_by_battle;
			}
			return TRUE;
		}
		arg.step = 32;
		[[fallthrough]];
	}
	case 32: {
		auto message = pduel->new_message(MSG_HINT);
		message->write<uint8_t>(HINT_EVENT);
		message->write<uint8_t>(0);
		message->write<uint64_t>(43);
		message = pduel->new_message(MSG_HINT);
		message->write<uint8_t>(HINT_EVENT);
		message->write<uint8_t>(1);
		message->write<uint64_t>(43);
		core.hint_timing[0] |= TIMING_BATTLED;
		core.hint_timing[1] |= TIMING_BATTLED;
		emplace_process<Processors::PointEvent>(false, false, is_flag(DUEL_SINGLE_CHAIN_IN_DAMAGE_SUBSTEP));
		return FALSE;
	}
	case 33: {
		auto des = arg.cards_destroyed_by_battle;
		if(des) {
			for(auto cit = des->container.begin(); cit != des->container.end();) {
				auto rm = cit++;
				if((*rm)->current.location != LOCATION_MZONE || ((*rm)->fieldid_r != core.pre_field[0] && (*rm)->fieldid_r != core.pre_field[1]))
					des->container.erase(rm);
			}
			emplace_process<Processors::Destroy>(Step{ 3 }, des, nullptr, REASON_BATTLE, PLAYER_NONE);
		}
		adjust_all();
		return FALSE;
	}
	case 34: {
		arg.cards_destroyed_by_battle = nullptr;
		// for unexpected end of damage step
		core.damage_calculated = true;
		core.selfdes_disabled = false;
		core.flip_delayed = false;
		core.new_fchain.splice(core.new_fchain.begin(), core.new_fchain_b);
		core.new_ochain.splice(core.new_ochain.begin(), core.new_ochain_b);
		card_set ing;
		card_set ed;
		if(core.attacker->is_status(STATUS_BATTLE_DESTROYED) && (core.attacker->current.reason & REASON_BATTLE)) {
			raise_single_event(core.attack_target, nullptr, EVENT_BATTLE_DESTROYING, nullptr, core.attacker->current.reason, core.attack_target->current.controler, 0, 1);
			raise_single_event(core.attacker, nullptr, EVENT_BATTLE_DESTROYED, nullptr, core.attacker->current.reason, core.attack_target->current.controler, 0, 0);
			raise_single_event(core.attacker, nullptr, EVENT_DESTROYED, nullptr, core.attacker->current.reason, core.attack_target->current.controler, 0, 0);
			ing.insert(core.attack_target);
			ed.insert(core.attacker);
		}
		if(core.attack_target && core.attack_target->is_status(STATUS_BATTLE_DESTROYED) && (core.attack_target->current.reason & REASON_BATTLE)) {
			raise_single_event(core.attacker, nullptr, EVENT_BATTLE_DESTROYING, nullptr, core.attack_target->current.reason, core.attacker->current.controler, 0, 0);
			raise_single_event(core.attack_target, nullptr, EVENT_BATTLE_DESTROYED, nullptr, core.attack_target->current.reason, core.attacker->current.controler, 0, 1);
			raise_single_event(core.attack_target, nullptr, EVENT_DESTROYED, nullptr, core.attack_target->current.reason, core.attacker->current.controler, 0, 1);
			ing.insert(core.attacker);
			ed.insert(core.attack_target);
		}
		if(ing.size())
			raise_event(std::move(ing), EVENT_BATTLE_DESTROYING, nullptr, 0, 0, 0, 0);
		if(ed.size()) {
			raise_event(ed, EVENT_BATTLE_DESTROYED, nullptr, 0, 0, 0, 0);
			raise_event(std::move(ed), EVENT_DESTROYED, nullptr, 0, 0, 0, 0);
		}
		raise_single_event(core.attacker, nullptr, EVENT_DAMAGE_STEP_END, nullptr, 0, 0, 0, 0);
		if(core.attack_target)
			raise_single_event(core.attack_target, nullptr, EVENT_DAMAGE_STEP_END, nullptr, 0, 0, 0, 1);
		raise_event(nullptr, EVENT_DAMAGE_STEP_END, nullptr, 0, 0, 0, 0);
		core.attacker->set_status(STATUS_BATTLE_DESTROYED, FALSE);
		if(core.attack_target)
			core.attack_target->set_status(STATUS_BATTLE_DESTROYED, FALSE);
		process_single_event();
		process_instant_event();
		auto message = pduel->new_message(MSG_HINT);
		message->write<uint8_t>(HINT_EVENT);
		message->write<uint8_t>(0);
		message->write<uint64_t>(44);
		message = pduel->new_message(MSG_HINT);
		message->write<uint8_t>(HINT_EVENT);
		message->write<uint8_t>(1);
		message->write<uint64_t>(44);
		emplace_process<Processors::PointEvent>(false, false, true);
		arg.step = 38;
		return FALSE;
	}
	case 38: {
		return FALSE;
	}
	case 39: {
		//end of damage step
		core.attacker->set_status(STATUS_OPPO_BATTLE, FALSE);
		if(core.attack_target)
			core.attack_target->set_status(STATUS_OPPO_BATTLE, FALSE);
		if(arg.forced_attack) {
			arg.forced_attack_done = true;
			arg.step = 0;
		} else
			arg.step = Processors::restart;
		infos.phase = PHASE_BATTLE_STEP;
		pduel->new_message(MSG_DAMAGE_STEP_END);
		reset_phase(PHASE_DAMAGE);
		adjust_all();
		if(core.effect_damage_step)
			return TRUE;
		return FALSE;
	}
	case 40: {
		for(auto& ch_lim : core.chain_limit)
			ensure_luaL_stack(luaL_unref, pduel->lua->lua_state, LUA_REGISTRYINDEX, ch_lim.function);
		core.chain_limit.clear();
		if(core.current_chain.size()) {
			for(auto& ch : core.current_chain)
				ch.triggering_effect->get_handler()->set_status(STATUS_CHAINING, FALSE);
			emplace_process<Processors::SolveChain>(false, false, false);
			if(!arg.forced_attack)
				arg.step = Processors::restart;
			return FALSE;
		}
		reset_phase(PHASE_BATTLE_STEP);
		adjust_all();
		return FALSE;
	}
	case 41: {
		// normal end of battle step
		arg.second_battle_phase_is_optional = true;
		effect_set eset;
		filter_player_effect(infos.turn_player, EFFECT_BP_TWICE, &eset, false);
		for(const auto& peff : eset) {
			if(!peff->value || peff->get_value() != 1) {
				arg.second_battle_phase_is_optional = false;
				break;
			}
		}
		arg.repeat_battle_phase = !eset.empty();
		infos.phase = PHASE_BATTLE;
		emplace_process<Processors::PhaseEvent>(PHASE_BATTLE);
		adjust_all();
		return FALSE;
	}
	case 42: {
		core.attacker = nullptr;
		core.attack_target = nullptr;
		if(arg.repeat_battle_phase && arg.second_battle_phase_is_optional) {
			emplace_process<Processors::SelectYesNo>(infos.turn_player, 32);
			return FALSE;
		}
		returns.set<int32_t>(0, arg.phase_to_change_to);
		returns.set<int32_t>(1, arg.repeat_battle_phase);
		return TRUE;
	}
	case 43: {
		auto bp_twice = returns.at<int32_t>(0);
		returns.set<int32_t>(0, arg.phase_to_change_to);
		returns.set<int32_t>(1, bp_twice);
		return TRUE;
	}
	}
	return TRUE;
}
*/