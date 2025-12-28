bool field::process(Processors::RefreshRelay& arg) {
	auto step = arg.step;
	switch(step) {
	case 0:
	case 1:
		if(player[step].recharge)
			next_player(step);
		return FALSE;
	default:
		return TRUE;
	}
}
