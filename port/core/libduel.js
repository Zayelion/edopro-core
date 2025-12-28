// Implements libduel.cpp
const { Effect, RESET_FLAGS, EFFECT_TYPES, EFFECT_CODES } = require('./effect');
const { ScriptLib } = require('./scriptlib');

const DEFAULT_FLAG_LABEL = 0;

/**
 * Validates that the provided duel has an accessible field state.
 * @param {import('./duel').Duel} duel Duel candidate.
 * @returns {import('./field').Field|undefined} Resolved field instance.
 */
const requireField = (duel) => {
  if (!duel) return undefined;
  if (!duel.game_field) return undefined;
  return duel.game_field;
};

/**
 * No-op placeholder mirroring the native global flag toggles.
 * @returns {void}
 */
const enableGlobalFlag = () => {};

/**
 * Retrieves the life points for a specific player.
 * @param {import('./duel').Duel} duel Duel reference.
 * @param {number} playerid Player identifier (0 or 1).
 * @returns {number} Life point value or zero when unavailable.
 */
const getLP = (duel, playerid) => {
  if (playerid !== 0 && playerid !== 1) return 0;
  const field = requireField(duel);
  if (!field) return 0;
  const player = field.player[playerid];
  if (!player) return 0;
  return player.lp ?? 0;
};

/**
 * Assigns life points to a player, preventing negative values.
 * @param {import('./duel').Duel} duel Duel reference.
 * @param {number} playerid Player identifier (0 or 1).
 * @param {number} lp Life points to apply.
 * @returns {void}
 */
const setLP = (duel, playerid, lp) => {
  if (playerid !== 0 && playerid !== 1) return;
  const field = requireField(duel);
  if (!field) return;
  const player = field.player[playerid];
  if (!player) return;
  const normalized = lp < 0 ? 0 : lp;
  player.lp = normalized;
};

/**
 * Reports the active turn player.
 * @param {import('./duel').Duel} duel Duel reference.
 * @returns {number} Player index for the turn owner.
 */
const getTurnPlayer = (duel) => {
  const field = requireField(duel);
  if (!field) return 0;
  return field.infos.turn_player ?? 0;
};

/**
 * Determines whether the supplied player currently has the turn.
 * @param {import('./duel').Duel} duel Duel reference.
 * @param {number} playerid Player identifier.
 * @returns {boolean} True when the player is the turn owner.
 */
const isTurnPlayer = (duel, playerid) => getTurnPlayer(duel) === playerid;

/**
 * Retrieves the overall turn count or a per-player turn counter.
 * @param {import('./duel').Duel} duel Duel reference.
 * @param {number} [playerid] Optional player identifier for per-player tracking.
 * @returns {number} Requested turn count.
 */
const getTurnCount = (duel, playerid) => {
  const field = requireField(duel);
  if (!field) return 0;
  if (playerid === 0 || playerid === 1) return field.infos.turn_id_by_player[playerid] ?? 0;
  return field.infos.turn_id ?? 0;
};

/**
 * Retrieves the configured draw count for a player.
 * @param {import('./duel').Duel} duel Duel reference.
 * @param {number} playerid Player identifier (0 or 1).
 * @returns {number} Number of cards drawn each turn.
 */
const getDrawCount = (duel, playerid) => {
  if (playerid !== 0 && playerid !== 1) return 0;
  const field = requireField(duel);
  if (!field) return 0;
  const player = field.player[playerid];
  if (!player) return 0;
  return player.draw_count ?? 0;
};

/**
 * Registers an existing effect object to the duel state.
 * @param {import('./duel').Duel} duel Duel reference.
 * @param {Effect} effect Effect instance to track.
 * @param {number} playerid Owning player identifier.
 * @returns {void}
 */
const registerEffect = (duel, effect, playerid) => {
  if (!effect) return;
  if (playerid !== 0 && playerid !== 1) return;
  const field = requireField(duel);
  if (!field) return;
  effect.effectOwner = playerid;
  if (!effect.owner) effect.owner = field.temp_card;
  if (!duel.effects.has(effect)) duel.effects.add(effect);
};

/**
 * Creates a new flag effect mirroring the native aura behavior.
 * @param {import('./duel').Duel} duel Duel reference.
 * @param {number} playerid Owning player identifier.
 * @param {number} code Effect code identifier.
 * @param {number} reset Reset flags mask.
 * @param {number} flag Effect flag mask.
 * @param {number} count Reset count tracking value.
 * @param {number} [label=DEFAULT_FLAG_LABEL] Optional label value to store.
 * @returns {Effect|undefined} Newly registered effect when successful.
 */
