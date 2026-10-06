// SubagentStart/SubagentStop records as `.codex/hooks/knu-subagent-hooks.mjs` writes them: one observed child per
// selected lane of a delegation, in one Parent session, spawned under one dispatch token.
export const FIXTURE_DISPATCH_TOKEN = 'disp1';

export function observedChildren(
  delegation,
  {
    model = 'gpt-6-astra',
    agentType,
    sessionId = 'parent-session',
    dispatchToken = FIXTURE_DISPATCH_TOKEN,
  } = {},
) {
  const records = delegation.recommendedChildren.flatMap((contract, index) => {
    const base = {
      schema: 'knu-codex-subagent-hook/v1',
      sessionId,
      agentId: `child-${index}`,
      agentType: agentType ?? contract.routeRecommendation.role,
      model,
      agentPath: `/root/${contract.laneId.replaceAll('-', '_')}_${dispatchToken}`,
      parentThreadId: sessionId,
    };
    return [
      { ...base, event: 'SubagentStart' },
      { ...base, event: 'SubagentStop', ownTurn: { model, effort: 'high' } },
    ];
  });
  return { sessionId, records };
}
