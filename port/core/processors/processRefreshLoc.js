bool field::process(Processors::RefreshLoc& arg) {
	switch(arg.step) {
	case 0: {
		effect_set eset;
		if(is_flag(DUEL_3_COLUMNS_FIELD)) {
			player[0].used_location |= 0x1111;
			player[1].used_location |= 0x1111;
		}
		arg.previously_disabled_locations = (player[0].disabled_location & 0xffff) | (player[1].disabled_location << 16);
		player[0].disabled_location = 0;
		player[1].disabled_location = 0;
		core.disfield_effects.clear();
		core.extra_mzone_effects.clear();
		core.extra_szone_effects.clear();
		filter_field_effect(EFFECT_DISABLE_FIELD, &eset);
		for(const auto& peff : eset) {
			uint32_t value = peff->get_value();
			if(value && !peff->is_flag(EFFECT_FLAG_REPEAT)) {
				player[0].disabled_location |= value & 0xff7f;
				player[1].disabled_location |= (value >> 16) & 0xff7f;
			} else
				core.disfield_effects.push_back(peff);
		}
		eset.clear();
		filter_field_effect(EFFECT_USE_EXTRA_MZONE, &eset);
		for(const auto& peff : eset) {
			uint32_t p = peff->get_handler_player();
			uint32_t value = peff->get_value();
			player[p].disabled_location |= (value >> 16) & 0x1f;
			if((uint32_t)field_used_count[(value >> 16) & 0x1f] < (value & 0xffff))
				core.extra_mzone_effects.push_back(peff);
		}
		eset.clear();
		filter_field_effect(EFFECT_USE_EXTRA_SZONE, &eset);
		for(const auto& peff : eset) {
			uint32_t p = peff->get_handler_player();
			uint32_t value = peff->get_value();
			player[p].disabled_location |= (value >> 8) & 0x1f00;
			if((uint32_t)field_used_count[(value >> 16) & 0x1f] < (value & 0xffff))
				core.extra_szone_effects.push_back(peff);
		}
		return FALSE;
	}
	case 1: {
		if(core.disfield_effects.empty()) {
			arg.step = 2;
			return FALSE;
		}
		effect* peffect = core.disfield_effects[0];
		arg.current_disable_field_effect = peffect;
		core.disfield_effects.erase(core.disfield_effects.begin());
		if(!peffect->operation) {
			peffect->value = 0x80;
			arg.step = 0;
			return FALSE;
		}
		core.sub_solving_event.push_back(nil_event);
		emplace_process<Processors::ExecuteOperation>(peffect, peffect->get_handler_player());
		return FALSE;
	}
	case 2: {
		auto disabled_locations = returns.at<uint32_t>(0);
		disabled_locations &= 0xff7fff7f;
		if(disabled_locations == 0)
			disabled_locations = 0x80;
		if(arg.current_disable_field_effect->get_handler_player() == 0) {
			arg.current_disable_field_effect->value = disabled_locations;
			player[0].disabled_location |= disabled_locations & 0xff7f;
			player[1].disabled_location |= (disabled_locations >> 16) & 0xff7f;
		} else {
			arg.current_disable_field_effect->value = ((disabled_locations << 16) | (disabled_locations >> 16));
			player[1].disabled_location |= disabled_locations & 0xff7f;
			player[0].disabled_location |= (disabled_locations >> 16) & 0xff7f;
		}
		returns.set<uint32_t>(0, disabled_locations);
		arg.step = 0;
		return FALSE;
	}
	case 3: {
		if(core.extra_mzone_effects.size() == 0) {
			arg.step = 4;
			return FALSE;
		}
		effect* peffect = core.extra_mzone_effects[0];
		arg.current_disable_field_effect = peffect;
		core.extra_mzone_effects.erase(core.extra_mzone_effects.begin());
		uint32_t p = peffect->get_handler_player();
		uint32_t mzone_flag = (player[p].disabled_location | player[p].used_location) & 0x1f;
		if(mzone_flag == 0x1f) {
			arg.step = 4;
			return FALSE;
		}
		int32_t val = peffect->get_value();
		int32_t dis_count = (val & 0xffff) - field_used_count[(val >> 16) & 0x1f];
		int32_t empty_count = 5 - field_used_count[mzone_flag];
		uint32_t flag = mzone_flag | 0xffffffe0;
		if(dis_count > empty_count)
			dis_count = empty_count;
		arg.dis_count = dis_count;
		emplace_process<Processors::SelectDisField>(p, flag, dis_count);
		return FALSE;
	}
	case 4: {
		uint32_t dis_count = arg.dis_count;
		uint32_t mzone_flag = 0;
		uint8_t pt = 0;
		for(uint32_t i = 0; i < dis_count; ++i) {
			uint8_t s = returns.at<int8_t>(pt + 2);
			mzone_flag |= 0x1u << s;
			pt += 3;
		}
		effect* peffect = arg.current_disable_field_effect;
		player[peffect->get_handler_player()].disabled_location |= mzone_flag;
		peffect->value = (int32_t)(peffect->value | (mzone_flag << 16));
		arg.step = 2;
		return FALSE;
	}
	case 5: {
		if(core.extra_szone_effects.size() == 0) {
			arg.step = 6;
			return FALSE;
		}
		effect* peffect = core.extra_szone_effects[0];
		arg.current_disable_field_effect = peffect;
		core.extra_szone_effects.erase(core.extra_szone_effects.begin());
		uint32_t p = peffect->get_handler_player();
		uint32_t szone_flag = ((player[p].disabled_location | player[p].used_location) >> 8) & 0x1f;
		if(szone_flag == 0x1f) {
			arg.step = 6;
			return FALSE;
		}
		int32_t val = peffect->get_value();
		uint32_t dis_count = (val & 0xffff) - field_used_count[(val >> 16) & 0x1f];
		uint32_t empty_count = 5 - field_used_count[szone_flag];
		uint32_t flag = (szone_flag << 8) | 0xffffe0ff;
		if(dis_count > empty_count)
			dis_count = empty_count;
		arg.dis_count = dis_count;
		emplace_process<Processors::SelectDisField>(p, flag, dis_count);
		return FALSE;
	}
	case 6: {
		uint32_t dis_count = arg.dis_count;
		uint32_t szone_flag = 0;
		uint8_t pt = 0;
		for(uint32_t i = 0; i < dis_count; ++i) {
			uint8_t s = returns.at<int8_t>(pt + 2);
			szone_flag |= 0x1u << s;
			pt += 3;
		}
		effect* peffect = arg.current_disable_field_effect;
		player[peffect->get_handler_player()].disabled_location |= szone_flag << 8;
		peffect->value = (int32_t)(peffect->value | (szone_flag << 16));
		arg.step = 4;
		return FALSE;
	}
	case 7: {
		player[0].disabled_location |= (((player[1].disabled_location >> 5) & 1) << 6) | (((player[1].disabled_location >> 6) & 1) << 5);
		player[1].disabled_location |= (((player[0].disabled_location >> 5) & 1) << 6) | (((player[0].disabled_location >> 6) & 1) << 5);
		uint32_t dis = player[0].disabled_location | (player[1].disabled_location << 16);
		if(dis != arg.previously_disabled_locations) {
			auto message = pduel->new_message(MSG_FIELD_DISABLED);
			message->write<uint32_t>(dis);
		}
		return TRUE;
	}
	}
	return TRUE;
}
