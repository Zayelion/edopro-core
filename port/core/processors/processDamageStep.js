const { EFFECT_CODES, EFFECT_FLAGS } = require('../effect');
const { CARD_LOCATIONS, PLAYERS } = require('../card');
const { POSITION_CONSTANTS, DAMAGE_STEP_CONSTANTS } = require('../processor');
const { LuaParam } = require('../interpreter');

const { LOCATION_MZONE } = CARD_LOCATIONS;
const { PLAYER_NONE } = PLAYERS;

const {
  POS_FACEUP_ATTACK,
  POS_FACEDOWN_ATTACK,
  POS_FACEUP_DEFENSE,
  POS_FACEDOWN_DEFENSE,
  POS_ATTACK,
  POS_FACEUP,
  POS_FACEDOWN,
} = POSITION_CONSTANTS;

const {
  PHASE_DAMAGE,
  PHASE_DAMAGE_CAL,
  STATUS_ATTACK_CANCELED,
  MSG_ATTACK,
  MSG_DAMAGE_STEP_START,
  DUEL_0_ATK_DESTROYED,
} = DAMAGE_STEP_CONSTANTS;

const {
  EFFECT_DEFENSE_ATTACK,
  EFFECT_CHANGE_BATTLE_STAT,
  EFFECT_PIERCE,
  EFFECT_BOTH_BATTLE_DAMAGE,
  EFFECT_REFLECT_BATTLE_DAMAGE,
  EFFECT_ALSO_BATTLE_DAMAGE,
  EFFECT_CHANGE_BATTLE_DAMAGE,
  EFFECT_NO_BATTLE_DAMAGE,
  EFFECT_AVOID_BATTLE_DAMAGE,
  EFFECT_BATTLE_DAMAGE_TO_EFFECT,
  DOUBLE_DAMAGE,
  HALF_DAMAGE,
} = EFFECT_CODES;

const { EFFECT_FLAG_PLAYER_TARGET } = EFFECT_FLAGS;

const effectSortId = (left, right) => (left?.id ?? 0) - (right?.id ?? 0);

const ensureBattleDamage = (core) => {
  if (!Array.isArray(core.battle_damage)) {
    core.battle_damage = [0, 0];
    return;
  }
  core.battle_damage[0] = core.battle_damage[0] ?? 0;
  core.battle_damage[1] = core.battle_damage[1] ?? 0;
};

const applyEffectDamageChange = (eset, context, cardForValue) => {
  const { core, pduel } = context;
  eset.sort(effectSortId);
  for (let p = 0; p < 2; ++p) {
    let doubleDam = false;
    let halfDam = false;
    let damValue = -1;
    for (const peff of eset) {
      let val = -1;
      if (!peff.is_flag(EFFECT_FLAG_PLAYER_TARGET)) {
        pduel.lua.add_param(LuaParam.INT, p);
        pduel.lua.add_param(LuaParam.CARD, cardForValue);
        val = peff.get_value(2);
      } else if (peff.is_target_player(p)) {
        pduel.lua.add_param(LuaParam.CARD, cardForValue);
        val = peff.get_value(1);
      }
      if (val === DOUBLE_DAMAGE) {
        doubleDam = true;
      } else if (val === HALF_DAMAGE) {
        halfDam = true;
      } else if (val > 0) {
        damValue = val;
      } else if (val === 0) {
        damValue = 0;
        break;
      }
    }
    if (doubleDam && halfDam) {
      doubleDam = false;
      halfDam = false;
    }
    if (doubleDam) core.battle_damage[p] *= 2;
    if (halfDam) core.battle_damage[p] = Math.trunc(core.battle_damage[p] / 2);
    if (damValue >= 0 && core.battle_damage[p] > 0) core.battle_damage[p] = damValue;
  }
};

const resolveReflectAlso = (context, reflect, also, damp, pa, both) => {
  const { core } = context;
  if (both) {
    if (reflect[pa] && reflect[pa].get_handler_player() === pa) {
      core.battle_damage[1 - pa] += core.battle_damage[pa];
      core.battle_damage[pa] = 0;
    } else if (reflect[1 - pa] && reflect[1 - pa].get_handler_player() === pa) {
      core.battle_damage[pa] += core.battle_damage[1 - pa];
      core.battle_damage[1 - pa] = 0;
    } else if (reflect[pa] && reflect[pa].get_handler_player() === 1 - pa) {
      core.battle_damage[1 - pa] += core.battle_damage[pa];
      core.battle_damage[pa] = 0;
    } else if (reflect[1 - pa] && reflect[1 - pa].get_handler_player() === 1 - pa) {
      core.battle_damage[pa] += core.battle_damage[1 - pa];
      core.battle_damage[1 - pa] = 0;
    }
    return;
  }
  if (reflect[damp]) {
    if (!also[1 - damp]) {
      core.battle_damage[1 - damp] += core.battle_damage[damp];
      core.battle_damage[damp] = 0;
    } else {
      core.battle_damage[1 - damp] += core.battle_damage[damp];
      core.battle_damage[damp] = core.battle_damage[1 - damp];
    }
  } else if (also[damp]) {
    if (!reflect[1 - damp]) {
      core.battle_damage[1 - damp] += core.battle_damage[damp];
    } else {
      core.battle_damage[1 - damp] += core.battle_damage[damp];
      core.battle_damage[damp] += core.battle_damage[1 - damp];
      core.battle_damage[1 - damp] = 0;
    }
  }
};

