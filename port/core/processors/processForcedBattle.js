bool field::process(Processors::ForcedBattle& arg) {
	switch(arg.step) {
	case 0: {
		if (is_player_affected_by_effect(infos.turn_player, EFFECT_CANNOT_BP))
			return TRUE;
		++core.battle_phase_count[infos.turn_player];
		if (is_player_affected_by_effect(infos.turn_player, EFFECT_SKIP_BP) || core.force_turn_end) {
			auto message = pduel->new_message(MSG_NEW_PHASE);
			message->write<uint16_t>(PHASE_BATTLE_START);
			reset_phase(PHASE_BATTLE_START);
			reset_phase(PHASE_BATTLE_STEP);
			reset_phase(PHASE_BATTLE);
			adjust_all();
			message = pduel->new_message(MSG_NEW_PHASE);
			message->write<uint16_t>(infos.phase);
			return TRUE;
		}
		arg.backup_phase = infos.phase;
		auto tmp_attacker = core.forced_attacker;
		auto tmp_attack_target = core.forced_attack_target;
		if(!tmp_attacker->is_capable_attack_announce(infos.turn_player))
			return TRUE;
		card_vector cv;
		get_attack_target(tmp_attacker, &cv);
		if((cv.size() == 0 && tmp_attacker->direct_attackable == 0) || (tmp_attack_target && std::find(cv.begin(), cv.end(), tmp_attack_target)==cv.end()))
			return TRUE;
		core.attacker = tmp_attacker;
		core.attack_target = tmp_attack_target;
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
		core.attack_cancelable = true;
		core.attack_cost_paid = FALSE;
		core.chain_attacker_id = 0;
		core.chain_attack_target = nullptr;
		returns.set<int32_t>(0, 1);
		reset_phase(infos.phase);
		reset_phase(PHASE_BATTLE_START);
		infos.phase = PHASE_BATTLE_STEP;
		core.new_fchain.clear();
		core.new_ochain.clear();
		core.quick_f_chain.clear();
		core.delayed_quick_tmp.clear();
		auto message = pduel->new_message(MSG_NEW_PHASE);
		message->write<uint16_t>(PHASE_BATTLE_START);
		emplace_process<Processors::BattleCommand>(Step{ 1 }, nullptr, true);
		return FALSE;
	}
	case 1: {
		reset_phase(infos.phase);
		infos.phase = arg.backup_phase;
		core.new_fchain.clear();
		core.new_ochain.clear();
		core.quick_f_chain.clear();
		core.delayed_quick_tmp.clear();
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
		core.attacker = nullptr;
		core.attack_target = nullptr;
		auto message = pduel->new_message(MSG_NEW_PHASE);
		message->write<uint16_t>(infos.phase);
		return TRUE;
	}
	}
	return TRUE;
}
