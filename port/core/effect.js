// Implements effect.cpp

const EFFECT_STATUS = Object.freeze({
  EFFECT_STATUS_AVAILABLE: 0x0001,
  EFFECT_STATUS_SUMMON_SELF: 0x0004,
});

const EFFECT_COUNT_CODE = Object.freeze({
  EFFECT_COUNT_CODE_OATH: 0x1,
  EFFECT_COUNT_CODE_DUEL: 0x2,
  EFFECT_COUNT_CODE_SINGLE: 0x4,
  EFFECT_COUNT_CODE_CHAIN: 0x8,
});

const RESET_FLAGS = Object.freeze({
  RESET_SELF_TURN: 0x10000000,
  RESET_OPPO_TURN: 0x20000000,
  RESET_PHASE: 0x40000000,
  RESET_CHAIN: 0x80000000,
  RESET_EVENT: 0x1000,
  RESET_CARD: 0x2000,
  RESET_CODE: 0x4000,
  RESET_COPY: 0x8000,
  RESET_DISABLE: 0x00010000,
  RESET_TURN_SET: 0x00020000,
  RESET_TOGRAVE: 0x00040000,
  RESET_REMOVE: 0x00080000,
  RESET_TEMP_REMOVE: 0x00100000,
  RESET_TOHAND: 0x00200000,
  RESET_TODECK: 0x00400000,
  RESET_LEAVE: 0x00800000,
  RESET_TOFIELD: 0x01000000,
  RESET_CONTROL: 0x02000000,
  RESET_OVERLAY: 0x04000000,
  RESET_MSCHANGE: 0x08000000,
});

const EFFECT_TYPES = Object.freeze({
  EFFECT_TYPE_SINGLE: 0x0001,
  EFFECT_TYPE_FIELD: 0x0002,
  EFFECT_TYPE_EQUIP: 0x0004,
  EFFECT_TYPE_ACTIONS: 0x0008,
  EFFECT_TYPE_ACTIVATE: 0x0010,
  EFFECT_TYPE_FLIP: 0x0020,
  EFFECT_TYPE_IGNITION: 0x0040,
  EFFECT_TYPE_TRIGGER_O: 0x0080,
  EFFECT_TYPE_QUICK_O: 0x0100,
  EFFECT_TYPE_TRIGGER_F: 0x0200,
  EFFECT_TYPE_QUICK_F: 0x0400,
  EFFECT_TYPE_CONTINUOUS: 0x0800,
  EFFECT_TYPE_XMATERIAL: 0x1000,
  EFFECT_TYPE_GRANT: 0x2000,
  EFFECT_TYPE_TARGET: 0x4000,
});

const EFFECT_FLAGS = Object.freeze({
  EFFECT_FLAG_INITIAL: 0x0001,
  EFFECT_FLAG_FUNC_VALUE: 0x0002,
  EFFECT_FLAG_COUNT_LIMIT: 0x0004,
  EFFECT_FLAG_FIELD_ONLY: 0x0008,
  EFFECT_FLAG_CARD_TARGET: 0x0010,
  EFFECT_FLAG_IGNORE_RANGE: 0x0020,
  EFFECT_FLAG_ABSOLUTE_TARGET: 0x0040,
  EFFECT_FLAG_IGNORE_IMMUNE: 0x0080,
  EFFECT_FLAG_SET_AVAILABLE: 0x0100,
  EFFECT_FLAG_CANNOT_NEGATE: 0x0200,
  EFFECT_FLAG_CANNOT_DISABLE: 0x0400,
  EFFECT_FLAG_PLAYER_TARGET: 0x0800,
  EFFECT_FLAG_BOTH_SIDE: 0x1000,
  EFFECT_FLAG_COPY_INHERIT: 0x2000,
  EFFECT_FLAG_DAMAGE_STEP: 0x4000,
  EFFECT_FLAG_DAMAGE_CAL: 0x8000,
  EFFECT_FLAG_DELAY: 0x10000,
  EFFECT_FLAG_SINGLE_RANGE: 0x20000,
  EFFECT_FLAG_UNCOPYABLE: 0x40000,
  EFFECT_FLAG_OATH: 0x80000,
  EFFECT_FLAG_SPSUM_PARAM: 0x100000,
  EFFECT_FLAG_REPEAT: 0x200000,
  EFFECT_FLAG_NO_TURN_RESET: 0x400000,
  EFFECT_FLAG_EVENT_PLAYER: 0x800000,
  EFFECT_FLAG_OWNER_RELATE: 0x1000000,
  EFFECT_FLAG_CANNOT_INACTIVATE: 0x2000000,
  EFFECT_FLAG_CLIENT_HINT: 0x4000000,
  EFFECT_FLAG_CONTINUOUS_TARGET: 0x8000000,
  EFFECT_FLAG_LIMIT_ZONE: 0x10000000,
  EFFECT_FLAG_IMMEDIATELY_APPLY: 0x80000000,
});

