bool field::process(Processors::QuickEffect& arg) {
	auto skip_freechain = arg.skip_freechain;
	auto priority = arg.priority_player;
	switch(arg.step) {
	case 0: {
		uint8_t check_player = infos.turn_player;
		if(arg.is_opponent)
			check_player = 1 - infos.turn_player;
		core.select_chains.clear();
		for(auto ifit = core.quick_f_chain.begin(); ifit != core.quick_f_chain.end(); ) {
			effect* peffect = ifit->first;
			card* phandler = peffect->get_handler();
			if(peffect->is_chainable(ifit->second.triggering_player) && peffect->check_count_limit(ifit->second.triggering_player)
					&& phandler->is_has_relation(ifit->second)) {
				if(ifit->second.triggering_player == check_player)
					core.select_chains.push_back(ifit->second);
			} else {
				core.quick_f_chain.erase(ifit++);
				continue;
			}
			++ifit;
		}
		if(core.select_chains.size() == 0)
			returns.set<int32_t>(0, -1);
		else if(core.select_chains.size() == 1)
			returns.set<int32_t>(0, 0);
		else
			emplace_process<Processors::SelectChain>(check_player, 0, true);
		return FALSE;
	}
	case 1: {
		if(returns.at<int32_t>(0) == -1) {
			if(core.quick_f_chain.size()) {
				arg.is_opponent = true;
				arg.step = Processors::restart;
			} else if(core.new_chains.size()) {
				emplace_process<Processors::AddChain>();
				emplace_process<Processors::QuickEffect>(false, 1 - core.new_chains.back().triggering_player);
				infos.priorities[0] = 0;
				infos.priorities[1] = 0;
				/*if(core.set_forced_attack) {
					core.set_forced_attack = false;
					emplace_process<Processors::ForcedBattle>();
				}*/
				return TRUE;
			}
			return FALSE;
		}
		auto newchain = std::next(core.select_chains.begin(), returns.at<int32_t>(0));
		effect* peffect = newchain->triggering_effect;
		uint8_t tp = newchain->triggering_player;
		peffect->get_handler()->set_status(STATUS_CHAINING, TRUE);
		peffect->dec_count(tp);
		core.new_chains.splice(core.new_chains.end(), core.select_chains, newchain);
		core.quick_f_chain.erase(peffect);
		arg.step = Processors::restart;
		return FALSE;
	}
	case 2: {
		if(core.ignition_priority_chains.size())
			core.select_chains.swap(core.ignition_priority_chains);
		for(auto& event : { &core.point_event , &core.instant_event }) {
			for(auto evit = event->begin(); evit != event->end(); ++evit) {
				auto pr = effects.activate_effect.equal_range(evit->event_code);
				for(auto eit = pr.first; eit != pr.second;) {
					effect* peffect = eit->second;
					++eit;
					peffect->set_activate_location();
					if(!peffect->is_flag(EFFECT_FLAG_DELAY) && peffect->is_chainable(priority) && peffect->is_activateable(priority, *evit)) {
						card* phandler = peffect->get_handler();
						auto& newchain = core.select_chains.emplace_back();
						newchain.flag = 0;
						newchain.chain_id = infos.field_id++;
						newchain.evt = *evit;
						newchain.triggering_effect = peffect;
						newchain.set_triggering_state(phandler);
						newchain.triggering_player = priority;
					}
				}
				pr = effects.quick_o_effect.equal_range(evit->event_code);
				for(auto eit = pr.first; eit != pr.second;) {
					effect* peffect = eit->second;
					++eit;
					peffect->set_activate_location();
					if(!peffect->is_flag(EFFECT_FLAG_DELAY) && peffect->is_chainable(priority) && peffect->is_activateable(priority, *evit)) {
						card* phandler = peffect->get_handler();
						auto& newchain = core.select_chains.emplace_back();
						newchain.flag = 0;
						newchain.chain_id = infos.field_id++;
						newchain.evt = *evit;
						newchain.triggering_effect = peffect;
						newchain.set_triggering_state(phandler);
						newchain.triggering_player = priority;
					}
				}
			}
		}
		for(auto& ch : core.new_ochain_h) {
			effect* peffect = ch.triggering_effect;
			card* phandler = peffect->get_handler();
			if(!peffect->is_flag(EFFECT_FLAG_FIELD_ONLY) && (peffect->type & EFFECT_TYPE_FIELD)
				&& (peffect->range & LOCATION_HAND) && phandler->current.location == LOCATION_HAND) {
				if(!phandler->is_has_relation(ch) && peffect->is_condition_check(phandler->current.controler, ch.evt))
					phandler->create_relation(ch);
				peffect->set_activate_location();
				ch.triggering_player = phandler->current.controler;
				ch.set_triggering_state(phandler);
			}
			if(ch.triggering_player == priority && !phandler->is_status(STATUS_CHAINING)
				&& ((ch.triggering_location == LOCATION_HAND && phandler->is_position(POS_FACEDOWN)) || ch.triggering_location == LOCATION_DECK)
				&& phandler->is_has_relation(ch) && peffect->is_chainable(priority) && peffect->is_activateable(priority, ch.evt, TRUE)
				&& check_spself_from_hand_trigger(ch))
				core.select_chains.push_back(ch);
		}
		//delayed activate
		for(const auto& ev : core.full_event) {
			auto pr = effects.activate_effect.equal_range(ev.event_code);
			for(auto eit = pr.first; eit != pr.second;) {
				effect* peffect = eit->second;
				++eit;
				peffect->set_activate_location();
				if(peffect->is_flag(EFFECT_FLAG_DELAY) && peffect->is_chainable(priority) && peffect->is_activateable(priority, ev)) {
					card* phandler = peffect->get_handler();
					auto& newchain = core.select_chains.emplace_back();
					newchain.flag = 0;
					newchain.chain_id = infos.field_id++;
					newchain.evt = ev;
					newchain.triggering_effect = peffect;
					newchain.set_triggering_state(phandler);
					newchain.triggering_player = priority;
				}
			}
		}
		// delayed quick
		for(auto eit = core.delayed_quick.begin(); eit != core.delayed_quick.end();) {
			effect* peffect = eit->first;
			const tevent& evt = eit->second;
			++eit;
			peffect->set_activate_location();
			if(peffect->is_chainable(priority) && peffect->is_activateable(priority, evt, TRUE, FALSE, FALSE)) {
				card* phandler = peffect->get_handler();
				auto& newchain = core.select_chains.emplace_back();
				newchain.flag = 0;
				newchain.chain_id = infos.field_id++;
				newchain.evt = evt;
				newchain.triggering_effect = peffect;
				newchain.set_triggering_state(phandler);
				newchain.triggering_player = priority;
			}
		}
		core.spe_effect[priority] = static_cast<int32_t>(core.select_chains.size());
		if(!skip_freechain) {
			nil_event.event_code = EVENT_FREE_CHAIN;
			auto pr = effects.activate_effect.equal_range(EVENT_FREE_CHAIN);
			for(auto eit = pr.first; eit != pr.second;) {
				effect* peffect = eit->second;
				++eit;
				peffect->set_activate_location();
				if(peffect->is_chainable(priority) && peffect->is_activateable(priority, nil_event)) {
					card* phandler = peffect->get_handler();
					auto& newchain = core.select_chains.emplace_back();
					newchain.flag = 0;
					newchain.chain_id = infos.field_id++;
					newchain.evt = nil_event;
					newchain.triggering_effect = peffect;
					newchain.set_triggering_state(phandler);
					newchain.triggering_player = priority;
					if(check_hint_timing(peffect) || check_cteffect_hint(peffect, priority))
						++core.spe_effect[priority];
				}
			}
			pr = effects.quick_o_effect.equal_range(EVENT_FREE_CHAIN);
			for(auto eit = pr.first; eit != pr.second;) {
				effect* peffect = eit->second;
				++eit;
				peffect->set_activate_location();
				if(peffect->is_chainable(priority) && peffect->is_activateable(priority, nil_event)) {
					card* phandler = peffect->get_handler();
					auto& newchain = core.select_chains.emplace_back();
					newchain.flag = 0;
					newchain.chain_id = infos.field_id++;
					newchain.evt = nil_event;
					newchain.triggering_effect = peffect;
					newchain.set_triggering_state(phandler);
					newchain.triggering_player = priority;
					if(check_hint_timing(peffect))
						++core.spe_effect[priority];
				}
			}
		}
		if(core.current_chain.size() || (core.hint_timing[0] & TIMING_ATTACK) || (core.hint_timing[1] & TIMING_ATTACK))
			core.spe_effect[priority] = static_cast<int32_t>(core.select_chains.size());
		emplace_process<Processors::SelectChain>(priority, core.spe_effect[priority], false);
		return FALSE;
	}
	case 3: {
		if(core.select_chains.size() && returns.at<int32_t>(0) != -1) {
			auto newchain = std::next(core.select_chains.begin(), returns.at<int32_t>(0));
			effect* peffect = newchain->triggering_effect;
			core.delayed_quick.erase(std::make_pair(peffect, newchain->evt));
			core.new_chains.splice(core.new_chains.end(), core.select_chains, newchain);
			peffect->get_handler()->set_status(STATUS_CHAINING, TRUE);
			peffect->dec_count(priority);
			emplace_process<Processors::AddChain>();
			emplace_process<Processors::QuickEffect>(false, 1 - priority);
			infos.priorities[0] = 0;
			infos.priorities[1] = 0;
		} else {
			infos.priorities[priority] = 1;
			if(!infos.priorities[0] || !infos.priorities[1])
				emplace_process<Processors::QuickEffect>(Step{ 1 }, skip_freechain, 1 - priority);
			else {
				core.hint_timing[0] &= TIMING_DAMAGE_STEP | TIMING_DAMAGE_CAL;
				core.hint_timing[1] &= TIMING_DAMAGE_STEP | TIMING_DAMAGE_CAL;
			}
		}
		core.select_chains.clear();
		/*if(core.set_forced_attack) {
			core.set_forced_attack = false;
			emplace_process<Processors::ForcedBattle>();
		}*/
		return TRUE;
	}
	}
	/*if(core.set_forced_attack) {
		core.set_forced_attack = false;
		emplace_process<Processors::ForcedBattle>();
	}*/
	return TRUE;
}
int32_t field::process_instant_event() {
	auto check_simul = [&just_sent=core.just_sent_cards](effect* peffect, card* phandler) {
		return (peffect->flag[1] & EFFECT_FLAG2_CHECK_SIMULTANEOUS) != 0 && just_sent.find(phandler) != just_sent.end();
	};
	if(core.queue_event.size() == 0) {
		/*if(core.set_forced_attack)
			emplace_process<Processors::ForcedBattle>();*/
		return TRUE;
	}
	chain_list tp;
	chain_list ntp;
	for(const auto& ev : core.queue_event) {
		//continuous events
		auto pr = effects.continuous_effect.equal_range(ev.event_code);
		for(auto eit = pr.first; eit != pr.second;) {
			effect* peffect = eit->second;
			++eit;
			uint8_t owner_player = peffect->get_handler_player();
			if(peffect->is_flag(EFFECT_FLAG_EVENT_PLAYER) && (ev.event_player == 0 || ev.event_player == 1))
				owner_player = ev.event_player;
			if(peffect->is_activateable(owner_player, ev)) {
				auto& chain_set = [&]() -> chain_list& {
					if(peffect->is_flag(EFFECT_FLAG_DELAY) && (core.chain_solving || core.conti_solving)) {
						if(owner_player == infos.turn_player)
							return core.delayed_continuous_tp;
						return core.delayed_continuous_ntp;
					}
					if(owner_player == infos.turn_player)
						return tp;
					return ntp;
				}();
				auto& newchain = chain_set.emplace_back();
				newchain.chain_id = 0;
				newchain.chain_count = 0;
				newchain.triggering_effect = peffect;
				newchain.triggering_player = owner_player;
				newchain.evt = ev;
				newchain.target_cards = nullptr;
				newchain.target_player = PLAYER_NONE;
				newchain.target_param = 0;
				newchain.disable_player = PLAYER_NONE;
				newchain.disable_reason = nullptr;
				newchain.flag = 0;
			}
		}
		if(ev.event_code == EVENT_ADJUST || ev.event_code == EVENT_BREAK_EFFECT || ((ev.event_code & 0xfffff000u) == EVENT_PHASE_START))
			continue;
		//triggers
		pr = effects.trigger_f_effect.equal_range(ev.event_code);
		for(auto eit = pr.first; eit != pr.second;) {
			effect* peffect = eit->second;
			++eit;
			card* phandler = peffect->get_handler();
			if(!phandler->is_status(STATUS_EFFECT_ENABLED) || !peffect->is_condition_check(phandler->current.controler, ev))
				continue;
			bool was_just_sent = false;
			if((was_just_sent = check_simul(peffect, phandler)) == true && (peffect->range & LOCATION_HAND) == 0)
				continue;
			peffect->set_activate_location();
			auto& newchain = core.new_fchain.emplace_back();
			newchain.was_just_sent = was_just_sent;
			newchain.flag = 0;
			newchain.chain_id = infos.field_id++;
			newchain.event_id = ev.global_id;
			newchain.evt = ev;
			newchain.triggering_effect = peffect;
			newchain.set_triggering_state(phandler);
			if(peffect->is_flag(EFFECT_FLAG_EVENT_PLAYER) && (ev.event_player == 0 || ev.event_player == 1))
				newchain.triggering_player = ev.event_player;
			else
				newchain.triggering_player = phandler->current.controler;
			phandler->create_relation(newchain);
		}
		pr = effects.trigger_o_effect.equal_range(ev.event_code);
		for(auto eit = pr.first; eit != pr.second;) {
			effect* peffect = eit->second;
			++eit;
			card* phandler = peffect->get_handler();
			bool act = phandler->is_status(STATUS_EFFECT_ENABLED) && peffect->is_condition_check(phandler->current.controler, ev);
			bool was_just_sent = false;
			if((was_just_sent = check_simul(peffect, phandler)) == true && (peffect->range & LOCATION_HAND) == 0)
				continue;
			if((peffect->range & LOCATION_HAND) == 0 && !act)
				continue;
			peffect->set_activate_location();
			auto& newchain = core.new_ochain.emplace_back();
			newchain.was_just_sent = was_just_sent;
			newchain.flag = 0;
			newchain.chain_id = infos.field_id++;
			newchain.event_id = ev.global_id;
			newchain.evt = ev;
			newchain.triggering_effect = peffect;
			newchain.set_triggering_state(phandler);
			if(peffect->is_flag(EFFECT_FLAG_EVENT_PLAYER) && (ev.event_player == 0 || ev.event_player == 1))
				newchain.triggering_player = ev.event_player;
			else
				newchain.triggering_player = phandler->current.controler;
			if(peffect->is_flag(EFFECT_FLAG_FIELD_ONLY)
				|| !(peffect->range & LOCATION_HAND)
				|| ((peffect->range & phandler->current.location) && act))
				phandler->create_relation(newchain);
		}
		//instant_f
		pr = effects.quick_f_effect.equal_range(ev.event_code);
		for(auto eit = pr.first; eit != pr.second;) {
			effect* peffect = eit->second;
			++eit;
			card* phandler = peffect->get_handler();
			peffect->set_activate_location();
			if(peffect->is_activateable(phandler->current.controler, ev)) {
				chain& newchain = core.quick_f_chain[peffect];
				newchain.flag = 0;
				newchain.chain_id = infos.field_id++;
				newchain.evt = ev;
				newchain.triggering_effect = peffect;
				newchain.set_triggering_state(phandler);
				if(peffect->is_flag(EFFECT_FLAG_EVENT_PLAYER) && (ev.event_player == 0 || ev.event_player == 1))
					newchain.triggering_player = ev.event_player;
				else
					newchain.triggering_player = phandler->current.controler;
				phandler->create_relation(newchain);
			}
		}
		// delayed activate effect
		core.delayed_activate_event.push_back(ev);
		// delayed quick effect
		pr = effects.quick_o_effect.equal_range(ev.event_code);
		for(auto eit = pr.first; eit != pr.second;) {
			effect* peffect = eit->second;
			++eit;
			if(peffect->is_flag(EFFECT_FLAG_DELAY) && peffect->is_condition_check(peffect->get_handler()->current.controler, ev))
				core.delayed_quick_tmp.emplace(peffect, ev);
		}
	}
	while(tp.size()) {
		core.sub_solving_continuous.splice(core.sub_solving_continuous.end(), tp, tp.begin());
		emplace_process<Processors::SolveContinuous>();
	}
	while(ntp.size()) {
		core.sub_solving_continuous.splice(core.sub_solving_continuous.end(), ntp, ntp.begin());
		emplace_process<Processors::SolveContinuous>();
	}
	core.instant_event.splice(core.instant_event.end(), core.queue_event);
	/*if(core.set_forced_attack) {
		core.set_forced_attack = false;
		emplace_process<Processors::ForcedBattle>();
	}*/
	return TRUE;
}
int32_t field::process_single_event() {
	if(core.single_event.size() == 0) {
		/*if(core.set_forced_attack) {
			core.set_forced_attack = false;
			emplace_process<Processors::ForcedBattle>();
		}*/
		return TRUE;
	}
	chain_list tp;
	chain_list ntp;
	for(const auto& ev : core.single_event) {
		card* starget = ev.trigger_card;
		auto pr = starget->single_effect.equal_range(ev.event_code);
		for(auto eit = pr.first; eit != pr.second;) {
			effect* peffect = eit->second;
			++eit;
			process_single_event(peffect, ev, tp, ntp);
		}
		for(auto& pcard : starget->xyz_materials) {
			pr = pcard->xmaterial_effect.equal_range(ev.event_code);
			for(auto eit = pr.first; eit != pr.second;) {
				effect* peffect = eit->second;
				++eit;
				if(peffect->type & EFFECT_TYPE_FIELD)
					continue;
				process_single_event(peffect, ev, tp, ntp);
			}
		}
	}
	while(tp.size()) {
		core.sub_solving_continuous.splice(core.sub_solving_continuous.end(), tp, tp.begin());
		emplace_process<Processors::SolveContinuous>();
	}
	while(ntp.size()) {
		core.sub_solving_continuous.splice(core.sub_solving_continuous.end(), ntp, ntp.begin());
		emplace_process<Processors::SolveContinuous>();
	}
	core.single_event.clear();
	/*if(core.set_forced_attack) {
		core.set_forced_attack = false;
		emplace_process<Processors::ForcedBattle>();
	}*/
	return TRUE;
}
int32_t field::process_single_event(effect* peffect, const tevent& e, chain_list& tp, chain_list& ntp) {
	if(!(peffect->type & EFFECT_TYPE_ACTIONS))
		return FALSE;
	if((peffect->type & EFFECT_TYPE_FLIP) && (e.event_value & (NO_FLIP_EFFECT >> 16)))
		return FALSE;
	//continuous & trigger (single)
	if(peffect->type & EFFECT_TYPE_CONTINUOUS) {
		uint8_t owner_player = peffect->get_handler_player();
		if(peffect->is_flag(EFFECT_FLAG_EVENT_PLAYER) && (e.event_player == 0 || e.event_player == 1))
			owner_player = e.event_player;
		if(peffect->is_activateable(owner_player, e)) {
			auto& chain_set = [&]() -> chain_list& {
				if(peffect->is_flag(EFFECT_FLAG_DELAY) && (core.chain_solving || core.conti_solving)) {
					if(owner_player == infos.turn_player)
						return core.delayed_continuous_tp;
					return core.delayed_continuous_ntp;
				}
				if(owner_player == infos.turn_player)
					return tp;
				return ntp;
			}();
			auto& newchain = chain_set.emplace_back();
			newchain.chain_id = 0;
			newchain.chain_count = 0;
			newchain.triggering_effect = peffect;
			newchain.triggering_player = owner_player;
			newchain.evt = e;
			newchain.target_cards = nullptr;
			newchain.target_player = PLAYER_NONE;
			newchain.target_param = 0;
			newchain.disable_player = PLAYER_NONE;
			newchain.disable_reason = nullptr;
			newchain.flag = 0;
		}
	} else {
		card* phandler = peffect->get_handler();
		if(!peffect->is_condition_check(phandler->current.controler, e))
			return FALSE;
		peffect->set_activate_location();
		auto& chain_set = [&]() -> chain_list& {
			if(core.flip_delayed && e.event_code == EVENT_FLIP) {
				if(peffect->type & EFFECT_TYPE_TRIGGER_O)
					return core.new_ochain_b;
				return core.new_fchain_b;
			}
			if(peffect->type & EFFECT_TYPE_TRIGGER_O)
				return core.new_ochain;
			return core.new_fchain;
		}();
		auto& newchain = chain_set.emplace_back();
		newchain.flag = 0;
		newchain.chain_id = infos.field_id++;
		newchain.event_id = e.global_id;
		newchain.evt = e;
		newchain.triggering_effect = peffect;
		newchain.set_triggering_state(phandler);
		if(peffect->is_flag(EFFECT_FLAG_EVENT_PLAYER) && (e.event_player == 0 || e.event_player == 1))
			newchain.triggering_player = e.event_player;
		else {
			if(phandler->current.reason & REASON_TEMPORARY)
				newchain.triggering_player = phandler->previous.controler;
			else
				newchain.triggering_player = newchain.triggering_controler;
		}
		peffect->set_active_type();
		phandler->create_relation(newchain);
		effect* deffect;
		if((deffect = phandler->is_affected_by_effect(EFFECT_DISABLE_EFFECT)) != nullptr) {
			effect* negeff = pduel->new_effect();
			negeff->owner = deffect->owner;
			negeff->type = EFFECT_TYPE_SINGLE;
			negeff->code = EFFECT_DISABLE_CHAIN;
			negeff->value = newchain.chain_id;
			negeff->reset_flag = RESET_EVENT | deffect->get_value();
			phandler->add_effect(negeff);
		}
	}
	/*if(core.set_forced_attack) {
		core.set_forced_attack = false;
		emplace_process<Processors::ForcedBattle>();
	}*/
	return TRUE;
}
