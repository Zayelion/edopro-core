bool field::process(Processors::SolveContinuous& arg) {
	switch(arg.step) {
	case 0: {
		core.solving_continuous.splice(core.solving_continuous.begin(), core.sub_solving_continuous);
		auto& clit = core.solving_continuous.front();
		effect* peffect = clit.triggering_effect;
		uint8_t triggering_player = clit.triggering_player;
		if(!peffect->check_count_limit(triggering_player)) {
			core.solving_continuous.pop_front();
			return TRUE;
		}
		core.continuous_chain.push_back(clit);
		if(peffect->is_flag(EFFECT_FLAG_DELAY) || (!(peffect->code & 0xfffff000u) && (peffect->code & (EVENT_PHASE | EVENT_PHASE_START))))
			core.conti_solving = true;
		arg.reason_effect = core.reason_effect;
		arg.reason_player = core.reason_player;
		if(!peffect->target)
			return FALSE;
		core.sub_solving_event.push_back(clit.evt);
		emplace_process<Processors::ExecuteTarget>(peffect, triggering_player);
		return FALSE;
	}
	case 1: {
		return FALSE;
	}
	case 2: {
		auto& clit = core.solving_continuous.front();
		effect* peffect = clit.triggering_effect;
		uint8_t triggering_player = clit.triggering_player;
		if(!peffect->operation)
			return FALSE;
		peffect->dec_count(triggering_player);
		core.sub_solving_event.push_back(clit.evt);
		emplace_process<Processors::ExecuteOperation>(peffect, triggering_player);
		return FALSE;
	}
	case 3: {
		auto& clit = core.solving_continuous.front();
		effect* peffect = clit.triggering_effect;
		core.reason_effect = arg.reason_effect;
		core.reason_player = arg.reason_player;
		core.continuous_chain.pop_back();
		core.solving_continuous.pop_front();
		if(peffect->is_flag(EFFECT_FLAG_DELAY) || (!(peffect->code & 0xfffff000u) && (peffect->code & (EVENT_PHASE | EVENT_PHASE_START)))) {
			core.conti_solving = false;
			adjust_all();
			return FALSE;
		}
		return TRUE;
	}
	case 4: {
		if(core.conti_player == PLAYER_NONE)
			core.conti_player = infos.turn_player;
		if(core.conti_player == infos.turn_player) {
			if(core.delayed_continuous_tp.size()) {
				core.sub_solving_continuous.splice(core.sub_solving_continuous.end(), core.delayed_continuous_tp, core.delayed_continuous_tp.begin());
				emplace_process<Processors::SolveContinuous>();
			} else
				core.conti_player = 1 - infos.turn_player;
		}
		if(core.conti_player == 1 - infos.turn_player) {
			if(core.delayed_continuous_ntp.size()) {
				core.sub_solving_continuous.splice(core.sub_solving_continuous.end(), core.delayed_continuous_ntp, core.delayed_continuous_ntp.begin());
				emplace_process<Processors::SolveContinuous>();
			} else if(core.delayed_continuous_tp.size()) {
				core.conti_player = infos.turn_player;
				core.sub_solving_continuous.splice(core.sub_solving_continuous.end(), core.delayed_continuous_tp, core.delayed_continuous_tp.begin());
				emplace_process<Processors::SolveContinuous>();
			} else
				core.conti_player = PLAYER_NONE;
		}
		return TRUE;
	}
	}
	return TRUE;
}