const EFFECT_FLAGS2 = Object.freeze({
  EFFECT_FLAG2_CONTINUOUS_EQUIP: 0x0001,
  EFFECT_FLAG2_COF: 0x0002,
  EFFECT_FLAG2_CHECK_SIMULTANEOUS: 0x0004,
  EFFECT_FLAG2_FORCE_ACTIVATE_LOCATION: 0x40000000,
  EFFECT_FLAG2_MAJESTIC_MUST_COPY: 0x80000000,
});

const EFFECT_CODES = Object.freeze({
  EFFECT_IMMUNE_EFFECT: 1,
  EFFECT_DISABLE: 2,
  EFFECT_CANNOT_DISABLE: 3,
  EFFECT_SET_CONTROL: 4,
  EFFECT_CANNOT_CHANGE_CONTROL: 5,
  EFFECT_CANNOT_ACTIVATE: 6,
  EFFECT_CANNOT_TRIGGER: 7,
  EFFECT_DISABLE_EFFECT: 8,
  EFFECT_DISABLE_CHAIN: 9,
  EFFECT_DISABLE_TRAPMONSTER: 10,
  EFFECT_CANNOT_INACTIVATE: 12,
  EFFECT_CANNOT_DISEFFECT: 13,
  EFFECT_CANNOT_CHANGE_POSITION: 14,
  EFFECT_TRAP_ACT_IN_HAND: 15,
  EFFECT_TRAP_ACT_IN_SET_TURN: 16,
  EFFECT_REMAIN_FIELD: 17,
  EFFECT_MONSTER_SSET: 18,
  EFFECT_QP_ACT_IN_SET_TURN: 19,
  EFFECT_CANNOT_SUMMON: 20,
  EFFECT_CANNOT_FLIP_SUMMON: 21,
  EFFECT_CANNOT_SPECIAL_SUMMON: 22,
  EFFECT_CANNOT_MSET: 23,
  EFFECT_CANNOT_SSET: 24,
  EFFECT_CANNOT_DRAW: 25,
  EFFECT_CANNOT_DISABLE_SUMMON: 26,
  EFFECT_CANNOT_DISABLE_SPSUMMON: 27,
  EFFECT_SET_SUMMON_COUNT_LIMIT: 28,
  EFFECT_EXTRA_SUMMON_COUNT: 29,
  EFFECT_SPSUMMON_CONDITION: 30,
  EFFECT_REVIVE_LIMIT: 31,
  EFFECT_SUMMON_PROC: 32,
  EFFECT_LIMIT_SUMMON_PROC: 33,
  EFFECT_SPSUMMON_PROC: 34,
  EFFECT_EXTRA_SET_COUNT: 35,
  EFFECT_SET_PROC: 36,
  EFFECT_LIMIT_SET_PROC: 37,
  EFFECT_DEVINE_LIGHT: 38,
  EFFECT_CANNOT_DISABLE_FLIP_SUMMON: 39,
  EFFECT_INDESTRUCTABLE: 40,
  EFFECT_INDESTRUCTABLE_EFFECT: 41,
  EFFECT_INDESTRUCTABLE_BATTLE: 42,
  EFFECT_UNRELEASABLE_SUM: 43,
  EFFECT_UNRELEASABLE_NONSUM: 44,
  EFFECT_DESTROY_SUBSTITUTE: 45,
  EFFECT_CANNOT_RELEASE: 46,
  EFFECT_INDESTRUCTABLE_COUNT: 47,
  EFFECT_UNRELEASABLE_EFFECT: 48,
  EFFECT_DESTROY_REPLACE: 50,
  EFFECT_RELEASE_REPLACE: 51,
  EFFECT_SEND_REPLACE: 52,
  EFFECT_CANNOT_DISCARD_HAND: 55,
  EFFECT_CANNOT_DISCARD_DECK: 56,
  EFFECT_CANNOT_USE_AS_COST: 57,
  EFFECT_CANNOT_PLACE_COUNTER: 58,
  EFFECT_CANNOT_TO_GRAVE_AS_COST: 59,
  EFFECT_LEAVE_FIELD_REDIRECT: 60,
  EFFECT_TO_HAND_REDIRECT: 61,
  EFFECT_TO_DECK_REDIRECT: 62,
  EFFECT_TO_GRAVE_REDIRECT: 63,
  EFFECT_REMOVE_REDIRECT: 64,
  EFFECT_CANNOT_TO_HAND: 65,
  EFFECT_CANNOT_TO_DECK: 66,
  EFFECT_CANNOT_REMOVE: 67,
  EFFECT_CANNOT_TO_GRAVE: 68,
  EFFECT_CANNOT_TURN_SET: 69,
  EFFECT_CANNOT_BE_BATTLE_TARGET: 70,
  EFFECT_CANNOT_BE_EFFECT_TARGET: 71,
  EFFECT_IGNORE_BATTLE_TARGET: 72,
  EFFECT_CANNOT_DIRECT_ATTACK: 73,
  EFFECT_DIRECT_ATTACK: 74,
  EFFECT_GEMINI_STATUS: 75,
  EFFECT_EQUIP_LIMIT: 76,
  EFFECT_GEMINI_SUMMONABLE: 77,
  EFFECT_UNION_LIMIT: 78,
  EFFECT_REVERSE_DAMAGE: 80,
  EFFECT_REVERSE_RECOVER: 81,
  EFFECT_CHANGE_DAMAGE: 82,
  EFFECT_REFLECT_DAMAGE: 83,
  EFFECT_CANNOT_ATTACK: 85,
  EFFECT_CANNOT_ATTACK_ANNOUNCE: 86,
  EFFECT_CANNOT_CHANGE_POS_E: 87,
  EFFECT_ACTIVATE_COST: 90,
  EFFECT_SUMMON_COST: 91,
  EFFECT_SPSUMMON_COST: 92,
  EFFECT_FLIPSUMMON_COST: 93,
  EFFECT_MSET_COST: 94,
  EFFECT_SSET_COST: 95,
  EFFECT_ATTACK_COST: 96,
  EFFECT_UPDATE_ATTACK: 100,
  EFFECT_SET_ATTACK: 101,
  EFFECT_SET_ATTACK_FINAL: 102,
  EFFECT_SET_BASE_ATTACK: 103,
  EFFECT_UPDATE_DEFENSE: 104,
  EFFECT_SET_DEFENSE: 105,
  EFFECT_SET_DEFENSE_FINAL: 106,
  EFFECT_SET_BASE_DEFENSE: 107,
  EFFECT_REVERSE_UPDATE: 108,
  EFFECT_SWAP_AD: 109,
  EFFECT_SWAP_BASE_AD: 110,
  EFFECT_SWAP_ATTACK_FINAL: 111,
  EFFECT_SWAP_DEFENSE_FINAL: 112,
  EFFECT_ADD_CODE: 113,
  EFFECT_CHANGE_CODE: 114,
  EFFECT_ADD_TYPE: 115,
  EFFECT_REMOVE_TYPE: 116,
  EFFECT_CHANGE_TYPE: 117,
  EFFECT_REMOVE_CODE: 118,
  EFFECT_ADD_RACE: 120,
  EFFECT_REMOVE_RACE: 121,
  EFFECT_CHANGE_RACE: 122,
  EFFECT_ADD_ATTRIBUTE: 125,
  EFFECT_REMOVE_ATTRIBUTE: 126,
  EFFECT_CHANGE_ATTRIBUTE: 127,
  EFFECT_UPDATE_LEVEL: 130,
  EFFECT_CHANGE_LEVEL: 131,
  EFFECT_UPDATE_RANK: 132,
  EFFECT_CHANGE_RANK: 133,
  EFFECT_UPDATE_LSCALE: 134,
  EFFECT_CHANGE_LSCALE: 135,
  EFFECT_UPDATE_RSCALE: 136,
  EFFECT_CHANGE_RSCALE: 137,
  EFFECT_SET_POSITION: 140,
  EFFECT_SELF_DESTROY: 141,
  EFFECT_SELF_TOGRAVE: 142,
  EFFECT_DOUBLE_TRIBUTE: 150,
  EFFECT_DECREASE_TRIBUTE: 151,
  EFFECT_DECREASE_TRIBUTE_SET: 152,
  EFFECT_EXTRA_RELEASE: 153,
  EFFECT_TRIBUTE_LIMIT: 154,
  EFFECT_EXTRA_RELEASE_SUM: 155,
  EFFECT_TRIPLE_TRIBUTE: 156,
  EFFECT_ADD_EXTRA_TRIBUTE: 157,
  EFFECT_EXTRA_RELEASE_NONSUM: 158,
  EFFECT_PUBLIC: 160,
  EFFECT_COUNTER_PERMIT: 0x10000,
  EFFECT_COUNTER_LIMIT: 0x20000,
  EFFECT_RCOUNTER_REPLACE: 0x30000,
  EFFECT_LPCOST_CHANGE: 170,
  EFFECT_LPCOST_REPLACE: 171,
  EFFECT_SKIP_DP: 180,
  EFFECT_SKIP_SP: 181,
  EFFECT_SKIP_M1: 182,
  EFFECT_SKIP_BP: 183,
  EFFECT_SKIP_M2: 184,
  EFFECT_CANNOT_BP: 185,
  EFFECT_CANNOT_M2: 186,
  EFFECT_CANNOT_EP: 187,
  EFFECT_SKIP_TURN: 188,
  EFFECT_SKIP_EP: 189,
  EFFECT_DEFENSE_ATTACK: 190,
  EFFECT_MUST_ATTACK: 191,
  EFFECT_FIRST_ATTACK: 192,
  EFFECT_ATTACK_ALL: 193,
  EFFECT_EXTRA_ATTACK: 194,
  EFFECT_ONLY_BE_ATTACKED: 196,
  EFFECT_ATTACK_DISABLED: 197,
  EFFECT_CHANGE_BATTLE_STAT: 198,
  EFFECT_NO_BATTLE_DAMAGE: 200,
  EFFECT_AVOID_BATTLE_DAMAGE: 201,
  EFFECT_REFLECT_BATTLE_DAMAGE: 202,
  EFFECT_PIERCE: 203,
  EFFECT_BATTLE_DESTROY_REDIRECT: 204,
  EFFECT_BATTLE_DAMAGE_TO_EFFECT: 205,
  EFFECT_BOTH_BATTLE_DAMAGE: 206,
  EFFECT_ALSO_BATTLE_DAMAGE: 207,
  EFFECT_CHANGE_BATTLE_DAMAGE: 208,
  EFFECT_TOSS_COIN_REPLACE: 220,
  EFFECT_TOSS_DICE_REPLACE: 221,
  EFFECT_TOSS_COIN_CHOOSE: 222,
  EFFECT_TOSS_DICE_CHOOSE: 223,
  EFFECT_FUSION_MATERIAL: 230,
  EFFECT_CHAIN_MATERIAL: 231,
  EFFECT_SYNCHRO_MATERIAL: 232,
  EFFECT_XYZ_MATERIAL: 233,
  EFFECT_FUSION_SUBSTITUTE: 234,
  EFFECT_CANNOT_BE_FUSION_MATERIAL: 235,
  EFFECT_CANNOT_BE_SYNCHRO_MATERIAL: 236,
  EFFECT_SYNCHRO_MATERIAL_CUSTOM: 237,
  EFFECT_CANNOT_BE_XYZ_MATERIAL: 238,
  EFFECT_CANNOT_BE_LINK_MATERIAL: 239,
  EFFECT_SYNCHRO_LEVEL: 240,
  EFFECT_RITUAL_LEVEL: 241,
  EFFECT_XYZ_LEVEL: 242,
  EFFECT_EXTRA_RITUAL_MATERIAL: 243,
  EFFECT_NONTUNER: 244,
  EFFECT_OVERLAY_REMOVE_REPLACE: 245,
  EFFECT_CANNOT_BE_MATERIAL: 248,
  EFFECT_PRE_MONSTER: 250,
  EFFECT_MATERIAL_CHECK: 251,
  EFFECT_DISABLE_FIELD: 260,
  EFFECT_USE_EXTRA_MZONE: 261,
  EFFECT_USE_EXTRA_SZONE: 262,
  EFFECT_MAX_MZONE: 263,
  EFFECT_MAX_SZONE: 264,
  EFFECT_MUST_USE_MZONE: 265,
  EFFECT_BECOME_LINKED_ZONE: 266,
  EFFECT_HAND_LIMIT: 270,
  EFFECT_DRAW_COUNT: 271,
  EFFECT_SPIRIT_DONOT_RETURN: 280,
  EFFECT_SPIRIT_MAYNOT_RETURN: 281,
  EFFECT_CHANGE_ENVIRONMENT: 290,
  EFFECT_NECRO_VALLEY: 291,
  EFFECT_FORBIDDEN: 292,
  EFFECT_NECRO_VALLEY_IM: 293,
  EFFECT_REVERSE_DECK: 294,
  EFFECT_REMOVE_BRAINWASHING: 295,
  EFFECT_BP_TWICE: 296,
  EFFECT_UNIQUE_CHECK: 297,
  EFFECT_MATCH_KILL: 300,
  EFFECT_SYNCHRO_CHECK: 310,
  EFFECT_QP_ACT_IN_NTPHAND: 311,
  EFFECT_MUST_BE_SMATERIAL: 312,
  EFFECT_TO_GRAVE_REDIRECT_CB: 313,
  EFFECT_CHANGE_LEVEL_FINAL: 314,
  EFFECT_CHANGE_RANK_FINAL: 315,
  EFFECT_MUST_BE_FMATERIAL: 316,
  EFFECT_MUST_BE_XMATERIAL: 317,
  EFFECT_MUST_BE_LMATERIAL: 318,
  EFFECT_SPSUMMON_PROC_G: 320,
  EFFECT_SPSUMMON_COUNT_LIMIT: 330,
  EFFECT_LEFT_SPSUMMON_COUNT: 331,
  EFFECT_CANNOT_SELECT_BATTLE_TARGET: 332,
  EFFECT_CANNOT_SELECT_EFFECT_TARGET: 333,
  EFFECT_ADD_SETCODE: 334,
  EFFECT_NO_EFFECT_DAMAGE: 335,
  EFFECT_UNSUMMONABLE_CARD: 336,
  EFFECT_DISCARD_COST_CHANGE: 338,
  EFFECT_HAND_SYNCHRO: 339,
  EFFECT_ONLY_ATTACK_MONSTER: 343,
  EFFECT_MUST_ATTACK_MONSTER: 344,
  EFFECT_PATRICIAN_OF_DARKNESS: 345,
  EFFECT_EXTRA_ATTACK_MONSTER: 346,
  EFFECT_UNION_STATUS: 347,
  EFFECT_OLDUNION_STATUS: 348,
  EFFECT_REMOVE_SETCODE: 349,
  EFFECT_CHANGE_SETCODE: 350,
  EFFECT_EXTRA_FUSION_MATERIAL: 352,
  EFFECT_EXTRA_PENDULUM_SUMMON: 360,
  EFFECT_IRON_WALL: 361,
  EFFECT_CANNOT_LOSE_DECK: 400,
  EFFECT_CANNOT_LOSE_LP: 401,
  EFFECT_CANNOT_LOSE_EFFECT: 402,
  EFFECT_BP_FIRST_TURN: 403,
  EFFECT_UNSTOPPABLE_ATTACK: 404,
  EFFECT_ALLOW_NEGATIVE: 405,
  EFFECT_SELF_ATTACK: 406,
  EFFECT_BECOME_QUICK: 407,
  EFFECT_LEVEL_RANK: 408,
  EFFECT_RANK_LEVEL: 409,
  EFFECT_LEVEL_RANK_S: 410,
  EFFECT_RANK_LEVEL_S: 411,
  EFFECT_UPDATE_LINK: 420,
  EFFECT_CHANGE_LINK: 421,
  EFFECT_CHANGE_LINK_FINAL: 422,
  EFFECT_ADD_LINKMARKER: 423,
  EFFECT_REMOVE_LINKMARKER: 424,
  EFFECT_CHANGE_LINKMARKER: 425,
  EFFECT_FORCE_NORMAL_SUMMON_POSITION: 426,
  EFFECT_FORCE_SPSUMMON_POSITION: 427,
  EFFECT_DARKNESS_HIDE: 428,
  DOUBLE_DAMAGE: 0x80000000,
  HALF_DAMAGE: 0x80000001,
});

