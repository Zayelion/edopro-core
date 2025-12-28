// Implements processor.cpp and processor_unit.h
const { CARD_LOCATIONS, PLAYERS } = require('./card');
const { SYMBOLIC_LOCATIONS } = require('./common');
const { OCG_CONSTANTS } = require('./ocgapi');

const PROCESS_RESTART = 0xffff;

const POSITION_CONSTANTS = {
  POS_FACEUP_ATTACK: 0x1,
  POS_FACEDOWN_ATTACK: 0x2,
  POS_FACEUP_DEFENSE: 0x4,
  POS_FACEDOWN_DEFENSE: 0x8,
};

POSITION_CONSTANTS.POS_FACEUP = POSITION_CONSTANTS.POS_FACEUP_ATTACK | POSITION_CONSTANTS.POS_FACEUP_DEFENSE;
POSITION_CONSTANTS.POS_FACEDOWN = POSITION_CONSTANTS.POS_FACEDOWN_ATTACK | POSITION_CONSTANTS.POS_FACEDOWN_DEFENSE;
POSITION_CONSTANTS.POS_DEFENSE = POSITION_CONSTANTS.POS_FACEUP_DEFENSE | POSITION_CONSTANTS.POS_FACEDOWN_DEFENSE;
POSITION_CONSTANTS.POS_ATTACK = POSITION_CONSTANTS.POS_FACEUP_ATTACK | POSITION_CONSTANTS.POS_FACEDOWN_ATTACK;

const ADD_CHAIN_CONSTANTS = {
  LOCATIONS: { ...CARD_LOCATIONS, ...SYMBOLIC_LOCATIONS },
  POSITIONS: {
    POS_FACEUP_ATTACK: OCG_CONSTANTS.POS_FACEUP_ATTACK,
    POS_FACEUP: OCG_CONSTANTS.POS_FACEUP,
  },
  PLAYER: { ...PLAYERS },
};

const ADJUST_CONSTANTS = {
  ...POSITION_CONSTANTS,
  STATUS_ATTACK_CANCELED: 0x200000,
  STATUS_JUST_POS: 0x1000000,
  STATUS_CONTINUOUS_POS: 0x2000000,
  PHASE_DAMAGE: 0x20,
  PHASE_DAMAGE_CAL: 0x40,
  MSG_WIN: 2,
  MSG_REVERSE_DECK: 65,
  MSG_DECK_TOP: 64,
  REASON_RULE: 0x400,
  DUEL_RELAY: 0x80,
  GLOBALFLAG_DECK_REVERSE_CHECK: 0x1,
  GLOBALFLAG_BRAINWASHING_CHECK: 0x2,
};

const ATTACK_DISABLE_CONSTANTS = {
  STATUS_ATTACK_CANCELED: 0x200000,
};

const BATTLE_COMMAND_CONSTANTS = {
  PHASE_BATTLE_STEP: 0x10,
  PHASE_DAMAGE: 0x20,
  PHASE_DAMAGE_CAL: 0x40,
  PHASE_BATTLE: 0x80,
  STATUS_CHAINING: 0x10000,
  STATUS_ATTACK_CANCELED: 0x200000,
  STATUS_OPPO_BATTLE: 0x10000000,
  STATUS_BATTLE_RESULT: 0x40,
  STATUS_BATTLE_DESTROYED: 0x4000,
  STATUS_DESTROY_CONFIRMED: 0x1000,
  TIMING_ATTACK: 0x1000,
  TIMING_DAMAGE_STEP: 0x2000,
  TIMING_DAMAGE_CAL: 0x4000,
  TIMING_BATTLE_PHASE: 0x1000000,
  TIMING_BATTLE_STEP_END: 0x4000000,
  TIMING_BATTLED: 0x8000000,
  MSG_HINT: 2,
  MSG_CARD_SELECTED: 80,
  MSG_ATTACK: 110,
  MSG_BATTLE: 111,
  MSG_ATTACK_DISABLED: 112,
  MSG_DAMAGE_STEP_START: 113,
  MSG_DAMAGE_STEP_END: 114,
  HINT_EVENT: 1,
  HINT_SELECTMSG: 3,
  HINT_CARD: 10,
  RESET_CODE: 0x4000,
  REASON_BATTLE: 0x20,
  REASON_EFFECT: 0x40,
  REASON_REPLACE: 0x1000000,
  DUEL_NO_MAIN_PHASE_2: 0x200000,
  DUEL_6_STEP_BATLLE_STEP: 0x08,
  DUEL_STORE_ATTACK_REPLAYS: 0x20000000,
  DUEL_SINGLE_CHAIN_IN_DAMAGE_SUBSTEP: 0x40000000,
  PROCESS_RESTART,
};

