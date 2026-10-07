import {
  assertCurrentRecoveryBinding,
  createRecoveryBinding,
  getModelProfile,
  createModelProfileBinding,
  MODEL_RECOVERY_SUSPENDED,
  MODEL_RECOVERY_SUSPENDED_REASON,
  ROLE_EFFORTS,
} from '../../../agents/codex/model-profiles.mjs';
import * as modelPolicy from '../../../agents/codex/orchestration-policy.mjs';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import {
  createModelScopeDigest,
  recommendDelegation,
} from '../../../agents/codex/child-task-contract.mjs';
import { discoverContextPack } from '../../../agents/common/domain-guide-registry.mjs';
import { buildTaskEnvelope } from '../../../agents/common/intake-policy.mjs';
import {
  createSemanticEvidenceId,
  createSemanticFactId,
  createSemanticSourceId,
} from '../../../agents/codex/routing-policy.mjs';
import {
  createDispatchRecommendation,
  createLifecycleRecommendation,
  evaluateRecovery,
  prepareLeaderSynthesis,
} from '../../../agents/codex/orchestration-policy.mjs';
import { FIXTURE_DISPATCH_TOKEN, observedChildren } from './fixtures/subagent-hook-observation.mjs';

const repoRoot = resolve(import.meta.dirname, '../../../..');
const UNLISTED_MODEL = 'gpt-x-unlisted';
const UNLISTED_REASON = {
  name: 'TypeError',
  message: 'Model is outside the allowed child model list.',
};

test('lifecycle eligibility is immutable advice, not native close or slot evidence', () => {
  const input = lifecycleEvidence();
  const before = structuredClone(input);
  const result = createLifecycleRecommendation(input);

  assert.equal(result.recommendation, 'close-eligible');
  assert.equal(result.closeDisposition, 'not-attempted');
  assert.equal(result.releaseDisposition, 'release-unverified');
  assert.equal(result.resultDisposition, 'collected');
  assert.equal(result.cleanupDisposition, 'required');
  assert.equal(result.authority, 'leader-reported-not-host-authenticated');
  assert.equal(result.requiresLeaderRuntimeConfirmation, true);
  assert.deepEqual(result.target, { parentId: '/root', childId: '/root/review', taskId: 'tb1' });
  assert.deepEqual(result.gaps, []);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.target), true);
  assert.deepEqual(input, before);
  assert.equal(Object.isFrozen(input.target), false);
});

const lifecycleNegatives = [
  ['no close', 'capabilities', { close: false }, 'unsupported', 'close-unsupported'],
  ['unknown close', 'capabilities', { close: null }, 'unsupported', 'close-unsupported'],
  [
    'stale evidence',
    'observation',
    { freshness: 'stale' },
    'unsupported',
    'observation-unverified',
  ],
  ['unknown scope', 'observation', { scope: 'unknown' }, 'unsupported', 'observation-unverified'],
  [
    'unknown provenance',
    'observation',
    { provenance: 'unknown' },
    'unsupported',
    'observation-unverified',
  ],
  [
    'denied authority',
    'observation',
    { actionPermission: 'denied' },
    'unsupported',
    'action-not-authorized',
  ],
  [
    'unknown authority',
    'observation',
    { actionPermission: 'unknown' },
    'unsupported',
    'action-not-authorized',
  ],
  ['foreign owner', 'target', { ownerParentId: '/other' }, 'unsupported', 'target-unverified'],
  ['missing owner', 'target', { ownerParentId: null }, 'unsupported', 'target-unverified'],
  ['unknown parent', 'target', { parentId: null }, 'unsupported', 'target-unverified'],
  ['root target', 'target', { isRoot: true }, 'unsupported', 'target-unverified'],
  ['unknown root status', 'target', { isRoot: null }, 'unsupported', 'target-unverified'],
  ['self target', 'target', { childId: '/root' }, 'unsupported', 'target-unverified'],
  ['other task', 'target', { observedTaskId: 'tb0' }, 'unsupported', 'target-unverified'],
  ['running', 'target', { state: 'running' }, 'wait', 'work-not-terminal'],
  ['waiting', 'target', { state: 'waiting' }, 'wait', 'work-not-terminal'],
  [
    'completed result is not native terminal',
    'target',
    { state: 'unknown' },
    'wait',
    'work-not-terminal',
  ],
  ['pending task', 'target', { pendingTasks: 1 }, 'wait', 'pending-work'],
  ['unknown pending task', 'target', { pendingTasks: null }, 'wait', 'pending-work'],
  ['pending tool', 'target', { pendingTools: 1 }, 'wait', 'pending-work'],
  ['unknown pending tool', 'target', { pendingTools: null }, 'wait', 'pending-work'],
  ['pending mailbox', 'target', { pendingMailbox: 1 }, 'wait', 'pending-work'],
  ['unknown pending mailbox', 'target', { pendingMailbox: null }, 'wait', 'pending-work'],
  ['uncollected result', 'result', { collected: false }, 'retain', 'result-uncollected'],
  ['unknown collection', 'result', { collected: null }, 'retain', 'result-uncollected'],
  ['old result', 'result', { taskId: 'tb0' }, 'retain', 'result-uncollected'],
  ['queued is not final', 'result', { delivery: 'queued' }, 'retain', 'result-uncollected'],
  ['timeout is not final', 'result', { delivery: 'timeout' }, 'retain', 'result-uncollected'],
];

for (const [name, field, patch, recommendation, gap] of lifecycleNegatives) {
  test(`lifecycle fails closed: ${name}`, () => {
    const input = lifecycleEvidence();
    Object.assign(input[field], patch);
    const result = createLifecycleRecommendation(input);
    assert.equal(result.recommendation, recommendation);
    assert.ok(result.gaps.includes(gap));
    assert.notEqual(result.closeDisposition, 'closed-confirmed');
    assert.equal(result.releaseDisposition, 'release-unverified');
  });
}

test('lifecycle retention and read-only status never request close', () => {
  const retained = lifecycleEvidence();
  retained.retention = { reason: 'Bounded delta review', revisit: 'After corrected snapshot' };
  assert.equal(createLifecycleRecommendation(retained).recommendation, 'retain');
  const status = createLifecycleRecommendation({ ...lifecycleEvidence(), intent: 'status' });
  assert.equal(status.recommendation, 'none');
  const idle = lifecycleEvidence();
  idle.target.state = 'idle';
  assert.notEqual(createLifecycleRecommendation(idle).recommendation, 'close-eligible');
});

test('idle continuation requires observed start-turn support, not message-only capability', () => {
  const input = lifecycleEvidence();
  input.intent = 'continue';
  input.target.state = 'idle';
  for (const support of [false, null]) {
    input.capabilities.startTurn = support;
    assert.equal(createLifecycleRecommendation(input).recommendation, 'unsupported');
  }
  input.capabilities.startTurn = true;
  input.capabilities.close = false;
  assert.equal(createLifecycleRecommendation(input).recommendation, 'continue');
  input.target.state = 'running';
  assert.equal(createLifecycleRecommendation(input).recommendation, 'wait');
});

test('close failure, uncertain outcome and conflicting post-state never trigger an automatic retry', () => {
  for (const status of ['failed', 'unknown', 'succeeded']) {
    const input = lifecycleEvidence();
    input.close = { status, childId: input.target.childId, taskId: input.target.taskId };
    const result = createLifecycleRecommendation(input);
    assert.equal(result.recommendation, 'retain');
    assert.equal(
      result.closeDisposition,
      status === 'failed' ? 'cleanup-failed' : 'close-unverified',
    );
    assert.equal(result.releaseDisposition, 'release-unverified');
  }
});

test('reported close and slot release require separate correlated observations', () => {
  const input = closedLifecycleEvidence();
  const closed = createLifecycleRecommendation(input);
  assert.equal(closed.recommendation, 'none');
  assert.equal(closed.closeDisposition, 'closed-confirmed');
  assert.equal(closed.releaseDisposition, 'release-unverified');
  input.release = {
    status: 'confirmed',
    childId: input.target.childId,
    taskId: input.target.taskId,
  };
  assert.equal(createLifecycleRecommendation(input).releaseDisposition, 'release-confirmed');
  for (const field of ['close', 'release']) {
    for (const key of ['childId', 'taskId']) {
      const mismatch = structuredClone(input);
      mismatch[field][key] = 'other';
      const result = createLifecycleRecommendation(mismatch);
      assert.equal(result.recommendation, 'unsupported');
      assert.notEqual(result.closeDisposition, 'closed-confirmed');
      assert.equal(result.releaseDisposition, 'release-unverified');
    }
  }
});

test('closed status or release alone cannot fabricate a successful native close', () => {
  const input = lifecycleEvidence();
  input.target.state = 'closed';
  assert.equal(createLifecycleRecommendation(input).closeDisposition, 'close-unverified');
  input.release = {
    status: 'confirmed',
    childId: input.target.childId,
    taskId: input.target.taskId,
  };
  const released = createLifecycleRecommendation(input);
  assert.equal(released.releaseDisposition, 'release-confirmed');
  assert.equal(released.closeDisposition, 'close-unverified');
  assert.notEqual(released.recommendation, 'close-eligible');
  for (const [field, patch] of lifecycleNegatives.map(([, field, patch]) => [field, patch])) {
    const unverified = closedLifecycleEvidence();
    Object.assign(unverified[field], patch);
    assert.notEqual(createLifecycleRecommendation(unverified).closeDisposition, 'closed-confirmed');
  }
});

