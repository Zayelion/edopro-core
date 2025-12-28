// Implements processor.cpp and processor_unit.h

import processExecuteCost from "./processExecuteCost.js";
import processExecuteOperation from "./processExecuteOperation.js";
import processExecuteTarget from "./processExecuteTarget.js";
import processPhaseEvent from "./processPhaseEvent.js";
import processPointEvent from "./processPointEvent.js";
import processQuickEffect from "./processQuickEffect.js";
import processIdleCommand from "./processIdleCommand.js";
import processBattleCommand from "./processBattleCommand.js";
import processForcedBattle from "./processForcedBattle.js";
import processDamageStep from "./processDamageStep.js";
import processTurn from "./processTurn.js";
import processAddChain from "./processAddChain.js";
import processSortChain from "./processSortChain.js";
import processSolveContinuous from "./processSolveContinuous.js";
import processSolveChain from "./processSolveChain.js";
import processRefreshLoc from "./processRefreshLoc.js";
import processAdjust from "./processAdjust.js";
import processStartup from "./processStartup.js";
import processSortDeck from "./processSortDeck.js";
import processDiscardHand from "./processDiscardHand.js";
import processAttackDisable from "./processAttackDisable.js";
import processSelectFusion from "./processSelectFusion.js";
import processRefreshRelay from "./processRefreshRelay.js";

export const processorMap = new Map([
  ['ExecuteCost', processExecuteCost],
  ['ExecuteOperation', processExecuteOperation],
  ['ExecuteTarget', processExecuteTarget],
  ['PhaseEvent', processPhaseEvent],
  ['PointEvent', processPointEvent],
  ['QuickEffect', processQuickEffect],
  ['IdleCommand', processIdleCommand],
  ['BattleCommand', processBattleCommand],
  ['ForcedBattle', processForcedBattle],
  ['DamageStep', processDamageStep],
  ['Turn', processTurn],
  ['AddChain', processAddChain],
  ['SortChain', processSortChain],
  ['SolveContinuous', processSolveContinuous],
  ['SolveChain', processSolveChain],
  ['RefreshLoc', processRefreshLoc],
  ['Adjust', processAdjust],
  ['Startup', processStartup],
  ['SortDeck', processSortDeck],
  ['DiscardHand', processDiscardHand],
  ['AttackDisable', processAttackDisable],
  ['SelectFusion', processSelectFusion],
  ['RefreshRelay', processRefreshRelay],
]);