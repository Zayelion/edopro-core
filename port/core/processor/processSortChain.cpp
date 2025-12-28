bool field::process(Processors::SortChain& arg) {
	auto is_turn_player = arg.playerid == infos.turn_player;
	auto& chains = is_turn_player ? core.tpchain : core.ntpchain;
	switch(arg.step) {
	case 0: {
		core.select_cards.clear();
		for(const auto& ch : chains)
			core.select_cards.push_back(ch.triggering_effect->get_handler());
		emplace_process<Processors::SortCard>(arg.playerid, true);
		return FALSE;
	}
	case 1: {
		if(returns.at<int8_t>(0) == -1)
			return TRUE;
		std::map<const chain*, int8_t> sort_map;
		int i = 0;
		for(const auto& ch : chains)
			sort_map[&ch] = returns.at<int8_t>(i++);
		chains.sort([&sort_map](const chain& c1, const chain& c2) { return sort_map[&c1] < sort_map[&c2]; });
		return TRUE;
	}
	}
	return TRUE;
}
void field::solve_continuous(uint8_t playerid, effect* peffect, const tevent& e) {
	auto& newchain = core.sub_solving_continuous.emplace_back();
	newchain.chain_id = 0;
	newchain.chain_count = 0;
	newchain.triggering_effect = peffect;
	newchain.triggering_player = playerid;
	newchain.evt = e;
	newchain.target_cards = nullptr;
	newchain.target_player = PLAYER_NONE;
	newchain.target_param = 0;
	newchain.disable_player = PLAYER_NONE;
	newchain.disable_reason = nullptr;
	newchain.flag = 0;
	emplace_process<Processors::SolveContinuous>();
}
