bool field::process(Processors::Adjust& arg) {
	switch(arg.step) {
	case 0: {
		core.re_adjust = false;
		return FALSE;
	}
	case 1: {
		//win check(deck=0 or lp=0)
		if(!core.force_turn_end){
			uint32_t winp = 5, rea = 1;
			if (player[0].lp <= 0 && player[1].lp > 0 && !is_player_affected_by_effect(0, EFFECT_CANNOT_LOSE_LP)) {
				winp = 1;
				rea = 1;
			}
			if (core.overdraw[0] && !core.overdraw[1] && !is_player_affected_by_effect(0, EFFECT_CANNOT_LOSE_DECK)) {
				winp = 1;
				rea = 2;
			}
			if (player[1].lp <= 0 && player[0].lp > 0 && !is_player_affected_by_effect(1, EFFECT_CANNOT_LOSE_LP)) {
				winp = 0;
				rea = 1;
			}
			if (core.overdraw[1] && !core.overdraw[0] && !is_player_affected_by_effect(1, EFFECT_CANNOT_LOSE_DECK)) {
				winp = 0;
				rea = 2;
			}
			if (player[1].lp <= 0 && player[0].lp <= 0 && !(is_player_affected_by_effect(0, EFFECT_CANNOT_LOSE_LP) && is_player_affected_by_effect(1, EFFECT_CANNOT_LOSE_LP))) {
				if (is_player_affected_by_effect(0, EFFECT_CANNOT_LOSE_LP))
					winp = 0;
				else if (is_player_affected_by_effect(1, EFFECT_CANNOT_LOSE_LP))
					winp = 1;
				else
					winp = PLAYER_NONE;
				rea = 1;
			}
			if (core.overdraw[1] && core.overdraw[0] && !(is_player_affected_by_effect(0, EFFECT_CANNOT_LOSE_DECK) && is_player_affected_by_effect(1, EFFECT_CANNOT_LOSE_DECK))) {
				if (is_player_affected_by_effect(0, EFFECT_CANNOT_LOSE_DECK))
					winp = 0;
				else if (is_player_affected_by_effect(1, EFFECT_CANNOT_LOSE_DECK))
					winp = 1;
				else
					winp = PLAYER_NONE;
				rea = 2;
			}
			if (is_flag(DUEL_RELAY)) {
				if (winp == PLAYER_NONE) {
					bool p1 = relay_check(0);
					bool p2 = relay_check(1);
					if (p1 && !p2)
						winp = 0;
					else if (!p1 && p2)
						winp = 1;
					else if (p1 && p2) {
						winp = 5;
						core.overdraw[0] = core.overdraw[1] = false;
					}
				} else if (winp < PLAYER_NONE)
					if (relay_check(1 - winp)) {
						winp = 5;
						core.overdraw[0] = core.overdraw[1] = false;
					}
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
		return FALSE;
	}
	case 2: {
		//disable check
		uint8_t tp = infos.turn_player;
		for(uint8_t p = 0; p < 2; ++p) {
			for(auto& pcard : player[tp].list_mzone) {
				if(pcard)
					add_to_disable_check_list(pcard);
			}
			for(auto& pcard : player[tp].list_szone) {
				if(pcard)
					add_to_disable_check_list(pcard);
			}
			tp = 1 - tp;
		}
		adjust_disable_check_list();
		emplace_process<Processors::RefreshLoc>();
		return FALSE;
	}
	case 3: {
		//trap monster
		core.trap_monster_adjust_set[0].clear();
		core.trap_monster_adjust_set[1].clear();
		for(uint8_t p = 0; p < 2; ++p) {
			for(auto& pcard : player[p].list_mzone) {
				if(!pcard) continue;
				if((pcard->get_type() & TYPE_TRAPMONSTER) && pcard->is_affected_by_effect(EFFECT_DISABLE_TRAPMONSTER)) {
					core.trap_monster_adjust_set[p].insert(pcard);
				}
			}
		}
		if(core.trap_monster_adjust_set[0].size() || core.trap_monster_adjust_set[1].size()) {
			core.re_adjust = true;
			emplace_process<Processors::TrapMonsterAdjust>();
		}
		return FALSE;
	}
	case 4: {
		//control
		core.control_adjust_set[0].clear();
		core.control_adjust_set[1].clear();
		card_set reason_cards;
		for(uint8_t p = 0; p < 2; ++p) {
			for(auto& pcard : player[p].list_mzone) {
				if(!pcard) continue;
				uint8_t cur = pcard->current.controler;
				auto [ref, peffect] = pcard->refresh_control_status();
				if(cur != ref && pcard->is_capable_change_control()) {
					core.control_adjust_set[p].insert(pcard);
					if(peffect && (!(peffect->type & EFFECT_TYPE_SINGLE) || peffect->condition))
						reason_cards.insert(peffect->get_handler());
				}
			}
		}
		if(core.control_adjust_set[0].size() || core.control_adjust_set[1].size()) {
			core.re_adjust = true;
			get_control(core.control_adjust_set[1 - infos.turn_player], nullptr, PLAYER_NONE, infos.turn_player, 0, 0, 0xff);
			get_control(core.control_adjust_set[infos.turn_player], nullptr, PLAYER_NONE, 1 - infos.turn_player, 0, 0, 0xff);
			for(auto& rcard : reason_cards) {
				++core.readjust_map[rcard];
				if(core.readjust_map[rcard] > 3)
					destroy(rcard, nullptr, REASON_RULE, PLAYER_NONE);
			}
		}
		core.last_control_changed_id = infos.field_id;
		return FALSE;
	}
	case 5: {
		//remove brainwashing
		if(core.global_flag & GLOBALFLAG_BRAINWASHING_CHECK) {
			core.control_adjust_set[0].clear();
			core.control_adjust_set[1].clear();
			effect_set eset;
			filter_field_effect(EFFECT_REMOVE_BRAINWASHING, &eset, false);
			if(core.remove_brainwashing = !eset.empty(); core.remove_brainwashing) {
				for(uint8_t p = 0; p < 2; ++p) {
					for(auto& pcard : player[p].list_mzone) {
						if(!pcard || !pcard->is_affected_by_effect(EFFECT_REMOVE_BRAINWASHING))
							continue;
						//the opposite of pcard->check_control_effect()
						auto pr = pcard->single_effect.equal_range(EFFECT_SET_CONTROL);
						for(auto eit = pr.first; eit != pr.second;) {
							effect* peffect = eit->second;
							++eit;
							if(!peffect->condition)
								peffect->handler->remove_effect(peffect);
						}
						if(p != pcard->owner && pcard->is_capable_change_control())
							core.control_adjust_set[p].insert(pcard);
					}
				}
			}
			if(core.control_adjust_set[0].size() || core.control_adjust_set[1].size()) {
				core.re_adjust = true;
				get_control(core.control_adjust_set[1 - infos.turn_player], nullptr, PLAYER_NONE, infos.turn_player, 0, 0, 0xff);
				get_control(core.control_adjust_set[infos.turn_player], nullptr, PLAYER_NONE, 1 - infos.turn_player, 0, 0, 0xff);
			}
		}
		arg.step = 7;
		return FALSE;
	}
	case 8: {
		if(adjust_grant_effect())
			core.re_adjust = true;
		return FALSE;
	}
	case 9: {
		if(core.selfdes_disabled) {
			arg.step = 10;
			return FALSE;
		}
		//self destroy
		adjust_self_destroy_set();
		return FALSE;
	}
	case 10: {
		//equip check
		uint8_t tp = infos.turn_player;
		card_set destroy_set;
		for(uint8_t p = 0; p < 2; ++p) {
			for(uint8_t i = 0; i < 5; ++i) {
				card* pcard = player[tp].list_szone[i];
				if(pcard && pcard->equiping_target && !pcard->is_affected_by_effect(EFFECT_EQUIP_LIMIT, pcard->equiping_target))
					destroy_set.insert(pcard);
			}
			tp = 1 - tp;
		}
		if(destroy_set.size()) {
			core.re_adjust = true;
			destroy(std::move(destroy_set), nullptr, REASON_RULE, PLAYER_NONE);
		}
		return FALSE;
	}
	case 11: {
		//position
		uint32_t tp = infos.turn_player, pos;
		card_set pos_adjust;
		effect_set eset;
		for(uint8_t p = 0; p < 2; ++p) {
			for(auto& pcard : player[tp].list_mzone) {
				if(!pcard || ((pcard->data.type & TYPE_LINK) && (pcard->data.type & TYPE_MONSTER)) || pcard->is_affected_by_effect(EFFECT_CANNOT_CHANGE_POS_E))
					continue;
				eset.clear();
				pcard->filter_effect(EFFECT_SET_POSITION, &eset);
				if(eset.size()) {
					pos = eset.back()->get_value();
					if((pos & 0xff) != pcard->current.position) {
						pos_adjust.insert(pcard);
						pcard->position_param = pos;
						if(pcard->is_status(STATUS_JUST_POS))
							pcard->set_status(STATUS_CONTINUOUS_POS, TRUE);
						else
							pcard->set_status(STATUS_CONTINUOUS_POS, FALSE);
					} else
						pcard->set_status(STATUS_CONTINUOUS_POS, FALSE);
					pcard->set_status(STATUS_JUST_POS, FALSE);
				}
			}
			tp = 1 - tp;
		}
		if(pos_adjust.size()) {
			core.re_adjust = true;
			auto ng = pduel->new_group();
			ng->container.swap(pos_adjust);
			ng->is_readonly = true;
			emplace_process<Processors::ChangePos>(ng, nullptr, PLAYER_NONE, true);
		}
		return FALSE;
	}
	case 12: {
		//shuffle check
		for(auto& pcard : player[0].list_hand) {
			effect* pub = pcard->is_affected_by_effect(EFFECT_PUBLIC);
			if(!pub && pcard->is_position(POS_FACEUP))
				core.shuffle_hand_check[0] = true;
			pcard->current.position = pub ? POS_FACEUP : POS_FACEDOWN;
		}
		for(auto& pcard : player[1].list_hand) {
			effect* pub = pcard->is_affected_by_effect(EFFECT_PUBLIC);
			if(!pub && pcard->is_position(POS_FACEUP))
				core.shuffle_hand_check[1] = true;
			pcard->current.position = pub ? POS_FACEUP : POS_FACEDOWN;
		}
		if(core.shuffle_hand_check[infos.turn_player])
			shuffle(infos.turn_player, LOCATION_HAND);
		if(core.shuffle_hand_check[1 - infos.turn_player])
			shuffle(1 - infos.turn_player, LOCATION_HAND);
		return FALSE;
	}
	case 13: {
		//reverse_deck
		if(core.global_flag & GLOBALFLAG_DECK_REVERSE_CHECK) {
			effect_set eset;
			filter_field_effect(EFFECT_REVERSE_DECK, &eset, false);
			auto reversed = !eset.empty();
			if(std::exchange(core.deck_reversed, reversed) != reversed) {
				reverse_deck(0);
				reverse_deck(1);
				pduel->new_message(MSG_REVERSE_DECK);
				if(reversed) {
					if(player[0].list_main.size()) {
						card* ptop = player[0].list_main.back();
						auto message = pduel->new_message(MSG_DECK_TOP);
						message->write<uint8_t>(0);
						message->write<uint32_t>(0);
						message->write<uint32_t>(ptop->data.code);
						message->write<uint32_t>(ptop->current.position);
					}
					if(player[1].list_main.size()) {
						card* ptop = player[1].list_main.back();
						auto message = pduel->new_message(MSG_DECK_TOP);
						message->write<uint8_t>(1);
						message->write<uint32_t>(0);
						message->write<uint32_t>(ptop->data.code);
						message->write<uint32_t>(ptop->current.position);
					}
				}
			}
		}
		return FALSE;
	}
	case 14: {
		//attack cancel
		card* attacker = core.attacker;
		if(!attacker)
			return FALSE;
		if(!attacker->is_affected_by_effect(EFFECT_UNSTOPPABLE_ATTACK)) {
			if(attacker->is_status(STATUS_ATTACK_CANCELED))
				return FALSE;
		}
		if(infos.phase != PHASE_DAMAGE && infos.phase != PHASE_DAMAGE_CAL) {
			if(!core.attacker->is_capable_attack()
				|| core.attacker->current.controler != core.attacker->attack_controler
				|| core.attacker->fieldid_r != core.pre_field[0]) {
				attacker->set_status(STATUS_ATTACK_CANCELED, TRUE);
				return FALSE;
			}
			if(core.attack_rollback)
				return FALSE;
			std::set<uint32_t> fidset;
			for(auto& pcard : player[1 - infos.turn_player].list_mzone) {
				if(pcard)
					fidset.insert(pcard->fieldid_r);
			}
			if(fidset != core.opp_mzone || !confirm_attack_target())
				core.attack_rollback = true;
		} else {
			if(core.attacker->current.location != LOCATION_MZONE || core.attacker->fieldid_r != core.pre_field[0]
				|| ((core.attacker->current.position & POS_DEFENSE) && !(core.attacker->is_affected_by_effect(EFFECT_DEFENSE_ATTACK)))
				|| core.attacker->current.controler != core.attacker->attack_controler
				|| (core.attack_target && (core.attack_target->current.location != LOCATION_MZONE
					|| core.attack_target->current.controler != core.attack_target->attack_controler
					|| core.attack_target->fieldid_r != core.pre_field[1])))
				core.attacker->set_status(STATUS_ATTACK_CANCELED, TRUE);
		}
		return FALSE;
	}
	case 15: {
		raise_event(nullptr, EVENT_ADJUST, nullptr, 0, PLAYER_NONE, PLAYER_NONE, 0);
		process_instant_event();
		return FALSE;
	}
	case 16: {
		if(core.re_adjust) {
			arg.step = Processors::restart;
			return FALSE;
		}
		if(core.shuffle_hand_check[0])
			shuffle(0, LOCATION_HAND);
		if(core.shuffle_hand_check[1])
			shuffle(1, LOCATION_HAND);
		if(core.shuffle_deck_check[0])
			shuffle(0, LOCATION_DECK);
		if(core.shuffle_deck_check[1])
			shuffle(1, LOCATION_DECK);
		return TRUE;
	}
	}
	return TRUE;
}