test('lifecycle input rejects missing, expanded and malformed fields without guessing authority', () => {
  assert.throws(() => createLifecycleRecommendation(), /lifecycle/u);
  for (const field of Object.keys(lifecycleEvidence())) {
    const missing = lifecycleEvidence();
    delete missing[field];
    assert.throws(() => createLifecycleRecommendation(missing), /lifecycle/u);
  }
  for (const field of [
    null,
    'observation',
    'target',
    'capabilities',
    'result',
    'close',
    'release',
  ]) {
    const input = lifecycleEvidence();
    (field ? input[field] : input).hostAuthenticated = true;
    assert.throws(() => createLifecycleRecommendation(input), /lifecycle/u);
  }
  for (const mutate of [
    (v) => {
      v.schemaVersion = 2;
    },
    (v) => {
      v.intent = 'close-now';
    },
    (v) => {
      v.target.pendingTasks = -1;
    },
    (v) => {
      v.target.pendingTools = 0.5;
    },
    (v) => {
      v.target.pendingTools = '0';
    },
    (v) => {
      v.target.pendingMailbox = -1;
    },
    (v) => {
      v.target.pendingMailbox = undefined;
    },
    (v) => {
      v.target.childId = ' /root/review';
    },
    (v) => {
      v.target.childId = '';
    },
    (v) => {
      v.capabilities.close = 'true';
    },
    (v) => {
      v.retention = { reason: 'keep forever' };
    },
    (v) => {
      v.result = [];
    },
  ]) {
    const input = lifecycleEvidence();
    mutate(input);
    assert.throws(() => createLifecycleRecommendation(input), /lifecycle/u);
  }
});

test('ordinary role dispatch remains valid without any close capability envelope', () => {
  assert.equal(
    createLifecycleRecommendation({
      ...lifecycleEvidence(),
      capabilities: { close: false, startTurn: true },
    }).recommendation,
    'unsupported',
  );
  const result = createDispatchRecommendation({ delegation: legalDelegation() });
  assert.equal(result.execution, 'native-bounded-dispatch');
  // Lifecycle evidence is not a dispatch input.
  assert.throws(
    () =>
      createDispatchRecommendation({
        delegation: legalDelegation(),
        lifecycle: lifecycleEvidence(),
      }),
    { name: 'TypeError', message: 'Unsupported dispatch input: lifecycle' },
  );
});

test('verified no-close separates task collection and cleanup from unobserved release', () => {
  const input = noCloseLifecycleEvidence();
  const before = structuredClone(input);
  const result = createLifecycleRecommendation(input);
  assert.equal(result.recommendation, 'none');
  assert.equal(result.reason, 'no-explicit-close-required');
  assert.equal(result.resultDisposition, 'collected');
  assert.equal(result.cleanupDisposition, 'not-required');
  assert.equal(result.closeDisposition, 'not-attempted');
  assert.equal(result.releaseDisposition, 'release-unverified');
  assert.deepEqual(result.gaps, []);
  assert.equal(result.requiresLeaderRuntimeConfirmation, true);
  assert.equal(result.authority, 'leader-reported-not-host-authenticated');
  assert.deepEqual(input, before);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(input.lifecycleContract), false);
});

test('no close capability or unverified contract cannot prove runtime-managed cleanup', () => {
  for (const contract of [
    undefined,
    null,
    { cleanup: 'unknown', verification: 'unverified', reference: null },
    { cleanup: 'runtime-managed', verification: 'unverified', reference: 'source-only' },
    { cleanup: 'explicit-close', verification: 'current-host', reference: 'other contract' },
  ]) {
    const input = noCloseLifecycleEvidence();
    if (contract === undefined) delete input.lifecycleContract;
    else input.lifecycleContract = contract;
    const result = createLifecycleRecommendation(input);
    assert.equal(result.recommendation, 'unsupported');
    assert.equal(result.cleanupDisposition, 'unknown');
    assert.equal(result.resultDisposition, 'collected');
    assert.equal(result.closeDisposition, 'cleanup-unavailable');
    assert.equal(result.releaseDisposition, 'release-unverified');
  }
  for (const support of [true, null]) {
    const conflict = noCloseLifecycleEvidence();
    conflict.capabilities.close = support;
    const result = createLifecycleRecommendation(conflict);
    assert.equal(result.recommendation, 'unsupported');
    assert.equal(result.reason, 'lifecycle-contract-conflict');
    assert.equal(result.cleanupDisposition, 'unknown');
  }
});

test('legacy input still parses but missing mailbox does not authorize cleanup or continuation', () => {
  for (const intent of ['cleanup', 'continue', 'status']) {
    const input = lifecycleEvidence();
    input.intent = intent;
    delete input.target.pendingMailbox;
    const result = createLifecycleRecommendation(input);
    assert.equal(result.recommendation, 'wait');
    assert.equal(result.reason, 'pending-work');
    assert.equal(result.resultDisposition, 'collected');
    assert.equal(result.cleanupDisposition, 'unknown');
  }
});

test('collected result may coexist with pending or unknown work without cleanup authority', () => {
  for (const factory of [lifecycleEvidence, noCloseLifecycleEvidence]) {
    for (const field of ['pendingTasks', 'pendingTools', 'pendingMailbox']) {
      for (const pending of [1, null]) {
        const input = factory();
        input.target[field] = pending;
        const result = createLifecycleRecommendation(input);
        assert.equal(result.resultDisposition, 'collected');
        assert.equal(result.cleanupDisposition, 'unknown');
        assert.equal(result.recommendation, 'wait');
        assert.equal(result.releaseDisposition, 'release-unverified');
      }
    }
  }
});

test('runtime-managed release needs its own correlated evidence, never a synthetic close', () => {
  const input = noCloseLifecycleEvidence();
  input.release = {
    status: 'confirmed',
    childId: input.target.childId,
    taskId: input.target.taskId,
  };
  const result = createLifecycleRecommendation(input);
  assert.equal(result.recommendation, 'none');
  assert.equal(result.releaseDisposition, 'release-confirmed');
  assert.equal(result.closeDisposition, 'not-attempted');
  assert.equal(result.cleanupDisposition, 'not-required');
  for (const key of ['childId', 'taskId']) {
    const mismatch = structuredClone(input);
    mismatch.release[key] = 'other';
    const rejected = createLifecycleRecommendation(mismatch);
    assert.equal(rejected.recommendation, 'unsupported');
    assert.equal(rejected.releaseDisposition, 'release-unverified');
    assert.equal(rejected.resultDisposition, 'unverified');
  }
});

test('reported release never authorizes another close or automatic continuation', () => {
  for (const intent of ['cleanup', 'continue']) {
    const input = lifecycleEvidence();
    input.intent = intent;
    input.release = {
      status: 'confirmed',
      childId: input.target.childId,
      taskId: input.target.taskId,
    };
    const result = createLifecycleRecommendation(input);
    assert.equal(result.recommendation, 'retain');
    assert.equal(result.reason, 'released-target-requires-confirmation');
    assert.equal(result.resultDisposition, 'collected');
    assert.equal(result.closeDisposition, 'not-attempted');
    assert.equal(result.releaseDisposition, 'release-confirmed');
    assert.equal(result.requiresLeaderRuntimeConfirmation, true);
  }
});

test('no-close preserves identity, permission, state, pending and final-result guards', () => {
  for (const [name, field, patch, recommendation, gap] of lifecycleNegatives.slice(2)) {
    const input = noCloseLifecycleEvidence();
    Object.assign(input[field], patch);
    const result = createLifecycleRecommendation(input);
    assert.equal(result.recommendation, recommendation, name);
    assert.ok(result.gaps.includes(gap), name);
    assert.notEqual(result.cleanupDisposition, 'not-required', name);
    assert.notEqual(result.closeDisposition, 'closed-confirmed', name);
    assert.equal(result.releaseDisposition, 'release-unverified', name);
  }
  const uncollected = noCloseLifecycleEvidence();
  uncollected.result.collected = false;
  assert.equal(createLifecycleRecommendation(uncollected).resultDisposition, 'uncollected');
});

test('no-close does not swallow retained followup, continuation or conflicting close evidence', () => {
  const retained = noCloseLifecycleEvidence();
  retained.retention = { reason: 'Same-scope delta review', revisit: 'After exact new snapshot' };
  assert.equal(createLifecycleRecommendation(retained).reason, 'retained-for-followup');
  const followup = noCloseLifecycleEvidence();
  followup.intent = 'continue';
  followup.target.state = 'idle';
  assert.equal(createLifecycleRecommendation(followup).recommendation, 'continue');
  delete followup.target.pendingMailbox;
  assert.equal(createLifecycleRecommendation(followup).recommendation, 'wait');
  const idle = noCloseLifecycleEvidence();
  idle.target.state = 'idle';
  assert.equal(createLifecycleRecommendation(idle).recommendation, 'wait');
  for (const status of ['succeeded', 'failed', 'unknown']) {
    const conflicting = noCloseLifecycleEvidence();
    conflicting.close = {
      status,
      childId: conflicting.target.childId,
      taskId: conflicting.target.taskId,
    };
    assert.equal(createLifecycleRecommendation(conflicting).recommendation, 'retain');
  }
});

test('finite optional lifecycle contract rejects malformed or invented host authority', () => {
  for (const contract of [
    {},
    undefined,
    { cleanup: 'auto-close', verification: 'current-host', reference: 'fixture' },
    { cleanup: 'runtime-managed', verification: 'source-tag', reference: 'fixture' },
    { cleanup: 'runtime-managed', verification: 'current-host', reference: null },
    { cleanup: 'runtime-managed', verification: 'current-host', reference: '' },
    {
      cleanup: 'runtime-managed',
      verification: 'current-host',
      reference: 'fixture',
      hostAuthenticated: true,
    },
  ]) {
    const input = lifecycleEvidence();
    input.lifecycleContract = contract;
    assert.throws(() => createLifecycleRecommendation(input), /lifecycle/u);
  }
});