const DAMAGE_STEP_CONSTANTS = {
  PHASE_DAMAGE: 0x20,
  PHASE_DAMAGE_CAL: 0x40,
  STATUS_ATTACK_CANCELED: 0x200000,
  MSG_ATTACK: 110,
  MSG_DAMAGE_STEP_START: 113,
  DUEL_0_ATK_DESTROYED: 0x10000000,
};

const DISCARD_HAND_CONSTANTS = {
  MSG_HINT: 2,
  HINT_SELECTMSG: 3,
  REASON_RULE: 0x400,
  REASON_ADJUST: 0x100,
  REASON_DISCARD: 0x4000,
};

const FORCED_BATTLE_CONSTANTS = {
  PHASE_BATTLE_START: 0x08,
  PHASE_BATTLE_STEP: 0x10,
  PHASE_BATTLE: 0x80,
  MSG_NEW_PHASE: 41,
};

const IDLE_COMMAND_CONSTANTS = {
  STATUS_CHAINING: 0x10000,
  STATUS_FORM_CHANGED: 0x100,
  TIMING_MAIN_END: 0x4,
  PHASE_MAIN1: 0x04,
  PHASE_MAIN2: 0x100,
  PHASE_BATTLE_START: 0x08,
  PHASE_BATTLE_STEP: 0x10,
  PHASE_BATTLE: 0x80,
  MSG_HINT: 2,
  MSG_NEW_PHASE: 41,
  HINT_EVENT: 1,
  DUEL_ATTACK_FIRST_TURN: 0x02,
  PROCESS_RESTART,
};

const PHASE_EVENT_CONSTANTS = {
  PHASE_DRAW: 0x01,
  PHASE_STANDBY: 0x02,
  PHASE_BATTLE_START: 0x08,
  PHASE_BATTLE_STEP: 0x10,
  PHASE_BATTLE: 0x80,
  PHASE_END: 0x200,
  TIMING_DRAW_PHASE: 0x1,
  TIMING_STANDBY_PHASE: 0x2,
  TIMING_BATTLE_START: 0x8,
  TIMING_BATTLE_END: 0x10,
  TIMING_END_PHASE: 0x20,
  MSG_HINT: 2,
  HINT_EVENT: 1,
  HINT_SELECTMSG: 3,
  DUEL_NO_HAND_LIMIT: 0x1000000,
  DUEL_INVERTED_QUICK_PRIORITY: 0x4000000,
  REASON_RULE: 0x400,
  REASON_DISCARD: 0x4000,
  REASON_ADJUST: 0x100,
  PROCESS_RESTART,
};

const POINT_EVENT_CONSTANTS = {
  STATUS_EFFECT_ENABLED: 0x400,
  STATUS_CHAINING: 0x10000,
  DUEL_TRIGGER_WHEN_PRIVATE_KNOWLEDGE: 0x20,
  DUEL_OCG_OBSOLETE_IGNITION: 0x100,
  DUEL_TCG_SEGOC_NONPUBLIC: 0x100000000,
  DUEL_TCG_SEGOC_FIRSTTRIGGER: 0x200000000,
  DUEL_TCG_FAST_EFFECT_IGNITION: 0x400000000,
  PROCESS_RESTART,
};

const QUICK_EFFECT_CONSTANTS = {
  STATUS_CHAINING: 0x10000,
  TIMING_ATTACK: 0x1000,
  TIMING_DAMAGE_STEP: 0x2000,
  TIMING_DAMAGE_CAL: 0x4000,
  PROCESS_RESTART,
};

