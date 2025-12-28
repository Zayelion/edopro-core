bool field::process(Processors::AttackDisable& arg) {
	switch(arg.step) {
	case 0: {
		auto* attacker = core.attacker;
		if(!attacker
		   || core.effect_damage_step != 0
		   || (attacker->fieldid_r != core.pre_field[0])
		   || (attacker->current.location != LOCATION_MZONE)
		   || !attacker->is_capable_attack()
		   || !attacker->is_affect_by_effect(core.reason_effect)
		   || attacker->is_affected_by_effect(EFFECT_UNSTOPPABLE_ATTACK)) {
			returns.set<int32_t>(0, 0);
			return TRUE;
		}
		auto* peffect = pduel->new_effect();
		peffect->code = EFFECT_ATTACK_DISABLED;
		peffect->type = EFFECT_TYPE_SINGLE;
		attacker->add_effect(peffect);
		attacker->set_status(STATUS_ATTACK_CANCELED, TRUE);
		raise_event(attacker, EVENT_ATTACK_DISABLED, core.reason_effect, 0, core.reason_player, PLAYER_NONE, 0);
		process_instant_event();
		return FALSE;
	}
	case 1: {
		returns.set<int32_t>(0, 1);
		return TRUE;
	}
	}
	return TRUE;
}