const calculateBattleDamage = (context, outDamage, outReason, outDestroyed) => {
  const { core } = context;
  ensureBattleDamage(core);

  const aa = core.attacker.get_attack();
  const ad = core.attacker.get_defense();
  let da = 0;
  let dd = 0;
  let a = aa;
  let d;
  const pa = core.attacker.current.controler;
  let pd;
  let damp = 0;
  let damchange = null;
  let reasonCard = null;
  const bd = [false, false];
  let pierce = false;
  core.battle_damage[0] = 0;
  core.battle_damage[1] = 0;

  if (core.attacker.is_position(POS_FACEUP_DEFENSE)) {
    const defattack = core.attacker.is_affected_by_effect(EFFECT_DEFENSE_ATTACK);
    if (defattack && defattack.get_value(core.attacker)) a = ad;
  }
  let battstat = core.attacker.is_affected_by_effect(EFFECT_CHANGE_BATTLE_STAT);
  if (battstat) a = battstat.get_value(core.attacker);

  if (core.attack_target) {
    da = core.attack_target.get_attack();
    dd = core.attack_target.get_defense();
    pd = core.attack_target.current.controler;
    battstat = core.attack_target.is_affected_by_effect(EFFECT_CHANGE_BATTLE_STAT);
    if (battstat) d = battstat.get_value(core.attack_target);
    else if (core.attack_target.is_position(POS_ATTACK)) d = da;
    else d = dd;

    if (core.attack_target.is_position(POS_ATTACK)) {
      if (a > d) {
        damp = pd;
        core.battle_damage[damp] = a - d;
        reasonCard = core.attacker;
        bd[1] = true;
      } else if (a < d) {
        damp = pa;
        core.battle_damage[damp] = d - a;
        reasonCard = core.attack_target;
        bd[0] = true;
      } else if (a !== 0 || context.is_flag?.(DUEL_0_ATK_DESTROYED)) {
        bd[0] = true;
        bd[1] = true;
      }
    } else {
      if (a > d) {
        const eset = [];
        core.attacker.filter_effect(EFFECT_PIERCE, eset);
        if (eset.length) {
          pierce = true;
          const dp = [0, 0];
          for (const peff of eset) dp[1 - peff.get_handler_player()] = 1;
          if (dp[0]) core.battle_damage[0] = a - d;
          if (dp[1]) core.battle_damage[1] = a - d;
          let doubleDamage = false;
          for (const peff of eset) {
            if (peff.get_value() === DOUBLE_DAMAGE) doubleDamage = true;
          }
          if (doubleDamage) {
            if (dp[0]) core.battle_damage[0] *= 2;
            if (dp[1]) core.battle_damage[1] *= 2;
          }
          let both = Boolean(dp[0] && dp[1]);
          if (!both) {
            damp = dp[0] ? 0 : 1;
            if (core.attacker.is_affected_by_effect(EFFECT_BOTH_BATTLE_DAMAGE)
              || core.attack_target.is_affected_by_effect(EFFECT_BOTH_BATTLE_DAMAGE)) {
              core.battle_damage[1 - damp] = core.battle_damage[damp];
              both = true;
            }
          }
          const reflect = [null, null];
          reflect[pd] = core.attack_target.is_affected_by_effect(EFFECT_REFLECT_BATTLE_DAMAGE, core.attacker);
          if (!reflect[pd]) reflect[pd] = context.is_player_affected_by_effect(pd, EFFECT_REFLECT_BATTLE_DAMAGE);
          reflect[1 - pd] = core.attacker.is_affected_by_effect(EFFECT_REFLECT_BATTLE_DAMAGE, core.attack_target);
          if (!reflect[1 - pd]) reflect[1 - pd] = context.is_player_affected_by_effect(1 - pd, EFFECT_REFLECT_BATTLE_DAMAGE);
          const also = [false, false];
          if (!both && (core.attack_target.is_affected_by_effect(EFFECT_ALSO_BATTLE_DAMAGE)
            || context.is_player_affected_by_effect(pd, EFFECT_ALSO_BATTLE_DAMAGE))) {
            also[pd] = true;
          }
          if (!both && (core.attacker.is_affected_by_effect(EFFECT_ALSO_BATTLE_DAMAGE)
            || context.is_player_affected_by_effect(1 - pd, EFFECT_ALSO_BATTLE_DAMAGE))) {
            also[1 - pd] = true;
          }
          resolveReflectAlso(context, reflect, also, damp, pa, both);

          eset.length = 0;
          core.attacker.filter_effect(EFFECT_CHANGE_BATTLE_DAMAGE, eset, false);
          core.attack_target.filter_effect(EFFECT_CHANGE_BATTLE_DAMAGE, eset, false);
          context.filter_player_effect(pa, EFFECT_CHANGE_BATTLE_DAMAGE, eset, false);
          context.filter_player_effect(1 - pa, EFFECT_CHANGE_BATTLE_DAMAGE, eset, false);
          applyEffectDamageChange(eset, context, core.attacker);

          if (core.attacker.is_affected_by_effect(EFFECT_NO_BATTLE_DAMAGE)
            || core.attack_target.is_affected_by_effect(EFFECT_AVOID_BATTLE_DAMAGE, core.attacker)
            || context.is_player_affected_by_effect(pd, EFFECT_AVOID_BATTLE_DAMAGE)) {
            core.battle_damage[pd] = 0;
          }
          if (core.attack_target.is_affected_by_effect(EFFECT_NO_BATTLE_DAMAGE)
            || core.attacker.is_affected_by_effect(EFFECT_AVOID_BATTLE_DAMAGE, core.attack_target)
            || context.is_player_affected_by_effect(1 - pd, EFFECT_AVOID_BATTLE_DAMAGE)) {
            core.battle_damage[1 - pd] = 0;
          }
          reasonCard = core.attacker;
        }
        bd[1] = true;
      } else if (a < d) {
        damp = pa;
        core.battle_damage[damp] = d - a;
        reasonCard = core.attack_target;
      }
    }
  } else {
    if (a !== 0) {
      damp = 1 - pa;
      core.battle_damage[damp] = a;
      reasonCard = core.attacker;
    }
  }

  if (reasonCard && !pierce && (damchange = reasonCard.is_affected_by_effect(EFFECT_BATTLE_DAMAGE_TO_EFFECT)) == null) {
    const damCard = reasonCard === core.attacker ? core.attack_target : core.attacker;
    let both = false;
    if (reasonCard.is_affected_by_effect(EFFECT_BOTH_BATTLE_DAMAGE)
      || (damCard && damCard.is_affected_by_effect(EFFECT_BOTH_BATTLE_DAMAGE))) {
      core.battle_damage[1 - damp] = core.battle_damage[damp];
      both = true;
    }
    const reflect = [null, null];
    reflect[damp] = damCard ? damCard.is_affected_by_effect(EFFECT_REFLECT_BATTLE_DAMAGE, reasonCard) : null;
    if (!damCard || !reflect[damp]) reflect[damp] = context.is_player_affected_by_effect(damp, EFFECT_REFLECT_BATTLE_DAMAGE);
    reflect[1 - damp] = reasonCard.is_affected_by_effect(EFFECT_REFLECT_BATTLE_DAMAGE, damCard);
    if (!reflect[1 - damp]) reflect[1 - damp] = context.is_player_affected_by_effect(1 - damp, EFFECT_REFLECT_BATTLE_DAMAGE);
    const also = [false, false];
    if (!both && ((damCard && damCard.is_affected_by_effect(EFFECT_ALSO_BATTLE_DAMAGE))
      || context.is_player_affected_by_effect(damp, EFFECT_ALSO_BATTLE_DAMAGE))) {
      also[damp] = true;
    }
    if (!both && (reasonCard.is_affected_by_effect(EFFECT_ALSO_BATTLE_DAMAGE)
      || context.is_player_affected_by_effect(1 - damp, EFFECT_ALSO_BATTLE_DAMAGE))) {
      also[1 - damp] = true;
    }
    resolveReflectAlso(context, reflect, also, damp, pa, both);

    const eset = [];
    reasonCard.filter_effect(EFFECT_CHANGE_BATTLE_DAMAGE, eset, false);
    if (damCard) damCard.filter_effect(EFFECT_CHANGE_BATTLE_DAMAGE, eset, false);
    context.filter_player_effect(damp, EFFECT_CHANGE_BATTLE_DAMAGE, eset, false);
    context.filter_player_effect(1 - damp, EFFECT_CHANGE_BATTLE_DAMAGE, eset, false);
    applyEffectDamageChange(eset, context, reasonCard);

    if (reasonCard.is_affected_by_effect(EFFECT_NO_BATTLE_DAMAGE)
      || (damCard && damCard.is_affected_by_effect(EFFECT_AVOID_BATTLE_DAMAGE, reasonCard))
      || context.is_player_affected_by_effect(damp, EFFECT_AVOID_BATTLE_DAMAGE)) {
      core.battle_damage[damp] = 0;
    }
    if ((damCard && damCard.is_affected_by_effect(EFFECT_NO_BATTLE_DAMAGE))
      || reasonCard.is_affected_by_effect(EFFECT_AVOID_BATTLE_DAMAGE, damCard)
      || context.is_player_affected_by_effect(1 - damp, EFFECT_AVOID_BATTLE_DAMAGE)) {
      core.battle_damage[1 - damp] = 0;
    }
  }

  if (!core.battle_damage[damp] && !core.battle_damage[1 - damp]) reasonCard = null;

  if (outDamage) outDamage.value = damchange;
  if (outReason) outReason.value = reasonCard;
  if (outDestroyed) {
    outDestroyed[0] = bd[0];
    outDestroyed[1] = bd[1];
  }
  return { damage_change_effect: damchange, reason_card: reasonCard, battle_destroyed: bd };
};

