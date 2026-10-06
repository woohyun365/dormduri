// SubagentStart/SubagentStop records as `.codex/hooks/knu-subagent-hooks.mjs` writes them: one observed child per
// selected lane of a delegation, in one Parent session, checked against the tracked hook policy copy.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const policyPath = resolve(import.meta.dirname, '../../../../../.codex/hooks/knu-hook-policy.json');

export function observedChildren(
  delegation,
  { model = 'gpt-6-astra', agentType, sessionId = 'parent-session' } = {},
) {
  const { allowedModels, roster } = JSON.parse(readFileSync(policyPath, 'utf8'));
  const records = delegation.recommendedChildren.flatMap((contract, index) => {
    const base = {
      schema: 'knu-codex-subagent-hook/v1',
      sessionId,
      agentId: `child-${index}`,
      agentType: agentType ?? contract.routeRecommendation.role,
      model,
      agentPath: `/root/${contract.laneId.replaceAll('-', '_')}`,
      parentThreadId: sessionId,
    };
    return [
      { ...base, event: 'SubagentStart' },
      { ...base, event: 'SubagentStop', ownTurn: { model, effort: 'high' } },
    ];
  });
  return { sessionId, records, allowedModels, roster };
}
