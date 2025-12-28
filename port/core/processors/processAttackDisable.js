const { EFFECT_TYPES, EFFECT_CODES, EFFECT_EVENTS } = require('../effect');
const { CARD_LOCATIONS, PLAYERS } = require('../card');

const { EFFECT_TYPE_SINGLE } = EFFECT_TYPES;
const { EFFECT_ATTACK_DISABLED, EFFECT_UNSTOPPABLE_ATTACK } = EFFECT_CODES;
const { EVENT_ATTACK_DISABLED } = EFFECT_EVENTS;

const { LOCATION_MZONE } = CARD_LOCATIONS;

const { ATTACK_DISABLE_CONSTANTS } = require('../processor');

const { STATUS_ATTACK_CANCELED } = ATTACK_DISABLE_CONSTANTS;

/**
 * Mirrors the native `field::process(Processors::AttackDisable)` routine.
 * @param {import('../field')} field Active duel field instance.
 * @param {{step: number}} arg Processor payload mirrored from the engine.
 * @returns {boolean} True when processing finishes for this step, false when yielding.
 */
function processAttackDisable(field, arg) {
  const { core, pduel, returns } = field;

  if (arg.step === 0) {
    const attacker = core.attacker;
    if (
      !attacker
      || core.effect_damage_step !== 0
      || attacker.fieldid_r !== core.pre_field[0]
      || attacker.current.location !== LOCATION_MZONE
      || !attacker.is_capable_attack()
      || !attacker.is_affected_by_effect(core.reason_effect)
      || attacker.is_affected_by_effect(EFFECT_UNSTOPPABLE_ATTACK)
    ) {
      returns.set(0, 0);
      return true;
    }

    const effect = pduel.new_effect();
    effect.code = EFFECT_ATTACK_DISABLED;
    effect.type = EFFECT_TYPE_SINGLE;
    attacker.add_effect(effect);
    attacker.set_status(STATUS_ATTACK_CANCELED, true);
    field.raise_event(attacker, EVENT_ATTACK_DISABLED, core.reason_effect, 0, core.reason_player, PLAYERS.PLAYER_NONE, 0);
    field.process_instant_event();
    arg.step = 1;
    return false;
  }

  if (arg.step === 1) {
    returns.set(0, 1);
    return true;
  }

  return true;
}

module.exports = processAttackDisable;
