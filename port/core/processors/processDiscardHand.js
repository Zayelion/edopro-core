const { CARD_LOCATIONS, PLAYERS } = require('../card');
const { OCG_CONSTANTS } = require('../ocgapi');

const { PLAYER_NONE } = PLAYERS;
const { LOCATION_GRAVE } = CARD_LOCATIONS;

const POS_FACEUP = OCG_CONSTANTS.POS_FACEUP;

const MSG_HINT = 2;
const HINT_SELECTMSG = 3;

const REASON_RULE = 0x400;
const REASON_ADJUST = 0x100;
const REASON_DISCARD = 0x4000;

/**
 * Ports the native `field::process(Processors::DiscardHand&)` control flow.
 * @param {import('../processor').ProcessDescriptor|import('../field').Field} unit Process descriptor or field instance.
 * @param {import('../field').Field} field Field instance driving resolution.
 * @returns {boolean} True when processing completes for the current step.
 */
function processDiscardHand(unit, field) {
  const isFieldArg = unit && unit.core && unit.infos && unit.player;
  const context = isFieldArg ? unit : field ?? this;
  const arg = (isFieldArg ? field : unit?.payload ?? unit) ?? {};
  const step = isFieldArg ? (arg.step ?? 0) : (unit?.step ?? arg.step ?? 0);
  const { core, returns, pduel } = context;
  const returnCards = context.return_cards ?? context.returnCards ?? {};

  switch (step) {
    case 0: {
      const message = pduel.new_message(MSG_HINT);
      message.write(HINT_SELECTMSG);
      message.write(arg.playerid);
      if (arg.reason & REASON_DISCARD) message.write(501);
      else message.write(504);
      context.emplace_process?.('SelectCard', arg.playerid, false, arg.min, arg.max);
      return false;
    }
    case 1: {
      if (!returnCards.list || returnCards.list.length === 0) {
        returns.set(0, 0);
      } else {
        const reason = arg.reason ?? (REASON_RULE | REASON_DISCARD | REASON_ADJUST);
        context.send_to(
          new Set(returnCards.list),
          core.reason_effect,
          reason,
          core.reason_player,
          PLAYER_NONE,
          LOCATION_GRAVE,
          0,
          POS_FACEUP,
        );
      }
      return true;
    }
    default:
      return true;
  }
}

module.exports = processDiscardHand;