const EFFECT_EVENTS = Object.freeze({
  EVENT_STARTUP: 1000,
  EVENT_FLIP: 1001,
  EVENT_FREE_CHAIN: 1002,
  EVENT_DESTROY: 1010,
  EVENT_REMOVE: 1011,
  EVENT_TO_HAND: 1012,
  EVENT_TO_DECK: 1013,
  EVENT_TO_GRAVE: 1014,
  EVENT_LEAVE_FIELD: 1015,
  EVENT_CHANGE_POS: 1016,
  EVENT_RELEASE: 1017,
  EVENT_DISCARD: 1018,
  EVENT_LEAVE_FIELD_P: 1019,
  EVENT_CHAIN_SOLVING: 1020,
  EVENT_CHAIN_ACTIVATING: 1021,
  EVENT_CHAIN_SOLVED: 1022,
  EVENT_CHAIN_NEGATED: 1024,
  EVENT_CHAIN_DISABLED: 1025,
  EVENT_CHAIN_END: 1026,
  EVENT_CHAINING: 1027,
  EVENT_BECOME_TARGET: 1028,
  EVENT_DESTROYED: 1029,
  EVENT_MOVE: 1030,
  EVENT_LEAVE_GRAVE: 1031,
  EVENT_ADJUST: 1040,
  EVENT_BREAK_EFFECT: 1050,
  EVENT_SUMMON_SUCCESS: 1100,
  EVENT_FLIP_SUMMON_SUCCESS: 1101,
  EVENT_SPSUMMON_SUCCESS: 1102,
  EVENT_SUMMON: 1103,
  EVENT_FLIP_SUMMON: 1104,
  EVENT_SPSUMMON: 1105,
  EVENT_MSET: 1106,
  EVENT_SSET: 1107,
  EVENT_BE_MATERIAL: 1108,
  EVENT_BE_PRE_MATERIAL: 1109,
  EVENT_DRAW: 1110,
  EVENT_DAMAGE: 1111,
  EVENT_RECOVER: 1112,
  EVENT_PREDRAW: 1113,
  EVENT_SUMMON_NEGATED: 1114,
  EVENT_FLIP_SUMMON_NEGATED: 1115,
  EVENT_SPSUMMON_NEGATED: 1116,
  EVENT_CONTROL_CHANGED: 1120,
  EVENT_EQUIP: 1121,
  EVENT_ATTACK_ANNOUNCE: 1130,
  EVENT_BE_BATTLE_TARGET: 1131,
  EVENT_BATTLE_START: 1132,
  EVENT_BATTLE_CONFIRM: 1133,
  EVENT_PRE_DAMAGE_CALCULATE: 1134,
  EVENT_PRE_BATTLE_DAMAGE: 1136,
  EVENT_BATTLED: 1138,
  EVENT_BATTLE_DESTROYING: 1139,
  EVENT_BATTLE_DESTROYED: 1140,
  EVENT_DAMAGE_STEP_END: 1141,
  EVENT_ATTACK_DISABLED: 1142,
  EVENT_BATTLE_DAMAGE: 1143,
  EVENT_TOSS_DICE: 1150,
  EVENT_TOSS_COIN: 1151,
  EVENT_TOSS_COIN_NEGATE: 1152,
  EVENT_TOSS_DICE_NEGATE: 1153,
  EVENT_LEVEL_UP: 1200,
  EVENT_PAY_LPCOST: 1201,
  EVENT_DETACH_MATERIAL: 1202,
  EVENT_TURN_END: 1210,
  EVENT_CONFIRM: 1211,
  EVENT_TOHAND_CONFIRM: 1212,
  EVENT_PHASE: 0x1000,
  EVENT_PHASE_START: 0x2000,
  EVENT_ADD_COUNTER: 0x10000,
  EVENT_REMOVE_COUNTER: 0x20000,
  EVENT_CUSTOM: 0x10000000,
});
const { PLAYERS } = require('./card');