/**
 * Ports the native `field::process(Processors::DamageStep&)` control flow.
 * @param {import('../processor').ProcessDescriptor|import('../field').Field} unit Process descriptor or field instance.
 * @param {import('../field').Field} field Field instance driving resolution.
 * @returns {boolean} True when processing completes for the current step.
 */
function processDamageStep(unit, field) {
  const isFieldArg = unit && unit.core && unit.infos && unit.player;
  const context = isFieldArg ? unit : field ?? this;
  const arg = (isFieldArg ? field : unit?.payload ?? unit) ?? {};
  const step = isFieldArg ? (arg.step ?? 0) : (unit?.step ?? arg.step ?? 0);
  const setStep = (value) => {
    if (unit && typeof unit.step === 'number') unit.step = value;
    arg.step = value;
  };
  const { core, infos, pduel } = context;
  const newAttack = Boolean(arg.new_attack);

  if (!context.calculate_battle_damage) {
    context.calculate_battle_damage = (damageOut, reasonOut, destroyedOut) => (
      calculateBattleDamage(context, damageOut, reasonOut, destroyedOut)
    );
  }

  switch (step) {
    case 0: {
      if (core.effect_damage_step && !newAttack) return true;
      core.effect_damage_step = 1;
      [core.attacker, arg.attacker] = [arg.attacker, core.attacker];
      [core.attack_target, arg.attack_target] = [arg.attack_target, core.attack_target];
      arg.backup_phase = infos.phase;
      if (core.attacker.current.location !== LOCATION_MZONE
        || (core.attack_target && core.attack_target.current.location !== LOCATION_MZONE)) {
        setStep(2);
        return false;
      }
      if (newAttack) {
        core.attack_state_count[infos.turn_player] += 1;
        core.battled_count[infos.turn_player] += 1;
        context.check_card_counter(core.attacker, context.ACTIVITY_ATTACK, infos.turn_player);
      }
      core.attacker.announced_cards.addcard(core.attack_target);
      context.attack_all_target_check();
      const message = pduel.new_message(MSG_ATTACK);
      message.write(core.attacker.get_info_location());
      if (core.attack_target) {
        message.write(core.attack_target.get_info_location());
      } else {
        message.write({});
      }
      infos.phase = PHASE_DAMAGE;
      pduel.new_message(MSG_DAMAGE_STEP_START);
      core.pre_field[0] = core.attacker.fieldid_r;
      core.attacker.attacked_count += 1;
      if (core.attack_target) {
        core.pre_field[1] = core.attack_target.fieldid_r;
        if (core.attack_target.is_position(POS_FACEDOWN)) {
          context.change_position(core.attack_target, null, PLAYER_NONE, core.attack_target.current.position >> 1, 0, true);
          context.adjust_all();
        }
      } else {
        core.pre_field[1] = 0;
      }
      return false;
    }
    case 1: {
      infos.phase = PHASE_DAMAGE_CAL;
      context.emplace_process?.('BattleCommand', { step: 26 });
      setStep(2);
      core.reserved = arg;
      return true;
    }
    case 2: {
      core.effect_damage_step = 2;
      context.emplace_process?.('BattleCommand', { step: 32 }, arg.cards_destroyed_by_battle);
      return false;
    }
    case 3: {
      [core.attacker, arg.attacker] = [arg.attacker, core.attacker];
      [core.attack_target, arg.attack_target] = [arg.attack_target, core.attack_target];
      if (core.attacker) core.attacker.set_status(STATUS_ATTACK_CANCELED, true);
      if (core.attack_target) core.attack_target.set_status(STATUS_ATTACK_CANCELED, true);
      core.effect_damage_step = 0;
      infos.phase = arg.backup_phase;
      return true;
    }
    default:
      return true;
  }
}

processDamageStep.calculate_battle_damage = calculateBattleDamage;

module.exports = processDamageStep;
