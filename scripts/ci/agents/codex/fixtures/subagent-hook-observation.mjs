// Hook records as `.codex/hooks/knu-subagent-hooks.mjs` writes them: one observed child per selected lane of a
// delegation, in one Parent session, spawned under one dispatch token. Each child has the root PreToolUse allow record
// that bound its task name, then SubagentStart and SubagentStop. By default the child runs its contract's profile model
// at its role's pinned effort.
import { getModelProfile, ROLE_EFFORTS } from '../../../../agents/codex/model-profiles.mjs';

export const FIXTURE_DISPATCH_TOKEN = 'disp1';

export function observedChildren(
  delegation,
  {
    model,
    agentType,
    sessionId = 'parent-session',
    dispatchToken = FIXTURE_DISPATCH_TOKEN,
    bind = true,
  } = {},
) {
  const records = delegation.recommendedChildren.flatMap((contract, index) => {
    const role = agentType ?? contract.routeRecommendation.role;
    const childModel = model ?? getModelProfile(contract.routeRecommendation.profileId).model;
    const taskName = `${contract.laneId.replaceAll('-', '_')}_${dispatchToken}`;
    const base = {
      schema: 'knu-codex-subagent-hook/v1',
      sessionId,
      agentId: `child-${index}`,
      agentType: role,
      model: childModel,
      agentPath: `/root/${taskName}`,
      parentThreadId: sessionId,
    };
    return [
      ...(bind
        ? [
            {
              schema: 'knu-codex-subagent-hook/v1',
              sessionId,
              event: 'PreToolUse',
              toolName: 'collaborationspawn_agent',
              caller: 'root',
              decision: 'allow',
              input: {
                task_name: taskName,
                agent_type: role,
                model: childModel,
                fork_turns: 'none',
              },
            },
          ]
        : []),
      { ...base, event: 'SubagentStart' },
      {
        ...base,
        event: 'SubagentStop',
        ownTurn: { model: childModel, effort: ROLE_EFFORTS[role] ?? 'high' },
      },
    ];
  });
  return { sessionId, records };
}