const FLAG_SLOTS = 2;

/**
 * Represents a single effect instance translated from the C++ engine.
 */
class Effect {
  /**
   * @param {import('./duel')} duel Owning duel instance reference.
   */
  constructor(duel) {
    this.duel = duel;
    this.countLimit = 0;
    this.countLimitMax = 0;
    this.countFlag = 0;
    this.countHoptIndex = 0;
    this.effectOwner = PLAYERS.PLAYER_NONE;
    this.type = 0;
    this.copyId = 0;
    this.range = 0;
    this.sRange = 0;
    this.oRange = 0;
    this.resetCount = 0;
    this.activeLocation = 0;
    this.activeSequence = 0;
    this.status = 0;
    this.code = 0;
    this.flag = Array.from({ length: FLAG_SLOTS }, () => 0);
    this.id = 0;
    this.initialId = 0;
    this.resetFlag = 0;
    this.countCode = 0;
    this.category = 0;
    this.hintTiming = [0, 0];
    this.cardType = 0;
    this.activeType = 0;
    this.labelObject = undefined;
    this.condition = undefined;
    this.cost = undefined;
    this.target = undefined;
    this.value = undefined;
    this.operation = undefined;
    this.owner = undefined;
    this.handler = undefined;
    this.activeHandler = undefined;
    this.description = 0n;
    this.label = [];
  }

