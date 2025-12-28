const { EFFECT_CODES } = require('../effect');

const { EFFECT_CANNOT_BP, EFFECT_SKIP_BP } = EFFECT_CODES;

const { FORCED_BATTLE_CONSTANTS } = require('../processor');

const {
  PHASE_BATTLE_START,
  PHASE_BATTLE_STEP,
  PHASE_BATTLE,
  MSG_NEW_PHASE,
} = FORCED_BATTLE_CONSTANTS;

/**
 * Ports the native `field::process(Processors::ForcedBattle&)` control flow.
 * @param {import('../processor').ProcessDescriptor|import('../field').Field} unit Process descriptor or field instance.
 * @param {import('../field').Field} field Field instance driving resolution.
 * @returns {boolean} True when processing completes for the current step.
 */
function processForcedBattle(unit, field) {
  const isFieldArg = unit && unit.core && unit.infos && unit.player;
  const context = isFieldArg ? unit : field ?? this;
  const arg = (isFieldArg ? field : unit?.payload ?? unit) ?? {};
  const step = isFieldArg ? (arg.step ?? 0) : (unit?.step ?? arg.step ?? 0);
  const { core, infos, player, returns, pduel } = context;

  switch (step) {
    case 0: {
      if (context.is_player_affected_by_effect(infos.turn_player, EFFECT_CANNOT_BP)) return true;
      core.battle_phase_count[infos.turn_player] += 1;
      if (context.is_player_affected_by_effect(infos.turn_player, EFFECT_SKIP_BP) || core.force_turn_end) {
        let message = pduel.new_message(MSG_NEW_PHASE);
        message.write(PHASE_BATTLE_START);
        context.reset_phase(PHASE_BATTLE_START);
        context.reset_phase(PHASE_BATTLE_STEP);
        context.reset_phase(PHASE_BATTLE);
        context.adjust_all();
        message = pduel.new_message(MSG_NEW_PHASE);
        message.write(infos.phase);
        return true;
      }
      arg.backup_phase = infos.phase;
      const tmpAttacker = core.forced_attacker;
      const tmpAttackTarget = core.forced_attack_target;
      if (!tmpAttacker?.is_capable_attack_announce(infos.turn_player)) return true;
      const cv = [];
      context.get_attack_target(tmpAttacker, cv);
      if ((!cv.length && tmpAttacker.direct_attackable === 0)
        || (tmpAttackTarget && !cv.includes(tmpAttackTarget))) {
        return true;
      }
      core.attacker = tmpAttacker;
      core.attack_target = tmpAttackTarget;
      for (let p = 0; p < 2; ++p) {
        for (const pcard of player[p].list_mzone) {
          if (!pcard) continue;
          pcard.attack_announce_count = 0;
          pcard.announce_count = 0;
          pcard.attacked_count = 0;
          pcard.announced_cards.clear();
          pcard.attacked_cards.clear();
          pcard.battled_cards.clear();
        }
      }
      core.attack_cancelable = true;
      core.attack_cost_paid = false;
      core.chain_attacker_id = 0;
      core.chain_attack_target = null;
      returns.set(0, 1);
      context.reset_phase(infos.phase);
      context.reset_phase(PHASE_BATTLE_START);
      infos.phase = PHASE_BATTLE_STEP;
      core.new_fchain.clear();
      core.new_ochain.clear();
      core.quick_f_chain.clear();
      core.delayed_quick_tmp.clear();
      const message = pduel.new_message(MSG_NEW_PHASE);
      message.write(PHASE_BATTLE_START);
      context.emplace_process?.('BattleCommand', { step: 1 }, null, true);
      return false;
    }
    case 1: {
      context.reset_phase(infos.phase);
      infos.phase = arg.backup_phase;
      core.new_fchain.clear();
      core.new_ochain.clear();
      core.quick_f_chain.clear();
      core.delayed_quick_tmp.clear();
      for (let p = 0; p < 2; ++p) {
        for (const pcard of player[p].list_mzone) {
          if (!pcard) continue;
          pcard.attack_announce_count = 0;
          pcard.announce_count = 0;
          pcard.attacked_count = 0;
          pcard.announced_cards.clear();
          pcard.attacked_cards.clear();
          pcard.battled_cards.clear();
        }
      }
      core.attacker = null;
      core.attack_target = null;
      const message = pduel.new_message(MSG_NEW_PHASE);
      message.write(infos.phase);
      return true;
    }
    default:
      return true;
  }
}

module.exports = processForcedBattle;
