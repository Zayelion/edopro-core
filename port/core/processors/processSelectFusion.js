bool field::process(Processors::SelectFusion& arg) {
	auto playerid = arg.playerid;
	auto fusion_materials = arg.fusion_materials;
	auto pcard = arg.pcard;
	auto forced_materials = arg.forced_materials;
	auto chkf = arg.chkf;
	switch(arg.step) {
	case 0:	{
		effect_set eset;
		pcard->fusion_filter_valid(fusion_materials, forced_materials, chkf, &eset);
		core.select_effects.clear();
		core.select_options.clear();
		if(eset.empty())
			return TRUE;
		for(const auto& peff : eset) {
			core.select_effects.push_back(peff);
			core.select_options.push_back(peff->description);
		}
		if(core.select_options.size() == 1)
			returns.set<int32_t>(0, 0);
		else
			emplace_process<Processors::SelectOption>(playerid);
		return FALSE;
	}
	case 1:	{
		core.fusion_materials.clear();
		if(!core.select_effects[returns.at<int32_t>(0)])
			return TRUE;
		auto& e = core.sub_solving_event.emplace_back();
		e.event_cards = fusion_materials;
		e.reason_effect = core.select_effects[returns.at<int32_t>(0)];
		e.reason_player = playerid;
		pduel->lua->add_param<LuaParam::GROUP>(forced_materials);
		pduel->lua->add_param<LuaParam::INT>(chkf);
		pduel->lua->add_param<LuaParam::EFFECT>(core.reason_effect);
		emplace_process<Processors::ExecuteOperation>(core.select_effects[returns.at<int32_t>(0)], playerid);
		return FALSE;
	}
	}
	return TRUE;
}