  /**
   * Checks whether a primary flag is set.
   * @param {number} flagToCheck Flag bitmask.
   * @param {number} [slot=0] Which internal flag slot to check.
   * @returns {boolean} True when the flag is present.
   */
  isFlag(flagToCheck, slot = 0) {
    if (slot < 0 || slot >= FLAG_SLOTS) return false;
    return (this.flag[slot] & flagToCheck) !== 0;
  }

  /**
   * Sets a flag bit in the desired slot.
   * @param {number} flagToSet Flag bitmask to enable.
   * @param {number} [slot=0] Slot index to mutate.
   * @returns {void}
   */
  setFlag(flagToSet, slot = 0) {
    if (slot < 0 || slot >= FLAG_SLOTS) return;
    this.flag[slot] |= flagToSet;
  }

  /**
   * Determines if the effect is related to disable checks.
   * @returns {boolean} True when the effect disables or prevents disabling.
   */
  isDisableRelated() {
    if (this.code === EFFECT_CODES.EFFECT_IMMUNE_EFFECT) return true;
    if (this.code === EFFECT_CODES.EFFECT_DISABLE) return true;
    if (this.code === EFFECT_CODES.EFFECT_CANNOT_DISABLE) return true;
    if (this.code === EFFECT_CODES.EFFECT_FORBIDDEN) return true;
    return false;
  }