const registerFlagEffect = (duel, playerid, code, reset, flag, count, label = DEFAULT_FLAG_LABEL) => {
  if (playerid !== 0 && playerid !== 1) return undefined;
  const field = requireField(duel);
  if (!field) return undefined;
  const normalizedCount = count === 0 ? 1 : count;
  let normalizedReset = reset;
  const needsTurnFlags = (normalizedReset & RESET_FLAGS.RESET_PHASE) !== 0;
  const hasTurnFlags = (normalizedReset & (RESET_FLAGS.RESET_SELF_TURN | RESET_FLAGS.RESET_OPPO_TURN)) !== 0;
  if (needsTurnFlags && !hasTurnFlags) normalizedReset |= RESET_FLAGS.RESET_SELF_TURN | RESET_FLAGS.RESET_OPPO_TURN;
  const effect = new Effect(duel);
  effect.effectOwner = playerid;
  effect.owner = field.temp_card;
  effect.handler = undefined;
  effect.type = EFFECT_TYPES.EFFECT_TYPE_FIELD;
  effect.code = (code & 0xfffffff) | EFFECT_CODES.EFFECT_FLAG_EFFECT;
  effect.resetFlag = normalizedReset;
  effect.flag[0] = flag;
  effect.sRange = 1;
  effect.oRange = 0;
  effect.resetCount = normalizedCount;
  effect.label.push(label);
  duel.effects.add(effect);
  return effect;
};

/**
 * Counts how many matching flag effects exist for a player.
 * @param {import('./duel').Duel} duel Duel reference.
 * @param {number} playerid Player identifier.
 * @param {number} code Effect code identifier.
 * @returns {number} Quantity of effects present.
 */
const getFlagEffect = (duel, playerid, code) => {
  if (playerid !== 0 && playerid !== 1) return 0;
  const codeMask = (code & 0xfffffff) | EFFECT_CODES.EFFECT_FLAG_EFFECT;
  let count = 0;
  for (const effect of duel.effects) {
    if (effect.code !== codeMask) continue;
    if (effect.effectOwner !== playerid) continue;
    count += 1;
  }
  return count;
};

/**
 * Removes all flag effects matching the provided code for a player.
 * @param {import('./duel').Duel} duel Duel reference.
 * @param {number} playerid Player identifier.
 * @param {number} code Effect code identifier.
 * @returns {void}
 */
const resetFlagEffect = (duel, playerid, code) => {
  if (playerid !== 0 && playerid !== 1) return;
  const codeMask = (code & 0xfffffff) | EFFECT_CODES.EFFECT_FLAG_EFFECT;
  for (const effect of Array.from(duel.effects)) {
    if (effect.code !== codeMask) continue;
    if (effect.effectOwner !== playerid) continue;
    duel.effects.delete(effect);
  }
};

/**
 * Updates the label value on the first matching flag effect.
 * @param {import('./duel').Duel} duel Duel reference.
 * @param {number} playerid Player identifier.
 * @param {number} code Effect code identifier.
 * @param {number} value Label value to store.
 * @returns {boolean} True when an effect was updated.
 */
const setFlagEffectLabel = (duel, playerid, code, value) => {
  if (playerid !== 0 && playerid !== 1) return false;
  const codeMask = (code & 0xfffffff) | EFFECT_CODES.EFFECT_FLAG_EFFECT;
  for (const effect of duel.effects) {
    if (effect.code !== codeMask) continue;
    if (effect.effectOwner !== playerid) continue;
    effect.label = [value];
    return true;
  }
  return false;
};

/**
 * Retrieves the labels associated with all matching flag effects.
 * @param {import('./duel').Duel} duel Duel reference.
 * @param {number} playerid Player identifier.
 * @param {number} code Effect code identifier.
 * @returns {number[]} Array of label values.
 */
const getFlagEffectLabel = (duel, playerid, code) => {
  if (playerid !== 0 && playerid !== 1) return [];
  const codeMask = (code & 0xfffffff) | EFFECT_CODES.EFFECT_FLAG_EFFECT;
  const labels = [];
  for (const effect of duel.effects) {
    if (effect.code !== codeMask) continue;
    if (effect.effectOwner !== playerid) continue;
    labels.push(effect.label.length ? effect.label[0] : DEFAULT_FLAG_LABEL);
  }
  return labels;
};

/**
 * Registers duel-facing library functions with the provided registry.
 * @param {ScriptLib} registry Registry instance or plain collector.
 * @returns {{ [key: string]: Function }} Registered function map.
 */
function registerDuelLibrary(registry) {
  const functions = {
    EnableGlobalFlag: enableGlobalFlag,
    GetLP: getLP,
    SetLP: setLP,
    GetTurnPlayer: getTurnPlayer,
    IsTurnPlayer: isTurnPlayer,
    GetTurnCount: getTurnCount,
    GetDrawCount: getDrawCount,
    RegisterEffect: registerEffect,
    RegisterFlagEffect: registerFlagEffect,
    GetFlagEffect: getFlagEffect,
    ResetFlagEffect: resetFlagEffect,
    SetFlagEffectLabel: setFlagEffectLabel,
    GetFlagEffectLabel: getFlagEffectLabel,
  };
  if (registry instanceof ScriptLib) {
    Object.entries(functions).forEach(([name, fn]) => registry.add(name, fn));
  }
  return functions;
}

module.exports = {
  enableGlobalFlag,
  getLP,
  setLP,
  getTurnPlayer,
  isTurnPlayer,
  getTurnCount,
  getDrawCount,
  registerEffect,
  registerFlagEffect,
  getFlagEffect,
  resetFlagEffect,
  setFlagEffectLabel,
  getFlagEffectLabel,
  registerDuelLibrary,
  DEFAULT_FLAG_LABEL,
};
