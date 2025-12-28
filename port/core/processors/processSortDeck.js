export default function processSortDeck(arg) {
  const field = this;
  const { core, player, returns, pduel } = field;

  let { count } = arg;
  const { sort_player: sortPlayer, target_player: targetPlayer } = arg;
  const bottom = arg.bottom;
  const list = player[targetPlayer].list_main;
  if (count > list.length) count = list.length;

  switch (arg.step) {
    case 0: {
      if (bottom) {
        core.select_cards = list.slice(0, count);
      } else {
        core.select_cards = list.slice(-count).reverse();
      }
      field.emplace_process?.("SortCard", sortPlayer, false);
      return false;
    }
    case 1: {
      if (returns.at(0) === -1 || count === 0) return true;

      const tc = new Array(core.select_cards.length);
      for (let i = 0; i < count; ++i) tc[returns.at(i)] = core.select_cards[i];

      for (let i = 0; i < count; ++i) {
        const pcard = bottom ? tc[i] : tc[count - i - 1];
        const message = pduel.new_message("MSG_MOVE");
        message.write(0);
        message.write(pcard.get_info_location());
        list.splice(pcard.current.sequence, 1);
        if (bottom) list.unshift(pcard);
        else list.push(pcard);
        field.reset_sequence?.(targetPlayer, "LOCATION_DECK");
        message.write(pcard.get_info_location());
        message.write(pcard.current.reason);
      }

      if (core.global_flag & field.GLOBALFLAG_DECK_REVERSE_CHECK) {
        const ptop = list[list.length - 1];
        if (core.deck_reversed || ptop.current.position === field.POS_FACEUP_DEFENSE) {
          const message = pduel.new_message("MSG_DECK_TOP");
          message.write(targetPlayer);
          message.write(0);
          message.write(ptop.data.code);
          message.write(ptop.current.position);
        }
      }
      return true;
    }
    default:
      return true;
  }
}