function noCloseLifecycleEvidence() {
  const input = lifecycleEvidence();
  input.capabilities.close = false;
  input.lifecycleContract = {
    cleanup: 'runtime-managed',
    verification: 'current-host',
    reference: 'synthetic-host-contract',
  };
  return input;
}

function lifecycleEvidence() {
  return {
    schemaVersion: 1,
    intent: 'cleanup',
    observation: {
      scope: 'current-turn',
      freshness: 'current-turn',
      provenance: 'native-tools',
      actionPermission: 'allowed',
    },
    target: {
      parentId: '/root',
      childId: '/root/review',
      ownerParentId: '/root',
      taskId: 'tb1',
      observedTaskId: 'tb1',
      isRoot: false,
      state: 'completed',
      pendingTasks: 0,
      pendingTools: 0,
      pendingMailbox: 0,
    },
    capabilities: { close: true, startTurn: true },
    result: { taskId: 'tb1', collected: true, delivery: 'final' },
    retention: null,
    close: { status: 'not-attempted', childId: null, taskId: null },
    release: { status: 'unknown', childId: null, taskId: null },
  };
}

function closedLifecycleEvidence() {
  const input = lifecycleEvidence();
  input.target.state = 'closed';
  input.close = { status: 'succeeded', childId: input.target.childId, taskId: input.target.taskId };
  return input;
}

test('dispatch accepts only its delegation, concurrency, token and recovery inputs', () => {
  const delegation = legalDelegation();
  for (const key of ['reportedRuntimeEvidence', 'modelUseByLane', 'hostAuthenticated'])
    assert.throws(() => createDispatchRecommendation({ delegation, [key]: {} }), {
      name: 'TypeError',
      message: `Unsupported dispatch input: ${key}`,
    });
});

test('contract-derived spawn arguments need no reported runtime evidence', () => {
  const delegation = legalDelegation();
  const result = createDispatchRecommendation({ delegation, dispatchToken: 'k3x9' });
  assert.equal(result.execution, 'native-bounded-dispatch');
  assert.deepEqual(
    result.dispatches.map(({ spawnArguments }) => spawnArguments),
    delegation.recommendedChildren.map(({ laneId, routeRecommendation }) => ({
      task_name: `${laneId.replaceAll('-', '_')}_k3x9`,
      agent_type: routeRecommendation.role,
      model: 'gpt-6-astra',
      reasoning_effort: ROLE_EFFORTS[routeRecommendation.role],
      fork_turns: 'none',
    })),
  );
  // No leader-reported runtime, admission or post-execution field remains on the advice.
  assert.deepEqual(Object.keys(result).sort(), [
    'deferredLaneIds',
    'dispatches',
    'execution',
    'gaps',
    'leaderOwnership',
    'limits',
    'reason',
    'requestId',
    'schemaVersion',
  ]);
  for (const dispatch of result.dispatches)
    assert.deepEqual(Object.keys(dispatch).sort(), [
      'agentType',
      'contract',
      'dispatchOwner',
      'dispatchToken',
      'effort',
      'laneId',
      'model',
      'spawnArguments',
    ]);
});

test('leader-reported post-execution checks and runtime capability fixtures are gone', () => {
  assert.equal('evaluateModelExecution' in modelPolicy, false, 'evaluateModelExecution export');
  assert.equal(
    existsSync(
      resolve(repoRoot, 'scripts/ci/agents/codex/fixtures/codex-runtime-capability-cases.json'),
    ),
    false,
    'runtime capability fixture',
  );
});

test('caller-expanded write capability fails closed before dispatch', () => {
  const delegation = legalDelegation();
  const expanded = {
    ...delegation,
    recommendedChildren: delegation.recommendedChildren.map((contract) => ({
      ...contract,
      allowed: {
        ...contract.allowed,
        tools: [...contract.allowed.tools, 'workspace-edit'],
      },
      boundary: {
        ...contract.boundary,
        writeOwnership: [],
        readOnly: false,
      },
    })),
  };

  assert.throws(
    () => createDispatchRecommendation({ delegation: expanded }),
    /write capability requires explicit write ownership/u,
  );
});

test('dispatch re-validates a caller-edited delegation before any spawn advice', () => {
  const base = legalDelegation();
  const asWriter = (contract, path) => ({
    ...contract,
    allowed: { ...contract.allowed, tools: [...contract.allowed.tools, 'workspace-edit'] },
    boundary: { ...contract.boundary, writeOwnership: [path], readOnly: false },
  });
  const [first, second] = base.recommendedChildren;
  const cases = [
    [
      { ...base, recommendedChildren: [asWriter(first, 'a.ts'), asWriter(second, 'b.ts')] },
      'delegation can select at most one write-capable child lane.',
    ],
    [
      {
        ...base,
        recommendedChildren: Array.from({ length: 7 }, (_, i) => ({
          ...first,
          laneId: `lane-${i}`,
        })),
      },
      'delegation exceeds the hard child limit of 6.',
    ],
    [
      { ...base, execution: 'direct' },
      'delegation execution and recommended child count are inconsistent.',
    ],
    [
      { ...base, leaderOwnership: { ...base.leaderOwnership, finalDecision: false } },
      'delegation must preserve leader-only ownership.',
    ],
    [
      { ...base, recommendedChildren: [first, { ...second, laneId: first.laneId }] },
      'contract laneId values must be unique.',
    ],
  ];
  for (const [delegation, message] of cases)
    assert.throws(() => createDispatchRecommendation({ delegation }), {
      name: 'TypeError',
      message,
    });
  // A recovery decision never yields a descriptor while model recovery is suspended, whatever else is supplied.
  const refused = createDispatchRecommendation({
    delegation: legalDelegation({ oneLane: true }),
    recoveryDecision: { laneId: 'legal-repository-map', action: 'alternate-once' },
  });
  assert.equal(refused.execution, 'leader-sequential');
  assert.deepEqual(refused.dispatches, []);
  assert.deepEqual(refused.deferredLaneIds, ['legal-repository-map']);
  assert.deepEqual(refused.gaps, ['model-recovery-incompatible-or-unadmitted']);
});

test('accepts one validated bounded lane', () => {
  const delegation = legalDelegation({ oneLane: true });
  const ready = createDispatchRecommendation({ delegation });

  assert.equal(delegation.recommendedChildren.length, 1);
  assert.equal(ready.execution, 'native-bounded-dispatch');
  assert.equal(ready.dispatches.length, 1);
  assert.equal(ready.dispatches[0].agentType, 'knu_explorer_xhigh');
});

test('ordinary scoped Astra advice binds exact native arguments without changing input or Parent', () => {
  const input = ordinaryScopedDispatchInput();
  const before = structuredClone(input);
  const result = createDispatchRecommendation(input);
  assert.equal(result.execution, 'native-bounded-dispatch');
  assert.deepEqual(result.dispatches[0].spawnArguments, {
    task_name: 'legal_repository_map',
    agent_type: 'knu_explorer_xhigh',
    model: 'gpt-6-astra',
    reasoning_effort: 'xhigh',
    fork_turns: 'none',
  });
  assert.equal(result.dispatches[0].contract.contextDelivery.applied, false);
  assert.deepEqual(result.dispatches[0].contract.contextDelivery.failures, [
    'Preserve the earlier failed verification as evidence.',
  ]);
  assert.ok(Object.isFrozen(result.dispatches[0].spawnArguments));
  assert.deepEqual(input, before);
  // A dispatch token joins the task name so completion can bind this dispatch's own child.
  const tokened = createDispatchRecommendation({
    ...ordinaryScopedDispatchInput(),
    dispatchToken: 'k3x9',
  });
  assert.equal(tokened.dispatches[0].spawnArguments.task_name, 'legal_repository_map_k3x9');
  assert.equal(tokened.dispatches[0].dispatchToken, 'k3x9');
  for (const dispatchToken of ['', 'UP', 'a_b1', 'toolongtoken13'])
    assert.throws(
      () => createDispatchRecommendation({ ...ordinaryScopedDispatchInput(), dispatchToken }),
      /dispatch token/u,
    );
});

test('ordinary context gaps cannot leave a ready descriptor', () => {
  const cases = [
    [
      'null context',
      (v) => {
        v.delegation.recommendedChildren[0].contextDelivery = null;
      },
    ],
    [
      'incompatible context',
      (v, c) => {
        c.compatible = false;
      },
    ],
    [
      'unknown compatibility',
      (v, c) => {
        delete c.compatible;
      },
    ],
    [
      'already applied claim',
      (v, c) => {
        c.applied = true;
      },
    ],
    [
      'unknown application',
      (v, c) => {
        delete c.applied;
      },
    ],
    [
      'contradictory gap',
      (v, c) => {
        c.gaps = ['full-history-fork-denied'];
      },
    ],
    [
      'unknown gaps',
      (v, c) => {
        delete c.gaps;
      },
    ],
  ];
  for (const [name, mutate] of cases) {
    const input = structuredClone(ordinaryScopedDispatchInput());
    mutate(input, input.delegation.recommendedChildren[0].contextDelivery);
    const result = createDispatchRecommendation(input);
    assert.equal(result.execution, 'leader-sequential', name);
    assert.deepEqual(result.dispatches, [], name);
    assert.deepEqual(result.gaps, ['context-delivery-incompatible:legal-repository-map'], name);
  }
});

