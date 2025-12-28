bool field::process(Processors::SolveChain& arg) {
	auto step = arg.step;
	if(core.current_chain.size() == 0 && step == 0)
		return TRUE;
	auto cait = core.current_chain.rbegin();
	switch(step) {
	case 0: {
		if(core.spsummon_rst) {
			if(is_flag(DUEL_CANNOT_SUMMON_OATH_OLD)) {
				set_spsummon_counter(0, false, true);
				set_spsummon_counter(1, false, true);
				core.spsummon_rst = false;
			}
			if(is_flag(DUEL_SPSUMMON_ONCE_OLD_NEGATE)) {
				for(int plr = 0; plr < 2; ++plr) {
					for(auto& iter : core.spsummon_once_map[plr]) {
						auto spcode = iter.first;
						core.spsummon_once_map[plr][spcode] -= core.spsummon_once_map_rst[plr][spcode];
						core.spsummon_once_map_rst[plr][spcode] = 0;
					}
				}
			}
		}
		auto message = pduel->new_message(MSG_CHAIN_SOLVING);
		message->write<uint8_t>(cait->chain_count);
		add_to_disable_check_list(cait->triggering_effect->get_handler());
		adjust_instant();
		raise_event(nullptr, EVENT_CHAIN_ACTIVATING, cait->triggering_effect, 0, cait->triggering_player, cait->triggering_player, cait->chain_count);
		process_instant_event();
		return FALSE;
	}
	case 1: {
		effect* peffect = cait->triggering_effect;
		if(cait->flag & CHAIN_DISABLE_ACTIVATE && is_chain_negatable(cait->chain_count)) {
			remove_oath_effect(peffect);
			if(peffect->is_flag(EFFECT_FLAG_COUNT_LIMIT) && (peffect->count_flag & EFFECT_COUNT_CODE_OATH)) {
				dec_effect_code(peffect->count_code, peffect->count_flag, peffect->count_hopt_index, cait->triggering_player);
			}
			if(cait->applied_chain_counters != nullptr) {
				restore_chain_counter(cait->triggering_player, *cait->applied_chain_counters);
				delete cait->applied_chain_counters;
				cait->applied_chain_counters = nullptr;
			}
			core.new_fchain.remove_if([chaincount = cait->chain_count](const chain& ch) { return ch.evt.event_code == EVENT_CHAINING && ch.evt.event_value == chaincount; });
			core.new_ochain.remove_if([chaincount = cait->chain_count](const chain& ch) { return ch.evt.event_code == EVENT_CHAINING && ch.evt.event_value == chaincount; });
			raise_event(nullptr, EVENT_CHAIN_NEGATED, peffect, 0, cait->triggering_player, cait->triggering_player, cait->chain_count);
			process_instant_event();
			arg.step = 9;
			return FALSE;
		}
		if(cait->applied_chain_counters != nullptr) {
			delete cait->applied_chain_counters;
			cait->applied_chain_counters = nullptr;
		}
		release_oath_relation(peffect);
		break_effect();
		core.chain_solving = true;
		raise_event(nullptr, EVENT_CHAIN_SOLVING, peffect, 0, cait->triggering_player, cait->triggering_player, cait->chain_count);
		process_instant_event();
		return FALSE;
	}
	case 2: {
		core.spsummon_state_count_tmp[0] = core.spsummon_state_count[0];
		core.spsummon_state_count_tmp[1] = core.spsummon_state_count[1];
		effect* peffect = cait->triggering_effect;
		card* pcard = peffect->get_handler();
		if((cait->flag & CHAIN_CONTINUOUS_CARD) && !pcard->is_has_relation(*cait)) {
			arg.step = 3;
			return FALSE;
		}
		if((peffect->type & EFFECT_TYPE_ACTIVATE) && pcard->is_has_relation(*cait) && !cait->replace_op) {
			pcard->enable_field_effect(true);
			if(is_flag(DUEL_1_FACEUP_FIELD)) {
				if(pcard->data.type & TYPE_FIELD) {
					card* fscard = player[1 - pcard->current.controler].list_szone[5];
					if(fscard && fscard->is_position(POS_FACEUP))
						fscard->enable_field_effect(false);
				}
			}
			adjust_instant();
		}
		// creating continuous target: peffect->is_flag(EFFECT_FLAG_CONTINUOUS_TARGET) && !cait->replace_op
		// operation function creating continuous target should be executed even when disabled
		if(is_chain_disablable(cait->chain_count) && (!peffect->is_flag(EFFECT_FLAG_CONTINUOUS_TARGET) || cait->replace_op)) {
			if(is_chain_disabled(cait->chain_count) || (pcard->get_status(STATUS_DISABLED | STATUS_FORBIDDEN) && pcard->is_has_relation(*cait))) {
				if(!(cait->flag & CHAIN_DISABLE_EFFECT)) {
					auto message = pduel->new_message(MSG_CHAIN_DISABLED);
					message->write<uint8_t>(cait->chain_count);
				}
				raise_event(nullptr, EVENT_CHAIN_DISABLED, peffect, 0, cait->triggering_player, cait->triggering_player, cait->chain_count);
				process_instant_event();
				arg.step = 3;
				return FALSE;
			}
		}
		return FALSE;
	}
	case 3 : {
		effect* peffect = cait->triggering_effect;
		card* pcard = peffect->get_handler();
		if((cait->flag & CHAIN_CONTINUOUS_CARD) && !pcard->is_has_relation(*cait)){
			return FALSE;
		}
		if(cait->replace_op) {
			arg.backed_up_operation = cait->triggering_effect->operation;
			cait->triggering_effect->operation = cait->replace_op;
		} else
			arg.backed_up_operation = 0;
		if(cait->triggering_effect->operation) {
			core.sub_solving_event.push_back(cait->evt);
			emplace_process<Processors::ExecuteOperation>(cait->triggering_effect, cait->triggering_player);
		}
		return FALSE;
	}
	case 4: {
		effect* peffect = cait->triggering_effect;
		if(arg.backed_up_operation) {
			if(peffect->operation != 0)
				ensure_luaL_stack(luaL_unref, pduel->lua->lua_state, LUA_REGISTRYINDEX, peffect->operation);
			peffect->operation = arg.backed_up_operation;
		}
		core.special_summoning.clear();
		core.equiping_cards.clear();
		return FALSE;
	}
	case 5: {
		if(std::exchange(arg.backed_up_operation, 0) == 0) {
			if(cait->opinfos.count(0x200) && cait->opinfos[0x200].op_count) {
				if(is_flag(DUEL_CANNOT_SUMMON_OATH_OLD)) {
					if(core.spsummon_state_count_tmp[cait->triggering_player] == core.spsummon_state_count[cait->triggering_player])
						set_spsummon_counter(cait->triggering_player);
					if(cait->opinfos[0x200].op_player == PLAYER_ALL && core.spsummon_state_count_tmp[1 - cait->triggering_player] == core.spsummon_state_count[1 - cait->triggering_player])
						set_spsummon_counter(1 - cait->triggering_player);
				}
				if(is_flag(DUEL_CANNOT_SUMMON_OATH_OLD)) {
					//sometimes it may add twice, only works for once per turn
					auto& optarget = cait->opinfos[0x200];
					if(optarget.op_cards) {
						if(optarget.op_player == PLAYER_ALL) {
							uint32_t sumplayer = optarget.op_param;
							if(is_flag(DUEL_SPSUMMON_ONCE_OLD_NEGATE) && (core.global_flag & GLOBALFLAG_SPSUMMON_ONCE)) {
								auto opit = optarget.op_cards->container.begin();
								if((*opit)->spsummon_code)
									++core.spsummon_once_map[sumplayer][(*opit)->spsummon_code];
								++opit;
								if((*opit)->spsummon_code)
									++core.spsummon_once_map[1 - sumplayer][(*opit)->spsummon_code];
							}
							auto opit = optarget.op_cards->container.begin();
							check_card_counter(*opit, ACTIVITY_SPSUMMON, sumplayer);
							++opit;
							check_card_counter(*opit, ACTIVITY_SPSUMMON, 1 - sumplayer);
						} else {
							uint32_t sumplayer = cait->triggering_player;
							// genarally setting op_player is unnecessary when the effect targets cards
							// in the case of CATEGORY_SPECIAL_SUMMON(with EFFECT_FLAG_CARD_TARGET), op_player=0x10
							// indecates that it is the opponent that special summons the target monsters
							if(cait->triggering_effect->is_flag(EFFECT_FLAG_CARD_TARGET) && optarget.op_player == 0x10)
								sumplayer = 1 - sumplayer;
							for(auto& ptarget : optarget.op_cards->container) {
								if(is_flag(DUEL_SPSUMMON_ONCE_OLD_NEGATE) && (core.global_flag & GLOBALFLAG_SPSUMMON_ONCE) && ptarget->spsummon_code)
									++core.spsummon_once_map[sumplayer][ptarget->spsummon_code];
								check_card_counter(ptarget, ACTIVITY_SPSUMMON, sumplayer);
							}
						}
					}
				}
			}
		}
		core.spsummon_state_count_tmp[0] = 0;
		core.spsummon_state_count_tmp[1] = 0;
		core.chain_solving = false;
		if(core.delayed_continuous_tp.size()) {
			core.conti_player = infos.turn_player;
			core.sub_solving_continuous.splice(core.sub_solving_continuous.end(), core.delayed_continuous_tp, core.delayed_continuous_tp.begin());
			emplace_process<Processors::SolveContinuous>();
		} else if(core.delayed_continuous_ntp.size()) {
			core.conti_player = 1 - infos.turn_player;
			core.sub_solving_continuous.splice(core.sub_solving_continuous.end(), core.delayed_continuous_ntp, core.delayed_continuous_ntp.begin());
			emplace_process<Processors::SolveContinuous>();
		} else
			core.conti_player = PLAYER_NONE;
		raise_event(nullptr, EVENT_CHAIN_SOLVED, cait->triggering_effect, 0, cait->triggering_player, cait->triggering_player, cait->chain_count);
		adjust_disable_check_list();
		process_instant_event();
		arg.step = 9;
		return FALSE;
	}
	case 10: {
		auto message = pduel->new_message(MSG_CHAIN_SOLVED);
		message->write<uint8_t>(cait->chain_count);
		effect* peffect = cait->triggering_effect;
		card* pcard = peffect->get_handler();
		if((peffect->type & EFFECT_TYPE_ACTIVATE) && (cait->flag & CHAIN_ACTIVATING))
			peffect->type &= ~EFFECT_TYPE_ACTIVATE;
		if((cait->flag & CHAIN_HAND_EFFECT) && !pcard->is_position(POS_FACEUP) && (pcard->current.location == LOCATION_HAND))
			shuffle(pcard->current.controler, LOCATION_HAND);
		if(cait->target_cards && cait->target_cards->container.size()) {
			for(auto& ptarget : cait->target_cards->container)
				ptarget->release_relation(*cait);
		}
		if((pcard->data.type & TYPE_EQUIP) && (peffect->type & EFFECT_TYPE_ACTIVATE)
			&& !pcard->equiping_target && pcard->is_has_relation(*cait))
			pcard->set_status(STATUS_LEAVE_CONFIRMED, TRUE);
		if(is_flag(DUEL_1_FACEUP_FIELD)) {
			if((pcard->data.type & TYPE_FIELD) && (peffect->type & EFFECT_TYPE_ACTIVATE)
					&& !pcard->is_status(STATUS_LEAVE_CONFIRMED) && pcard->is_has_relation(*cait)) {
				card* fscard = player[1 - pcard->current.controler].list_szone[5];
				if(fscard && fscard->is_position(POS_FACEUP))
					destroy(fscard, nullptr, REASON_RULE, 1 - pcard->current.controler);
			}
		}
		peffect->active_type = 0;
		peffect->active_handler = nullptr;
		pcard->release_relation(*cait);
		for(auto& cit : core.delayed_enable_set) {
			if(cit->current.location == LOCATION_MZONE)
				cit->enable_field_effect(true);
		}
		core.delayed_enable_set.clear();
		adjust_all();
		core.current_chain.pop_back();
		if(--core.real_chain_count < 0)
			core.real_chain_count = 0;
		if(!core.current_chain.size()) {
			for(auto& ch_lim : core.chain_limit)
				ensure_luaL_stack(luaL_unref, pduel->lua->lua_state, LUA_REGISTRYINDEX, ch_lim.function);
			core.chain_limit.clear();
			return FALSE;
		}
		if((core.summoning_card || core.summoning_proc_group_type) && core.reserved)
			core.subunits.push_back(*std::exchange(core.reserved, std::nullopt));
		core.summoning_card = nullptr;
		core.summoning_proc_group_type = 0;
		arg.step = Processors::restart;
		return FALSE;
	}
	case 11: {
		for(auto cit = core.leave_confirmed.begin(); cit != core.leave_confirmed.end();) {
			auto rm = cit++;
			if(!(*rm)->is_status(STATUS_LEAVE_CONFIRMED))
				core.leave_confirmed.erase(rm);
		}
		if(core.leave_confirmed.size())
			send_to(core.leave_confirmed, nullptr, REASON_RULE, PLAYER_NONE, PLAYER_NONE, LOCATION_GRAVE, 0, POS_FACEUP);
		return FALSE;
	}
	case 12: {
		core.used_event.splice(core.used_event.end(), core.point_event);
		pduel->new_message(MSG_CHAIN_END);
		reset_chain();
		if((core.summoning_card || core.summoning_proc_group_type || core.effect_damage_step == 1) && core.reserved)
			core.subunits.push_back(*std::exchange(core.reserved, std::nullopt));
		core.summoning_proc_group_type = 0;
		core.summoning_card = nullptr;
		return FALSE;
	}
	case 13: {
		core.just_sent_cards.clear();
		raise_event(nullptr, EVENT_CHAIN_END, nullptr, 0, 0, 0, 0);
		process_instant_event();
		adjust_all();
		if(!arg.skip_trigger || !arg.skip_new) {
			core.hint_timing[0] |= TIMING_CHAIN_END;
			core.hint_timing[1] |= TIMING_CHAIN_END;
			emplace_process<Processors::PointEvent>(arg.skip_trigger, arg.skip_freechain || arg.skip_new, arg.skip_new);
		}
		returns.set<int32_t>(0, TRUE);
		return TRUE;
	}
	}
	return TRUE;
}
int32_t field::break_effect(bool clear_sent) {
	if(clear_sent)
		core.just_sent_cards.clear();
	core.hint_timing[0] &= TIMING_DAMAGE_STEP | TIMING_DAMAGE_CAL;
	core.hint_timing[1] &= TIMING_DAMAGE_STEP | TIMING_DAMAGE_CAL;
	for (auto chit = core.new_ochain.begin(); chit != core.new_ochain.end();) {
		auto rm = chit++;
		effect* peffect = rm->triggering_effect;
		if (!peffect->is_flag(EFFECT_FLAG_DELAY)) {
			if (peffect->is_flag(EFFECT_FLAG_FIELD_ONLY)
			        || !(peffect->type & EFFECT_TYPE_FIELD) || peffect->in_range(*rm)) {
				auto message = pduel->new_message(MSG_MISSED_EFFECT);
				message->write(peffect->get_handler()->get_info_location());
				message->write<uint32_t>(peffect->get_handler()->data.code);
			}
			core.new_ochain.erase(rm);
		}
	}
	core.used_event.splice(core.used_event.end(), core.instant_event);
	adjust_instant();
	if(!is_flag(DUEL_RELAY) && !core.force_turn_end) {
		uint32_t winp = 5, rea = 1;
		if(player[0].lp <= 0 && player[1].lp > 0 && !is_player_affected_by_effect(0, EFFECT_CANNOT_LOSE_LP)) {
			winp = 1;
			rea = 1;
		}
		if(core.overdraw[0] && !core.overdraw[1] && !is_player_affected_by_effect(0, EFFECT_CANNOT_LOSE_DECK)) {
			winp = 1;
			rea = 2;
		}
		if(player[1].lp <= 0 && player[0].lp > 0 && !is_player_affected_by_effect(1, EFFECT_CANNOT_LOSE_LP)) {
			winp = 0;
			rea = 1;
		}
		if(core.overdraw[1] && !core.overdraw[0] && !is_player_affected_by_effect(1, EFFECT_CANNOT_LOSE_DECK)) {
			winp = 0;
			rea = 2;
		}
		if(player[1].lp <= 0 && player[0].lp <= 0 && !(is_player_affected_by_effect(0, EFFECT_CANNOT_LOSE_LP) && is_player_affected_by_effect(1, EFFECT_CANNOT_LOSE_LP))) {
			if(is_player_affected_by_effect(0, EFFECT_CANNOT_LOSE_LP))
				winp = 0;
			else if(is_player_affected_by_effect(1, EFFECT_CANNOT_LOSE_LP))
				winp = 1;
			else
				winp = PLAYER_NONE;
			rea = 1;
		}
		if(core.overdraw[1] && core.overdraw[0] && !(is_player_affected_by_effect(0, EFFECT_CANNOT_LOSE_DECK) && is_player_affected_by_effect(1, EFFECT_CANNOT_LOSE_DECK))) {
			if(is_player_affected_by_effect(0, EFFECT_CANNOT_LOSE_DECK))
				winp = 0;
			else if(is_player_affected_by_effect(1, EFFECT_CANNOT_LOSE_DECK))
				winp = 1;
			else
				winp = PLAYER_NONE;
			rea = 2;
		}
		if(winp != 5) {
			auto message = pduel->new_message(MSG_WIN);
			message->write<uint8_t>(winp);
			message->write<uint8_t>(rea);
			core.overdraw[0] = core.overdraw[1] = false;
			core.win_player = 5;
			core.win_reason = 0;
		} else if(core.win_player != 5) {
			auto message = pduel->new_message(MSG_WIN);
			message->write<uint8_t>(core.win_player);
			message->write<uint8_t>(core.win_reason);
			core.win_player = 5;
			core.win_reason = 0;
			core.overdraw[0] = core.overdraw[1] = false;
		}
	}
	return 0;
}
void field::adjust_instant() {
	++infos.event_id;
	adjust_disable_check_list();
	adjust_self_destroy_set();
}
void field::adjust_all() {
	++infos.event_id;
	core.readjust_map.clear();
	emplace_process<Processors::Adjust>();
}
void field::refresh_location_info_instant() {
	effect_set eset;
	uint32_t dis1 = player[0].disabled_location | (player[1].disabled_location << 16);
	player[0].disabled_location = 0;
	player[1].disabled_location = 0;
	filter_field_effect(EFFECT_DISABLE_FIELD, &eset);
	for(const auto& peff : eset) {
		uint32_t value = peff->get_value();
		player[0].disabled_location |= value & 0xff7f;
		player[1].disabled_location |= (value >> 16) & 0xff7f;
	}
	eset.clear();
	filter_field_effect(EFFECT_USE_EXTRA_MZONE, &eset);
	for(const auto& peff : eset) {
		uint32_t p = peff->get_handler_player();
		uint32_t value = peff->get_value();
		player[p].disabled_location |= (value >> 16) & 0x1f;
	}
	eset.clear();
	filter_field_effect(EFFECT_USE_EXTRA_SZONE, &eset);
	for(const auto& peff : eset) {
		uint32_t p = peff->get_handler_player();
		uint32_t value = peff->get_value();
		player[p].disabled_location |= (value >> 8) & 0x1f00;
	}
	player[0].disabled_location |= (((player[1].disabled_location >> 5) & 1) << 6) | (((player[1].disabled_location >> 6) & 1) << 5);
	player[1].disabled_location |= (((player[0].disabled_location >> 5) & 1) << 6) | (((player[0].disabled_location >> 6) & 1) << 5);
	uint32_t dis2 = player[0].disabled_location | (player[1].disabled_location << 16);
	if(dis1 != dis2) {
		auto message = pduel->new_message(MSG_FIELD_DISABLED);
		message->write<uint32_t>(dis2);
	}
}
