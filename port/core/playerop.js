// Implements playerop.cpp

/**
 * Serializes a card snapshot into the minimal structure expected by clients.
 * @param {object} card Card instance extracted from the field containers.
 * @returns {{ code: number, controler: number, location: number, sequence: number }}
 */
function serializeCardPosition(card) {
  return {
    code: card?.data?.code ?? 0,
    controler: card?.current?.controler ?? 0,
    location: card?.current?.location ?? 0,
    sequence: card?.current?.sequence ?? 0,
  };
}

/**
 * Handles player operation prompts generated during idle/battle phases.
 */
class PlayerOperationManager {
  /**
   * @param {import('./field').Field} field Owning field instance.
   */
  constructor(field) {
    this.field = field;
  }

  /**
   * Builds a battle command selection payload mirroring the native message.
   * @param {number} playerid Player receiving the prompt.
   * @returns {object} Structured selection information.
   */
  buildBattleCommand(playerid) {
    const chains = this.field.core.select_chains || [];
    const attackable = this.field.core.attackable_cards || [];
    const activatable = chains.map((ch) => {
      const effect = ch.triggering_effect;
      const handler = effect?.get_handler?.();
      return {
        effect_description: effect?.description ?? 0,
        client_mode: effect?.get_client_mode?.() ?? 0,
        card: serializeCardPosition(handler),
      };
    });
    const battleTargets = attackable.map((card) => ({
      ...serializeCardPosition(card),
      direct_attackable: card?.direct_attackable ?? 0,
    }));
    return {
      player: playerid,
      activatable,
      attackable: battleTargets,
      can_main2: Boolean(this.field.core.to_m2),
      can_end_phase: Boolean(this.field.core.to_ep),
    };
  }

  /**
   * Builds an idle command selection payload including summon and activation options.
   * @param {number} playerid Player receiving the prompt.
   * @returns {object} Structured selection information.
   */
  buildIdleCommand(playerid) {
    const mapCardList = (cards = []) => cards.map((card) => serializeCardPosition(card));
    const chains = this.field.core.select_chains || [];
    const activatable = chains
      .sort((left, right) => (left.triggering_effect?.id ?? 0) - (right.triggering_effect?.id ?? 0))
      .map((ch) => ({
        card: serializeCardPosition(ch.triggering_effect?.get_handler?.()),
        description: ch.triggering_effect?.description ?? 0,
        client_mode: ch.triggering_effect?.get_client_mode?.() ?? 0,
      }));
    const canShuffle = Boolean(this.field.infos?.can_shuffle) && (this.field.player?.[playerid]?.list_hand?.length ?? 0) > 1;
    return {
      player: playerid,
      summonable: mapCardList(this.field.core.summonable_cards),
      spsummonable: mapCardList(this.field.core.spsummonable_cards),
      repositionable: mapCardList(this.field.core.repositionable_cards),
      msetable: mapCardList(this.field.core.msetable_cards),
      ssetable: mapCardList(this.field.core.ssetable_cards),
      activatable,
      can_battle_phase: this.field.infos?.phase === 0x04 && Boolean(this.field.core.to_bp),
      can_end_phase: Boolean(this.field.core.to_ep),
      can_shuffle_hand: canShuffle,
    };
  }

  /**
   * Simple yes/no prompt builder used for generic confirmations.
   * @param {number} playerid Player receiving the prompt.
   * @param {number} description Description identifier.
   * @returns {{ player: number, description: number }} Prompt payload.
   */
  buildYesNo(playerid, description) {
    return { player: playerid, description };
  }

  /**
   * Builds an effect-specific yes/no prompt including card context.
   * @param {number} playerid Player receiving the prompt.
   * @param {object} card Card invoking the confirmation.
   * @param {number} description Description identifier.
   * @returns {{ player: number, card: object, description: number }} Prompt payload.
   */
  buildEffectYesNo(playerid, card, description) {
    return { player: playerid, card: serializeCardPosition(card), description };
  }
}

module.exports = { PlayerOperationManager, serializeCardPosition };
