// Implements libcard.cpp
const { Card, CardState } = require('./card');
const { ScriptLib } = require('./scriptlib');

/**
 * Ensures the provided value is a card instance.
 * @param {unknown} candidate Potential card value.
 * @returns {Card} Validated card instance.
 * @throws {TypeError} When the value is not a card.
 */
const requireCard = (candidate) => {
  if (candidate instanceof Card) return candidate;
  throw new TypeError('Expected Card instance for card library operation');
};

/**
 * Pulls a state snapshot from a card.
 * @param {Card} card Card to inspect.
 * @returns {CardState} Current or fallback state.
 */
const readState = (card) => card.current ?? card.previous ?? new CardState();

/**
 * Retrieves the base code plus any auxiliary code assigned to the card.
 * @param {Card} card Card being queried.
 * @returns {number[]} Array of unique codes.
 */
const getCode = (card) => {
  const target = requireCard(card);
  const primary = target.data?.code ?? 0;
  const secondary = target.second_code ? target.second_code(primary) : target.data?.code2 ?? 0;
  if (secondary && secondary !== primary) return [primary, secondary];
  return [primary];
};

/**
 * Resolves the original printed code, respecting alias data.
 * @param {Card} card Card being queried.
 * @returns {number} Original card code.
 */
const getOriginalCode = (card) => {
  const target = requireCard(card);
  const code = target.data?.code ?? 0;
  const alias = target.data?.alias ?? 0;
  if (!alias) return code;
  const difference = code - alias;
  if (difference > -10 && difference < 10) return alias;
  return code;
};

/**
 * Retrieves the original rule code as used in a duel.
 * @param {Card} card Card being queried.
 * @returns {number[]} Rule code information.
 */
const getOriginalCodeRule = (card) => {
  const target = requireCard(card);
  const alias = target.data?.alias ?? 0;
  if (alias) return [alias];
  const code = target.data?.code ?? 0;
  return [code];
};

/**
 * Extracts current set codes from a card.
 * @param {Card} card Card being queried.
 * @returns {number[]} Set code list.
 */
const getSetCard = (card) => {
  const target = requireCard(card);
  const state = readState(target);
  if (!state.setcodes.size) return [];
  return Array.from(state.setcodes);
};

/**
 * Extracts original set codes from the card definition.
 * @param {Card} card Card being queried.
 * @returns {number[]} Set code list.
 */
const getOriginalSetCard = (card) => {
  const target = requireCard(card);
  const codes = target.data?.setcodes;
  if (!codes?.length) return [];
  return Array.from(new Set(codes));
};

/**
 * Provides the previous set codes recorded on the card.
 * @param {Card} card Card being queried.
 * @returns {number[]} Prior set codes.
 */
const getPreviousSetCard = (card) => {
  const target = requireCard(card);
  const previous = target.previous ?? new CardState();
  if (!previous.setcodes.size) return [];
  return Array.from(previous.setcodes);
};

/**
 * Retrieves the current card type flags.
 * @param {Card} card Card being queried.
 * @returns {number} Type mask.
 */
const getType = (card) => {
  const target = requireCard(card);
  const state = readState(target);
  return state.type ?? 0;
};

/**
 * Retrieves the original card type flags.
 * @param {Card} card Card being queried.
 * @returns {number} Original type mask.
 */
const getOriginalType = (card) => {
  const target = requireCard(card);
  return target.data?.type ?? 0;
};

/**
 * Reads the current level from the card state.
 * @param {Card} card Card being queried.
 * @returns {number} Level value.
 */
const getLevel = (card) => {
  const target = requireCard(card);
  const state = readState(target);
  return state.level ?? 0;
};

/**
 * Reads the current rank from the card state.
 * @param {Card} card Card being queried.
 * @returns {number} Rank value.
 */
const getRank = (card) => {
  const target = requireCard(card);
  const state = readState(target);
  return state.rank ?? 0;
};

/**
 * Reads the current link rating from the card state.
 * @param {Card} card Card being queried.
 * @returns {number} Link value.
 */
const getLink = (card) => {
  const target = requireCard(card);
  const state = readState(target);
  return state.link ?? 0;
};

/**
 * Reads the current pendulum left scale from the card state.
 * @param {Card} card Card being queried.
 * @returns {number} Left scale value.
 */
const getLeftScale = (card) => {
  const target = requireCard(card);
  const state = readState(target);
  return state.lscale ?? 0;
};

/**
 * Reads the current pendulum right scale from the card state.
 * @param {Card} card Card being queried.
 * @returns {number} Right scale value.
 */
const getRightScale = (card) => {
  const target = requireCard(card);
  const state = readState(target);
  return state.rscale ?? 0;
};

/**
 * Associates card-facing functions with a script library registry.
 * @param {ScriptLib} registry Registry that collects exported functions.
 * @returns {{ [key: string]: Function }} Registered function map.
 */
function registerCardLibrary(registry) {
  if (!(registry instanceof ScriptLib)) {
    return {
      GetCode: getCode,
      GetOriginalCode: getOriginalCode,
      GetOriginalCodeRule: getOriginalCodeRule,
      GetSetCard: getSetCard,
      GetOriginalSetCard: getOriginalSetCard,
      GetPreviousSetCard: getPreviousSetCard,
      GetType: getType,
      GetOriginalType: getOriginalType,
      GetLevel: getLevel,
      GetRank: getRank,
      GetLink: getLink,
      GetLeftScale: getLeftScale,
      GetRightScale: getRightScale,
    };
  }
  registry.add('GetCode', getCode);
  registry.add('GetOriginalCode', getOriginalCode);
  registry.add('GetOriginalCodeRule', getOriginalCodeRule);
  registry.add('GetSetCard', getSetCard);
  registry.add('GetOriginalSetCard', getOriginalSetCard);
  registry.add('GetPreviousSetCard', getPreviousSetCard);
  registry.add('GetType', getType);
  registry.add('GetOriginalType', getOriginalType);
  registry.add('GetLevel', getLevel);
  registry.add('GetRank', getRank);
  registry.add('GetLink', getLink);
  registry.add('GetLeftScale', getLeftScale);
  registry.add('GetRightScale', getRightScale);
  return {
    GetCode: getCode,
    GetOriginalCode: getOriginalCode,
    GetOriginalCodeRule: getOriginalCodeRule,
    GetSetCard: getSetCard,
    GetOriginalSetCard: getOriginalSetCard,
    GetPreviousSetCard: getPreviousSetCard,
    GetType: getType,
    GetOriginalType: getOriginalType,
    GetLevel: getLevel,
    GetRank: getRank,
    GetLink: getLink,
    GetLeftScale: getLeftScale,
    GetRightScale: getRightScale,
  };
}

module.exports = {
  registerCardLibrary,
  getCode,
  getOriginalCode,
  getOriginalCodeRule,
  getSetCard,
  getOriginalSetCard,
  getPreviousSetCard,
  getType,
  getOriginalType,
  getLevel,
  getRank,
  getLink,
  getLeftScale,
  getRightScale,
};
