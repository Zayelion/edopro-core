const { PLAYERS } = require('../card');

/**
 * Ports `field::process(Processors::SortChain&)` from the native engine.
 * @param {{ step: number, payload?: any, playerid?: number }} unit Process descriptor.
 * @param {import('../field').Field} field Current duel field instance.
 * @returns {boolean} True when the processor finishes for the current step.
 */
function processSortChain(unit, field) {
  const context = field ?? this;
  const arg = unit?.payload ?? unit ?? {};
  const { core, infos, returns } = context;
  const step = unit?.step ?? arg.step ?? 0;

  const isTurnPlayer = (arg.playerid ?? 0) === (infos?.turn_player ?? 0);
  const chains = isTurnPlayer ? core?.tpchain ?? [] : core?.ntpchain ?? [];

  switch (step) {
    case 0: {
      context.core.select_cards = [];
      for (const ch of chains) {
        const handler = ch?.triggering_effect?.get_handler?.();
        if (handler) context.core.select_cards.push(handler);
      }
      context.emplace_process?.('SortCard', arg.playerid, true);
      return false;
    }
    case 1: {
      if (returns?.at?.(0) === -1) return true;
      const sortMap = new Map();
      let index = 0;
      for (const ch of chains) {
        sortMap.set(ch, returns?.at?.(index) ?? 0);
        index += 1;
      }
      chains.sort((left, right) => (sortMap.get(left) ?? 0) - (sortMap.get(right) ?? 0));
      return true;
    }
    default:
      return true;
  }
}

/**
 * Mirrors `field::solve_continuous` to enqueue continuous chains.
 * @param {import('../field').Field} field Current duel field instance.
 * @param {number} playerid Player resolving the effect.
 * @param {any} peffect Triggering effect instance.
 * @param {any} event Triggering event payload.
 * @returns {void}
 */
function solveContinuous(field, playerid, peffect, event) {
  const context = field ?? this;
  if (!context || !context.core) return;
  if (!Array.isArray(context.core.sub_solving_continuous)) context.core.sub_solving_continuous = [];
  const newchain = {};
  context.core.sub_solving_continuous.push(newchain);
  newchain.chain_id = 0;
  newchain.chain_count = 0;
  newchain.triggering_effect = peffect;
  newchain.triggering_player = playerid ?? 0;
  newchain.evt = event;
  newchain.target_cards = undefined;
  newchain.target_player = PLAYERS.PLAYER_NONE;
  newchain.target_param = 0;
  newchain.disable_player = PLAYERS.PLAYER_NONE;
  newchain.disable_reason = undefined;
  newchain.flag = 0;
  context.emplace_process?.('SolveContinuous');
}

module.exports = processSortChain;
module.exports.solveContinuous = solveContinuous;
