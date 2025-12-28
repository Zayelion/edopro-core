const { EFFECT_FLAGS, EFFECT_EVENTS } = require('../effect');
const { PLAYERS } = require('../card');

/**
 * Ports `field::process(Processors::SolveContinuous&)` from the native engine.
 * @param {{ step: number, payload?: any }} unit Process descriptor to evaluate.
 * @param {import('../field').Field} field Field instance driving resolution.
 * @returns {boolean} True when the process completes for the current step.
 */
function processSolveContinuous(unit, field) {
  const context = field ?? this;
  const arg = unit?.payload ?? unit ?? {};
  const step = unit?.step ?? arg.step ?? 0;
  const { core, infos } = context;

  if (!Array.isArray(core.solving_continuous)) core.solving_continuous = [];
  if (!Array.isArray(core.sub_solving_continuous)) core.sub_solving_continuous = [];
  if (!Array.isArray(core.continuous_chain)) core.continuous_chain = [];
  if (!Array.isArray(core.sub_solving_event)) core.sub_solving_event = [];

  const eventPhaseMask = (EFFECT_EVENTS.EVENT_PHASE ?? 0) | (EFFECT_EVENTS.EVENT_PHASE_START ?? 0);

  switch (step) {
    case 0: {
      if (core.sub_solving_continuous.length) {
        core.solving_continuous.unshift(...core.sub_solving_continuous);
        core.sub_solving_continuous.length = 0;
      }
      const clit = core.solving_continuous[0];
      if (!clit) return true;
      const peffect = clit.triggering_effect;
      const triggering_player = clit.triggering_player ?? 0;
      if (peffect?.check_count_limit && !peffect.check_count_limit(triggering_player)) {
        core.solving_continuous.shift();
        return true;
      }
      core.continuous_chain.push(clit);
      const code = peffect?.code ?? 0;
      if (peffect?.is_flag?.(EFFECT_FLAGS.EFFECT_FLAG_DELAY) || (!(code & 0xfffff000) && (code & eventPhaseMask))) {
        core.conti_solving = true;
      }
      arg.reason_effect = core.reason_effect;
      arg.reason_player = core.reason_player;
      if (!peffect?.target) return false;
      core.sub_solving_event.push(clit.evt);
      context.emplace_process?.('ExecuteTarget', peffect, triggering_player);
      return false;
    }
    case 1:
      return false;
    case 2: {
      const clit = core.solving_continuous[0];
      if (!clit) return true;
      const peffect = clit.triggering_effect;
      const triggering_player = clit.triggering_player ?? 0;
      if (!peffect?.operation) return false;
      if (peffect.dec_count) peffect.dec_count(triggering_player);
      core.sub_solving_event.push(clit.evt);
      context.emplace_process?.('ExecuteOperation', peffect, triggering_player);
      return false;
    }
    case 3: {
      const clit = core.solving_continuous[0];
      const peffect = clit?.triggering_effect;
      core.reason_effect = arg.reason_effect;
      core.reason_player = arg.reason_player;
      core.continuous_chain.pop();
      if (core.solving_continuous.length) core.solving_continuous.shift();
      const code = peffect?.code ?? 0;
      if (peffect?.is_flag?.(EFFECT_FLAGS.EFFECT_FLAG_DELAY) || (!(code & 0xfffff000) && (code & eventPhaseMask))) {
        core.conti_solving = false;
        context.adjust_all?.();
        return false;
      }
      return true;
    }
    case 4: {
      if (core.conti_player === undefined) core.conti_player = PLAYERS.PLAYER_NONE;
      if (core.conti_player === PLAYERS.PLAYER_NONE) core.conti_player = infos?.turn_player ?? 0;
      if (core.conti_player === (infos?.turn_player ?? 0)) {
        if (core.delayed_continuous_tp?.length) {
          const next = core.delayed_continuous_tp.shift();
          if (next !== undefined) core.sub_solving_continuous.push(next);
          context.emplace_process?.('SolveContinuous');
        } else {
          core.conti_player = 1 - (infos?.turn_player ?? 0);
        }
      }
      if (core.conti_player === 1 - (infos?.turn_player ?? 0)) {
        if (core.delayed_continuous_ntp?.length) {
          const next = core.delayed_continuous_ntp.shift();
          if (next !== undefined) core.sub_solving_continuous.push(next);
          context.emplace_process?.('SolveContinuous');
        } else if (core.delayed_continuous_tp?.length) {
          core.conti_player = infos?.turn_player ?? 0;
          const next = core.delayed_continuous_tp.shift();
          if (next !== undefined) core.sub_solving_continuous.push(next);
          context.emplace_process?.('SolveContinuous');
        } else {
          core.conti_player = PLAYERS.PLAYER_NONE;
        }
      }
      return true;
    }
    default:
      return true;
  }
}

module.exports = processSolveContinuous;
