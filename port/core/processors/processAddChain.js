bool field::process(Processors::AddChain& arg) {
	switch (arg.step) {
	case 0: {
		if (!core.new_chains.size())
			return TRUE;
		auto& clit = core.new_chains.front();
		effect* peffect = clit.triggering_effect;
		arg.is_activated_effect = false;
		// if it's an activate effect, go to subroutine checking for effects allowing the card
		// to be activated even when it shouldn't normally (the turn it was set, from the hand, etc)
		if((peffect->type & EFFECT_TYPE_ACTIVATE) != 0)
			arg.step = 9;
		return FALSE;
	}
	case 1: {
		auto& clit = core.new_chains.front();
		effect_set eset;
		filter_player_effect(clit.triggering_player, EFFECT_ACTIVATE_COST, &eset);
		for(const auto& peff : eset) {
			pduel->lua->add_param<LuaParam::EFFECT>(peff);
			pduel->lua->add_param<LuaParam::EFFECT>(clit.triggering_effect);
			pduel->lua->add_param<LuaParam::INT>(clit.triggering_player);
			if(!pduel->lua->check_condition(peff->target, 3))
				continue;
			if(peff->operation) {
				core.sub_solving_event.push_back(clit.evt);
				emplace_process<Processors::ExecuteOperation>(peff, clit.triggering_player);
			}
		}
		if(!arg.is_activated_effect)
			return FALSE;
		effect* peffect = clit.triggering_effect;
		card* phandler = peffect->get_handler();
		phandler->set_status(STATUS_ACT_FROM_HAND, phandler->current.location == LOCATION_HAND);
		if(phandler->current.location == LOCATION_SZONE) {
			change_position(phandler, nullptr, phandler->current.controler, POS_FACEUP, 0);
		} else {
			uint32_t zone = 0xff;
			if(!(phandler->data.type & (TYPE_FIELD | TYPE_PENDULUM)) && peffect->is_flag(EFFECT_FLAG_LIMIT_ZONE)) {
				pduel->lua->add_param<LuaParam::INT>(clit.triggering_player);
				pduel->lua->add_param<LuaParam::GROUP>(clit.evt.event_cards);
				pduel->lua->add_param<LuaParam::INT>(clit.evt.event_player);
				pduel->lua->add_param<LuaParam::INT>(clit.evt.event_value);
				pduel->lua->add_param<LuaParam::EFFECT>(clit.evt.reason_effect);
				pduel->lua->add_param<LuaParam::INT>(clit.evt.reason);
				pduel->lua->add_param<LuaParam::INT>(clit.evt.reason_player);
				zone = peffect->get_value(7);
				if(!zone)
					return TRUE;
			}
			int32_t loc = LOCATION_SZONE;
			if(peffect->is_flag(EFFECT_FLAG2_FORCE_ACTIVATE_LOCATION)) {
				loc = peffect->get_value();
				if(!loc)
					return TRUE;
			} else if(phandler->current.location == LOCATION_HAND) {
				if(phandler->data.type & TYPE_PENDULUM) {
					loc = LOCATION_PZONE;
				} else if(phandler->data.type & TYPE_FIELD) {
					loc = LOCATION_FZONE;
				}
			}
			phandler->enable_field_effect(false);
			move_to_field(phandler, phandler->current.controler, phandler->current.controler, loc, (loc == LOCATION_MZONE) ? POS_FACEUP_ATTACK : POS_FACEUP, FALSE, 0, zone);
		}
		return FALSE;
	}
	case 2: {
		auto& clit = core.new_chains.front();
		effect* peffect = clit.triggering_effect;
		card* phandler = peffect->get_handler();
		if(peffect->type & EFFECT_TYPE_ACTIVATE) {
			clit.set_triggering_state(phandler);
		}
		auto message = pduel->new_message(MSG_CHAINING);
		message->write<uint32_t>(phandler->data.code);
		message->write(phandler->get_info_location());
		message->write<uint8_t>(clit.triggering_controler);
		message->write<uint8_t>((uint8_t)clit.triggering_location);
		message->write<uint32_t>(clit.triggering_sequence);
		message->write<uint64_t>(peffect->description);
		message->write<uint32_t>(core.current_chain.size() + 1);
		for(auto& ch_lim : core.chain_limit)
			ensure_luaL_stack(luaL_unref, pduel->lua->lua_state, LUA_REGISTRYINDEX, ch_lim.function);
		core.chain_limit.clear();
		peffect->card_type = phandler->get_type();
		if((peffect->card_type & (TYPE_TRAP | TYPE_MONSTER)) == (TYPE_TRAP | TYPE_MONSTER))
			peffect->card_type -= TYPE_TRAP;
		if(is_flag(DUEL_TRIGGER_WHEN_PRIVATE_KNOWLEDGE)) {
			if(!((peffect->type & EFFECT_TYPE_CONTINUOUS) == 0 && (peffect->type & EFFECT_TYPE_SINGLE) != 0))
				peffect->set_active_type();
		} else
			peffect->set_active_type();
		peffect->active_handler = peffect->handler->overlay_target;
		clit.chain_count = static_cast<uint8_t>(core.current_chain.size()) + 1;
		clit.target_cards = nullptr;
		clit.target_player = PLAYER_NONE;
		clit.target_param = 0;
		clit.disable_reason = nullptr;
		clit.disable_player = PLAYER_NONE;
		clit.replace_op = 0;
		if(phandler->current.location == LOCATION_HAND)
			clit.flag |= CHAIN_HAND_EFFECT;
		core.current_chain.push_back(clit);
		core.current_chain.back().applied_chain_counters = check_chain_counter(peffect, clit.triggering_player, clit.chain_count);
		// triggered events which are not caused by RaiseEvent create relation with the handler
		if(!peffect->is_flag(EFFECT_FLAG_FIELD_ONLY) && (!(peffect->type & 0x2a0) || (peffect->code & 0xfffff000u) == EVENT_PHASE)) {
			phandler->create_relation(clit);
		}
		peffect->effect_owner = clit.triggering_player;
		// DISABLE_CHAIN should be check before cost
		effect* deffect;
		if(!peffect->is_flag(EFFECT_FLAG_FIELD_ONLY) && phandler->is_has_relation(clit) && (deffect = phandler->is_affected_by_effect(EFFECT_DISABLE_EFFECT)) != nullptr) {
			effect* negeff = pduel->new_effect();
			negeff->owner = deffect->owner;
			negeff->type = EFFECT_TYPE_SINGLE;
			negeff->code = EFFECT_DISABLE_CHAIN;
			negeff->value = clit.chain_id;
			negeff->reset_flag = RESET_CHAIN | RESET_EVENT | deffect->get_value();
			phandler->add_effect(negeff);
		}
		core.new_chains.pop_front();
		return FALSE;
	}
	case 3: {
		auto& clit = core.current_chain.back();
		int32_t playerid = clit.triggering_player;
		effect* peffect = clit.triggering_effect;
		if(!is_flag(DUEL_USE_TRAPS_IN_NEW_CHAIN) && get_cteffect(peffect, playerid, TRUE)) {
			const bool damage_step = infos.phase == PHASE_DAMAGE && !peffect->is_flag(EFFECT_FLAG_DAMAGE_STEP);
			const bool damage_cal = infos.phase == PHASE_DAMAGE_CAL && !peffect->is_flag(EFFECT_FLAG_DAMAGE_CAL);
			if(damage_step || damage_cal) {
				returns.set<int32_t>(0, TRUE);
				return FALSE;
			}
			emplace_process<Processors::SelectEffectYesNo>(playerid, 94, peffect->get_handler());
		} else
			returns.set<int32_t>(0, FALSE);
		return FALSE;
	}
	case 4: {
		if(!returns.at<int32_t>(0)) {
			core.select_chains.clear();
			core.select_options.clear();
			arg.step = 5;
			return FALSE;
		}
		if(core.select_chains.size() > 1) {
			auto& clit = core.current_chain.back();
			emplace_process<Processors::SelectOption>(clit.triggering_player);
		} else
			returns.set<int32_t>(0, 0);
		return FALSE;
	}
	case 5: {
		auto& clit = core.current_chain.back();
		auto ch = std::next(core.select_chains.begin(), returns.at<int32_t>(0));
		int32_t playerid = clit.triggering_player;
		effect* peffect = ch->triggering_effect;
		card* phandler = peffect->get_handler();
		auto message = pduel->new_message(MSG_HINT);
		message->write<uint8_t>(HINT_OPSELECTED);
		message->write<uint8_t>(playerid);
		message->write<uint64_t>(returns.at<int32_t>(0) >= (int32_t)core.select_options.size() ? core.select_options[returns.at<int32_t>(0)] : 65);
		clit.triggering_effect = peffect;
		clit.evt = ch->evt;
		phandler->create_relation(clit);
		peffect->dec_count(playerid);
		if(!(peffect->type & EFFECT_TYPE_ACTIVATE)) {
			peffect->type |= EFFECT_TYPE_ACTIVATE;
			clit.flag |= CHAIN_ACTIVATING;
		}
		core.select_chains.clear();
		core.select_options.clear();
		effect* deffect = pduel->new_effect();
		deffect->owner = phandler;
		deffect->code = 0;
		deffect->type = EFFECT_TYPE_SINGLE;
		deffect->flag[0] = EFFECT_FLAG_CANNOT_DISABLE | EFFECT_FLAG_CLIENT_HINT;
		deffect->description = 65;
		deffect->reset_flag = RESET_CHAIN;
		phandler->add_effect(deffect);
		return FALSE;
	}
	case 6: {
		auto& clit = core.current_chain.back();
		effect* peffect = clit.triggering_effect;
		if(peffect->cost) {
			core.sub_solving_event.push_back(clit.evt);
			emplace_process<Processors::ExecuteCost>(peffect, clit.triggering_player);
		}
		return FALSE;
	}
	case 7: {
		auto& clit = core.current_chain.back();
		effect* peffect = clit.triggering_effect;
		if(peffect->target) {
			core.sub_solving_event.push_back(clit.evt);
			emplace_process<Processors::ExecuteTarget>(peffect, clit.triggering_player);
		}
		return FALSE;
	}
	case 8: {
		break_effect(false);
		auto& clit = core.current_chain.back();
		effect* peffect = clit.triggering_effect;
		card* phandler = peffect->get_handler();
		if(clit.target_cards && clit.target_cards->container.size()) {
			if(peffect->is_flag(EFFECT_FLAG_CARD_TARGET)) {
				for(auto& pcard : clit.target_cards->container)
					raise_single_event(pcard, nullptr, EVENT_BECOME_TARGET, peffect, 0, clit.triggering_player, 0, clit.chain_count);
				process_single_event();
				if(clit.target_cards->container.size())
					raise_event(clit.target_cards->container, EVENT_BECOME_TARGET, peffect, 0, clit.triggering_player, clit.triggering_player, clit.chain_count);
			}
		}
		if(peffect->type & EFFECT_TYPE_ACTIVATE) {
			core.leave_confirmed.insert(phandler);
			if(!(phandler->data.type & (TYPE_CONTINUOUS | TYPE_FIELD | TYPE_EQUIP | TYPE_PENDULUM | TYPE_LINK))
			        && !phandler->is_affected_by_effect(EFFECT_REMAIN_FIELD))
				phandler->set_status(STATUS_LEAVE_CONFIRMED, TRUE);
		}
		if((phandler->get_type() & (TYPE_SPELL | TYPE_TRAP))
				&& (phandler->get_type() & (TYPE_CONTINUOUS | TYPE_FIELD | TYPE_EQUIP | TYPE_PENDULUM | TYPE_LINK))
				&& phandler->is_has_relation(clit) && phandler->current.location == LOCATION_SZONE
				&& !peffect->is_flag(EFFECT_FLAG_FIELD_ONLY))
			clit.flag |= CHAIN_CONTINUOUS_CARD;
		core.phase_action = true;
		if(clit.opinfos.count(0x200) && clit.opinfos[0x200].op_count) {
			if(is_flag(DUEL_CANNOT_SUMMON_OATH_OLD)) {
				core.spsummon_rst = true;
				set_spsummon_counter(clit.triggering_player, true, true);
				if(clit.opinfos[0x200].op_player == PLAYER_ALL)
					set_spsummon_counter(1 - clit.triggering_player, true, true);
			}
			if(is_flag(DUEL_SPSUMMON_ONCE_OLD_NEGATE) && (core.global_flag & GLOBALFLAG_SPSUMMON_ONCE)) {
				auto& optarget = clit.opinfos[0x200];
				if(optarget.op_cards) {
					if(optarget.op_player == PLAYER_ALL) {
						auto opit = optarget.op_cards->container.begin();
						uint32_t sumplayer = optarget.op_param;
						if((*opit)->spsummon_code) {
							++core.spsummon_once_map[sumplayer][(*opit)->spsummon_code];
							++core.spsummon_once_map_rst[sumplayer][(*opit)->spsummon_code];
						}
						++opit;
						if((*opit)->spsummon_code) {
							++core.spsummon_once_map[1 - sumplayer][(*opit)->spsummon_code];
							++core.spsummon_once_map_rst[1 - sumplayer][(*opit)->spsummon_code];
						}
					} else {
						uint32_t sumplayer = clit.triggering_player;
						// genarally setting op_player is unnecessary when the effect targets cards
						// in the case of CATEGORY_SPECIAL_SUMMON(with EFFECT_FLAG_CARD_TARGET), op_player=0x10
						// indecates that it is the opponent that special summons the target monsters
						if(peffect->is_flag(EFFECT_FLAG_CARD_TARGET) && optarget.op_player == 0x10)
							sumplayer = 1 - sumplayer;
						for(auto& pcard : optarget.op_cards->container) {
							if(pcard->spsummon_code) {
								++core.spsummon_once_map[sumplayer][pcard->spsummon_code];
								++core.spsummon_once_map_rst[sumplayer][pcard->spsummon_code];
							}
						}
					}
				}
			}
		}
		auto message = pduel->new_message(MSG_CHAINED);
		message->write<uint8_t>(clit.chain_count);
		raise_event(phandler, EVENT_CHAINING, peffect, 0, clit.triggering_player, clit.triggering_player, clit.chain_count);
		process_instant_event();
		core.just_sent_cards.clear();
		++core.real_chain_count;
		if(core.new_chains.size())
			emplace_process<Processors::AddChain>();
		adjust_all();
		return TRUE;
	}
	case 10: {
		arg.is_activated_effect = true;
		auto& clit = core.new_chains.front();
		effect* peffect = clit.triggering_effect;
		card* phandler = peffect->get_handler();
		int32_t ecode = 0;
		if(phandler->current.location == LOCATION_HAND) {
			if(phandler->data.type & TYPE_TRAP)
				ecode = EFFECT_TRAP_ACT_IN_HAND;
			else if((phandler->data.type & TYPE_SPELL) && (phandler->data.type & TYPE_QUICKPLAY || phandler->is_affected_by_effect(EFFECT_BECOME_QUICK))
					&& infos.turn_player != phandler->current.controler)
				ecode = EFFECT_QP_ACT_IN_NTPHAND;
		} else if(phandler->current.location == LOCATION_SZONE) {
			if((phandler->data.type & TYPE_TRAP) && phandler->get_status(STATUS_SET_TURN))
				ecode = EFFECT_TRAP_ACT_IN_SET_TURN;
			if((phandler->data.type & TYPE_SPELL) && (phandler->data.type & TYPE_QUICKPLAY || phandler->is_affected_by_effect(EFFECT_BECOME_QUICK)) && phandler->get_status(STATUS_SET_TURN))
				ecode = EFFECT_QP_ACT_IN_SET_TURN;
		}
		if(ecode) {
			core.select_effects.clear();
			core.select_options.clear();
			effect_set eset;
			phandler->filter_effect(ecode, &eset);
			bool has_no_side_effect_effs = false;
			if(!eset.empty()) {
				for(const auto& peff : eset) {
					if(peff->has_function_value() || peff->has_count_limit()) {
						if(peff->check_count_limit(phandler->current.controler)) {
							core.select_effects.push_back(peff);
							core.select_options.push_back(peff->description);
						}
					} else {
						has_no_side_effect_effs = has_no_side_effect_effs || true;
					}
				}
				if(core.select_options.empty()) {
					arg.step = 0;
					return FALSE;
				}
				if(has_no_side_effect_effs) {
					core.select_options.insert(core.select_options.begin(), 99);
					core.select_effects.insert(core.select_effects.begin(), nullptr);
				}
				if(core.select_options.size() == 1)
					returns.set<int32_t>(0, 0);
				else
					emplace_process<Processors::SelectOption>(phandler->current.controler);
			}
		} else {
			arg.step = 0;
		}
		return FALSE;
	}
	case 11: {
		auto& clit = core.new_chains.front();
		effect* peffect = clit.triggering_effect;
		card* phandler = peffect->get_handler();
		if(!core.select_effects.empty()) {
			auto* eff = core.select_effects[returns.at<int32_t>(0)];
			if(eff) {
				eff->dec_count(phandler->current.controler);
				pduel->lua->add_param<LuaParam::EFFECT>(peffect);
				eff->get_value(phandler, 1);
			}
		}
		arg.step = 0;
		return FALSE;
	}
	}
	return TRUE;
}