  /**
   * Determines if the effect is responsible for self-destruction logic.
   * @returns {boolean} True when the effect self-destroys.
   */
  isSelfDestroyRelated() {
    if (this.code === EFFECT_CODES.EFFECT_UNIQUE_CHECK) return true;
    if (this.code === EFFECT_CODES.EFFECT_SELF_DESTROY) return true;
    if (this.code === EFFECT_CODES.EFFECT_SELF_TOGRAVE) return true;
    return false;
  }

  /**
   * Determines whether the effect can be forbidden by other effects.
   * @returns {boolean} True when the effect is allowed to be forbidden.
   */
  isCanBeForbidden() {
    const counterType = this.code & 0xf0000;
    if (this.isFlag(EFFECT_FLAGS.EFFECT_FLAG_CANNOT_DISABLE) && !this.isFlag(EFFECT_FLAGS.EFFECT_FLAG_CANNOT_NEGATE)) return false;
    if (this.code === EFFECT_CODES.EFFECT_CHANGE_CODE) return false;
    if (counterType === EFFECT_CODES.EFFECT_COUNTER_PERMIT) return false;
    if (counterType === EFFECT_CODES.EFFECT_COUNTER_LIMIT) return false;
    return true;
  }

  /**
   * Checks whether the effect currently respects its count limit.
   * @param {number} playerId Target player identifier.
   * @returns {boolean} True when the effect can still be activated.
   */
  checkCountLimit(playerId) {
    if (!this.isFlag(EFFECT_FLAGS.EFFECT_FLAG_COUNT_LIMIT)) return true;
    if (this.countLimit <= 0) return false;
    if (!this.countCode && !this.countFlag) return true;
    if (this.countFlag === EFFECT_COUNT_CODE.EFFECT_COUNT_CODE_SINGLE) return this.countLimit > 0;
    if (playerId !== PLAYERS.PLAYER_NONE) return this.countLimit > 0;
    return this.countLimit > 0;
  }

