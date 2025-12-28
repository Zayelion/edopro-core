bool field::process(Processors::DiscardHand& arg) {
	auto playerid = arg.playerid;
	auto min = arg.min;
	auto max = arg.max;
	auto reason = arg.reason;
	switch(arg.step) {
	case 0: {
		auto message = pduel->new_message(MSG_HINT);
		message->write<uint8_t>(HINT_SELECTMSG);
		message->write<uint8_t>(playerid);
		if(reason & REASON_DISCARD)
			message->write<uint64_t>(501);
		else
			message->write<uint64_t>(504);
		emplace_process<Processors::SelectCard>(playerid, false, min, max);
		return FALSE;
	}
	case 1: {
		if(return_cards.list.empty())
			returns.set<int32_t>(0, 0);
		else
			send_to(card_set{ return_cards.list.begin(), return_cards.list.end() }, core.reason_effect, reason, core.reason_player, PLAYER_NONE, LOCATION_GRAVE, 0, POS_FACEUP);
		return TRUE;
	}
	}
	return TRUE;
}

