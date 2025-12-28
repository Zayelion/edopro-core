const { LuaParam } = require('../interpreter');

/**
 * Ports the native `field::process(Processors::SelectFusion&)` control flow.
 * @param {import('../processor').ProcessDescriptor|import('../field').Field} unit Process descriptor or field instance.
 * @param {import('../field').Field} field Field instance driving resolution.
 * @returns {boolean} True when processing completes for the current step.
 */
function processSelectFusion(unit, field) {
  const isFieldArg = unit && unit.core && unit.infos && unit.player;
  const context = isFieldArg ? unit : field ?? this;
  const arg = (isFieldArg ? field : unit?.payload ?? unit) ?? {};
  const step = isFieldArg ? (arg.step ?? 0) : (unit?.step ?? arg.step ?? 0);
  const { core, returns, pduel } = context;
  const playerid = arg.playerid ?? 0;
  const fusionMaterials = arg.fusion_materials;
  const pcard = arg.pcard;
  const forcedMaterials = arg.forced_materials;
  const chkf = arg.chkf ?? 0;

  switch (step) {
    case 0: {
      const eset = [];
      pcard.fusion_filter_valid(fusionMaterials, forcedMaterials, chkf, eset);
      core.select_effects = [];
      core.select_options = [];
      if (!eset.length) return true;
      for (const peff of eset) {
        core.select_effects.push(peff);
        core.select_options.push(peff.description);
      }
      if (core.select_options.length === 1) returns.set(0, 0);
      else context.emplace_process?.('SelectOption', playerid);
      return false;
    }
    case 1: {
      core.fusion_materials = [];
      const selected = core.select_effects[returns.at(0)];
      if (!selected) return true;
      const ev = core.sub_solving_event.emplace_back?.() ?? core.sub_solving_event.push({}) && core.sub_solving_event[core.sub_solving_event.length - 1];
      ev.event_cards = fusionMaterials;
      ev.reason_effect = selected;
      ev.reason_player = playerid;
      pduel.lua.add_param(LuaParam.GROUP, forcedMaterials);
      pduel.lua.add_param(LuaParam.INT, chkf);
      pduel.lua.add_param(LuaParam.EFFECT, core.reason_effect);
      context.emplace_process?.('ExecuteOperation', selected, playerid);
      return false;
    }
    default:
      return true;
  }
}

module.exports = processSelectFusion;
