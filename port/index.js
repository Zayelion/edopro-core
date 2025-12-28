// Implements README-described API surface.
const {
  OCG_GetVersion,
  OCG_CreateDuel,
  OCG_DestroyDuel,
  OCG_DuelNewCard,
  OCG_StartDuel,
  OCG_DuelProcess,
  OCG_DuelGetMessage,
  OCG_DuelSetResponse,
  OCG_LoadScript,
  OCG_DuelQueryCount,
  OCG_DuelQuery,
  OCG_DuelQueryLocation,
  OCG_DuelQueryField,
} = require('./core/ocgapi');

module.exports = {
  OCG_GetVersion,
  OCG_CreateDuel,
  OCG_DestroyDuel,
  OCG_DuelNewCard,
  OCG_StartDuel,
  OCG_DuelProcess,
  OCG_DuelGetMessage,
  OCG_DuelSetResponse,
  OCG_LoadScript,
  OCG_DuelQueryCount,
  OCG_DuelQuery,
  OCG_DuelQueryLocation,
  OCG_DuelQueryField,
};
