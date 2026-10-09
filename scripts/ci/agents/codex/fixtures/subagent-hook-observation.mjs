// Hook records as `.codex/hooks/knu-subagent-hooks.mjs` writes them: one observed child per selected lane of a
// delegation, in one Parent session, spawned under one dispatch token. Each child has the root PreToolUse allow record
// that bound its task name and sealed its registration, then SubagentStart and SubagentStop. By default the child runs
// its contract's profile model at its role's pinned effort. A lane in retryLaneIds is observed as its recovery retry,
// on the `_retry` task path. acceptedChildren() gives the acceptance records `codex:accept` writes for them.
import { createHash } from 'node:crypto';

import { getModelProfile, ROLE_EFFORTS } from '../../../../agents/codex/model-profiles.mjs';

export const FIXTURE_DISPATCH_TOKEN = 'disp1';
const RECORD_SCHEMA = 'knu-codex-subagent-hook/v1';

export function observedChildren(
  delegation,
  {
    model,
    agentType,
    sessionId = 'parent-session',
    dispatchToken = FIXTURE_DISPATCH_TOKEN,
    bind = true,
    seal = true,
    retryLaneIds = [],
  } = {},
) {
  const records = delegation.recommendedChildren.flatMap((contract, index) => {
    const role = agentType ?? contract.routeRecommendation.role;
    const childModel = model ?? getModelProfile(contract.routeRecommendation.profileId).model;
    const retry = retryLaneIds.includes(contract.laneId);
    const taskName = `${contract.laneId.replaceAll('-', '_')}_${dispatchToken}${retry ? '_retry' : ''}`;
    return childRecords({
      sessionId,
      agentId: `child-${index}`,
      registration: {
        taskName,
        kind: 'lane',
        laneId: contract.laneId,
        dispatchToken,
        retry,
        spawnArguments: spawnArguments(taskName, role, childModel),
      },
      bind,
      seal,
    });
  });
  return { sessionId, records, malformed: 0 };
}

// One reviewer child per round under the dispatch token, on the review profile model unless given.
export function observedReviews({
  sessionId = 'parent-session',
  dispatchToken = FIXTURE_DISPATCH_TOKEN,
  laneIds,
  rounds = [1],
  model,
} = {}) {
  const reviewModel = model ?? getModelProfile('review').model;
  const records = rounds.flatMap((round) => {
    const taskName = `review_${dispatchToken}_${round}`;
    return childRecords({
      sessionId,
      agentId: `reviewer-${round}`,
      registration: {
        taskName,
        kind: 'review',
        reviewId: `review-${dispatchToken}-${round}`,
        dispatchToken,
        round,
        reviewOf: laneIds,
        spawnArguments: spawnArguments(taskName, 'knu_reviewer', reviewModel),
      },
      bind: true,
      seal: true,
    });
  });
  return { sessionId, records, malformed: 0 };
}

// The acceptance record of every sealed child's last stop, as `codex:accept` writes it after a passing check.
export function acceptedChildren(observation, { only } = {}) {
  return observation.records
    .filter(({ event, registration }) => event === 'PreToolUse' && registration)
    .filter(({ registration }) => only === undefined || only.includes(registration.taskName))
    .map(({ registration }) => {
      const stop = observation.records.findLast(
        ({ event, agentPath }) =>
          event === 'SubagentStop' && agentPath === `/root/${registration.taskName}`,
      );
      return {
        schema: 'knu-codex-task-acceptance/v1',
        sessionId: observation.sessionId,
        taskName: registration.taskName,
        kind: registration.kind,
        agentId: stop.agentId,
        stopDigest: digest(JSON.stringify(stop)),
        registrationDigest: registration.digest,
        acceptedAt: '2026-10-09T00:00:00Z',
      };
    });
}

function spawnArguments(taskName, role, model) {
  return {
    task_name: taskName,
    agent_type: role,
    model,
    reasoning_effort: ROLE_EFFORTS[role] ?? 'high',
    fork_turns: 'none',
  };
}

function childRecords({ sessionId, agentId, registration, bind, seal }) {
  const {
    task_name: taskName,
    agent_type: role,
    model,
    reasoning_effort: effort,
  } = registration.spawnArguments;
  const file = { schema: 'knu-codex-task-registration/v1', sessionId, ...registration };
  const base = {
    schema: RECORD_SCHEMA,
    sessionId,
    agentId,
    agentType: role,
    model,
    agentPath: `/root/${taskName}`,
    parentThreadId: sessionId,
  };
  return [
    ...(bind
      ? [
          {
            schema: RECORD_SCHEMA,
            sessionId,
            event: 'PreToolUse',
            toolName: 'collaborationspawn_agent',
            caller: 'root',
            decision: 'allow',
            input: {
              task_name: taskName,
              agent_type: role,
              model,
              reasoning_effort: effort,
              fork_turns: 'none',
            },
            ...(seal
              ? { registration: { digest: digest(JSON.stringify(file)), ...registration } }
              : {}),
          },
        ]
      : []),
    { ...base, event: 'SubagentStart' },
    { ...base, event: 'SubagentStop', ownTurn: { model, effort } },
  ];
}

function digest(text) {
  return `sha256:${createHash('sha256').update(text).digest('hex')}`;
}
