// Implements processor.cpp and processor_unit.h

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
 * Magic restart marker from the native engine.
 * @type {number}
 */
const PROCESS_RESTART = 0xffff;

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

module.exports = {
  PROCESS_REQUIREMENTS,
  PROCESS_RESTART,
  ProcessDescriptor,
  ProcessorQueue,
};