  /**
   * Reduces the count limit after an activation.
   * @returns {void}
   */
  decCount() {
    if (this.countLimit <= 0) return;
    this.countLimit -= 1;
  }

  /**
   * Increases the count limit bookkeeping.
   * @returns {void}
   */
  incCount() {
    this.countLimit += 1;
    if (this.countLimitMax >= this.countLimit) return;
    this.countLimitMax = this.countLimit;
  }

  /**
   * Resets the remaining count to the maximum tracked value.
   * @returns {void}
   */
  recharge() {
    this.countLimit = this.countLimitMax;
  }

  /**
   * Marks the effect as currently available.
   * @returns {void}
   */
  setAvailable() {
    this.status |= EFFECT_STATUS.EFFECT_STATUS_AVAILABLE;
  }

  /**
   * Clears the available status flag.
   * @returns {void}
   */
  clearAvailable() {
    this.status &= ~EFFECT_STATUS.EFFECT_STATUS_AVAILABLE;
  }

  /**
   * Determines if the effect currently has an available status flag.
   * @returns {boolean} True when available.
   */
  isAvailable() {
    return (this.status & EFFECT_STATUS.EFFECT_STATUS_AVAILABLE) !== 0;
  }

  /**
   * Retrieves the owning player identifier.
   * @returns {number} Player constant.
   */
  getOwnerPlayer() {
    return this.effectOwner;
  }