const REFRESH_LOC_CONSTANTS = {
  DUEL_3_COLUMNS_FIELD: 0x4000,
  MSG_FIELD_DISABLED: 56,
};

const SOLVE_CHAIN_CONSTANTS = {
  STATUS_DISABLED: 0x1,
  STATUS_FORBIDDEN: 0x4000000,
  STATUS_LEAVE_CONFIRMED: 0x2000,
  STATUS_CHAINING: 0x10000,
  CHAIN_DISABLE_ACTIVATE: 0x01,
  CHAIN_DISABLE_EFFECT: 0x02,
  CHAIN_HAND_EFFECT: 0x04,
  CHAIN_CONTINUOUS_CARD: 0x08,
  CHAIN_ACTIVATING: 0x10,
  TIMING_DAMAGE_STEP: 0x2000,
  TIMING_DAMAGE_CAL: 0x4000,
  TIMING_CHAIN_END: 0x8000,
  MSG_CHAIN_SOLVING: 72,
  MSG_CHAIN_SOLVED: 73,
  MSG_CHAIN_END: 74,
  MSG_CHAIN_NEGATED: 75,
  MSG_CHAIN_DISABLED: 76,
  MSG_MISSED_EFFECT: 120,
  MSG_WIN: 5,
  MSG_FIELD_DISABLED: 56,
  DUEL_RELAY: 0x80,
  DUEL_1_FACEUP_FIELD: 0x400,
  DUEL_SPSUMMON_ONCE_OLD_NEGATE: 0x40000,
  DUEL_CANNOT_SUMMON_OATH_OLD: 0x80000,
  GLOBALFLAG_SPSUMMON_ONCE: 0x200,
  REASON_TEMPORARY: 0x4,
  REASON_RULE: 0x400,
  PROCESS_RESTART,
};

const PROCESSOR_CONSTANTS = {
  ADD_CHAIN_CONSTANTS,
  ADJUST_CONSTANTS,
  ATTACK_DISABLE_CONSTANTS,
  BATTLE_COMMAND_CONSTANTS,
  DAMAGE_STEP_CONSTANTS,
  DISCARD_HAND_CONSTANTS,
  FORCED_BATTLE_CONSTANTS,
  IDLE_COMMAND_CONSTANTS,
  PHASE_EVENT_CONSTANTS,
  POINT_EVENT_CONSTANTS,
  POSITION_CONSTANTS,
  QUICK_EFFECT_CONSTANTS,
  REFRESH_LOC_CONSTANTS,
  SOLVE_CHAIN_CONSTANTS,
};

/**
 * Maps native process struct names to their `needs_answer` flag from the engine.
 * @type {Record<string, boolean>}
 */
const PROCESS_REQUIREMENTS = {
  Adjust: false,
  Turn: false,
  RefreshLoc: false,
  Startup: false,
  SelectBattleCmd: true,
  SelectIdleCmd: true,
  SelectEffectYesNo: true,
  SelectYesNo: true,
  SelectOption: true,
  SelectCard: true,
  SelectCardCodes: true,
  SelectUnselectCard: true,
  SelectChain: true,
  SelectPlace: true,
  SelectDisField: true,
  SelectPosition: true,
  SelectTributeP: true,
  SortChain: false,
  SelectCounter: true,
  SelectSum: true,
  SortCard: true,
  SelectRelease: false,
  SelectTribute: false,
  PointEvent: false,
  QuickEffect: false,
  IdleCommand: false,
  PhaseEvent: false,
  BattleCommand: false,
  DamageStep: false,
  ForcedBattle: false,
  AddChain: false,
  SolveChain: false,
  SolveContinuous: false,
  ExecuteCost: false,
  ExecuteOperation: false,
  ExecuteTarget: false,
  Destroy: false,
  Release: false,
  SendTo: false,
  DestroyReplace: false,
  ReleaseReplace: false,
  SendToReplace: false,
  MoveToField: false,
  ChangePos: false,
  OperationReplace: false,
  ActivateEffect: false,
  SummonRule: false,
  SpSummonRule: false,
  SpSummon: false,
  FlipSummon: false,
  MonsterSet: false,
  SpellSet: false,
  SpSummonStep: false,
  SpellSetGroup: false,
  SpSummonRuleGroup: false,
  Draw: false,
  Damage: false,
  Recover: false,
  Equip: false,
  GetControl: false,
  SwapControl: false,
  ControlAdjust: false,
  SelfDestroyUnique: false,
  SelfDestroy: false,
  SelfToGrave: false,
  TrapMonsterAdjust: false,
  PayLPCost: false,
  RemoveCounter: false,
  AttackDisable: false,
  AnnounceRace: true,
  AnnounceAttribute: true,
  AnnounceCard: true,
  AnnounceNumber: true,
  TossCoin: false,
  TossDice: false,
  RockPaperScissors: true,
  SelectFusion: false,
  DiscardHand: false,
  DiscardDeck: false,
  SortDeck: false,
  RemoveOverlay: false,
  XyzOverlay: false,
  RefreshRelay: false,
};

