import {
  getModelProfile,
  createModelProfileBinding,
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
import {
  acceptedChildren,
  FIXTURE_DISPATCH_TOKEN,
  observedChildren,
} from './fixtures/subagent-hook-observation.mjs';

const repoRoot = resolve(import.meta.dirname, '../../../..');
const UNLISTED_MODEL = 'gpt-x-unlisted';

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

test('dispatch accepts only its delegation, concurrency and token inputs', () => {
  const delegation = legalDelegation();
  for (const key of [
    'reportedRuntimeEvidence',
    'modelUseByLane',
    'hostAuthenticated',
    'recoveryDecision',
  ])
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

test('suspended model recovery exports are gone from profiles, child contracts and the policy', async () => {
  const modules = {
    'model-profiles': await import('../../../agents/codex/model-profiles.mjs'),
    'child-task-contract': await import('../../../agents/codex/child-task-contract.mjs'),
    'orchestration-policy': modelPolicy,
  };
  for (const [name, exports] of Object.entries(modules))
    for (const removed of [
      'MODEL_RECOVERY_SUSPENDED',
      'MODEL_RECOVERY_SUSPENDED_REASON',
      'createRecoveryBinding',
      'assertCurrentRecoveryBinding',
      'createRecoveryChildContract',
      'assertRecoveryChildContract',
    ])
      assert.equal(Object.hasOwn(exports, removed), false, `${name}: ${removed}`);
});

test('model recovery suspension sections are gone and the recovery ceiling names the one-rung ladder', () => {
  const read = (path) => readFileSync(resolve(repoRoot, path), 'utf8');
  const workflow = 'docs/development/agent-workflows/';
  const recovery = read(`${workflow}request-intake/orchestration-recovery.md`);
  const adapter = read(`${workflow}adapters/codex.md`);
  const delegation = read(`${workflow}adapters/codex-delegation.md`);
  assert.doesNotMatch(recovery, /^## Model recovery suspension$/mu);
  assert.doesNotMatch(adapter, /^### Model recovery suspension$/mu);
  assert.doesNotMatch(delegation, /^### Recovery child context$/mu);
  for (const text of [
    recovery,
    adapter,
    delegation,
    read(`${workflow}agentic-architecture-decisions.md`),
  ])
    assert.doesNotMatch(text, /#model-recovery-suspension|recoveryDecision\b|effortMode/u);
  const start = recovery.indexOf('## Recovery ceiling\n');
  assert.ok(start >= 0);
  const ceiling = recovery.slice(start, recovery.indexOf('\n## ', start + 1));
  // A result-quality failure retries once one rung up on its role; the retry never chains.
  assert.doesNotMatch(ceiling, /다른 model로 다시 시도하지 않습니다|ladder는 없습니다/u);
  assert.match(ceiling, /`laneId`·`route`·`attempts`만/u);
  assert.match(ceiling, /같은 역할로 사다리 한 단 위/u);
  assert.match(ceiling, /재시도의 재시도·연쇄 상향은 없습니다/u);
  for (const text of [adapter, delegation])
    assert.doesNotMatch(text, /다른 model로\s*(다시 시도하지|옮기지) 않습니다/u);
});

test('deleted delivery effort mode is not prose input and a new contract after handoff is not a retry', () => {
  const read = (path) => readFileSync(resolve(repoRoot, path), 'utf8');
  const workflow = 'docs/development/agent-workflows/';
  for (const path of [
    'adapters/codex.md',
    'adapters/codex-delegation.md',
    'request-intake/orchestration-recovery.md',
  ])
    assert.doesNotMatch(read(`${workflow}${path}`), /inherit|explicit-effort/iu, path);
  assert.doesNotMatch(
    read(`${workflow}request-intake/delegation.md`),
    /explicit-effort|effortMode/u,
  );
  const recovery = read(`${workflow}request-intake/orchestration-recovery.md`);
  const start = recovery.indexOf('## Recovery ceiling\n');
  const ceiling = recovery.slice(start, recovery.indexOf('\n## ', start + 1));
  assert.match(ceiling, /새 ordinary contract[^\n]*\n[^\n]*새 위임입니다/u);
});

test('the common recovery ceiling the Codex retry relies on keeps one retry and no per-failure model ladder', () => {
  const orchestration = readFileSync(
    resolve(repoRoot, 'docs/development/agent-workflows/orchestration.md'),
    'utf8',
  );
  const start = orchestration.indexOf('## Recovery ceiling\n');
  assert.ok(start >= 0);
  const ceiling = orchestration.slice(start, orchestration.indexOf('\n## ', start + 1));
  assert.match(ceiling, /모델을 바꾼 시도도 같은 상한을 소비합니다/u);
  assert.match(ceiling, /실패할 때마다 모델을 차례로 올리는 자동 사다리는 없습니다/u);
  assert.match(
    ceiling,
    /다른 접근의 구체\(모델·effort 상향, 대체 역할, 호출 인자\)는 host adapter가 정합니다/u,
  );
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
    // Every child role is read-only (D-OSS-35): one caller-edited write-capable child already fails.
    [
      { ...base, recommendedChildren: [asWriter(first, 'a.ts'), second] },
      'child contracts are read-only: every child role is read-only and implementation stays with the Lead.',
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
    // A caller-edited mode other than scoped or reuse is incompatible context, not a reuse.
    [
      'caller-edited full-history mode',
      (v, c) => {
        c.mode = 'full-history';
      },
    ],
    [
      'unknown mode',
      (v, c) => {
        c.mode = 'x';
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

test('omitted or scoped context spawns fresh, while a compatible reuse continues the earlier child', () => {
  const legacy = structuredClone(ordinaryScopedDispatchInput());
  delete legacy.delegation.recommendedChildren[0].contextDelivery;
  for (const input of [legacy, ordinaryScopedDispatchInput()]) {
    const result = createDispatchRecommendation(input);
    assert.equal(result.execution, 'native-bounded-dispatch');
    assert.equal(result.dispatches[0].spawnArguments.fork_turns, 'none');
    // The role file pins the effort; the context delivery carries no effort.
    assert.equal(result.dispatches[0].spawnArguments.reasoning_effort, 'xhigh');
  }
  const reuse = ordinaryScopedDispatchInput({
    mode: 'reuse',
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
    route: laneRoute('legal-official-evidence'),
    attempts: [failedAttempt('official-api', 'official-source-unavailable')],
  });
  const secondFailure = evaluateRecovery({
    laneId: 'legal-official-evidence',
    route: laneRoute('legal-official-evidence'),
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
      route: laneRoute('legal-repository-map'),
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
        route: laneRoute('legal-official-evidence'),
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
        route: laneRoute('legal-official-evidence'),
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
        route: laneRoute('legal-official-evidence'),
        attempts: [
          failedAttempt('one', 'tool-unavailable'),
          { ...failedAttempt('two', 'tool-unavailable'), alternateOf: 'one' },
          { ...failedAttempt('three', 'tool-unavailable'), alternateOf: 'two' },
        ],
      }),
    /at most one alternate/u,
  );
});

test('terminal recovery keeps its disposition per failure category and refuses a primary alternateOf', () => {
  for (const [failureCategory, disposition] of [
    ['missing-authority', 'plan-oq'],
    ['scope-conflict', 'plan-oq'],
    ['credential-required', 'user-handoff'],
    ['external-production', 'user-handoff'],
    ['role-routing-unavailable', 'leader-sequential'],
    ['quota-exhausted', 'blocker-handoff'],
  ]) {
    const result = evaluateRecovery({
      laneId: 'legal-repository-map',
      route: laneRoute('legal-repository-map'),
      attempts: [failedAttempt('primary', failureCategory)],
    });
    assert.equal(result.status, 'handoff-required', failureCategory);
    assert.equal(result.disposition, disposition, failureCategory);
  }
  const unknown = evaluateRecovery({
    laneId: 'legal-repository-map',
    route: laneRoute('legal-repository-map'),
    attempts: [
      failedAttempt('primary', 'unknown'),
      { ...failedAttempt('alternate', 'unknown'), alternateOf: 'primary' },
    ],
  });
  assert.equal(unknown.disposition, 'blocker-handoff');
  assert.equal(unknown.confidence, 'low');
  assert.throws(
    () =>
      evaluateRecovery({
        laneId: 'legal-repository-map',
        route: laneRoute('legal-repository-map'),
        attempts: [{ ...failedAttempt('primary', 'tool-unavailable'), alternateOf: 'earlier' }],
      }),
    { name: 'TypeError', message: 'The primary attempt cannot declare alternateOf.' },
  );
});

test('leader synthesis keeps validating ordinary recovery decisions and their lanes', () => {
  const delegation = legalDelegation();
  const pending = evaluateRecovery({
    laneId: 'legal-repository-map',
    route: laneRoute('legal-repository-map'),
    attempts: [failedAttempt('repository-index', 'tool-unavailable')],
  });
  const synthesize = (recoveryDecisions, childResults = []) =>
    prepareLeaderSynthesis({ delegation, childResults, recoveryDecisions });
  const refuses = (recoveryDecisions, message, childResults) =>
    assert.throws(() => synthesize(recoveryDecisions, childResults), {
      name: 'TypeError',
      message,
    });
  refuses(pending, 'recoveryDecisions must be an array.');
  refuses(
    [{ ...pending, laneId: 'unknown-lane' }],
    'Recovery references an unknown lane: unknown-lane',
  );
  refuses([pending, pending], 'recovery laneId values must be unique.');
  refuses([pending], 'A completed child result cannot have a pending or terminal recovery.', [
    successfulLegalResults()[1],
  ]);
  refuses([{ ...pending, schemaVersion: 2 }], 'recovery decision must use the bounded schema.');
  refuses([{ ...pending, action: 'none' }], 'recovery status and action are inconsistent.');
  refuses(
    [{ ...pending, status: 'not-started', action: 'primary-attempt' }],
    'non-failure recovery states cannot include blocker or disposition.',
  );
  refuses([{ ...pending, blocker: null }], 'failure recovery states require a blocker.');
  refuses(
    [{ ...pending, status: 'handoff-required', action: 'terminal-handoff' }],
    'handoff-required recovery requires a disposition.',
  );
  refuses(
    [{ ...pending, remainingAlternateAttempts: 0 }],
    'recovery remaining attempt count is inconsistent.',
  );
  // A pending alternate keeps synthesis from the leader decision.
  const waiting = synthesize([pending], [successfulLegalResults()[0]]);
  assert.deepEqual(waiting.pendingRecoveryLaneIds, ['legal-repository-map']);
  assert.equal(waiting.readyForLeaderDecision, false);
});

test('prepares evidence for leader-only synthesis without granting child final authority', () => {
  const delegation = legalDelegation();
  const synthesis = prepareLeaderSynthesis({
    delegation,
    childResults: successfulLegalResults(),
    recoveryDecisions: [],
    conflicts: [],
    hookObservation: observedChildren(delegation),
    acceptances: acceptedChildren(observedChildren(delegation)),
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
  const synthesize = (
    hookObservation,
    dispatchToken = FIXTURE_DISPATCH_TOKEN,
    acceptances = acceptedChildren(hookObservation),
  ) =>
    prepareLeaderSynthesis({
      delegation,
      childResults: successfulLegalResults(),
      hookObservation,
      acceptances,
      dispatchToken,
    });

  // Both lanes are xhigh roles on the Astra assignment profile.
  const observed = synthesize(observedChildren(delegation));
  assert.equal(observed.readyForLeaderDecision, true);
  assert.deepEqual(observed.refusedLaneIds, []);
  assert.ok(
    observed.completionChecks.every(({ accepted, effort }) => accepted && effort === 'xhigh'),
  );
  // A completed lane also needs the acceptance record of its accepted child; a list without it refuses the lane.
  const unaccepted = synthesize(observedChildren(delegation), FIXTURE_DISPATCH_TOKEN, []);
  assert.equal(unaccepted.readyForLeaderDecision, false);
  assert.deepEqual(
    unaccepted.completionChecks.map(({ reason }) => reason),
    ['acceptance-missing', 'acceptance-missing'],
  );
  assert.throws(() => synthesize(observedChildren(delegation), FIXTURE_DISPATCH_TOKEN, {}), {
    name: 'TypeError',
    message: 'acceptances must be an array.',
  });
  assert.throws(() => prepareLeaderSynthesis({ delegation, childResults: [], acceptances: {} }), {
    name: 'TypeError',
    message: 'acceptances must be an array.',
  });
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
        route: laneRoute('legal-official-evidence'),
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
  // A decision names no model beyond its computed retryRoute; a field outside evaluateRecovery's output is refused.
  const pending = evaluateRecovery({
    laneId: 'legal-official-evidence',
    route: laneRoute('legal-official-evidence'),
    attempts: [failedAttempt('official-api', 'tool-unavailable')],
  });
  for (const field of ['nextModel', 'recoveryBinding'])
    assert.throws(
      () =>
        prepareLeaderSynthesis({
          delegation,
          childResults: [successfulLegalResults()[1]],
          recoveryDecisions: [{ ...pending, [field]: 'gpt-6-astra' }],
        }),
      { name: 'TypeError', message: `Unsupported recovery decision field: ${field}` },
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
            ...evaluateRecovery({
              laneId: 'legal-official-evidence',
              route: laneRoute('legal-official-evidence'),
              attempts: [],
            }),
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

// The lane contract route a recovery decision is computed against.
function laneRoute(laneId, delegation = legalDelegation()) {
  const { role, profileId } = delegation.recommendedChildren.find(
    (contract) => contract.laneId === laneId,
  ).routeRecommendation;
  return { role, profileId };
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
  for (const profileId of ['standard-read', 'extract']) {
    const profile = getModelProfile(profileId);
    const input = modelDispatchInput('pilot', profileId);
    const c = input.delegation.recommendedChildren[0];
    const model = c.routeRecommendation.modelRecommendation;
    model.request.profileId = profileId;
    model.profileBinding = createModelProfileBinding(profile);
    model.recommendedModel = profile.model;
    const fact = model.request.verificationFacts.acceptance;
    model.request.verificationFacts = Object.fromEntries(
      profile.verificationKeys.map((k) => [k, fact]),
    );
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
        d.boundary.writeOwnership = ['outside.ts'];
      },
      (d) => {
        d.boundary.readOnly = false;
        d.boundary.writeOwnership = ['outside.ts'];
        d.allowed.tools.push('workspace-edit');
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
test('old medium/high profile data remains invalid in the descriptor after full rehash', () => {
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
  }
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

test('attempt numbers and decision confidence or prohibited approaches must match the recomputed recovery', () => {
  const laneId = 'legal-repository-map';
  const failure = failedAttempt('repository-index', 'tool-unavailable');
  assert.equal(
    evaluateRecovery({ laneId, route: laneRoute(laneId), attempts: [{ ...failure, number: 1 }] })
      .attempts[0].number,
    1,
  );
  assert.throws(
    () =>
      evaluateRecovery({
        laneId,
        route: laneRoute(laneId),
        attempts: [{ ...failure, number: 99 }],
      }),
    {
      name: 'TypeError',
      message: 'Attempt number must equal its position: 1.',
    },
  );
  const delegation = legalDelegation();
  const decision = evaluateRecovery({ laneId, route: laneRoute(laneId), attempts: [failure] });
  const synthesize = (recoveryDecision) =>
    prepareLeaderSynthesis({ delegation, recoveryDecisions: [recoveryDecision] });
  assert.doesNotThrow(() => synthesize(decision));
  assert.throws(() => synthesize({ ...decision, confidence: 'low' }), {
    name: 'TypeError',
    message: 'Recovery decision confidence must match its attempts.',
  });
  assert.throws(() => synthesize({ ...decision, prohibitedApproachIds: ['gpt-6-astra'] }), {
    name: 'TypeError',
    message: 'Recovery decision prohibitedApproachIds must match its attempts.',
  });
});

test('recovery and synthesis refuse model attribution because the retry route is computed from the contract', () => {
  const laneId = 'legal-official-evidence';
  const route = laneRoute(laneId);
  // The Astra lane has no rung above it, so its retry keeps the contract.
  assert.equal(getModelProfile(route.profileId).kind, 'assignment');
  const retryRoute = { kind: 'same-contract', ...route, model: 'gpt-6-astra' };
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
    route,
    retryRoute,
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
  // The retry model comes from the lane route and the ladder, so an attempt carries no model, effort or child identity.
  const attributed = {
    model: 'gpt-6.1-sol',
    effort: 'high',
    executed: true,
    identity: { taskId: 'task-1' },
    recoveryBinding: { model: 'gpt-6-astra' },
  };
  for (const [field, value] of Object.entries(attributed))
    assert.throws(
      () =>
        evaluateRecovery({
          laneId,
          route: laneRoute(laneId),
          attempts: [{ ...failedAttempt('primary', 'verification-failed'), [field]: value }],
        }),
      { name: 'TypeError', message: `Unsupported attempt field: ${field}` },
      field,
    );
  assert.throws(
    () =>
      evaluateRecovery({
        laneId,
        route: laneRoute(laneId),
        attempts: [failedAttempt('primary', 'verification-failed')],
        modelRecovery: { pendingWriter: 'cleared' },
      }),
    { name: 'TypeError', message: 'Unsupported recovery input: modelRecovery' },
  );
  assert.throws(
    () =>
      prepareLeaderSynthesis({
        delegation: legalDelegation(),
        childResults: successfulLegalResults(),
        recoveryDecisions: [decision([solFailure, astraAlternate])],
      }),
    { name: 'TypeError', message: 'Unsupported attempt field: model' },
  );
  // An ordinary distinct-approach retry without model attribution completes on the retry task path.
  const { model: _m1, effort: _e1, ...ordinaryFailure } = solFailure;
  const { model: _m2, effort: _e2, ...ordinaryAlternate } = astraAlternate;
  const delegation = legalDelegation();
  assert.equal(
    prepareLeaderSynthesis({
      delegation,
      childResults: successfulLegalResults(),
      recoveryDecisions: [decision([ordinaryFailure, ordinaryAlternate])],
      hookObservation: observedChildren(delegation, { retryLaneIds: [laneId] }),
      acceptances: acceptedChildren(observedChildren(delegation, { retryLaneIds: [laneId] })),
      dispatchToken: FIXTURE_DISPATCH_TOKEN,
    }).readyForLeaderDecision,
    true,
  );
});

test('a result-quality failure retries once one rung up on its role and other failures keep the contract', () => {
  const laneId = 'lane-a';
  const decide = (route, failureCategory) =>
    evaluateRecovery({ laneId, route, attempts: [failedAttempt('primary', failureCategory)] });
  const ladder = (role, profileId, model) => ({ kind: 'ladder', role, profileId, model });
  const same = (role, profileId, model) => ({ kind: 'same-contract', role, profileId, model });
  const sol = { role: 'knu_researcher', profileId: 'standard-read' };
  for (const failureCategory of ['verification-failed', 'unknown']) {
    const pending = decide(sol, failureCategory);
    assert.equal(pending.action, 'alternate-once', failureCategory);
    assert.deepEqual(pending.route, sol);
    assert.deepEqual(
      pending.retryRoute,
      ladder('knu_researcher', 'astra-fallback', 'gpt-6-astra'),
      failureCategory,
    );
  }
  assert.deepEqual(
    decide({ role: 'knu_explorer_xhigh', profileId: 'extract' }, 'verification-failed').retryRoute,
    ladder('knu_explorer_xhigh', 'elevated-read', 'gpt-6.1-sol'),
  );
  assert.deepEqual(
    decide({ role: 'knu_explorer_xhigh', profileId: 'elevated-read' }, 'unknown').retryRoute,
    ladder('knu_explorer_xhigh', 'astra-fallback', 'gpt-6-astra'),
  );
  // Evidence and tool failures change the approach on the same contract.
  for (const failureCategory of [
    'tool-unavailable',
    'official-source-unavailable',
    'repository-evidence-missing',
  ])
    assert.deepEqual(
      decide(sol, failureCategory).retryRoute,
      same('knu_researcher', 'standard-read', 'gpt-6.1-sol'),
      failureCategory,
    );
  // An Astra lane has no rung above it.
  for (const route of [
    { role: 'knu_reviewer', profileId: 'review' },
    { role: 'knu_explorer', profileId: 'astra-fallback' },
  ])
    assert.deepEqual(
      decide(route, 'verification-failed').retryRoute,
      same(route.role, route.profileId, 'gpt-6-astra'),
      route.profileId,
    );
  const quota = decide(sol, 'quota-exhausted');
  assert.equal(quota.status, 'handoff-required');
  assert.equal(quota.retryRoute, null);
  assert.equal(evaluateRecovery({ laneId, route: sol, attempts: [] }).retryRoute, null);
  // The finished retry keeps the route it ran on; there is no retry of a retry.
  const retried = evaluateRecovery({
    laneId,
    route: sol,
    attempts: [
      failedAttempt('primary', 'verification-failed'),
      { ...failedAttempt('astra-retry', 'verification-failed'), alternateOf: 'primary' },
    ],
  });
  assert.equal(retried.action, 'terminal-handoff');
  assert.deepEqual(retried.retryRoute, ladder('knu_researcher', 'astra-fallback', 'gpt-6-astra'));
  assert.throws(
    () =>
      evaluateRecovery({
        laneId,
        route: sol,
        attempts: [
          failedAttempt('primary', 'quota-exhausted'),
          { ...failedAttempt('retry', 'verification-failed'), alternateOf: 'primary' },
        ],
      }),
    { name: 'TypeError', message: 'A non-retryable failure has no alternate attempt.' },
  );
  assert.throws(() => evaluateRecovery({ laneId, attempts: [] }), {
    name: 'TypeError',
    message: 'Recovery requires the lane route: role and profileId.',
  });
  assert.throws(
    () => evaluateRecovery({ laneId, route: { ...sol, model: 'gpt-6-astra' }, attempts: [] }),
    { name: 'TypeError', message: 'Unsupported recovery route field: model' },
  );
  assert.throws(
    () =>
      evaluateRecovery({
        laneId,
        route: { role: 'knu_reviewer', profileId: 'standard-read' },
        attempts: [],
      }),
    { name: 'TypeError', message: 'Role knu_reviewer is not in profile standard-read.' },
  );
});

test('a retried lane completes on its retry route model and task path, and decisions keep their routes', () => {
  const { delegation } = modelDispatchInput();
  const contract = delegation.recommendedChildren[0];
  const laneId = contract.laneId;
  const route = laneRoute(laneId, delegation);
  assert.deepEqual(route, { role: contract.routeRecommendation.role, profileId: 'standard-read' });
  const retried = evaluateRecovery({
    laneId,
    route,
    attempts: [
      failedAttempt('primary', 'verification-failed'),
      {
        approachId: 'astra-retry',
        alternateOf: 'primary',
        outcome: 'success',
        evidence: 'Passed.',
      },
    ],
  });
  const childResults = successfulLegalResults().filter((result) => result.laneId === laneId);
  const synthesize = (
    hookObservation,
    recoveryDecisions = [retried],
    acceptances = acceptedChildren(hookObservation),
  ) =>
    prepareLeaderSynthesis({
      delegation,
      childResults,
      recoveryDecisions,
      hookObservation,
      acceptances,
      dispatchToken: FIXTURE_DISPATCH_TOKEN,
    });
  const onRetry = (model) => observedChildren(delegation, { model, retryLaneIds: [laneId] });
  assert.equal(synthesize(onRetry('gpt-6-astra')).readyForLeaderDecision, true);
  // The retry ran one rung up, so the contract model on the retry path is refused.
  assert.equal(synthesize(onRetry('gpt-6.1-sol')).completionChecks[0].reason, 'model-mismatch');
  // The primary task path is not the retry, and an accepted primary child ends the lane before its retry.
  const primaryOnly = observedChildren(delegation, { model: 'gpt-6-astra' });
  assert.equal(
    synthesize(primaryOnly, [retried], []).completionChecks[0].reason,
    'observation-missing',
  );
  assert.equal(synthesize(primaryOnly).completionChecks[0].reason, 'lane-accepted');
  assert.throws(
    () =>
      synthesize(onRetry('gpt-6-astra'), [
        { ...retried, retryRoute: { ...retried.retryRoute, model: 'gpt-6.1-sol' } },
      ]),
    {
      name: 'TypeError',
      message: 'Recovery decision retryRoute must match its route and attempts.',
    },
  );
  const otherRoute = { role: 'knu_explorer', profileId: 'astra-fallback' };
  assert.throws(
    () =>
      synthesize(onRetry('gpt-6-astra'), [
        evaluateRecovery({ laneId, route: otherRoute, attempts: retried.attempts }),
      ]),
    { name: 'TypeError', message: 'Recovery route must match its lane contract.' },
  );
});

test('a retry dispatch takes its spawn arguments from a pending decision and the ladder', () => {
  const { delegation } = modelDispatchInput();
  const laneId = delegation.recommendedChildren[0].laneId;
  const route = laneRoute(laneId, delegation);
  const pending = evaluateRecovery({
    laneId,
    route,
    attempts: [failedAttempt('primary', 'verification-failed')],
  });
  const retry = modelPolicy.createRetryDispatch({
    delegation,
    recoveryDecision: pending,
    dispatchToken: FIXTURE_DISPATCH_TOKEN,
  });
  assert.deepEqual(retry.spawnArguments, {
    task_name: `${laneId.replaceAll('-', '_')}_${FIXTURE_DISPATCH_TOKEN}_retry`,
    agent_type: route.role,
    model: 'gpt-6-astra',
    reasoning_effort: ROLE_EFFORTS[route.role],
    fork_turns: 'none',
  });
  assert.deepEqual(retry.retryRoute, pending.retryRoute);
  const sameContract = evaluateRecovery({
    laneId,
    route,
    attempts: [failedAttempt('primary', 'tool-unavailable')],
  });
  assert.equal(
    modelPolicy.createRetryDispatch({
      delegation,
      recoveryDecision: sameContract,
      dispatchToken: 'disp2',
    }).spawnArguments.model,
    'gpt-6.1-sol',
  );
  const finished = evaluateRecovery({
    laneId,
    route,
    attempts: [
      ...pending.attempts,
      { approachId: 'retry', alternateOf: 'primary', outcome: 'success', evidence: 'Passed.' },
    ],
  });
  assert.throws(
    () =>
      modelPolicy.createRetryDispatch({
        delegation,
        recoveryDecision: finished,
        dispatchToken: 'disp2',
      }),
    { name: 'TypeError', message: 'A retry dispatch needs a pending alternate decision.' },
  );
  assert.throws(() => modelPolicy.createRetryDispatch({ delegation, recoveryDecision: pending }), {
    name: 'TypeError',
    message: 'A retry dispatch requires a dispatch token.',
  });
  const unknownLane = evaluateRecovery({
    laneId: 'missing-lane',
    route,
    attempts: pending.attempts,
  });
  assert.throws(
    () =>
      modelPolicy.createRetryDispatch({
        delegation,
        recoveryDecision: unknownLane,
        dispatchToken: 'disp2',
      }),
    { name: 'TypeError', message: 'Recovery references an unknown lane: missing-lane' },
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

test('a retry dispatch and synthesis recompute the decision state and keep the primary dispatch gates', () => {
  const { delegation } = modelDispatchInput();
  const laneId = delegation.recommendedChildren[0].laneId;
  const route = laneRoute(laneId, delegation);
  const finished = evaluateRecovery({
    laneId,
    route,
    attempts: [
      failedAttempt('primary', 'verification-failed'),
      { ...failedAttempt('retry', 'verification-failed'), alternateOf: 'primary' },
    ],
  });
  // A finished decision relabeled as pending does not buy a second retry.
  const relabeled = {
    ...finished,
    status: 'alternate-available',
    action: 'alternate-once',
    remainingAlternateAttempts: 1,
    disposition: null,
  };
  const stateMessage = 'Recovery decision status and action must match its attempts.';
  assert.throws(
    () =>
      modelPolicy.createRetryDispatch({
        delegation,
        recoveryDecision: relabeled,
        dispatchToken: 'disp9',
      }),
    { name: 'TypeError', message: stateMessage },
  );
  // Two failed attempts labeled as done do not let a completed result pass.
  const done = {
    ...finished,
    status: 'complete',
    action: 'none',
    remainingAlternateAttempts: 0,
    blocker: null,
    disposition: null,
  };
  delete done.prohibitedApproachIds;
  assert.throws(() => prepareLeaderSynthesis({ delegation, recoveryDecisions: [done] }), {
    name: 'TypeError',
    message: stateMessage,
  });
  // A lane the primary dispatch keeps out of native spawn gets no retry spawn either.
  const reuse = ordinaryScopedDispatchInput({
    mode: 'reuse',
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
  const [reused] = reuse.delegation.recommendedChildren;
  const pending = evaluateRecovery({
    laneId: reused.laneId,
    route: laneRoute(reused.laneId, reuse.delegation),
    attempts: [failedAttempt('primary', 'tool-unavailable')],
  });
  assert.throws(
    () =>
      modelPolicy.createRetryDispatch({
        delegation: reuse.delegation,
        recoveryDecision: pending,
        dispatchToken: 'disp9',
      }),
    {
      name: 'TypeError',
      message:
        'A retry dispatch needs a dispatchable lane: context-reuse-not-a-spawn:legal-repository-map',
    },
  );
  const drifted = structuredClone(delegation);
  drifted.recommendedChildren[0].objective = 'A changed objective after registration.';
  const driftedPending = evaluateRecovery({
    laneId,
    route,
    attempts: [failedAttempt('primary', 'verification-failed')],
  });
  assert.throws(
    () =>
      modelPolicy.createRetryDispatch({
        delegation: drifted,
        recoveryDecision: driftedPending,
        dispatchToken: 'disp9',
      }),
    /A retry dispatch needs a dispatchable lane: .*model-contract-snapshot-changed/u,
  );
});
