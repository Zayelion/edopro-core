bool field::process(Processors::SortDeck& arg) {
	auto sort_player = arg.sort_player;
	auto target_player = arg.target_player;
	auto count = arg.count;
	bool bottom = arg.bottom;
	auto& list = player[target_player].list_main;
	if(count > list.size())
		count = static_cast<uint16_t>(list.size());
	switch(arg.step) {
	case 0: {
		if(bottom) {
			const auto clit = list.begin();
			core.select_cards.assign(clit, clit + count);
		} else {
			const auto clit = list.rbegin();
			core.select_cards.assign(clit, clit + count);
		}
		emplace_process<Processors::SortCard>(sort_player, false);
		return FALSE;
	}
	case 1: {
		if(returns.at<int8_t>(0) == -1 || count == 0)
			return TRUE;
		card_vector tc(core.select_cards.size());
		for(uint32_t i = 0; i < count; ++i)
			tc[returns.at<uint8_t>(i)] = core.select_cards[i];
		for(uint32_t i = 0; i < count; ++i) {
			card* pcard = nullptr;
			if(bottom)
				pcard = tc[i];
			else
				pcard = tc[count - i - 1];
			auto message = pduel->new_message(MSG_MOVE);
			message->write<uint32_t>(0);
			message->write(pcard->get_info_location());
			list.erase(list.begin() + pcard->current.sequence);
			if(bottom)
				list.insert(list.begin(), pcard);
			else
				list.push_back(pcard);
			reset_sequence(target_player, LOCATION_DECK);
			message->write(pcard->get_info_location());
			message->write<uint32_t>(pcard->current.reason);
		}
		if(core.global_flag & GLOBALFLAG_DECK_REVERSE_CHECK) {
			card* ptop = list.back();
			if(core.deck_reversed || (ptop->current.position == POS_FACEUP_DEFENSE)) {
				auto message = pduel->new_message(MSG_DECK_TOP);
				message->write<uint8_t>(target_player);
				message->write<uint32_t>(0);
				message->write<uint32_t>(ptop->data.code);
				message->write<uint32_t>(ptop->current.position);
			}
		}
		return TRUE;
	}
	}
	return TRUE;
}