test('composed full-history and review-role conflicts stop ordinary dispatch', () => {
  for (const change of [
    { mode: 'full-history', rationale: 'Synthetic history conflict.' },
    { mode: 'full-history', rationale: null },
    { purpose: 'initial-review' },
  ]) {
    const input = ordinaryScopedDispatchInput(change);
    assert.equal(input.delegation.recommendedChildren[0].contextDelivery.compatible, false);
    const result = createDispatchRecommendation(input);
    assert.equal(result.execution, 'leader-sequential');
    assert.deepEqual(result.dispatches, []);
    assert.ok(result.gaps.includes('context-delivery-incompatible:legal-repository-map'));
  }
});

test('omitted or inherited context spawns fresh, while a compatible reuse continues the earlier child', () => {
  const legacy = structuredClone(ordinaryScopedDispatchInput());
  delete legacy.delegation.recommendedChildren[0].contextDelivery;
  const inherited = ordinaryScopedDispatchInput({ effortMode: 'inherit' });
  for (const input of [legacy, inherited]) {
    const result = createDispatchRecommendation(input);
    assert.equal(result.execution, 'native-bounded-dispatch');
    assert.equal(result.dispatches[0].spawnArguments.fork_turns, 'none');
    // The role file pins the effort whatever the context asked to inherit.
    assert.equal(result.dispatches[0].spawnArguments.reasoning_effort, 'xhigh');
  }
  const reuse = ordinaryScopedDispatchInput({
    mode: 'reuse',
    effortMode: 'inherit',
    previous: {
      childId: '/root/same-task',
      laneId: 'legal-repository-map',
      role: 'knu_explorer_xhigh',
      sameOutcome: true,
      scopeUnchanged: true,
      sourceSnapshot: 'synthetic-source-v1',
      revalidatedForSnapshot: 'synthetic-source-v1',
      independentReview: false,
    },
  });
  assert.equal(reuse.delegation.recommendedChildren[0].contextDelivery.compatible, true);
  const followup = createDispatchRecommendation(reuse);
  assert.equal(followup.execution, 'leader-sequential');
  assert.deepEqual(followup.dispatches, []);
  assert.deepEqual(followup.gaps, ['context-reuse-not-a-spawn:legal-repository-map']);
  const fullHistory = ordinaryScopedDispatchInput({
    mode: 'full-history',
    effortMode: 'inherit',
    rationale: 'Necessary complete context.',
  });
  assert.ok(
    fullHistory.delegation.recommendedChildren[0].contextDelivery.gaps.includes(
      'full-history-fork-denied',
    ),
  );
  assert.equal(createDispatchRecommendation(fullHistory).execution, 'leader-sequential');
});

test('permits one distinct alternate attempt and then requires a terminal handoff', () => {
  const firstFailure = evaluateRecovery({
    laneId: 'legal-official-evidence',
    attempts: [failedAttempt('official-api', 'official-source-unavailable')],
  });
  const secondFailure = evaluateRecovery({
    laneId: 'legal-official-evidence',
    attempts: [
      failedAttempt('official-api', 'official-source-unavailable'),
      {
        ...failedAttempt('official-html', 'official-source-unavailable'),
        alternateOf: 'official-api',
      },
    ],
  });

  assert.equal(firstFailure.action, 'alternate-once');
  assert.equal(firstFailure.remainingAlternateAttempts, 1);
  assert.deepEqual(firstFailure.prohibitedApproachIds, ['official-api']);
  assert.equal(secondFailure.action, 'terminal-handoff');
  assert.equal(secondFailure.remainingAlternateAttempts, 0);
  assert.equal(secondFailure.disposition, 'evidence-gap');
  assert.equal(secondFailure.maxAlternateAttempts, 1);
});

test('does not retry authority, credential, production, scope, or role-routing failures', () => {
  for (const [failureCategory, expectedAction] of [
    ['missing-authority', 'terminal-handoff'],
    ['credential-required', 'terminal-handoff'],
    ['external-production', 'terminal-handoff'],
    ['scope-conflict', 'terminal-handoff'],
    ['role-routing-unavailable', 'leader-sequential-fallback'],
  ]) {
    const result = evaluateRecovery({
      laneId: 'legal-repository-map',
      attempts: [failedAttempt('primary', failureCategory)],
    });
    assert.equal(result.action, expectedAction, failureCategory);
    assert.equal(result.remainingAlternateAttempts, 0, failureCategory);
  }
});

test('rejects repeat attempts, post-success retries, and more than one alternate', () => {
  assert.throws(
    () =>
      evaluateRecovery({
        laneId: 'legal-official-evidence',
        attempts: [
          failedAttempt('same-approach', 'tool-unavailable'),
          { ...failedAttempt('same-approach', 'tool-unavailable'), alternateOf: 'same-approach' },
        ],
      }),
    /one distinct alternate approach/u,
  );
  assert.throws(
    () =>
      evaluateRecovery({
        laneId: 'legal-official-evidence',
        attempts: [
          { approachId: 'primary', outcome: 'success', evidence: 'Completed.' },
          {
            approachId: 'alternate',
            alternateOf: 'primary',
            outcome: 'success',
            evidence: 'Repeated.',
          },
        ],
      }),
    /cannot follow a successful primary/u,
  );
  assert.throws(
    () =>
      evaluateRecovery({
        laneId: 'legal-official-evidence',
        attempts: [
          failedAttempt('one', 'tool-unavailable'),
          { ...failedAttempt('two', 'tool-unavailable'), alternateOf: 'one' },
          { ...failedAttempt('three', 'tool-unavailable'), alternateOf: 'two' },
        ],
      }),
    /at most one alternate/u,
  );
});

test('prepares evidence for leader-only synthesis without granting child final authority', () => {
  const delegation = legalDelegation();
  const synthesis = prepareLeaderSynthesis({
    delegation,
    childResults: successfulLegalResults(),
    recoveryDecisions: [],
    conflicts: [],
    hookObservation: observedChildren(delegation),
    dispatchToken: FIXTURE_DISPATCH_TOKEN,
  });

  assert.equal(synthesis.readyForLeaderDecision, true);
  assert.equal(synthesis.facts.length, 2);
  assert.equal(synthesis.leaderOwnership.finalDecision, true);
  assert.equal(synthesis.leaderOwnership.finalUserResponse, true);
  assert.equal(synthesis.leaderOwnership.finalVerification, true);
  assert.equal(Object.isFrozen(synthesis), true);
});

test('a leader-reported completed child is refused without its hook observation', () => {
  const delegation = legalDelegation();
  const reportedOnly = prepareLeaderSynthesis({
    delegation,
    childResults: successfulLegalResults(),
    dispatchToken: FIXTURE_DISPATCH_TOKEN,
  });

  assert.equal(
    reportedOnly.readyForLeaderDecision,
    false,
    'a refused lane blocks leader synthesis',
  );
  assert.deepEqual(reportedOnly.refusedLaneIds, [
    'legal-official-evidence',
    'legal-repository-map',
  ]);
  assert.deepEqual(
    reportedOnly.completionChecks.map(({ laneId, accepted, reason }) => [laneId, accepted, reason]),
    [
      ['legal-official-evidence', false, 'observation-missing'],
      ['legal-repository-map', false, 'observation-missing'],
    ],
  );
  assert.equal(reportedOnly.completionAuthority, 'codex-subagent-hook');
  // Records without the dispatch token cannot name this dispatch's child.
  const untokened = prepareLeaderSynthesis({
    delegation,
    childResults: successfulLegalResults(),
    hookObservation: observedChildren(delegation),
  });
  assert.deepEqual(
    untokened.completionChecks.map(({ reason }) => reason),
    ['dispatch-token-missing', 'dispatch-token-missing'],
  );
});