/**
 * Creates a process descriptor mirroring the native `Process` template.
 */
class ProcessDescriptor {
  /**
   * @param {string} type Process struct name from the native engine.
   * @param {Record<string, any>} [payload] Optional payload to attach for processing.
   */
  constructor(type, payload) {
    this.type = type;
    this.step = payload?.step ?? 0;
    this.needsAnswer = Boolean(PROCESS_REQUIREMENTS[type]);
    this.payload = { ...payload };
  }
}

/**
 * Maintains processor queues mirroring the native duel processor pipeline.
 */
class ProcessorQueue {
  /**
   * @param {object} owner Owner of the queue, typically a Field instance.
   */
  constructor(owner) {
    this.owner = owner;
    this.units = [];
    this.subunits = [];
  }

  /**
   * Appends a process to the main queue.
   * @param {string} type Process type name.
   * @param {Record<string, any>} [payload] Optional payload.
   * @returns {ProcessDescriptor} Created process descriptor.
   */
  enqueue(type, payload) {
    const unit = new ProcessDescriptor(type, payload);
    this.units.push(unit);
    return unit;
  }

  /**
   * Adds a process to the subunit list that will be merged before processing.
   * @param {string} type Process type name.
   * @param {Record<string, any>} [payload] Optional payload.
   * @returns {ProcessDescriptor} Created process descriptor.
   */
  enqueueSubunit(type, payload) {
    const unit = new ProcessDescriptor(type, payload);
    this.subunits.push(unit);
    return unit;
  }

  /**
   * Moves subunits to the front of the queue.
   * @returns {void}
   */
  flushSubunits() {
    if (!this.subunits.length) return;
    this.units.unshift(...this.subunits);
    this.subunits = [];
  }

  /**
   * Retrieves the current unit.
   * @returns {ProcessDescriptor|undefined} Current queued process.
   */
  peek() {
    return this.units[0];
  }

  /**
   * Removes the current unit from the queue.
   * @returns {void}
   */
  complete() {
    this.units.shift();
  }
}

const exportObject = {
  PROCESS_REQUIREMENTS,
  PROCESS_RESTART,
  PROCESSOR_CONSTANTS,
  ADD_CHAIN_CONSTANTS,
  ADJUST_CONSTANTS,
  ATTACK_DISABLE_CONSTANTS,
  BATTLE_COMMAND_CONSTANTS,
  DAMAGE_STEP_CONSTANTS,
  DISCARD_HAND_CONSTANTS,
  FORCED_BATTLE_CONSTANTS,
  IDLE_COMMAND_CONSTANTS,
  PHASE_EVENT_CONSTANTS,
  POINT_EVENT_CONSTANTS,
  POSITION_CONSTANTS,
  QUICK_EFFECT_CONSTANTS,
  REFRESH_LOC_CONSTANTS,
  SOLVE_CHAIN_CONSTANTS,
  ProcessDescriptor,
  ProcessorQueue,
  processorMap: undefined,
};

module.exports = exportObject;

const { processorMap } = require('./processors/functions');
exportObject.processorMap = processorMap;
