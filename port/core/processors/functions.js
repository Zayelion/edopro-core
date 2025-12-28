// Implements processor.cpp and processor_unit.h
const processExecuteCost = require('./processExecuteCost');
const processExecuteOperation = require('./processExecuteOperation');
const processExecuteTarget = require('./processExecuteTarget');
const processPhaseEvent = require('./processPhaseEvent');
const processPointEvent = require('./processPointEvent');
const processQuickEffect = require('./processQuickEffect');
const processIdleCommand = require('./processIdleCommand');
const processBattleCommand = require('./processBattleCommand');
const processForcedBattle = require('./processForcedBattle');
const processDamageStep = require('./processDamageStep');
const processTurn = require('./processTurn');
const processAddChain = require('./processAddChain');
const processSortChain = require('./processSortChain');
const processSolveContinuous = require('./processSolveContinuous');
const processSolveChain = require('./processSolveChain');
const processRefreshLoc = require('./processRefreshLoc');
const processAdjust = require('./processAdjust');
const processStartup = require('./processStartup');
const processSortDeck = require('./processSortDeck');
const processDiscardHand = require('./processDiscardHand');
const processAttackDisable = require('./processAttackDisable');
const processSelectFusion = require('./processSelectFusion');
const processRefreshRelay = require('./processRefreshRelay');

const processorMap = new Map([
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

module.exports = { processorMap };
