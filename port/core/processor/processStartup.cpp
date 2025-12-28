bool field::process(Processors::Startup& arg) {
	switch(arg.step) {
	case 0: {
		core.shuffle_hand_check[0] = false;
		core.shuffle_hand_check[1] = false;
		core.shuffle_deck_check[0] = false;
		core.shuffle_deck_check[1] = false;
		raise_event(nullptr, EVENT_STARTUP, nullptr, 0, 0, 0, 0);
		process_instant_event();
		return FALSE;
	}
	case 1: {
		for(int p = 0; p < 2; p++) {
			core.shuffle_hand_check[p] = false;
			core.shuffle_deck_check[p] = false;
			if(player[p].start_count > 0)
				draw(nullptr, REASON_RULE, PLAYER_NONE, p, player[p].start_count);
			auto list_size = player[p].extra_lists_main.size();
			for(size_t l = 0; l < list_size; l++) {
				auto& main = player[p].extra_lists_main[l];
				auto& hand = player[p].extra_lists_hand[l];
				for(int i = 0; i < player[p].start_count && !main.empty(); ++i) {
					card* pcard = main.back();
					main.pop_back();
					hand.push_back(pcard);
					pcard->current.controler = p;
					pcard->current.location = LOCATION_HAND;
					pcard->current.sequence = static_cast<uint32_t>(hand.size() - 1);
					pcard->current.position = POS_FACEDOWN;
				}

			}
		}
		emplace_process<Processors::Turn>(0);
		return TRUE;
	}
	}
	return TRUE;
}