  /**
   * Retrieves the owning card reference.
   * @returns {object|undefined} Card that owns the effect.
   */
  getOwner() {
    return this.owner;
  }

  /**
   * Retrieves the handler card reference.
   * @returns {object|undefined} Card handling the effect.
   */
  getHandler() {
    return this.handler;
  }

  /**
   * Returns a shallow clone of this effect suitable for independent bookkeeping.
   * @returns {Effect} Cloned effect instance.
   */
  clone() {
    const copy = new Effect(this.duel);
    copy.countLimit = this.countLimit;
    copy.countLimitMax = this.countLimitMax;
    copy.countFlag = this.countFlag;
    copy.countHoptIndex = this.countHoptIndex;
    copy.effectOwner = this.effectOwner;
    copy.type = this.type;
    copy.copyId = this.copyId;
    copy.range = this.range;
    copy.sRange = this.sRange;
    copy.oRange = this.oRange;
    copy.resetCount = this.resetCount;
    copy.activeLocation = this.activeLocation;
    copy.activeSequence = this.activeSequence;
    copy.status = this.status;
    copy.code = this.code;
    copy.flag = [...this.flag];
    copy.id = this.id;
    copy.initialId = this.initialId;
    copy.resetFlag = this.resetFlag;
    copy.countCode = this.countCode;
    copy.category = this.category;
    copy.hintTiming = [...this.hintTiming];
    copy.cardType = this.cardType;
    copy.activeType = this.activeType;
    copy.labelObject = this.labelObject;
    copy.condition = this.condition;
    copy.cost = this.cost;
    copy.target = this.target;
    copy.value = this.value;
    copy.operation = this.operation;
    copy.owner = this.owner;
    copy.handler = this.handler;
    copy.activeHandler = this.activeHandler;
    copy.description = this.description;
    copy.label = [...this.label];
    return copy;
  }
}


module.exports = {
  Effect,
  EFFECT_STATUS,
  EFFECT_TYPES,
  EFFECT_FLAGS,
  EFFECT_FLAGS2,
  EFFECT_CODES,
  EFFECT_EVENTS,
  RESET_FLAGS,
  EFFECT_COUNT_CODE,
};
