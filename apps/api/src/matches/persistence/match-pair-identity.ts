export function sortParticipantIds(leftParticipantId: string, rightParticipantId: string) {
  return leftParticipantId <= rightParticipantId
    ? ([leftParticipantId, rightParticipantId] as const)
    : ([rightParticipantId, leftParticipantId] as const);
}

export function buildParticipantPairIdentity(
  leftParticipantId: string,
  rightParticipantId: string,
) {
  const [pairMinParticipantId, pairMaxParticipantId] = sortParticipantIds(
    leftParticipantId,
    rightParticipantId,
  );

  return {
    pairMinParticipantId,
    pairMaxParticipantId,
    pairKey: `${pairMinParticipantId}:${pairMaxParticipantId}`,
  };
}
