const { EFFECT_CODES, EFFECT_FLAGS } = require('../effect');
const { OCG_CONSTANTS } = require('../ocgapi');

const {
  EFFECT_DISABLE_FIELD,
  EFFECT_USE_EXTRA_MZONE,
  EFFECT_USE_EXTRA_SZONE,
} = EFFECT_CODES;

const { EFFECT_FLAG_REPEAT } = EFFECT_FLAGS;

const DUEL_3_COLUMNS_FIELD = 0x4000;

const MSG_FIELD_DISABLED = 56;

const fieldUsedCount = (() => {
  const table = new Array(32).fill(0);
  for (let i = 0; i < table.length; ++i) {
    let value = i;
    let count = 0;
    while (value) {
      value &= value - 1;
      count += 1;
    }
    table[i] = count;
  }
  return table;
})();

/**
 * Ports the native `field::process(Processors::RefreshLoc&)` control flow.
 * @param {import('../processor').ProcessDescriptor|import('../field').Field} unit Process descriptor or field instance.
 * @param {import('../field').Field} field Field instance driving resolution.
 * @returns {boolean} True when processing completes for the current step.
 */
function processRefreshLoc(unit, field) {
  const isFieldArg = unit && unit.core && unit.infos && unit.player;
  const context = isFieldArg ? unit : field ?? this;
  const arg = (isFieldArg ? field : unit?.payload ?? unit) ?? {};
  const step = isFieldArg ? (arg.step ?? 0) : (unit?.step ?? arg.step ?? 0);
  const { core, player, returns, pduel } = context;

  switch (step) {
    case 0: {
      const eset = [];
      if (context.is_flag(DUEL_3_COLUMNS_FIELD)) {
        player[0].used_location |= 0x1111;
        player[1].used_location |= 0x1111;
      }
      arg.previously_disabled_locations = (player[0].disabled_location & 0xffff) | (player[1].disabled_location << 16);
      player[0].disabled_location = 0;
      player[1].disabled_location = 0;
      core.disfield_effects = [];
      core.extra_mzone_effects = [];
      core.extra_szone_effects = [];
      context.filter_field_effect?.(EFFECT_DISABLE_FIELD, eset);
      for (const peff of eset) {
        const value = peff.get_value();
        if (value && !peff.is_flag(EFFECT_FLAG_REPEAT)) {
          player[0].disabled_location |= value & 0xff7f;
          player[1].disabled_location |= (value >> 16) & 0xff7f;
        } else {
          core.disfield_effects.push(peff);
        }
      }
      eset.length = 0;
      context.filter_field_effect?.(EFFECT_USE_EXTRA_MZONE, eset);
      for (const peff of eset) {
        const p = peff.get_handler_player();
        const value = peff.get_value();
        player[p].disabled_location |= (value >> 16) & 0x1f;
        if (fieldUsedCount[(value >> 16) & 0x1f] < (value & 0xffff)) core.extra_mzone_effects.push(peff);
      }
      eset.length = 0;
      context.filter_field_effect?.(EFFECT_USE_EXTRA_SZONE, eset);
      for (const peff of eset) {
        const p = peff.get_handler_player();
        const value = peff.get_value();
        player[p].disabled_location |= (value >> 8) & 0x1f00;
        if (fieldUsedCount[(value >> 16) & 0x1f] < (value & 0xffff)) core.extra_szone_effects.push(peff);
      }
      return false;
    }
    case 1: {
      if (!core.disfield_effects.length) {
        arg.step = 2;
        return false;
      }
      const peffect = core.disfield_effects[0];
      arg.current_disable_field_effect = peffect;
      core.disfield_effects.shift();
      if (!peffect.operation) {
        peffect.value = 0x80;
        arg.step = 0;
        return false;
      }
      core.sub_solving_event.push(context.nil_event);
      context.emplace_process?.('ExecuteOperation', peffect, peffect.get_handler_player());
      return false;
    }
    case 2: {
      let disabledLocations = returns.at(0);
      disabledLocations &= 0xff7fff7f;
      if (disabledLocations === 0) disabledLocations = 0x80;
      if (arg.current_disable_field_effect.get_handler_player() === 0) {
        arg.current_disable_field_effect.value = disabledLocations;
        player[0].disabled_location |= disabledLocations & 0xff7f;
        player[1].disabled_location |= (disabledLocations >> 16) & 0xff7f;
      } else {
        arg.current_disable_field_effect.value = (disabledLocations << 16) | (disabledLocations >> 16);
        player[1].disabled_location |= disabledLocations & 0xff7f;
        player[0].disabled_location |= (disabledLocations >> 16) & 0xff7f;
      }
      returns.set(0, disabledLocations);
      arg.step = 0;
      return false;
    }
    case 3: {
      if (!core.extra_mzone_effects.length) {
        arg.step = 4;
        return false;
      }
      const peffect = core.extra_mzone_effects[0];
      arg.current_disable_field_effect = peffect;
      core.extra_mzone_effects.shift();
      const p = peffect.get_handler_player();
      const mzoneFlag = (player[p].disabled_location | player[p].used_location) & 0x1f;
      if (mzoneFlag === 0x1f) {
        arg.step = 4;
        return false;
      }
      const val = peffect.get_value();
      let disCount = (val & 0xffff) - fieldUsedCount[(val >> 16) & 0x1f];
      const emptyCount = 5 - fieldUsedCount[mzoneFlag];
      const flag = mzoneFlag | 0xffffffe0;
      if (disCount > emptyCount) disCount = emptyCount;
      arg.dis_count = disCount;
      context.emplace_process?.('SelectDisField', p, flag, disCount);
      return false;
    }
    case 4: {
      const disCount = arg.dis_count;
      let mzoneFlag = 0;
      let pt = 0;
      for (let i = 0; i < disCount; ++i) {
        const s = returns.at(pt + 2);
        mzoneFlag |= 1 << s;
        pt += 3;
      }
      const peffect = arg.current_disable_field_effect;
      player[peffect.get_handler_player()].disabled_location |= mzoneFlag;
      peffect.value = peffect.value | (mzoneFlag << 16);
      arg.step = 2;
      return false;
    }
    case 5: {
      if (!core.extra_szone_effects.length) {
        arg.step = 6;
        return false;
      }
      const peffect = core.extra_szone_effects[0];
      arg.current_disable_field_effect = peffect;
      core.extra_szone_effects.shift();
      const p = peffect.get_handler_player();
      const szoneFlag = ((player[p].disabled_location | player[p].used_location) >> 8) & 0x1f;
      if (szoneFlag === 0x1f) {
        arg.step = 6;
        return false;
      }
      const val = peffect.get_value();
      let disCount = (val & 0xffff) - fieldUsedCount[(val >> 16) & 0x1f];
      const emptyCount = 5 - fieldUsedCount[szoneFlag];
      const flag = (szoneFlag << 8) | 0xffffe0ff;
      if (disCount > emptyCount) disCount = emptyCount;
      arg.dis_count = disCount;
      context.emplace_process?.('SelectDisField', p, flag, disCount);
      return false;
    }
    case 6: {
      const disCount = arg.dis_count;
      let szoneFlag = 0;
      let pt = 0;
      for (let i = 0; i < disCount; ++i) {
        const s = returns.at(pt + 2);
        szoneFlag |= 1 << s;
        pt += 3;
      }
      const peffect = arg.current_disable_field_effect;
      player[peffect.get_handler_player()].disabled_location |= szoneFlag << 8;
      peffect.value = peffect.value | (szoneFlag << 16);
      arg.step = 4;
      return false;
    }
    case 7: {
      player[0].disabled_location |= (((player[1].disabled_location >> 5) & 1) << 6) | (((player[1].disabled_location >> 6) & 1) << 5);
      player[1].disabled_location |= (((player[0].disabled_location >> 5) & 1) << 6) | (((player[0].disabled_location >> 6) & 1) << 5);
      const dis = player[0].disabled_location | (player[1].disabled_location << 16);
      if (dis !== arg.previously_disabled_locations) {
        const message = pduel.new_message(MSG_FIELD_DISABLED);
        message.write(dis);
      }
      return true;
    }
    default:
      return true;
  }
}

module.exports = processRefreshLoc;
