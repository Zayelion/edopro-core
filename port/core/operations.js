// Implements operations.cpp

/**
 * Collects operations executed against the field so later processors can drain
 * them. This mirrors the role of the C++ helpers by providing high-level
 * entry points used by Lua bindings.
 */
class Operations {
  /**
   * @param {import('./field').Field} field Owning field instance.
   */
  constructor(field) {
    this.field = field;
    this.queue = [];
  }

  /**
   * Retrieves the current chain link referenced by Lua-friendly indices.
   * @param {number} [chaincount] One-based index within the active chain.
   * @returns {import('./field').ChainLink|undefined} Matching chain link.
   */
  getChainLink(chaincount) {
    if (!Array.isArray(this.field.core.current_chain)) return undefined;
    if (this.field.core.current_chain.length === 0) return undefined;
    const normalized = typeof chaincount === 'number' && chaincount > 0
      ? chaincount
      : this.field.core.current_chain.length;
    if (normalized > this.field.core.current_chain.length) return undefined;
    const index = normalized - 1;
    return this.field.core.current_chain[index];
  }

  /**
   * Marks a chain link as negated and records the reason information.
   * @param {number} [chaincount] Optional one-based chain index.
   * @param {import('./effect').Effect|undefined} reason_effect Effect disabling the chain.
   * @param {number} [reason_player=0] Player responsible for the change.
   * @returns {boolean} True when a chain link was updated.
   */
  negateChain(chaincount, reason_effect, reason_player = 0) {
    const link = this.getChainLink(chaincount);
    if (!link) return false;
    if (link.flag?.negated) return false;
    const updatedFlag = typeof link.flag === 'object' && link.flag !== undefined ? link.flag : {};
    updatedFlag.negated = true;
    link.flag = updatedFlag;
    link.disable_reason = reason_effect;
    link.disable_player = reason_player;
    this.enqueue('negate_chain', { chain: link });
    return true;
  }

  /**
   * Marks a chain link as disabled without negating its activation.
   * @param {number} [chaincount] Optional one-based chain index.
   * @param {import('./effect').Effect|undefined} reason_effect Effect disabling the chain.
   * @param {number} [reason_player=0] Player responsible for the change.
   * @returns {boolean} True when a chain link was updated.
   */
  disableChain(chaincount, reason_effect, reason_player = 0) {
    const link = this.getChainLink(chaincount);
    if (!link) return false;
    if (link.flag?.effect_disabled) return false;
    const updatedFlag = typeof link.flag === 'object' && link.flag !== undefined ? link.flag : {};
    updatedFlag.effect_disabled = true;
    link.flag = updatedFlag;
    link.disable_reason = reason_effect;
    link.disable_player = reason_player;
    this.enqueue('disable_chain', { chain: link });
    return true;
  }

  /**
   * Replaces the operation index invoked when the chain resolves.
   * @param {number} [chaincount] Optional one-based chain index.
   * @param {number} replacementOp Operation identifier.
   * @returns {void}
   */
  changeChainEffect(chaincount, replacementOp) {
    const link = this.getChainLink(chaincount);
    if (!link) return;
    link.replace_op = replacementOp;
    if (link.triggering_effect?.handler?.current?.location === undefined) return;
    if (link.triggering_effect.handler.current.location !== 0x08) return;
    link.triggering_effect.handler.set_status?.('STATUS_LEAVE_CONFIRMED', true);
  }

  /**
   * Swaps the targeted group of cards for an existing chain link.
   * @param {number} [chaincount] Optional one-based chain index.
   * @param {import('./group').Group} targets New target group.
   * @returns {void}
   */
  changeTarget(chaincount, targets) {
    const link = this.getChainLink(chaincount);
    if (!link || !targets) return;
    const targetCards = link.target_cards;
    if (!targetCards) return;
    targetCards.container = [...targets.container];
    this.enqueue('change_target', { chain: link, targets: targetCards });
  }

  /**
   * Updates the target player for an active chain link.
   * @param {number} [chaincount] Optional one-based chain index.
   * @param {number} playerid Player identifier.
   * @returns {void}
   */
  changeTargetPlayer(chaincount, playerid) {
    const link = this.getChainLink(chaincount);
    if (!link) return;
    link.target_player = playerid;
  }

  /**
   * Updates the target parameter for an active chain link.
   * @param {number} [chaincount] Optional one-based chain index.
   * @param {number} param New parameter value.
   * @returns {void}
   */
  changeTargetParam(chaincount, param) {
    const link = this.getChainLink(chaincount);
    if (!link) return;
    link.target_param = param;
  }

  /**
   * Enqueues a high-level operation descriptor so that future processors can
   * drain or inspect the requested changes.
   * @param {string} type Operation discriminator.
   * @param {object} payload Structured payload describing the operation.
   * @returns {void}
   */
  enqueue(type, payload) {
    this.queue.push({ type, payload });
  }
}

module.exports = { Operations };
