/**
 * Ports the native `field::process(Processors::RefreshRelay&)` control flow.
 * @param {import('../processor').ProcessDescriptor|import('../field').Field} unit Process descriptor or field instance.
 * @param {import('../field').Field} field Field instance driving resolution.
 * @returns {boolean} True when processing completes for the current step.
 */
function processRefreshRelay(unit, field) {
  const isFieldArg = unit && unit.core && unit.infos && unit.player;
  const context = isFieldArg ? unit : field ?? this;
  const arg = (isFieldArg ? field : unit?.payload ?? unit) ?? {};
  const step = isFieldArg ? (arg.step ?? 0) : (unit?.step ?? arg.step ?? 0);
  const { player } = context;

  switch (step) {
    case 0:
    case 1:
      if (player[step].recharge) context.next_player(step);
      return false;
    default:
      return true;
  }
}

module.exports = processRefreshRelay;
