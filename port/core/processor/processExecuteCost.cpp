bool field::process(Processors::ExecuteCost& arg) {
	auto step = arg.step;
	auto triggering_effect = arg.triggering_effect;
	auto triggering_player = arg.triggering_player;
	if(!triggering_effect->cost) {
		core.solving_event.splice(core.solving_event.begin(), core.sub_solving_event);
		pduel->lua->params.clear();
		core.solving_event.pop_front();
		return TRUE;
	}
	if (step == 0) {
		core.solving_event.splice(core.solving_event.begin(), core.sub_solving_event);
		const tevent& e = core.solving_event.front();
		pduel->lua->add_param<LuaParam::INT>(1, true);
		pduel->lua->add_param<LuaParam::INT>(e.reason_player, true);
		pduel->lua->add_param<LuaParam::INT>(e.reason, true);
		pduel->lua->add_param<LuaParam::EFFECT>(e.reason_effect , true);
		pduel->lua->add_param<LuaParam::INT>(e.event_value, true);
		pduel->lua->add_param<LuaParam::INT>(e.event_player, true);
		pduel->lua->add_param<LuaParam::GROUP>(e.event_cards , true);
		pduel->lua->add_param<LuaParam::INT>(triggering_player, true);
		pduel->lua->add_param<LuaParam::EFFECT>(triggering_effect, true);
		if(core.check_level == 0) {
			core.shuffle_deck_check[0] = false;
			core.shuffle_deck_check[1] = false;
			core.shuffle_hand_check[0] = false;
			core.shuffle_hand_check[1] = false;
		}
		arg.shuffle_check_was_disabled = core.shuffle_check_disabled;
		core.shuffle_check_disabled = false;
		++core.check_level;
	}
	core.reason_effect = triggering_effect;
	core.reason_player = triggering_player;
	uint32_t count = static_cast<uint32_t>(pduel->lua->params.size());
	lua_Integer yield_value = 0;
	int32_t result = pduel->lua->call_coroutine(triggering_effect->cost, count, &yield_value, step);
	returns.set<int32_t>(0, static_cast<int32_t>(yield_value));
	if (result != COROUTINE_YIELD) {
		core.reason_effect = nullptr;
		core.reason_player = PLAYER_NONE;
		--core.check_level;
		if(core.check_level == 0) {
			if(core.shuffle_hand_check[0])
				shuffle(0, LOCATION_HAND);
			if(core.shuffle_hand_check[1])
				shuffle(1, LOCATION_HAND);
			if(core.shuffle_deck_check[0])
				shuffle(0, LOCATION_DECK);
			if(core.shuffle_deck_check[1])
				shuffle(1, LOCATION_DECK);
		}
		core.shuffle_check_disabled = arg.shuffle_check_was_disabled;
		core.solving_event.pop_front();
		return TRUE;
	}
	return FALSE;
}