test('hook observations bind each completed lane to its contract role, model and role effort', () => {
  const delegation = legalDelegation();
  const synthesize = (hookObservation, dispatchToken = FIXTURE_DISPATCH_TOKEN) =>
    prepareLeaderSynthesis({
      delegation,
      childResults: successfulLegalResults(),
      hookObservation,
      dispatchToken,
    });

  // Both lanes are xhigh roles on the Astra assignment profile.
  const observed = synthesize(observedChildren(delegation));
  assert.equal(observed.readyForLeaderDecision, true);
  assert.deepEqual(observed.refusedLaneIds, []);
  assert.ok(
    observed.completionChecks.every(({ accepted, effort }) => accepted && effort === 'xhigh'),
  );
  // Without the PreToolUse allow record (fail-open guard) nothing bound the spawn.
  assert.deepEqual(
    synthesize(observedChildren(delegation, { bind: false })).completionChecks.map(
      ({ reason }) => reason,
    ),
    ['observation-unbound', 'observation-unbound'],
  );
  // 6.1 Sol is an allowed pair for both roles, but the contracts asked for Astra.
  const otherModel = synthesize(observedChildren(delegation, { model: 'gpt-6.1-sol' }));
  assert.equal(otherModel.readyForLeaderDecision, false);
  assert.deepEqual(
    otherModel.completionChecks.map(({ reason }) => reason),
    ['model-mismatch', 'model-mismatch'],
  );
  const lowered = observedChildren(delegation);
  for (const record of lowered.records)
    if (record.event === 'SubagentStop') record.ownTurn = { ...record.ownTurn, effort: 'high' };
  assert.deepEqual(
    synthesize(lowered).completionChecks.map(({ reason }) => reason),
    ['effort-mismatch', 'effort-mismatch'],
  );
  // A grandchild under the first lane refuses that lane only.
  const nested = observedChildren(delegation);
  const firstStart = nested.records.find(({ event }) => event === 'SubagentStart');
  nested.records.push({
    ...firstStart,
    agentId: 'grandchild-0',
    agentType: 'default',
    agentPath: `${firstStart.agentPath}/helper`,
    parentThreadId: firstStart.agentId,
  });
  assert.deepEqual(
    synthesize(nested).completionChecks.map(({ laneId, reason }) => [laneId, reason]),
    [
      ['legal-official-evidence', 'observation-foreign'],
      ['legal-repository-map', null],
    ],
  );

  const unlisted = synthesize(observedChildren(delegation, { model: UNLISTED_MODEL }));
  assert.equal(unlisted.readyForLeaderDecision, false);
  assert.deepEqual(
    unlisted.completionChecks.map(({ reason }) => reason),
    ['model-not-allowed', 'model-not-allowed'],
  );
  const swapped = synthesize(observedChildren(delegation, { agentType: 'knu_reviewer' }));
  assert.deepEqual(
    swapped.completionChecks.map(({ reason }) => reason),
    ['observation-mismatch', 'observation-mismatch'],
  );
  const builtIn = synthesize(observedChildren(delegation, { agentType: 'default' }));
  assert.deepEqual(
    builtIn.completionChecks.map(({ reason }) => reason),
    ['role-not-in-roster', 'role-not-in-roster'],
  );
  // The allowlist and roster come from their owner, not from the caller's observation.
  const widened = synthesize({
    ...observedChildren(delegation, { model: UNLISTED_MODEL }),
    allowedModels: [UNLISTED_MODEL],
  });
  assert.deepEqual(
    widened.completionChecks.map(({ reason }) => reason),
    ['model-not-allowed', 'model-not-allowed'],
  );
  // An earlier dispatch's child of the same lane does not complete this dispatch.
  const earlier = synthesize(observedChildren(delegation, { dispatchToken: 'old1' }));
  assert.deepEqual(
    earlier.completionChecks.map(({ reason }) => reason),
    ['observation-missing', 'observation-missing'],
  );
  const twice = observedChildren(delegation);
  twice.records.push(
    ...twice.records.map((record) => ({ ...record, agentId: `${record.agentId}-b` })),
  );
  assert.deepEqual(
    synthesize(twice).completionChecks.map(({ reason }) => reason),
    ['observation-ambiguous', 'observation-ambiguous'],
  );
});

test('keeps missing, failed, unverified, recovering, or conflicting evidence from completion', () => {
  const delegation = legalDelegation();
  const incomplete = prepareLeaderSynthesis({
    delegation,
    childResults: [successfulLegalResults()[1]],
    recoveryDecisions: [
      evaluateRecovery({
        laneId: 'legal-official-evidence',
        attempts: [failedAttempt('official-api', 'tool-unavailable')],
      }),
    ],
    conflicts: [
      {
        statement: 'Repository policy and external interpretation conflict.',
        laneIds: ['legal-repository-map', 'legal-official-evidence'],
        resolution: 'unresolved',
        evidence: 'Both lanes reported different applicable scopes.',
      },
    ],
  });

  assert.equal(incomplete.readyForLeaderDecision, false);
  assert.deepEqual(incomplete.missingLaneIds, ['legal-official-evidence']);
  assert.deepEqual(incomplete.pendingRecoveryLaneIds, ['legal-official-evidence']);
  assert.equal(incomplete.conflicts[0].resolution, 'unresolved');
  // A distinct-approach alternate has no recovery binding, so it names no next model, and synthesis refuses one that does.
  assert.equal(incomplete.recoveryDecisions[0].nextModel ?? null, null);
  const unbound = {
    ...evaluateRecovery({
      laneId: 'legal-official-evidence',
      attempts: [failedAttempt('official-api', 'tool-unavailable')],
    }),
    nextModel: 'gpt-6-astra',
  };
  assert.throws(
    () =>
      prepareLeaderSynthesis({
        delegation,
        childResults: [successfulLegalResults()[1]],
        recoveryDecisions: [unbound],
      }),
    {
      name: 'TypeError',
      message: 'A recovery decision without a binding cannot name a next model.',
    },
  );
});

test('rejects child attempts to claim final decisions or omit contract outputs', () => {
  const delegation = legalDelegation();
  const [first] = successfulLegalResults();

  assert.throws(
    () =>
      prepareLeaderSynthesis({
        delegation,
        childResults: [{ ...first, finalDecision: 'Ship it.' }],
      }),
    /Unsupported child result field: finalDecision/u,
  );
  assert.throws(
    () =>
      prepareLeaderSynthesis({
        delegation,
        childResults: [{ ...first, outputs: {} }],
      }),
    /missing required fields/u,
  );
  assert.throws(
    () =>
      prepareLeaderSynthesis({
        delegation: { ...delegation, execution: 'direct', recommendedChildren: [] },
      }),
    /requires a bounded-lanes delegation/u,
  );
  assert.throws(
    () =>
      prepareLeaderSynthesis({
        delegation,
        recoveryDecisions: [
          {
            ...evaluateRecovery({ laneId: 'legal-official-evidence', attempts: [] }),
            action: 'terminal-handoff',
          },
        ],
      }),
    /status and action are inconsistent/u,
  );
});

