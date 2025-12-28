bool field::process(Processors::DamageStep& arg) {
	auto new_attack = arg.new_attack;
	switch(arg.step) {
	case 0: {
		if(core.effect_damage_step && !new_attack)
			return TRUE;
		core.effect_damage_step = 1;
		std::swap(core.attacker, arg.attacker);
		std::swap(core.attack_target, arg.attack_target);
		arg.backup_phase = infos.phase;
		if(core.attacker->current.location != LOCATION_MZONE || (core.attack_target && core.attack_target->current.location != LOCATION_MZONE)) {
			arg.step = 2;
			return FALSE;
		}
		if(new_attack) {
			++core.attack_state_count[infos.turn_player];
			++core.battled_count[infos.turn_player];
			check_card_counter(core.attacker, ACTIVITY_ATTACK, infos.turn_player);
		}
		core.attacker->announced_cards.addcard(core.attack_target);
		attack_all_target_check();
		auto message = pduel->new_message(MSG_ATTACK);
		message->write(core.attacker->get_info_location());
		if(core.attack_target) {
			message->write(core.attack_target->get_info_location());
		} else {
			message->write(loc_info{});
		}
		infos.phase = PHASE_DAMAGE;
		(void)pduel->new_message(MSG_DAMAGE_STEP_START);
		core.pre_field[0] = core.attacker->fieldid_r;
		++core.attacker->attacked_count;
		if(core.attack_target) {
			core.pre_field[1] = core.attack_target->fieldid_r;
			if(core.attack_target->is_position(POS_FACEDOWN)) {
				change_position(core.attack_target, nullptr, PLAYER_NONE, core.attack_target->current.position >> 1, 0, TRUE);
				adjust_all();
			}
		} else
			core.pre_field[1] = 0;
		return FALSE;
	}
	case 1: {
		infos.phase = PHASE_DAMAGE_CAL;
		emplace_process<Processors::BattleCommand>(Step{ 26 });
		arg.step = 2;
		core.reserved = std::move(arg);
		return TRUE;
	}
	case 2: {
		core.effect_damage_step = 2;
		emplace_process<Processors::BattleCommand>(Step{ 32 }, arg.cards_destroyed_by_battle);
		return FALSE;
	}
	case 3: {
		std::swap(core.attacker, arg.attacker);
		std::swap(core.attack_target, arg.attack_target);
		if(core.attacker)
			core.attacker->set_status(STATUS_ATTACK_CANCELED, TRUE);
		if(core.attack_target)
			core.attack_target->set_status(STATUS_ATTACK_CANCELED, TRUE);
		core.effect_damage_step = 0;
		infos.phase = arg.backup_phase;
		return TRUE;
	}
	}
	return TRUE;
}
void field::calculate_battle_damage(effect** pdamchange, card** preason_card, std::array<bool, 2>* battle_destroyed) {
	uint32_t aa = core.attacker->get_attack(), ad = core.attacker->get_defense();
	uint32_t da = 0, dd = 0, a = aa, d;
	uint8_t pa = core.attacker->current.controler, pd;
	uint8_t damp = 0;
	effect* damchange = nullptr;
	card* reason_card = nullptr;
	std::array<bool, 2> bd{};
	bool pierce = false;
	core.battle_damage[0] = core.battle_damage[1] = 0;
	if(core.attacker->is_position(POS_FACEUP_DEFENSE)) {
		effect* defattack = core.attacker->is_affected_by_effect(EFFECT_DEFENSE_ATTACK);
		if(defattack && defattack->get_value(core.attacker))
			a = ad;
	}
	effect* battstat = core.attacker->is_affected_by_effect(EFFECT_CHANGE_BATTLE_STAT);
	if(battstat)
		a = battstat->get_value(core.attacker);
	if(core.attack_target) {
		da = core.attack_target->get_attack();
		dd = core.attack_target->get_defense();
		pd = core.attack_target->current.controler;
		battstat = core.attack_target->is_affected_by_effect(EFFECT_CHANGE_BATTLE_STAT);
		if(battstat)
			d = battstat->get_value(core.attack_target);
		else if (core.attack_target->is_position(POS_ATTACK))
			d = da;
		else
			d = dd;
		if(core.attack_target->is_position(POS_ATTACK)) {
			if(a > d) {
				damp = pd;
				core.battle_damage[damp] = a - d;
				reason_card = core.attacker;
				bd[1] = true;
			} else if(a < d) {
				damp = pa;
				core.battle_damage[damp] = d - a;
				reason_card = core.attack_target;
				bd[0] = true;
			} else {
				if(a != 0 || is_flag(DUEL_0_ATK_DESTROYED)) {
					bd[0] = bd[1] = true;
				}
			}
		} else {
			if(a > d) {
				effect_set eset;
				core.attacker->filter_effect(EFFECT_PIERCE, &eset);
				if(eset.size()) {
					pierce = true;
					uint8_t dp[2] = {};
					for(const auto& peff : eset)
						dp[1 - peff->get_handler_player()] = 1;
					if(dp[0])
						core.battle_damage[0] = a - d;
					if(dp[1])
						core.battle_damage[1] = a - d;
					bool double_damage = false;
					//bool half_damage = false;
					for(const auto& peff : eset) {
						if(peff->get_value() == DOUBLE_DAMAGE)
							double_damage = true;
						//if(peff->get_value() == HALF_DAMAGE)
						//	half_damage = true;
					}
					//if(double_damage && half_damage) {
					//	double_damage = false;
					//	half_damage = false;
					//}
					if(double_damage) {
						if(dp[0])
							core.battle_damage[0] *= 2;
						if(dp[1])
							core.battle_damage[1] *= 2;
					}
					//if(half_damage) {
					//	if(dp[0])
					//		core.battle_damage[0] /= 2;
					//	if(dp[1])
					//		core.battle_damage[1] /= 2;
					//}
					bool both = dp[0] && dp[1];
					if(!both) {
						damp = dp[0] ? 0 : 1;
						if(core.attacker->is_affected_by_effect(EFFECT_BOTH_BATTLE_DAMAGE)
							|| core.attack_target->is_affected_by_effect(EFFECT_BOTH_BATTLE_DAMAGE)) {
							core.battle_damage[1 - damp] = core.battle_damage[damp];
							both = true;
						}
					}
					effect* reflect[2] = {};
					if((reflect[pd] = core.attack_target->is_affected_by_effect(EFFECT_REFLECT_BATTLE_DAMAGE, core.attacker)) == nullptr)
						reflect[pd] = is_player_affected_by_effect(pd, EFFECT_REFLECT_BATTLE_DAMAGE);
					if((reflect[1 - pd] = core.attacker->is_affected_by_effect(EFFECT_REFLECT_BATTLE_DAMAGE, core.attack_target)) == nullptr)
						reflect[1 - pd] = is_player_affected_by_effect(1 - pd, EFFECT_REFLECT_BATTLE_DAMAGE);
					bool also[2] = { false, false };
					if(!both
						&& (core.attack_target->is_affected_by_effect(EFFECT_ALSO_BATTLE_DAMAGE)
							|| is_player_affected_by_effect(pd, EFFECT_ALSO_BATTLE_DAMAGE)))
						also[pd] = true;
					if(!both
						&& (core.attacker->is_affected_by_effect(EFFECT_ALSO_BATTLE_DAMAGE)
							|| is_player_affected_by_effect(1 - pd, EFFECT_ALSO_BATTLE_DAMAGE)))
						also[1 - pd] = true;
					if(both) {
						//turn player's effect applies first
						if(reflect[pa] && reflect[pa]->get_handler_player() == pa) {
							core.battle_damage[1 - pa] += core.battle_damage[pa];
							core.battle_damage[pa] = 0;
						} else if(reflect[1 - pa] && reflect[1 - pa]->get_handler_player() == pa) {
							core.battle_damage[pa] += core.battle_damage[1 - pa];
							core.battle_damage[1 - pa] = 0;
						} else if(reflect[pa] && reflect[pa]->get_handler_player() == 1 - pa) {
							core.battle_damage[1 - pa] += core.battle_damage[pa];
							core.battle_damage[pa] = 0;
						} else if(reflect[1 - pa] && reflect[1 - pa]->get_handler_player() == 1 - pa) {
							core.battle_damage[pa] += core.battle_damage[1 - pa];
							core.battle_damage[1 - pa] = 0;
						}
					} else {
						if(reflect[damp]) {
							if(!also[1 - damp]) {
								core.battle_damage[1 - damp] += core.battle_damage[damp];
								core.battle_damage[damp] = 0;
							} else {
								core.battle_damage[1 - damp] += core.battle_damage[damp];
								core.battle_damage[damp] = core.battle_damage[1 - damp];
							}
						} else if(also[damp]) {
							if(!reflect[1 - damp]) {
								core.battle_damage[1 - damp] += core.battle_damage[damp];
							} else {
								core.battle_damage[1 - damp] += core.battle_damage[damp];
								core.battle_damage[damp] += core.battle_damage[1 - damp];
								core.battle_damage[1 - damp] = 0;
							}
						}
					}
					eset.clear();
					core.attacker->filter_effect(EFFECT_CHANGE_BATTLE_DAMAGE, &eset, FALSE);
					core.attack_target->filter_effect(EFFECT_CHANGE_BATTLE_DAMAGE, &eset, FALSE);
					filter_player_effect(pa, EFFECT_CHANGE_BATTLE_DAMAGE, &eset, false);
					filter_player_effect(1 - pa, EFFECT_CHANGE_BATTLE_DAMAGE, &eset, false);
					std::sort(eset.begin(), eset.end(), effect_sort_id);
					for(uint8_t p = 0; p < 2; ++p) {
						bool double_dam = false;
						bool half_dam = false;
						int32_t dam_value = -1;
						for(const auto& peff : eset) {
							lua_Integer val = -1;
							if(!peff->is_flag(EFFECT_FLAG_PLAYER_TARGET)) {
								pduel->lua->add_param<LuaParam::INT>(p);
								pduel->lua->add_param<LuaParam::CARD>(core.attacker);
								val = peff->get_value(2);
							} else if(peff->is_target_player(p)) {
								pduel->lua->add_param<LuaParam::CARD>(core.attacker);
								val = peff->get_value(1);
							}
							if(val == DOUBLE_DAMAGE) {
								double_dam = true;
							} else if(val == HALF_DAMAGE) {
								half_dam = true;
							} else if(val > 0) {
								dam_value = static_cast<int32_t>(val);
							} else if(val == 0) {
								dam_value = 0;
								break;
							}
						}
						if(double_dam && half_dam) {
							double_dam = false;
							half_dam = false;
						}
						if(double_dam)
							core.battle_damage[p] *= 2;
						if(half_dam)
							core.battle_damage[p] /= 2;
						if(dam_value >= 0 && core.battle_damage[p] > 0)
							core.battle_damage[p] = dam_value;
					}
					if(core.attacker->is_affected_by_effect(EFFECT_NO_BATTLE_DAMAGE)
						|| core.attack_target->is_affected_by_effect(EFFECT_AVOID_BATTLE_DAMAGE, core.attacker)
						|| is_player_affected_by_effect(pd, EFFECT_AVOID_BATTLE_DAMAGE))
						core.battle_damage[pd] = 0;
					if(core.attack_target->is_affected_by_effect(EFFECT_NO_BATTLE_DAMAGE)
						|| core.attacker->is_affected_by_effect(EFFECT_AVOID_BATTLE_DAMAGE, core.attack_target)
						|| is_player_affected_by_effect(1 - pd, EFFECT_AVOID_BATTLE_DAMAGE))
						core.battle_damage[1 - pd] = 0;
					reason_card = core.attacker;
				}
				bd[1] = true;
			} else if(a < d) {
				damp = pa;
				core.battle_damage[damp] = d - a;
				reason_card = core.attack_target;
			}
		}
	} else {
		if(a != 0) {
			damp = 1 - pa;
			core.battle_damage[damp] = a;
			reason_card = core.attacker;
		}
	}
	if(reason_card && !pierce
		&& (damchange = reason_card->is_affected_by_effect(EFFECT_BATTLE_DAMAGE_TO_EFFECT)) == nullptr) {
		card* dam_card = (reason_card == core.attacker) ? core.attack_target : core.attacker;
		bool both = false;
		if(reason_card->is_affected_by_effect(EFFECT_BOTH_BATTLE_DAMAGE)
			|| (dam_card && dam_card->is_affected_by_effect(EFFECT_BOTH_BATTLE_DAMAGE))) {
			core.battle_damage[1 - damp] = core.battle_damage[damp];
			both = true;
		}
		effect* reflect[2] = {};
		if(!dam_card || (reflect[damp] = dam_card->is_affected_by_effect(EFFECT_REFLECT_BATTLE_DAMAGE, reason_card)) == nullptr)
			reflect[damp] = is_player_affected_by_effect(damp, EFFECT_REFLECT_BATTLE_DAMAGE);
		if((reflect[1 - damp] = reason_card->is_affected_by_effect(EFFECT_REFLECT_BATTLE_DAMAGE, dam_card)) == nullptr)
			reflect[1 - damp] = is_player_affected_by_effect(1 - damp, EFFECT_REFLECT_BATTLE_DAMAGE);
		bool also[2] = { false, false };
		if(!both
			&& ((dam_card && dam_card->is_affected_by_effect(EFFECT_ALSO_BATTLE_DAMAGE))
				|| is_player_affected_by_effect(damp, EFFECT_ALSO_BATTLE_DAMAGE)))
			also[damp] = true;
		if(!both
			&& (reason_card->is_affected_by_effect(EFFECT_ALSO_BATTLE_DAMAGE)
				|| is_player_affected_by_effect(1 - damp, EFFECT_ALSO_BATTLE_DAMAGE)))
			also[1 - damp] = true;
		if(both) {
			//turn player's effect applies first
			if(reflect[pa] && reflect[pa]->get_handler_player() == pa) {
				core.battle_damage[1 - pa] += core.battle_damage[pa];
				core.battle_damage[pa] = 0;
			} else if(reflect[1 - pa] && reflect[1 - pa]->get_handler_player() == pa) {
				core.battle_damage[pa] += core.battle_damage[1 - pa];
				core.battle_damage[1 - pa] = 0;
			} else if(reflect[pa] && reflect[pa]->get_handler_player() == 1 - pa) {
				core.battle_damage[1 - pa] += core.battle_damage[pa];
				core.battle_damage[pa] = 0;
			} else if(reflect[1 - pa] && reflect[1 - pa]->get_handler_player() == 1 - pa) {
				core.battle_damage[pa] += core.battle_damage[1 - pa];
				core.battle_damage[1 - pa] = 0;
			}
		} else {
			if(reflect[damp]) {
				if(!also[1 - damp]) {
					core.battle_damage[1 - damp] += core.battle_damage[damp];
					core.battle_damage[damp] = 0;
				} else {
					core.battle_damage[1 - damp] += core.battle_damage[damp];
					core.battle_damage[damp] = core.battle_damage[1 - damp];
				}
			} else if(also[damp]) {
				if(!reflect[1 - damp]) {
					core.battle_damage[1 - damp] += core.battle_damage[damp];
				} else {
					core.battle_damage[1 - damp] += core.battle_damage[damp];
					core.battle_damage[damp] += core.battle_damage[1 - damp];
					core.battle_damage[1 - damp] = 0;
				}
			}
		}
		effect_set eset;
		reason_card->filter_effect(EFFECT_CHANGE_BATTLE_DAMAGE, &eset, FALSE);
		if(dam_card)
			dam_card->filter_effect(EFFECT_CHANGE_BATTLE_DAMAGE, &eset, FALSE);
		filter_player_effect(damp, EFFECT_CHANGE_BATTLE_DAMAGE, &eset, false);
		filter_player_effect(1 - damp, EFFECT_CHANGE_BATTLE_DAMAGE, &eset, false);
		std::sort(eset.begin(), eset.end(), effect_sort_id);
		for(uint8_t p = 0; p < 2; ++p) {
			bool double_dam = false;
			bool half_dam = false;
			int32_t dam_value = -1;
			for(const auto& peff : eset) {
				lua_Integer val = -1;
				if(!peff->is_flag(EFFECT_FLAG_PLAYER_TARGET)) {
					pduel->lua->add_param<LuaParam::INT>(p);
					pduel->lua->add_param<LuaParam::CARD>(reason_card);
					val = peff->get_value(2);
				} else if(peff->is_target_player(p)) {
					pduel->lua->add_param<LuaParam::CARD>(reason_card);
					val = peff->get_value(1);
				}
				if(val == DOUBLE_DAMAGE) {
					double_dam = true;
				} else if(val == HALF_DAMAGE) {
					half_dam = true;
				} else if(val > 0) {
					dam_value = static_cast<int32_t>(val);
				} else if(val == 0) {
					dam_value = 0;
					break;
				}
			}
			if(double_dam && half_dam) {
				double_dam = false;
				half_dam = false;
			}
			if(double_dam)
				core.battle_damage[p] *= 2;
			if(half_dam)
				core.battle_damage[p] /= 2;
			if(dam_value >= 0 && core.battle_damage[p] > 0)
				core.battle_damage[p] = dam_value;
		}
		if(reason_card->is_affected_by_effect(EFFECT_NO_BATTLE_DAMAGE)
			|| (dam_card && dam_card->is_affected_by_effect(EFFECT_AVOID_BATTLE_DAMAGE, reason_card))
			|| is_player_affected_by_effect(damp, EFFECT_AVOID_BATTLE_DAMAGE))
			core.battle_damage[damp] = 0;
		if((dam_card && dam_card->is_affected_by_effect(EFFECT_NO_BATTLE_DAMAGE))
			|| reason_card->is_affected_by_effect(EFFECT_AVOID_BATTLE_DAMAGE, dam_card)
			|| is_player_affected_by_effect(1 - damp, EFFECT_AVOID_BATTLE_DAMAGE))
			core.battle_damage[1 - damp] = 0;
	}
	if(!core.battle_damage[damp] && !core.battle_damage[1 - damp])
		reason_card = nullptr;
	if(pdamchange)
		*pdamchange = damchange;
	if(preason_card)
		*preason_card = reason_card;
	if(battle_destroyed) {
		*battle_destroyed = bd;
	}
}
