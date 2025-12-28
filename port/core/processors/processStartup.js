export default function processStartup(arg) {
  const field = this;
  const { core, player } = field;

  switch (arg.step) {
    case 0: {
      core.shuffle_hand_check[0] = false;
      core.shuffle_hand_check[1] = false;
      core.shuffle_deck_check[0] = false;
      core.shuffle_deck_check[1] = false;
      field.raise_event?.(null, field.EVENT_STARTUP, null, 0, 0, 0, 0);
      field.process_instant_event?.();
      return false;
    }
    case 1: {
      for (let p = 0; p < 2; p++) {
        core.shuffle_hand_check[p] = false;
        core.shuffle_deck_check[p] = false;
        if (player[p].start_count > 0) {
          field.draw?.(null, field.REASON_RULE, field.PLAYER_NONE, p, player[p].start_count);
        }
        const listSize = player[p].extra_lists_main.length;
        for (let l = 0; l < listSize; l++) {
          const main = player[p].extra_lists_main[l];
          const hand = player[p].extra_lists_hand[l];
          for (let i = 0; i < player[p].start_count && main.length > 0; ++i) {
            const pcard = main.pop();
            hand.push(pcard);
            pcard.current.controler = p;
            pcard.current.location = field.LOCATION_HAND;
            pcard.current.sequence = hand.length - 1;
            pcard.current.position = field.POS_FACEDOWN;
          }
        }
      }
      field.emplace_process?.("Turn", 0);
      return true;
    }
    default:
      return true;
  }
}