test('orchestration policy is pure advisory and does not implement a child lifecycle engine', () => {
  const source = readFileSync(
    resolve(repoRoot, 'scripts/agents/codex/orchestration-policy.mjs'),
    'utf8',
  );

  assert.doesNotMatch(source, /node:child_process|spawn_agent|exec_command|create_goal|tmux/u);
  assert.doesNotMatch(source, /setInterval|setTimeout|while\s*\(|process\.kill/u);
  assert.match(source, /leader-reported-not-host-authenticated/u);
  assert.match(source, /requiresLeaderRuntimeConfirmation/u);
});

test('dispatch gate guidance names the hook guard and completion check, not leader-reported runtime evidence', () => {
  const orchestration = readFileSync(
    resolve(repoRoot, 'docs/development/agent-workflows/orchestration.md'),
    'utf8',
  );
  const recovery = readFileSync(
    resolve(repoRoot, 'docs/development/agent-workflows/request-intake/orchestration-recovery.md'),
    'utf8',
  );
  for (const heading of [
    '## Reported runtime evidence',
    '## Model admission',
    '## Routine admission lifetime',
    '## First dispatch and post-execution evidence',
  ])
    assert.doesNotMatch(recovery, new RegExp(`^${heading}$`, 'mu'), heading);
  const start = recovery.indexOf('## Native dispatch gate\n');
  assert.ok(start >= 0);
  const gate = recovery.slice(start, recovery.indexOf('\n## ', start + 1));
  for (const pointer of [/knu-subagent-hooks\.mjs/u, /codex:completion/u, /gpt-6-astra/u])
    assert.match(gate, pointer);
  assert.doesNotMatch(
    `${orchestration}\n${recovery}`,
    /host-tool-schema|omx-runtime-overlay|requiresLeaderRuntimeConfirmation|modelUseByLane/u,
  );
});

test('model candidates spawn their profile model with the role pin effort for pilot and routine', () => {
  for (const purpose of ['pilot', 'routine']) {
    const input = modelDispatchInput(purpose);
    const before = structuredClone(input);
    const result = createDispatchRecommendation(input);
    assert.equal(result.execution, 'native-bounded-dispatch');
    assert.equal(result.dispatches[0].model, 'gpt-6.1-sol');
    assert.equal(result.dispatches[0].modelPurpose, purpose);
    assert.deepEqual(result.dispatches[0].spawnArguments, {
      task_name: 'legal_repository_map',
      agent_type: 'knu_explorer',
      model: 'gpt-6.1-sol',
      reasoning_effort: 'high',
      fork_turns: 'none',
    });
    assert.deepEqual(input, before);
  }
});

test('model candidates fail closed when their context, snapshot or cohort changes', () => {
  const mutations = [
    (x) => {
      delete x.delegation.recommendedChildren[0].contextDelivery;
    },
    (x) => {
      x.delegation.recommendedChildren[0].contextDelivery.compatible = false;
    },
    (x) => {
      x.delegation.recommendedChildren[0].contextDelivery.mode = 'full-history';
    },
    (x) => {
      x.delegation.recommendedChildren[0].boundary.readScope.push('apps/api');
    },
    (x) => {
      x.delegation.recommendedChildren[0].allowed.tools.push('test-runner');
    },
  ];
  for (const mutate of mutations) {
    const input = modelDispatchInput();
    mutate(input);
    let result;
    try {
      result = createDispatchRecommendation(input);
    } catch (error) {
      assert.ok(error instanceof TypeError);
      continue;
    }
    assert.equal(result.execution, 'leader-sequential', String(mutate));
    assert.equal(result.dispatches.length, 0);
  }
});

test('same-role lanes on different models dispatch together under the ordinary concurrency limit', () => {
  // Native observation (DA-018): two concurrent knu_explorer children ran on gpt-6.1-sol and gpt-6-astra as requested.
  const ordinaryLane = (contextPack) => ({
    ...repositoryLane(contextPack),
    id: 'legal-repository-owners',
    impactRisk: 'medium',
  });
  const input = modelDispatchInput('routine', 'standard-read', [ordinaryLane]);
  const routes = input.delegation.recommendedChildren.map(({ laneId, routeRecommendation }) => [
    laneId,
    routeRecommendation.role,
    routeRecommendation.profileId,
  ]);
  assert.deepEqual(routes, [
    ['legal-repository-map', 'knu_explorer', 'standard-read'],
    ['legal-repository-owners', 'knu_explorer', 'astra-fallback'],
  ]);

  const result = createDispatchRecommendation(input);
  assert.equal(result.execution, 'native-bounded-dispatch');
  assert.deepEqual(result.deferredLaneIds, []);
  assert.deepEqual(result.gaps, []);
  assert.deepEqual(
    result.dispatches.map(({ laneId, agentType, spawnArguments }) => [
      laneId,
      agentType,
      spawnArguments.model,
    ]),
    [
      ['legal-repository-map', 'knu_explorer', 'gpt-6.1-sol'],
      ['legal-repository-owners', 'knu_explorer', 'gpt-6-astra'],
    ],
  );

  // A concurrency limit of one still defers the second lane as an ordinary limit.
  const limited = createDispatchRecommendation({ ...structuredClone(input), concurrencyLimit: 1 });
  assert.deepEqual(limited.deferredLaneIds, ['legal-repository-owners']);
  assert.deepEqual(
    limited.dispatches.map(({ laneId }) => laneId),
    ['legal-repository-map'],
  );
  assert.deepEqual(limited.gaps, ['runtime-concurrency-limit: 1 lane(s) deferred.']);
});

test('model context and cohort checks cannot be bypassed by refreshing the scope digest', () => {
  for (const mutate of [
    (contract) => {
      contract.contextDelivery.compatible = false;
    },
    (contract) => {
      contract.contextDelivery.mode = 'reuse';
    },
    (contract) => {
      contract.contextDelivery.failures.push('regression failed');
    },
    (contract) => {
      contract.allowed.tools.push('test-runner');
    },
    (contract) => {
      // Same role and effort under an assignment profile: the candidate's profile no longer owns the route.
      contract.routeRecommendation.profileId = 'astra-fallback';
    },
  ]) {
    const input = modelDispatchInput();
    mutate(input.delegation.recommendedChildren[0]);
    rebindModelScope(input);
    const result = createDispatchRecommendation(input);
    assert.equal(result.execution, 'leader-sequential');
    assert.ok(
      result.gaps.some((gap) => /model-context|model-cohort|model-effort|context-/.test(gap)),
    );
  }
});

test('Sol implementation needs its exact write, regression and Astra QA evidence', () => {
  const input = modelDispatchInput();
  const contract = input.delegation.recommendedChildren[0];
  const model = contract.routeRecommendation.modelRecommendation;
  model.taskKind = 'implementation';
  model.role = 'knu_executor';
  model.request.profileId = 'standard-build';
  model.profileBinding = createModelProfileBinding(getModelProfile('standard-build'));
  const id = model.request.verificationFacts.acceptance;
  model.request.verificationFacts = { acceptance: id, regression: id, astraQa: id };
  model.recommendedModel = 'gpt-6.1-sol';
  contract.routeRecommendation.role = 'knu_executor';
  contract.routeRecommendation.profileId = 'standard-build';
  contract.boundary.readOnly = false;
  contract.boundary.writeOwnership = ['apps/web/src/legal/example.test.ts'];
  contract.allowed.tools = ['repository-read', 'workspace-edit', 'test-runner'];
  rebindModelScope(input);
  assert.equal(createDispatchRecommendation(input).execution, 'native-bounded-dispatch');
  const missingQa = structuredClone(input);
  delete missingQa.delegation.recommendedChildren[0].routeRecommendation.modelRecommendation.request
    .verificationFacts.astraQa;
  assert.throws(() => createDispatchRecommendation(missingQa), TypeError);
});

test('model rescue shares the existing one-alternate ceiling without a trial ladder', () => {
  const primary = failedAttempt('terra-pilot', 'verification-failed');
  const rescue = {
    ...failedAttempt('astra-rescue', 'verification-failed'),
    alternateOf: 'terra-pilot',
  };
  assert.equal(
    evaluateRecovery({ laneId: 'legal-repository-map', attempts: [primary, rescue] }).status,
    'handoff-required',
  );
  assert.throws(
    () =>
      evaluateRecovery({
        laneId: 'legal-repository-map',
        attempts: [primary, rescue, { ...rescue, approachId: 'sol-trial' }],
      }),
    /at most one alternate/u,
  );
});

function rebindModelScope(input) {
  const contract = input.delegation.recommendedChildren[0];
  contract.modelScopeDigest = createModelScopeDigest(contract);
}

function modelDispatchInput(purpose = 'pilot', profileId = 'standard-read', extraLanes = []) {
  const profile = getModelProfile(profileId);
  const envelope = buildTaskEnvelope({ request: 'Legal 개선 지점 분석해줘.' });
  const contextPack = discoverContextPack({
    envelope,
    repositoryEvidence: [{ path: 'docs/policies/legal-basis.md' }],
  });
  const parts = Array.from({ length: 15 }, (_, i) =>
    semanticEvidence(contextPack, `M-${String(i + 1).padStart(2, '0')}`),
  );
  const pass2Evidence = {
    ...parts[0],
    sources: parts.flatMap((p) => p.sources),
    facts: parts.flatMap((p) => p.facts),
    predicateClaims: parts.flatMap((p) => p.predicateClaims),
  };
  const lane = {
    ...repositoryLane(contextPack),
    impactRisk: 'low',
    pass2Evidence,
    modelRequest: {
      profileId,
      purpose,
      verificationFacts: {
        acceptance: parts[0].facts[0].factId,
        independentCheck: parts[1].facts[0].factId,
        ...(profile.verificationKeys.includes('fixedInput')
          ? {
              fixedInput: parts[2].facts[0].factId,
              outputSchema: parts[3].facts[0].factId,
              singleStep: parts[4].facts[0].factId,
            }
          : {}),
      },
    },
  };
  const delivery = {
    purpose: 'task',
    mode: 'scoped',
    effortMode: 'explicit',
    rationale: null,
    snapshot: 'synthetic-source-v1',
    evidencePointers: ['docs/policies/legal-basis.md'],
    findings: [],
    failures: [],
    previous: null,
  };
  const delegation = recommendDelegation({
    envelope,
    contextPack,
    laneCandidates: [lane, ...extraLanes.map((extra) => extra(contextPack))],
    deliveryByLane: { [lane.id]: delivery },
  });
  return structuredClone({ delegation });
}

function ordinaryDelivery() {
  return {
    purpose: 'task',
    mode: 'scoped',
    effortMode: 'explicit',
    rationale: null,
    snapshot: 'synthetic-source-v1',
    evidencePointers: ['docs/policies/legal-basis.md'],
    findings: ['One unresolved, bounded deep analysis question.'],
    failures: ['Preserve the earlier failed verification as evidence.'],
    previous: null,
  };
}

// A concurrency/transaction question is an XHigh read: the xhigh explorer variant on Astra.
function ordinaryScopedDispatchInput(change = {}) {
  return {
    delegation: legalDelegation({
      oneLane: true,
      predicateId: 'BE-01-concurrency-transaction',
      delivery: { ...ordinaryDelivery(), ...change },
    }),
  };
}

function legalDelegation({ oneLane = false, delivery, predicateId } = {}) {
  const envelope = buildTaskEnvelope({ request: 'Legal 개선 지점 분석해줘.' });
  const contextPack = discoverContextPack({
    envelope,
    repositoryEvidence: [
      { path: 'docs/policies/legal-basis.md' },
      { path: 'apps/web/src/legal/README.md' },
      { path: 'apps/api/src/legal/legal.controller.ts' },
    ],
  });
  return recommendDelegation({
    envelope,
    contextPack,
    deliveryByLane: delivery ? { 'legal-repository-map': delivery } : {},
    laneCandidates: oneLane
      ? [repositoryLane(contextPack, predicateId)]
      : [repositoryLane(contextPack), officialLane(contextPack)],
  });
}

function repositoryLane(contextPack, predicateId = 'SEC-05-disclosure') {
  return {
    id: 'legal-repository-map',
    domain: 'legal',
    taskKind: 'lookup',
    priority: 'medium',
    objective: 'Map current Legal repository owners.',
    question: 'Which policy, FE, BFF, BE, contract, and test owners exist?',
    allowedEvidence: ['repo', 'test'],
    allowedTools: ['repository-read'],
    readScope: ['docs/policies', 'apps/web/src/legal', 'apps/api/src/legal'],
    writeOwnership: [],
    dependencies: [],
    expectedOutputFields: ['owners'],
    verification: ['Cite each owner path.'],
    benefit: {
      kind: 'completeness',
      rationale: 'Repository ownership can be mapped independently.',
    },
    pass2Evidence: semanticEvidence(contextPack, predicateId),
  };
}

function officialLane(contextPack) {
  return {
    id: 'legal-official-evidence',
    domain: 'legal-policy',
    taskKind: 'research',
    priority: 'high',
    impactRisk: 'high',
    objective: 'Collect current official legal evidence.',
    question: 'Which official sources constrain the Legal surface?',
    allowedEvidence: ['official-current'],
    allowedTools: ['official-web-read'],
    readScope: ['https://www.law.go.kr'],
    writeOwnership: [],
    dependencies: [],
    expectedOutputFields: ['officialSources'],
    verification: ['Cite direct official URLs and verification dates.'],
    benefit: {
      kind: 'specialist-evidence',
      rationale: 'Official evidence needs an independent research lane.',
    },
    pass2Evidence: semanticEvidence(contextPack, 'SEC-07-official-evidence'),
  };
}

function semanticEvidence(contextPack, predicateId) {
  const current = contextPack.sources.find(({ path }) => path === 'docs/policies/legal-basis.md');
  const source = {
    path: current.path,
    locator: `fixture:${predicateId}`,
    kind: current.kind,
    observedAt: current.verifiedAt ?? current.freshness,
    contentDigest: `sha256:${'b'.repeat(64)}`,
  };
  source.sourceId = createSemanticSourceId(source);
  const fact = {
    statement: `Current Legal evidence supports ${predicateId}.`,
    sourceIds: [source.sourceId],
    confidence: 'high',
  };
  fact.factId = createSemanticFactId(fact);
  const claim = {
    predicateId,
    outcome: 'confirmed',
    factIds: [fact.factId],
    semanticMatch: {
      matches: true,
      rationale: `The current source supports ${predicateId}.`,
    },
    compositeCategory: null,
  };
  claim.evidenceId = createSemanticEvidenceId(claim);
  return {
    sources: [source],
    facts: [fact],
    predicateClaims: [claim],
    inferences: [],
    gaps: [],
    confidence: 'high',
  };
}

function successfulLegalResults() {
  return [
    {
      laneId: 'legal-official-evidence',
      status: 'completed',
      outputs: { officialSources: ['https://www.law.go.kr'] },
      facts: [{ statement: 'An official source was verified.', source: 'https://www.law.go.kr' }],
      inferences: [],
      gaps: [],
      confidence: 'high',
      verification: [
        {
          claim: 'The source is current and official.',
          evidence: 'Direct official URL checked on 2026-08-13.',
          status: 'passed',
        },
      ],
      blocker: null,
    },
    {
      laneId: 'legal-repository-map',
      status: 'completed',
      outputs: { owners: ['policy', 'frontend', 'backend'] },
      facts: [
        {
          statement: 'Legal has tracked policy, frontend, and backend owners.',
          source: 'docs/policies/legal-basis.md',
        },
      ],
      inferences: [],
      gaps: [],
      confidence: 'high',
      verification: [
        {
          claim: 'Every owner has a current repository path.',
          evidence: 'Repository path inventory completed.',
          status: 'passed',
        },
      ],
      blocker: null,
    },
  ];
}

function failedAttempt(approachId, failureCategory) {
  return {
    approachId,
    outcome: 'failure',
    failureCategory,
    evidence: `${failureCategory} blocked the attempt.`,
  };
}

test('without a candidate the Parent keeps direct work and Astra lanes', () => {
  // Rebuild from current task evidence, not by relabeling a candidate contract.
  const envelope = buildTaskEnvelope({ request: 'Legal 개선 지점 분석해줘.' });
  const contextPack = discoverContextPack({
    envelope,
    repositoryEvidence: [{ path: 'docs/policies/legal-basis.md' }],
  });
  const direct = createDispatchRecommendation({
    delegation: recommendDelegation({ envelope, contextPack }),
  });
  assert.deepEqual(direct.dispatches, []);
  assert.ok(['leader-direct', 'leader-sequential'].includes(direct.execution));
  const astra = createDispatchRecommendation(ordinaryScopedDispatchInput());
  assert.equal(astra.dispatches[0].spawnArguments.model, 'gpt-6-astra');
  assert.equal(astra.dispatches[0].contract.routeRecommendation.modelRecommendation, undefined);
});

test('lower model lanes share the ordinary concurrency limit', () => {
  const input = modelDispatchInput();
  const second = structuredClone(input.delegation.recommendedChildren[0]);
  second.laneId = 'second-map';
  second.modelScopeDigest = createModelScopeDigest(second);
  input.delegation.recommendedChildren.push(second);
  const result = createDispatchRecommendation(input);
  assert.deepEqual(
    result.dispatches.map(({ laneId }) => laneId),
    ['legal-repository-map', 'second-map'],
  );
  assert.deepEqual(result.deferredLaneIds, []);
  const limited = createDispatchRecommendation({ ...structuredClone(input), concurrencyLimit: 1 });
  assert.deepEqual(limited.deferredLaneIds, ['second-map']);
  assert.deepEqual(
    limited.dispatches.map(({ laneId }) => laneId),
    ['legal-repository-map'],
  );
  assert.deepEqual(limited.gaps, ['runtime-concurrency-limit: 1 lane(s) deferred.']);
});

test('candidate dispatch revalidates cohort, context and write ownership after a scope rehash', () => {
  for (const profileId of ['standard-read', 'extract', 'standard-build']) {
    const profile = getModelProfile(profileId);
    // A build candidate cannot come from a read lane's evidence, so it is converted from the read contract below.
    const input = modelDispatchInput('pilot', profile.readOnly ? profileId : 'standard-read');
    const c = input.delegation.recommendedChildren[0];
    const model = c.routeRecommendation.modelRecommendation;
    model.request.profileId = profileId;
    model.profileBinding = createModelProfileBinding(profile);
    model.recommendedModel = profile.model;
    const fact = model.request.verificationFacts.acceptance;
    model.request.verificationFacts = Object.fromEntries(
      profile.verificationKeys.map((k) => [k, fact]),
    );
    if (!profile.readOnly) {
      model.taskKind = 'implementation';
      model.role = c.routeRecommendation.role = 'knu_executor';
      c.routeRecommendation.profileId = profileId;
      c.boundary.readOnly = false;
      c.boundary.writeOwnership = ['apps/web/src/legal/example.test.ts'];
    }
    c.allowed.tools = [...profile.allowedTools];
    rebindModelScope(input);
    const original = createDispatchRecommendation(input);
    assert.equal(original.execution, 'native-bounded-dispatch', profileId);
    assert.equal(original.dispatches[0].spawnArguments.model, profile.model, profileId);
    for (const mutate of [
      (d) => {
        d.contextDelivery.mode = 'full-history';
      },
      (d) => {
        d.contextDelivery.mode = 'reuse';
      },
      (d) => {
        d.contextDelivery.compatible = false;
      },
      (d) => {
        d.contextDelivery.applied = true;
      },
      (d) => {
        d.contextDelivery.gaps.push('missing input');
      },
      (d) => {
        d.contextDelivery.failures.push('failed validation');
      },
      (d) => {
        d.contextDelivery = null;
      },
      (d) => {
        d.allowed.tools.push('unapproved-tool');
      },
      (d) => {
        d.boundary.writeOwnership = profile.readOnly ? ['outside.ts'] : [];
      },
      (d) => {
        if (profile.readOnly) {
          d.boundary.readOnly = false;
          d.boundary.writeOwnership = ['outside.ts'];
          d.allowed.tools.push('workspace-edit');
        } else d.allowed.tools = ['repository-read'];
      },
    ]) {
      const bad = structuredClone(input);
      const contract = bad.delegation.recommendedChildren[0];
      mutate(contract);
      contract.modelScopeDigest = createModelScopeDigest(contract);
      const before = structuredClone(bad);
      let result;
      try {
        result = createDispatchRecommendation(bad);
      } catch (error) {
        assert.ok(error instanceof TypeError, `${profileId}: ${mutate}`);
        continue;
      }
      assert.equal(result.execution, 'leader-sequential', `${profileId}: ${mutate}`);
      assert.deepEqual(bad, before);
    }
  }
});

test('a recorded Astra alternate is rejected while recorded model order and non-retryable checks remain', () => {
  const primary = {
    ...failedAttempt('lower-primary', 'verification-failed'),
    model: 'gpt-6.1-sol',
  };
  const base = {
    laneId: 'legal-repository-map',
    attempts: [primary],
    modelRecovery: {
      profileBinding: createModelProfileBinding(getModelProfile('standard-read')),
      pendingWriter: 'cleared',
    },
  };
  const rescue = {
    ...failedAttempt('astra-rescue', 'verification-failed'),
    alternateOf: 'lower-primary',
    model: 'gpt-6-astra',
  };
  assert.throws(() => evaluateRecovery({ ...base, attempts: [primary, rescue] }), {
    name: 'TypeError',
    message: MODEL_RECOVERY_SUSPENDED_REASON,
  });
  assert.throws(
    () =>
      evaluateRecovery({
        ...base,
        attempts: [primary, { ...rescue, model: getModelProfile('extract').model }],
      }),
    /Astra/,
  );
  assert.throws(
    () => evaluateRecovery({ ...base, attempts: [primary, { ...rescue, model: UNLISTED_MODEL }] }),
    UNLISTED_REASON,
  );
  for (const category of ['quota-exhausted', 'capacity-denied', 'missing-authority']) {
    const stopped = evaluateRecovery({
      ...base,
      attempts: [{ ...primary, failureCategory: category }],
    });
    assert.equal(stopped.action, 'terminal-handoff');
    assert.equal(stopped.nextModel, null);
    assert.throws(
      () =>
        evaluateRecovery({
          ...base,
          attempts: [{ ...primary, failureCategory: category }, rescue],
        }),
      /non-retryable/,
    );
  }
});

test('Luna boundary remains read-only fixed input even with a rebound scope', () => {
  const input = modelDispatchInput('pilot', 'extract');
  const dispatch = createDispatchRecommendation(input).dispatches[0];
  // The Luna role is the xhigh explorer variant: route and spawn effort are the same pinned value.
  assert.equal(dispatch.contract.routeRecommendation.role, 'knu_explorer_xhigh');
  assert.equal(dispatch.contract.routeRecommendation.effort, 'xhigh');
  assert.equal(dispatch.spawnArguments.reasoning_effort, 'xhigh');
  assert.equal(dispatch.spawnArguments.model, 'gpt-6-luna');
  for (const tool of ['official-web-read', 'test-runner']) {
    const bad = structuredClone(input);
    bad.delegation.recommendedChildren[0].allowed.tools.push(tool);
    rebindModelScope(bad);
    assert.equal(createDispatchRecommendation(bad).execution, 'leader-sequential');
  }
});

test('stale profile bindings cannot be revived by rebinding scope', () => {
  for (const patch of [
    { policyRevision: 'old' },
    { profileDigest: `sha256:${'0'.repeat(64)}` },
    { model: UNLISTED_MODEL },
    { resolvedEffort: 'medium' },
    { cohort: 'bounded-extraction' },
    { profileId: 'future' },
  ]) {
    const input = modelDispatchInput();
    const model = input.delegation.recommendedChildren[0].routeRecommendation.modelRecommendation;
    // Clone the boundary; shared fixture references are not authority.
    model.profileBinding = { ...model.profileBinding, ...patch };
    rebindModelScope(input);
    try {
      assert.equal(createDispatchRecommendation(input).dispatches.length, 0);
    } catch (e) {
      if (!(e instanceof TypeError)) throw e;
    }
  }
});
test('dispatch revalidates the recommendation and exact installed binding even with a refreshed scope', () => {
  for (const mutate of [
    (c) => {
      c.routeRecommendation.modelRecommendation.request.profileId = 'future';
    },
    (c) => {
      c.routeRecommendation.impactRisk = 'high';
    },
    (c) => {
      c.routeRecommendation.modelRecommendation.profileBinding.policyRevision = 'stale';
    },
  ]) {
    const input = modelDispatchInput();
    mutate(input.delegation.recommendedChildren[0]);
    rebindModelScope(input);
    assert.throws(() => createDispatchRecommendation(input), TypeError);
  }
});
test('explicit recovery requires a current profile and rejects unlisted or raw-model requests', () => {
  const base = {
    laneId: 'legal-repository-map',
    attempts: [{ ...failedAttempt('primary', 'verification-failed'), model: 'gpt-6.1-sol' }],
    modelRecovery: {
      profileBinding: createModelProfileBinding(getModelProfile('standard-read')),
      pendingWriter: 'cleared',
    },
  };
  assert.throws(() => evaluateRecovery({ ...base, modelRecovery: undefined }), TypeError);
  for (const model of [UNLISTED_MODEL]) {
    assert.throws(
      () => evaluateRecovery({ ...base, attempts: [{ ...base.attempts[0], model }] }),
      UNLISTED_REASON,
    );
    assert.throws(
      () =>
        evaluateRecovery({
          ...base,
          modelRecovery: { primaryModel: model, pendingWriter: 'cleared' },
        }),
      TypeError,
    );
  }
  assert.throws(
    () =>
      evaluateRecovery({
        ...base,
        modelRecovery: {
          ...base.modelRecovery,
          profileBinding: { ...base.modelRecovery.profileBinding, policyRevision: 'old' },
        },
      }),
    TypeError,
  );
});

test('old medium/high profile data remains invalid across descriptor and recovery after full rehash', () => {
  for (const oldEffort of ['medium', 'high']) {
    const oldBinding = createModelProfileBinding({
      ...getModelProfile('standard-read'),
      policyRevision: '2026-09-24.1',
      resolvedEffort: oldEffort,
    });
    const input = modelDispatchInput();
    input.delegation.recommendedChildren[0].routeRecommendation.modelRecommendation.profileBinding =
      oldBinding;
    rebindModelScope(input);
    assert.throws(() => createDispatchRecommendation(input), TypeError);
    assert.throws(
      () =>
        evaluateRecovery({
          laneId: 'old-profile',
          attempts: [
            { ...failedAttempt('old-primary', 'verification-failed'), model: 'gpt-6.1-sol' },
          ],
          modelRecovery: { profileBinding: oldBinding, pendingWriter: 'cleared' },
        }),
      TypeError,
    );
  }
});

test('every recovery binding consumer rejects a forged selection while model recovery is suspended', () => {
  const forged = { primary: {}, rescue: {}, assessment: {}, model: 'gpt-6-astra' };
  const suspended = { name: 'TypeError', message: MODEL_RECOVERY_SUSPENDED_REASON };
  assert.equal(MODEL_RECOVERY_SUSPENDED, true);
  assert.throws(() => createRecoveryBinding(forged), suspended);
  assert.throws(() => assertCurrentRecoveryBinding(forged), suspended);
  const input = modelDispatchInput();
  const decision = {
    laneId: input.delegation.recommendedChildren[0].laneId,
    status: 'retry-alternate',
    action: 'alternate-once',
    remainingAlternateAttempts: 1,
    recoveryBinding: forged,
  };
  // The recovery dispatch reports the rejected binding as a gap and never yields a rescue descriptor.
  const dispatch = createDispatchRecommendation({ ...input, recoveryDecision: decision });
  assert.equal(dispatch.execution, 'leader-sequential');
  assert.deepEqual(dispatch.dispatches, []);
  assert.deepEqual(dispatch.gaps, ['model-recovery-incompatible-or-unadmitted']);
});

test('runtime-managed no-close permits same-lane continuation without synthetic release evidence', () => {
  const input = noCloseLifecycleEvidence();
  const finished = createLifecycleRecommendation(input);
  assert.equal(finished.cleanupDisposition, 'not-required');
  assert.equal(finished.releaseDisposition, 'release-unverified');
  input.intent = 'continue';
  input.capabilities.startTurn = true;
  const continuation = createLifecycleRecommendation(input);
  assert.equal(continuation.recommendation, 'continue');
  assert.equal(continuation.releaseDisposition, 'release-unverified');
  assert.equal(continuation.requiresLeaderRuntimeConfirmation, true);
  input.target.pendingTasks = 1;
  assert.equal(createLifecycleRecommendation(input).recommendation, 'wait');
});

test('a failed candidate gets no Astra alternate while model recovery is suspended', () => {
  const profileBinding = createModelProfileBinding(getModelProfile('standard-read'));
  for (const pendingWriter of ['cleared', 'pending', 'unknown']) {
    const recovery = evaluateRecovery({
      laneId: 'legal-repository-map',
      attempts: [
        { ...failedAttempt('lower-primary', 'verification-failed'), model: 'gpt-6.1-sol' },
      ],
      modelRecovery: { profileBinding, pendingWriter },
    });
    assert.equal(recovery.action, 'terminal-handoff', pendingWriter);
    assert.equal(recovery.status, 'handoff-required', pendingWriter);
    assert.equal(recovery.remainingAlternateAttempts, 0, pendingWriter);
    assert.equal(recovery.nextModel, null, pendingWriter);
    assert.equal(
      recovery.blocker,
      pendingWriter === 'cleared' ? 'model-recovery-suspended' : 'model-pending-writer-not-cleared',
      pendingWriter,
    );
  }
  // An ordinary lane still gets its one distinct-approach alternate under the common recovery ceiling.
  assert.equal(
    evaluateRecovery({
      laneId: 'legal-official-evidence',
      attempts: [failedAttempt('official-api', 'official-source-unavailable')],
    }).action,
    'alternate-once',
  );
});

test('a route without an admitted candidate names an Astra assignment profile and spawns Astra', () => {
  const ordinary = createDispatchRecommendation(ordinaryScopedDispatchInput());
  assert.equal(ordinary.dispatches[0].spawnArguments.model, 'gpt-6-astra');
  for (const profileId of ['extract', 'elevated-read']) {
    const input = structuredClone(ordinaryScopedDispatchInput());
    input.delegation.recommendedChildren[0].routeRecommendation.profileId = profileId;
    assert.throws(() => createDispatchRecommendation(input), {
      name: 'TypeError',
      message: 'A route without an admitted candidate must name an Astra assignment profile.',
    });
  }
});

test('leader synthesis rejects a model-attributed alternate while model recovery is suspended', () => {
  const laneId = 'legal-official-evidence';
  const decision = (attempts) => ({
    schemaVersion: 1,
    maxAlternateAttempts: 1,
    laneId,
    status: 'complete',
    action: 'none',
    remainingAlternateAttempts: 0,
    blocker: null,
    disposition: null,
    attempts,
  });
  const solFailure = {
    approachId: 'sol-primary',
    outcome: 'failure',
    failureCategory: 'verification-failed',
    evidence: 'The Sol attempt failed its oracle.',
    model: 'gpt-6.1-sol',
    effort: 'high',
  };
  const astraAlternate = {
    approachId: 'astra-rescue',
    alternateOf: 'sol-primary',
    outcome: 'success',
    evidence: 'The Astra alternate passed.',
    model: 'gpt-6-astra',
    effort: 'high',
  };
  assert.throws(
    () =>
      prepareLeaderSynthesis({
        delegation: legalDelegation(),
        childResults: successfulLegalResults(),
        recoveryDecisions: [decision([solFailure, astraAlternate])],
      }),
    { name: 'TypeError', message: MODEL_RECOVERY_SUSPENDED_REASON },
  );
  // An ordinary distinct-approach alternate without model attribution is unchanged.
  const { model: _m1, effort: _e1, ...ordinaryFailure } = solFailure;
  const { model: _m2, effort: _e2, ...ordinaryAlternate } = astraAlternate;
  const delegation = legalDelegation();
  assert.equal(
    prepareLeaderSynthesis({
      delegation,
      childResults: successfulLegalResults(),
      recoveryDecisions: [decision([ordinaryFailure, ordinaryAlternate])],
      hookObservation: observedChildren(delegation),
      dispatchToken: FIXTURE_DISPATCH_TOKEN,
    }).readyForLeaderDecision,
    true,
  );
});

test('installed roles are the ten effort-pinned role files and a route effort must match its role', () => {
  const input = modelDispatchInput();
  const contract = input.delegation.recommendedChildren[0];
  assert.equal(
    contract.routeRecommendation.effort,
    ROLE_EFFORTS[contract.routeRecommendation.role],
  );
  const drifted = structuredClone(input);
  drifted.delegation.recommendedChildren[0].routeRecommendation.effort =
    contract.routeRecommendation.effort === 'high' ? 'medium' : 'high';
  assert.throws(() => createDispatchRecommendation(drifted), {
    name: 'TypeError',
    message: 'Route effort must be the effort its role file pins.',
  });
});
