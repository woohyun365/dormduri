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
import { readFileSync } from 'node:fs';
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
const runtimeCapabilityCases = JSON.parse(
  readFileSync(
    resolve(repoRoot, 'scripts/ci/agents/codex/fixtures/codex-runtime-capability-cases.json'),
    'utf8',
  ),
);

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
  const result = createDispatchRecommendation({
    delegation: legalDelegation(),
    reportedRuntimeEvidence: runtimeFixture('native-project-role-success').evidence,
  });
  assert.equal(result.execution, 'native-bounded-dispatch');
  const expanded = createDispatchRecommendation({
    delegation: legalDelegation(),
    reportedRuntimeEvidence: {
      ...runtimeFixture('native-project-role-success').evidence,
      lifecycle: lifecycleEvidence(),
    },
  });
  assert.equal(expanded.execution, 'leader-sequential');
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

for (const fixture of runtimeCapabilityCases) {
  test(`runtime evidence: ${fixture.id}`, () => {
    const result = createDispatchRecommendation({
      delegation: legalDelegation(),
      reportedRuntimeEvidence: fixture.evidence,
    });

    assert.equal(result.execution, fixture.expectedExecution);
    assert.equal(result.runtimeEvidenceAuthority, 'leader-reported-not-host-authenticated');
    assert.equal(Object.isFrozen(result.reportedRuntimeEvidence), true);
    if (fixture.expectedExecution === 'native-bounded-dispatch') {
      assert.equal(result.dispatches.length, 2);
      assert.equal(result.requiresLeaderRuntimeConfirmation, true);
      assert.ok(
        result.dispatches.every(
          ({ effectiveModel, effort, effectiveEffort, requiresLeaderRuntimeConfirmation }) =>
            effectiveModel === 'gpt-6-astra' &&
            effort === effectiveEffort &&
            requiresLeaderRuntimeConfirmation,
        ),
      );
      assert.equal(
        result.dispatches[0].runtimeSurface,
        fixture.evidence.surfaceMode === 'omx' ? 'omx-native-child' : 'native-child',
      );
    } else {
      assert.deepEqual(result.dispatches, []);
      assert.equal(result.requiresLeaderRuntimeConfirmation, false);
      assert.ok(
        result.gaps.some((gap) => gap.includes(fixture.expectedGap)),
        `${fixture.id}: ${result.gaps.join(', ')}`,
      );
    }
  });
}

for (const effort of ['none', 'minimal', 'low', 'max', 'ultra']) {
  test(`Astra runtime evidence rejects unsupported child effort: ${effort}`, () => {
    const evidence = structuredClone(runtimeFixture('native-project-role-success').evidence);
    evidence.roles[0].effectiveEffort = effort;
    const result = createDispatchRecommendation({
      delegation: legalDelegation(),
      reportedRuntimeEvidence: evidence,
    });

    assert.equal(result.execution, 'leader-sequential');
    assert.deepEqual(result.dispatches, []);
    assert.ok(result.gaps.some((gap) => gap.includes('runtime-role-metadata-invalid')));
  });
}

test('missing or caller-expanded runtime evidence fails closed instead of fabricating authority', () => {
  const delegation = legalDelegation();
  const missing = createDispatchRecommendation({ delegation });
  const expanded = createDispatchRecommendation({
    delegation,
    reportedRuntimeEvidence: {
      ...runtimeFixture('native-project-role-success').evidence,
      hostAuthenticated: true,
    },
  });

  assert.equal(missing.execution, 'leader-sequential');
  assert.match(missing.gaps.join(' '), /runtime-evidence-missing/u);
  assert.equal(expanded.execution, 'leader-sequential');
  assert.match(expanded.gaps.join(' '), /runtime-evidence-field-unsupported/u);
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
    () =>
      createDispatchRecommendation({
        delegation: expanded,
        reportedRuntimeEvidence: runtimeFixture('native-project-role-success').evidence,
      }),
    /write capability requires explicit write ownership/u,
  );
});

test('accepts one validated bounded lane while retaining the runtime capability gate', () => {
  const delegation = legalDelegation({ oneLane: true });
  const ready = createDispatchRecommendation({
    delegation,
    reportedRuntimeEvidence: runtimeFixture('native-project-role-success').evidence,
  });
  const unsupported = createDispatchRecommendation({
    delegation,
    reportedRuntimeEvidence: {
      ...runtimeFixture('native-project-role-success').evidence,
      dispatchPermission: 'unknown',
    },
  });

  assert.equal(delegation.recommendedChildren.length, 1);
  assert.equal(ready.execution, 'native-bounded-dispatch');
  assert.equal(ready.dispatches.length, 1);
  assert.equal(ready.dispatches[0].agentType, 'knu_explorer_xhigh');
  assert.equal(ready.dispatches[0].requiresLeaderRuntimeConfirmation, true);
  assert.equal(unsupported.execution, 'leader-sequential');
  assert.deepEqual(unsupported.dispatches, []);
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
  assert.equal(result.dispatches[0].runtimeAction, false);
  assert.equal(result.requiresLeaderRuntimeConfirmation, true);
  assert.equal(result.runtimeEvidenceAuthority, 'leader-reported-not-host-authenticated');
  assert.equal(result.dispatches[0].contract.contextDelivery.applied, false);
  assert.deepEqual(result.dispatches[0].contract.contextDelivery.failures, [
    'Preserve the earlier failed verification as evidence.',
  ]);
  assert.ok(Object.isFrozen(result.dispatches[0].spawnArguments));
  assert.deepEqual(input, before);
  assert.equal(Object.isFrozen(input.reportedRuntimeEvidence), false);
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

test('ordinary context and explicit invocation gaps cannot leave a ready descriptor', () => {
  const cases = [
    [
      'null context',
      (v) => {
        v.delegation.recommendedChildren[0].contextDelivery = null;
      },
      'runtime-context-incompatible',
    ],
    [
      'incompatible context',
      (v, c) => {
        c.compatible = false;
      },
      'runtime-context-incompatible',
    ],
    [
      'unknown compatibility',
      (v, c) => {
        delete c.compatible;
      },
      'runtime-context-incompatible',
    ],
    [
      'already applied claim',
      (v, c) => {
        c.applied = true;
      },
      'runtime-context-incompatible',
    ],
    [
      'unknown application',
      (v, c) => {
        delete c.applied;
      },
      'runtime-context-incompatible',
    ],
    [
      'contradictory gap',
      (v, c) => {
        c.gaps = ['delivery-runtime-unverified'];
      },
      'runtime-context-incompatible',
    ],
    [
      'unknown gaps',
      (v, c) => {
        delete c.gaps;
      },
      'runtime-context-incompatible',
    ],
    [
      'no model metadata',
      (v, c, r) => {
        delete r.modelSelection;
      },
      'runtime-scoped-model-unsupported',
    ],
    [
      'explicit model unsupported',
      (v, c, r) => {
        r.modelSelection.explicitModelSupport = false;
      },
      'runtime-scoped-model-unsupported',
    ],
    [
      'Astra not supported',
      (v, c, r) => {
        r.modelSelection.supportedModels = ['gpt-6.1-sol'];
      },
      'runtime-scoped-model-unsupported',
    ],
    [
      'different role pin',
      (v, c, r) => {
        r.modelSelection.roleModel = 'gpt-6.1-sol';
      },
      'runtime-scoped-model-unsupported',
    ],
    [
      'explicit effort unsupported',
      (v, c, r) => {
        r.explicitEffortSupport = false;
      },
      'runtime-scoped-effort-unsupported',
    ],
    [
      'reported effort mismatch',
      (v, c, r) => {
        r.effectiveEffort = 'high';
      },
      'runtime-effective-effort-mismatch',
    ],
    [
      'denied runtime',
      (v) => {
        v.reportedRuntimeEvidence.dispatchPermission = 'denied';
      },
      'runtime-dispatch-permission-denied',
    ],
    [
      'stale runtime',
      (v) => {
        v.reportedRuntimeEvidence.freshness = 'stale';
      },
      'runtime',
    ],
  ];
  for (const [name, mutate, gap] of cases) {
    const input = structuredClone(ordinaryScopedDispatchInput());
    mutate(
      input,
      input.delegation.recommendedChildren[0].contextDelivery,
      input.reportedRuntimeEvidence.roles[0],
    );
    const result = createDispatchRecommendation(input);
    assert.equal(result.execution, 'leader-sequential', name);
    assert.deepEqual(result.dispatches, [], name);
    assert.ok(
      result.gaps.some((item) => item.startsWith(gap)),
      name,
    );
    assert.equal(result.requiresLeaderRuntimeConfirmation, false, name);
  }
});

test('composed unknown, stale, unsupported fork and full-history conflicts stop ordinary dispatch', () => {
  for (const change of [
    { runtime: null },
    { runtime: { ...ordinaryDelivery().runtime, freshness: 'stale' } },
    { runtime: { ...ordinaryDelivery().runtime, scopedFork: false } },
    { mode: 'full-history', rationale: 'Synthetic history conflict.' },
  ]) {
    const input = ordinaryScopedDispatchInput(change);
    assert.equal(input.delegation.recommendedChildren[0].contextDelivery.compatible, false);
    const result = createDispatchRecommendation(input);
    assert.equal(result.execution, 'leader-sequential');
    assert.deepEqual(result.dispatches, []);
    assert.ok(result.gaps.includes('runtime-context-incompatible:legal-repository-map'));
  }
});

test('legacy and compatible non-explicit contexts are not silently converted to fresh scoped calls', () => {
  const legacy = structuredClone(ordinaryScopedDispatchInput());
  delete legacy.delegation.recommendedChildren[0].contextDelivery;
  delete legacy.reportedRuntimeEvidence.roles[0].modelSelection;
  const fullHistory = ordinaryScopedDispatchInput({
    mode: 'full-history',
    effortMode: 'inherit',
    rationale: 'Necessary complete context.',
  });
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
  const inherited = ordinaryScopedDispatchInput({ effortMode: 'inherit' });
  const omx = ordinaryScopedDispatchInput();
  Object.assign(omx.reportedRuntimeEvidence, {
    surfaceMode: 'omx',
    observationScope: 'current-session',
    freshness: 'current-session',
    provenance: ['host-tool-schema', 'omx-runtime-overlay'],
  });
  for (const input of [legacy, fullHistory, reuse, inherited, omx]) {
    const result = createDispatchRecommendation(input);
    assert.equal(result.execution, 'native-bounded-dispatch');
    assert.equal(result.dispatches[0].spawnArguments, undefined);
    assert.equal(result.requiresLeaderRuntimeConfirmation, true);
  }
  const pinned = ordinaryScopedDispatchInput();
  pinned.reportedRuntimeEvidence.roles[0].modelSelection.roleModel = 'gpt-6-astra';
  assert.equal(
    createDispatchRecommendation(pinned).dispatches[0].spawnArguments.model,
    'gpt-6-astra',
  );
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

test('tracked guidance preserves the reported-evidence trust boundary and live reconfirmation', () => {
  const orchestration = readFileSync(
    resolve(repoRoot, 'docs/development/agent-workflows/orchestration.md'),
    'utf8',
  );
  const recovery = readFileSync(
    resolve(repoRoot, 'docs/development/agent-workflows/request-intake/orchestration-recovery.md'),
    'utf8',
  );

  for (const required of [
    'leader-reported-not-host-authenticated',
    'requiresLeaderRuntimeConfirmation=true',
    'host-tool-schema',
    'omx-runtime-overlay',
    'gpt-6-astra',
  ]) {
    assert.ok(`${orchestration}\n${recovery}`.includes(required), required);
  }
});

test('model pilot advice is separate from adoption, runtime and context confirmation', () => {
  for (const purpose of ['pilot', 'routine']) {
    const input = modelDispatchInput(purpose);
    const before = structuredClone(input);
    const result = createDispatchRecommendation(input);
    assert.equal(result.execution, 'native-bounded-dispatch');
    assert.equal(result.dispatches[0].requestedModel, 'gpt-6.1-sol');
    assert.equal(result.dispatches[0].modelPurpose, purpose);
    assert.equal(result.dispatches[0].requiresLeaderRuntimeConfirmation, true);
    assert.equal(
      result.dispatches[0].contract.routeRecommendation.runtimeApplication.applied,
      false,
    );
    assert.deepEqual(input, before);
  }
});

test('model candidates fail closed without exact live admission and compatible runtime', () => {
  const mutations = [
    (x) => {
      modelUse(x).remainingBudget.children = 0;
    },
    (x) => {
      modelUse(x).remainingBudget.minutes = 0;
    },
    (x) => {
      delete x.modelUseByLane;
    },
    (x) => {
      modelUse(x).admission = null;
    },
    (x) => {
      modelUse(x).admission.reference = '';
    },
    (x) => {
      modelUse(x).admission.expiresAt = '2026-09-19T10:00:00.000Z';
    },
    (x) => {
      modelUse(x).admission.notBefore = '2026-09-21T10:00:00.000Z';
    },
    (x) => {
      modelUse(x).admission.scopeDigest = `sha256:${'0'.repeat(64)}`;
    },
    (x) => {
      modelUse(x).configDigest = `sha256:${'0'.repeat(64)}`;
    },
    (x) => {
      modelUse(x).admission.model = UNLISTED_MODEL;
    },
    (x) => {
      modelUse(x).admission.role = 'knu_executor';
    },
    (x) => {
      modelUse(x).admission.cohort = 'bounded-implementation';
    },
    (x) => {
      modelUse(x).admission.effort = 'medium';
    },
    (x) => {
      modelUse(x).admission.budget.maxChildren = 0;
    },
    (x) => {
      modelUse(x).admission.cleanupReference = '';
    },
    (x) => {
      modelUse(x).scopeStatus = 'changed';
    },
    (x) => {
      modelUse(x).checks = 'failed';
    },
    (x) => {
      x.reportedRuntimeEvidence.dispatchPermission = 'denied';
    },
    (x) => {
      x.reportedRuntimeEvidence.freshness = 'stale';
    },
    (x) => {
      x.reportedRuntimeEvidence.roles[0].effectiveModel = 'gpt-6-astra';
    },
    (x) => {
      x.reportedRuntimeEvidence.roles[0].effectiveEffort = 'medium';
    },
    (x) => {
      delete x.reportedRuntimeEvidence.roles[0].modelSelection;
    },
    (x) => {
      x.reportedRuntimeEvidence.roles[0].modelSelection.roleModel = 'gpt-6-astra';
    },
    (x) => {
      x.reportedRuntimeEvidence.roles[0].modelSelection.explicitModelSupport = false;
    },
    (x) => {
      x.reportedRuntimeEvidence.roles[0].modelSelection.supportedModels = ['gpt-6-astra'];
    },
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
  const solRole = input.reportedRuntimeEvidence.roles[0];
  input.reportedRuntimeEvidence.roles.push({
    ...structuredClone(solRole),
    effectiveModel: 'gpt-6-astra',
  });

  const result = createDispatchRecommendation(input);
  assert.equal(result.execution, 'native-bounded-dispatch');
  assert.deepEqual(result.deferredLaneIds, []);
  assert.deepEqual(result.gaps, []);
  assert.deepEqual(
    result.dispatches.map(({ laneId, agentType, effectiveModel }) => [
      laneId,
      agentType,
      effectiveModel,
    ]),
    [
      ['legal-repository-map', 'knu_explorer', 'gpt-6.1-sol'],
      ['legal-repository-owners', 'knu_explorer', 'gpt-6-astra'],
    ],
  );

  // A concurrency limit of one still defers the second lane as an ordinary limit.
  const limited = createDispatchRecommendation({ ...structuredClone(input), concurrencyLimit: 1 });
  assert.deepEqual(limited.deferredLaneIds, ['legal-repository-owners']);
  assert.deepEqual(limited.gaps, ['runtime-concurrency-limit: 1 lane(s) deferred.']);

  // The roster still rejects a repeated role and model pair, and a role with no report for the requested model.
  const repeated = structuredClone(input);
  repeated.reportedRuntimeEvidence.roles.push(structuredClone(solRole));
  assert.equal(createDispatchRecommendation(repeated).execution, 'leader-sequential');
  assert.ok(createDispatchRecommendation(repeated).gaps.includes('runtime-role-roster-duplicate'));
  const missing = structuredClone(input);
  missing.reportedRuntimeEvidence.roles.pop();
  assert.ok(
    createDispatchRecommendation(missing).gaps.includes('runtime-model-incompatible:knu_explorer'),
  );
});

test('pilot permission and pilot PASS never substitute for routine adoption GO', () => {
  for (const [purpose, kind, quality] of [
    ['routine', 'pilot', 'go'],
    ['routine', 'adoption', 'unadopted'],
    ['pilot', 'adoption', 'go'],
    ['pilot', 'pilot', 'no-go'],
  ]) {
    const input = modelDispatchInput(purpose);
    Object.assign(modelUse(input).admission, { kind, quality });
    assert.equal(createDispatchRecommendation(input).execution, 'leader-sequential');
  }
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
      result.gaps.some((gap) =>
        /model-context|model-cohort|model-role|runtime-role|model-effort/.test(gap),
      ),
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
  const role = input.reportedRuntimeEvidence.roles[0];
  Object.assign(role, { agentType: 'knu_executor', effectiveModel: 'gpt-6.1-sol' });
  Object.assign(modelUse(input).admission, {
    profileBinding: model.profileBinding,
    model: 'gpt-6.1-sol',
    role: 'knu_executor',
    cohort: 'bounded-implementation',
  });
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
  modelUse(input).scopeDigest = contract.modelScopeDigest;
  modelUse(input).admission.scopeDigest = contract.modelScopeDigest;
}

test('model evidence rejects unknown schema and preserves legacy mismatched-model rejection', () => {
  for (const mutate of [
    (x) => {
      modelUse(x).pilot = true;
    },
    (x) => {
      modelUse(x).admission.adopted = true;
    },
    (x) => {
      modelUse(x).admission.budget.unlimited = true;
    },
    (x) => {
      x.modelUseByLane.unknown = modelUse(x);
    },
  ]) {
    const input = modelDispatchInput();
    mutate(input);
    assert.throws(() => createDispatchRecommendation(input), TypeError);
  }
  // The Sol case must name the current Sol profile model, or it silently becomes another unlisted-model case.
  assert.equal(
    runtimeFixture('sol-supported-without-model-request-rejected').evidence.roles[0].effectiveModel,
    getModelProfile('standard-read').model,
  );
  for (const id of ['unlisted-model-rejected', 'sol-supported-without-model-request-rejected']) {
    assert.equal(
      createDispatchRecommendation({
        delegation: legalDelegation(),
        reportedRuntimeEvidence: runtimeFixture(id).evidence,
      }).execution,
      'leader-sequential',
    );
  }
  const invalid = modelDispatchInput();
  invalid.reportedRuntimeEvidence.roles[0].modelSelection.magicOverride = true;
  assert.equal(createDispatchRecommendation(invalid).execution, 'leader-sequential');
});

test('model admission and attempt inputs outside the allowlist fail for the allowlist reason', () => {
  const admission = modelDispatchInput();
  modelUse(admission).admission.model = UNLISTED_MODEL;
  assert.throws(() => createDispatchRecommendation(admission), UNLISTED_REASON);
  // Host observations stay facts: an unlisted model the host reports becomes a gap, never an error.
  const observed = ordinaryScopedDispatchInput();
  const role = observed.reportedRuntimeEvidence.roles[0];
  role.effectiveModel = UNLISTED_MODEL;
  role.modelSelection.supportedModels.push(UNLISTED_MODEL);
  role.modelSelection.roleModel = UNLISTED_MODEL;
  const result = createDispatchRecommendation(observed);
  assert.equal(result.execution, 'leader-sequential');
  assert.ok(
    result.gaps.includes('runtime-model-incompatible:knu_explorer_xhigh'),
    result.gaps.join(),
  );
  const resolved = resolvedDispatchInput();
  resolved.reportedRuntimeEvidence.roles[0].configurationResolution.model = UNLISTED_MODEL;
  const resolution = createDispatchRecommendation(resolved);
  assert.equal(resolution.execution, 'leader-sequential');
  assert.ok(
    resolution.gaps.includes('runtime-model-incompatible:knu_explorer'),
    resolution.gaps.join(),
  );
  const dispatch = createDispatchRecommendation(resolvedDispatchInput()).dispatches[0];
  const execution = {
    ...executionObservation(dispatch),
    hostMetadata: { model: UNLISTED_MODEL, effort: 'xhigh' },
  };
  const report = modelPolicy.evaluateModelExecution({
    dispatch,
    expectedChildId: execution.childId,
    reportedExecution: execution,
  });
  assert.deepEqual([report.accepted, report.gaps], [false, ['model-host-metadata-mismatch']]);
});

function modelUse(input) {
  return input.modelUseByLane['legal-repository-map'];
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
    runtime: {
      freshness: 'current-turn',
      scopedFork: true,
      fullHistoryFork: true,
      followup: true,
      explicitEffort: true,
      fullHistoryWithExplicitEffort: false,
      effectiveEffort: profile.resolvedEffort,
    },
  };
  const delegation = recommendDelegation({
    envelope,
    contextPack,
    laneCandidates: [lane, ...extraLanes.map((extra) => extra(contextPack))],
    deliveryByLane: { [lane.id]: delivery },
  });
  const [contract] = delegation.recommendedChildren;
  const digest = createModelScopeDigest(contract);
  const configDigest = `sha256:${'c'.repeat(64)}`;
  return structuredClone({
    delegation,
    reportedRuntimeEvidence: {
      schemaVersion: 1,
      surfaceMode: 'native',
      observationScope: 'current-turn',
      freshness: 'current-turn',
      provenance: ['host-tool-schema'],
      dispatchPermission: 'allowed',
      roles: [
        {
          agentType: profile.roles[0],
          available: true,
          effectiveModel: profile.model,
          effectiveEffort: profile.resolvedEffort,
          explicitEffortSupport: true,
          modelSelection: {
            supportedModels: ['gpt-6-astra', profile.model],
            roleModel: null,
            explicitModelSupport: true,
            reference: 'synthetic-host-model-schema',
          },
        },
      ],
    },
    modelUseByLane: {
      [lane.id]: {
        observedAt: '2026-09-20T10:00:00.000Z',
        configDigest,
        scopeDigest: digest,
        scopeStatus: 'current',
        checks: 'passed',
        remainingBudget: { children: 1, minutes: 10 },
        admission: {
          profileBinding: contract.routeRecommendation.modelRecommendation.profileBinding,
          kind: purpose === 'pilot' ? 'pilot' : 'adoption',
          reference: 'synthetic-owner-authorization',
          quality: purpose === 'pilot' ? 'unadopted' : 'go',
          model: profile.model,
          role: profile.roles[0],
          effort: profile.resolvedEffort,
          cohort: profile.cohort,
          scopeDigest: digest,
          configDigest,
          notBefore: '2026-09-20T09:00:00.000Z',
          expiresAt: '2026-09-20T11:00:00.000Z',
          budget: { maxChildren: 1, maxMinutes: 10 },
          cleanupReference: 'synthetic-supported-cleanup-contract',
        },
      },
    },
  });
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
    runtime: {
      freshness: 'current-turn',
      scopedFork: true,
      fullHistoryFork: true,
      followup: true,
      explicitEffort: true,
      fullHistoryWithExplicitEffort: false,
      effectiveEffort: 'xhigh',
    },
  };
}

function ordinaryScopedDispatchInput(change = {}) {
  const reportedRuntimeEvidence = structuredClone(
    runtimeFixture('native-project-role-success').evidence,
  );
  reportedRuntimeEvidence.roles = [
    {
      // A concurrency/transaction question is an XHigh read: the xhigh explorer variant.
      agentType: 'knu_explorer_xhigh',
      available: true,
      effectiveModel: 'gpt-6-astra',
      effectiveEffort: 'xhigh',
      explicitEffortSupport: true,
      modelSelection: {
        supportedModels: ['gpt-6-astra'],
        roleModel: null,
        explicitModelSupport: true,
        reference: 'synthetic-current-native-schema',
      },
    },
  ];
  return {
    delegation: legalDelegation({
      oneLane: true,
      predicateId: 'BE-01-concurrency-transaction',
      delivery: { ...ordinaryDelivery(), ...change },
    }),
    reportedRuntimeEvidence,
  };
}

function runtimeFixture(id) {
  const fixture = runtimeCapabilityCases.find((candidate) => candidate.id === id);
  assert.ok(fixture, `Missing runtime capability fixture: ${id}`);
  return fixture;
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

function resolvedDispatchInput(purpose = 'pilot', profileId) {
  const input = modelDispatchInput(purpose, profileId);
  const { profileBinding } =
    input.delegation.recommendedChildren[0].routeRecommendation.modelRecommendation;
  Object.assign(input.reportedRuntimeEvidence.roles[0], {
    effectiveModel: null,
    effectiveEffort: null,
    configurationResolution: {
      profileBinding,
      model: profileBinding.model,
      effort: profileBinding.resolvedEffort,
      configDigest: modelUse(input).configDigest,
      reference: 'synthetic-current-schema-and-loaded-config',
    },
  });
  return input;
}

function executionObservation(dispatch) {
  return {
    profileBinding: dispatch.contract.routeRecommendation.modelRecommendation.profileBinding,
    childId: '/root/bounded-task',
    taskId: dispatch.contract.modelTaskId,
    scopeDigest: dispatch.contract.modelScopeDigest,
    provenance: 'native-tool-result',
    accepted: true,
    executed: true,
    resultReference: 'synthetic-native-final',
    independentCheck: { status: 'passed', reference: 'synthetic-independent-check' },
    hostMetadata: null,
    usageReference: null,
  };
}

test('first dispatch uses resolved configuration, not invented effective telemetry', () => {
  const input = resolvedDispatchInput('routine');
  const before = structuredClone(input);
  const result = createDispatchRecommendation(input);
  assert.equal(result.execution, 'native-bounded-dispatch');
  const [dispatch] = result.dispatches;
  assert.equal(dispatch.effectiveModel, null);
  assert.equal(dispatch.effectiveEffort, null);
  assert.equal(dispatch.resolvedModel, 'gpt-6.1-sol');
  assert.equal(dispatch.resolvedEffort, 'high');
  assert.deepEqual(dispatch.spawnArguments, {
    task_name: input.delegation.recommendedChildren[0].laneId.replaceAll('-', '_'),
    agent_type: 'knu_explorer',
    model: 'gpt-6.1-sol',
    reasoning_effort: 'high',
    fork_turns: 'none',
  });
  assert.equal(dispatch.runtimeAction, false);
  assert.deepEqual(input, before);
});

test('routine withdrawal emits no candidate, permits safe direct work and requires fresh re-admission', () => {
  const original = resolvedDispatchInput('routine');
  assert.equal(createDispatchRecommendation(original).dispatches.length, 1);
  for (const withdraw of [
    (x) => {
      modelUse(x).admission = null;
    },
    (x) => {
      modelUse(x).admission.quality = 'no-go';
    },
    (x) => {
      modelUse(x).checks = 'failed';
    },
    (x) => {
      x.reportedRuntimeEvidence.roles[0].modelSelection.roleModel = 'gpt-6-astra';
    },
    (x) => {
      modelUse(x).configDigest = `sha256:${'e'.repeat(64)}`;
      x.reportedRuntimeEvidence.roles[0].configurationResolution.configDigest =
        modelUse(x).configDigest;
    },
  ]) {
    const input = structuredClone(original);
    withdraw(input);
    const blocked = createDispatchRecommendation(input);
    assert.equal(blocked.execution, 'leader-sequential');
    assert.deepEqual(blocked.dispatches, []);
    assert.ok(blocked.gaps.length > 0);
  }

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

  // New current bytes/config + fresh bounded GO. A restored config or old packet
  // alone is not a revocation service; the Parent owns this re-authorization.
  const renewed = structuredClone(original);
  const contract = renewed.delegation.recommendedChildren[0];
  contract.contextDelivery.snapshot = 'synthetic-new-authorized-source';
  rebindModelScope(renewed);
  const use = modelUse(renewed);
  use.configDigest = `sha256:${'e'.repeat(64)}`;
  renewed.reportedRuntimeEvidence.roles[0].configurationResolution.configDigest = use.configDigest;
  assert.deepEqual(createDispatchRecommendation(renewed).dispatches, []);
  use.admission.configDigest = use.configDigest;
  use.admission.reference = 'synthetic-new-owner-task-and-cohort-decision';
  use.observedAt = '2026-09-24T12:00:00.000Z';
  use.admission.notBefore = '2026-09-24T11:59:00.000Z';
  use.admission.expiresAt = '2026-09-24T12:10:00.000Z';
  const ready = createDispatchRecommendation(renewed);
  assert.equal(ready.execution, 'native-bounded-dispatch');
  assert.equal(ready.dispatches[0].spawnArguments.model, 'gpt-6.1-sol');
  assert.notEqual(
    contract.modelScopeDigest,
    original.delegation.recommendedChildren[0].modelScopeDigest,
  );
  assert.equal(modelUse(original).admission.reference, 'synthetic-owner-authorization');
});

test('pre-dispatch resolution rejects file-only, stale, pin, digest, effort and mixed evidence', () => {
  for (const mutate of [
    (x) => {
      x.reportedRuntimeEvidence.provenance = ['config-file'];
    },
    (x) => {
      x.reportedRuntimeEvidence.freshness = 'stale';
    },
    (x) => {
      x.reportedRuntimeEvidence.roles[0].modelSelection.roleModel = 'gpt-6-astra';
    },
    (x) => {
      x.reportedRuntimeEvidence.roles[0].configurationResolution.configDigest = `sha256:${'0'.repeat(64)}`;
    },
    (x) => {
      x.reportedRuntimeEvidence.roles[0].configurationResolution.effort = 'medium';
    },
    (x) => {
      x.reportedRuntimeEvidence.roles[0].effectiveModel = 'gpt-6-astra';
    },
    (x) => {
      x.reportedRuntimeEvidence.roles[0].explicitEffortSupport = false;
    },
    (x) => {
      x.reportedRuntimeEvidence.roles[0].modelSelection.explicitModelSupport = false;
    },
    (x) => {
      x.reportedRuntimeEvidence.roles[0].configurationResolution.reference = '';
    },
    (x) => {
      x.delegation.recommendedChildren[0].contextDelivery.mode = 'full-history';
      rebindModelScope(x);
    },
  ]) {
    const input = resolvedDispatchInput();
    mutate(input);
    assert.equal(
      createDispatchRecommendation(input).execution,
      'leader-sequential',
      String(mutate),
    );
  }
});

test('lower model lanes share the ordinary concurrency limit with one role and model report', () => {
  const input = resolvedDispatchInput();
  const second = structuredClone(input.delegation.recommendedChildren[0]);
  second.laneId = 'second-map';
  second.modelScopeDigest = createModelScopeDigest(second);
  input.delegation.recommendedChildren.push(second);
  input.modelUseByLane[second.laneId] = structuredClone(modelUse(input));
  input.modelUseByLane[second.laneId].scopeDigest = second.modelScopeDigest;
  input.modelUseByLane[second.laneId].admission.scopeDigest = second.modelScopeDigest;
  const result = createDispatchRecommendation(input);
  assert.deepEqual(
    result.dispatches.map(({ laneId }) => laneId),
    ['legal-repository-map', 'second-map'],
  );
  assert.deepEqual(result.deferredLaneIds, []);
  const limited = createDispatchRecommendation({ ...structuredClone(input), concurrencyLimit: 1 });
  assert.deepEqual(limited.deferredLaneIds, ['second-map']);
  assert.deepEqual(limited.gaps, ['runtime-concurrency-limit: 1 lane(s) deferred.']);
});

test('post-dispatch evidence binds child/task/quality without requiring cost telemetry', () => {
  const dispatch = createDispatchRecommendation(resolvedDispatchInput()).dispatches[0];
  assert.ok(dispatch);
  const observation = executionObservation(dispatch);
  const report = modelPolicy.evaluateModelExecution({
    dispatch,
    expectedChildId: observation.childId,
    reportedExecution: observation,
  });
  assert.equal(report.accepted, true);
  assert.equal(report.evidenceKind, 'runtime-contract-resolved');
  assert.equal(report.providerAttested, false);
  assert.equal(report.usageReference, null);
  assert.equal(report.runtimeAction, false);
  for (const mutate of [
    (x) => {
      x.childId = '/root/other';
    },
    (x) => {
      x.taskId = 'other-task';
    },
    (x) => {
      x.scopeDigest = `sha256:${'0'.repeat(64)}`;
    },
    (x) => {
      x.provenance = 'child-self-report';
    },
    (x) => {
      x.accepted = false;
    },
    (x) => {
      x.executed = false;
    },
    (x) => {
      x.resultReference = '';
    },
    (x) => {
      x.independentCheck.status = 'failed';
    },
    (x) => {
      x.hostMetadata = { model: 'gpt-6-astra', effort: 'xhigh' };
    },
    (x) => {
      x.hostMetadata = { model: 'gpt-6.1-sol', effort: 'medium' };
    },
  ]) {
    const bad = structuredClone(observation);
    mutate(bad);
    assert.equal(
      modelPolicy.evaluateModelExecution({
        dispatch,
        expectedChildId: observation.childId,
        reportedExecution: bad,
      }).accepted,
      false,
      String(mutate),
    );
  }
  const matching = { ...observation, hostMetadata: { model: 'gpt-6.1-sol', effort: 'high' } };
  assert.equal(
    modelPolicy.evaluateModelExecution({
      dispatch,
      expectedChildId: observation.childId,
      reportedExecution: matching,
    }).evidenceKind,
    'host-reported-model',
  );
});

test('post execution revalidates cohort, context and write ownership after a scope rehash', () => {
  for (const profileId of ['standard-read', 'extract', 'standard-build']) {
    const profile = getModelProfile(profileId);
    // A build candidate cannot come from a read lane's evidence, so it is converted from the read contract below.
    const input = resolvedDispatchInput('pilot', profile.readOnly ? profileId : 'standard-read');
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
    const role = input.reportedRuntimeEvidence.roles[0];
    role.agentType = c.routeRecommendation.role;
    role.modelSelection.supportedModels = [profile.model];
    Object.assign(role.configurationResolution, {
      profileBinding: model.profileBinding,
      model: profile.model,
    });
    Object.assign(modelUse(input).admission, {
      profileBinding: model.profileBinding,
      role: role.agentType,
      model: profile.model,
      cohort: profile.cohort,
    });
    rebindModelScope(input);
    const original = createDispatchRecommendation(input).dispatches[0];
    assert.ok(original, profileId);
    const check = (d) =>
      modelPolicy.evaluateModelExecution({
        dispatch: d,
        expectedChildId: '/root/bounded-task',
        reportedExecution: executionObservation(d),
      });
    assert.equal(check(original).accepted, true, profileId);
    for (const mutate of [
      (d) => {
        d.contract.contextDelivery.mode = 'full-history';
      },
      (d) => {
        d.contract.contextDelivery.mode = 'reuse';
      },
      (d) => {
        d.contract.contextDelivery.compatible = false;
      },
      (d) => {
        d.contract.contextDelivery.applied = true;
      },
      (d) => {
        d.contract.contextDelivery.gaps.push('missing input');
      },
      (d) => {
        d.contract.contextDelivery.failures.push('failed validation');
      },
      (d) => {
        d.contract.contextDelivery = null;
      },
      (d) => {
        d.contract.allowed.tools.push('unapproved-tool');
      },
      (d) => {
        d.contract.boundary.writeOwnership = profile.readOnly ? ['outside.ts'] : [];
      },
      (d) => {
        if (profile.readOnly) {
          d.contract.boundary.readOnly = false;
          d.contract.boundary.writeOwnership = ['outside.ts'];
          d.contract.allowed.tools.push('workspace-edit');
        } else d.contract.allowed.tools = ['repository-read'];
      },
    ]) {
      const d = structuredClone(original);
      mutate(d);
      d.contract.modelScopeDigest = createModelScopeDigest(d.contract);
      const before = structuredClone(d);
      assert.equal(check(d).accepted, false, `${profileId}: ${mutate}`);
      assert.deepEqual(d, before);
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

test('post evidence cannot promote contradictory or malformed resolution descriptors', () => {
  const dispatch = createDispatchRecommendation(resolvedDispatchInput()).dispatches[0];
  const observation = executionObservation(dispatch);
  for (const mutate of [
    (d) => {
      d.resolvedModel = 'gpt-6-astra';
      d.configurationResolution.model = 'gpt-6-astra';
    },
    (d) => {
      d.configurationResolution.reference = '';
    },
    (d) => {
      d.configurationResolution.configDigest = 'unbound-config';
    },
    (d) => {
      d.spawnArguments.fork_turns = 'all';
    },
    (d) => {
      d.contract.boundary.readScope.push('apps/api');
    },
  ]) {
    const bad = structuredClone(dispatch);
    mutate(bad);
    assert.equal(
      modelPolicy.evaluateModelExecution({
        dispatch: bad,
        expectedChildId: observation.childId,
        reportedExecution: observation,
      }).accepted,
      false,
      String(mutate),
    );
  }
});

test('Luna boundary remains read-only fixed input even with rebound admission', () => {
  const input = resolvedDispatchInput('pilot', 'extract');
  const dispatch = createDispatchRecommendation(input).dispatches[0];
  // The Luna role is the xhigh explorer variant: route, spawn and resolved effort are the same pinned value.
  assert.equal(dispatch.contract.routeRecommendation.role, 'knu_explorer_xhigh');
  assert.equal(dispatch.contract.routeRecommendation.effort, 'xhigh');
  assert.equal(dispatch.spawnArguments.reasoning_effort, 'xhigh');
  assert.equal(dispatch.resolvedEffort, 'xhigh');
  for (const tool of ['official-web-read', 'test-runner']) {
    const bad = structuredClone(input);
    bad.delegation.recommendedChildren[0].allowed.tools.push(tool);
    rebindModelScope(bad);
    assert.equal(createDispatchRecommendation(bad).execution, 'leader-sequential');
  }
});

test('legacy pinned compatibility does not promise unsupported explicit invocation arguments', () => {
  const input = modelDispatchInput();
  const role = input.reportedRuntimeEvidence.roles[0];
  role.modelSelection.roleModel = 'gpt-6.1-sol';
  role.modelSelection.explicitModelSupport = false;
  role.explicitEffortSupport = false;
  const result = createDispatchRecommendation(input);
  assert.equal(result.execution, 'native-bounded-dispatch');
  assert.equal(result.dispatches[0].effectiveModel, 'gpt-6.1-sol');
  assert.equal(result.dispatches[0].spawnArguments, undefined);
});

test('stale profile grants and resolution cannot be revived by rebinding scope', () => {
  for (const target of ['admission', 'configuration', 'recommendation']) {
    for (const patch of [
      { policyRevision: 'old' },
      { profileDigest: `sha256:${'0'.repeat(64)}` },
      { model: UNLISTED_MODEL },
      { resolvedEffort: 'medium' },
      { cohort: 'bounded-extraction' },
      { profileId: 'future' },
    ]) {
      const input = resolvedDispatchInput();
      const binding =
        target === 'admission'
          ? modelUse(input).admission.profileBinding
          : target === 'configuration'
            ? input.reportedRuntimeEvidence.roles[0].configurationResolution.profileBinding
            : input.delegation.recommendedChildren[0].routeRecommendation.modelRecommendation
                .profileBinding;
      // Clone each boundary independently; shared fixture references are not authority.
      const bad = { ...binding, ...patch };
      if (target === 'admission') modelUse(input).admission.profileBinding = bad;
      else if (target === 'configuration')
        input.reportedRuntimeEvidence.roles[0].configurationResolution.profileBinding = bad;
      else
        input.delegation.recommendedChildren[0].routeRecommendation.modelRecommendation.profileBinding =
          bad;
      rebindModelScope(input);
      try {
        assert.equal(createDispatchRecommendation(input).dispatches.length, 0);
      } catch (e) {
        if (!(e instanceof TypeError)) throw e;
      }
    }
  }
});
test('post execution revalidates recommendation and exact installed binding even with a refreshed scope', () => {
  const original = createDispatchRecommendation(resolvedDispatchInput()).dispatches[0];
  for (const mutate of [
    (d) => {
      d.contract.routeRecommendation.modelRecommendation.request.profileId = 'future';
    },
    (d) => {
      d.contract.routeRecommendation.impactRisk = 'high';
    },
    (d) => {
      d.contract.routeRecommendation.modelRecommendation.profileBinding.policyRevision = 'stale';
    },
  ]) {
    const d = structuredClone(original);
    mutate(d);
    d.contract.modelScopeDigest = createModelScopeDigest(d.contract);
    const observation = executionObservation(d);
    assert.equal(
      modelPolicy.evaluateModelExecution({
        dispatch: d,
        expectedChildId: observation.childId,
        reportedExecution: observation,
      }).accepted,
      false,
    );
  }
  const observation = executionObservation(original);
  observation.profileBinding = { ...observation.profileBinding, policyRevision: 'old' };
  assert.equal(
    modelPolicy.evaluateModelExecution({
      dispatch: original,
      expectedChildId: observation.childId,
      reportedExecution: observation,
    }).accepted,
    false,
  );
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

test('old medium/high profile data remains invalid across grant, descriptor, post and recovery after full rehash', () => {
  for (const oldEffort of ['medium', 'high']) {
    const oldBinding = createModelProfileBinding({
      ...getModelProfile('standard-read'),
      policyRevision: '2026-09-24.1',
      resolvedEffort: oldEffort,
    });
    const input = resolvedDispatchInput();
    input.delegation.recommendedChildren[0].routeRecommendation.modelRecommendation.profileBinding =
      oldBinding;
    Object.assign(input.reportedRuntimeEvidence.roles[0].configurationResolution, {
      profileBinding: oldBinding,
      effort: oldEffort,
    });
    Object.assign(modelUse(input).admission, { profileBinding: oldBinding, effort: oldEffort });
    rebindModelScope(input);
    assert.throws(() => createDispatchRecommendation(input), TypeError);
    const dispatch = structuredClone(
      createDispatchRecommendation(resolvedDispatchInput()).dispatches[0],
    );
    dispatch.contract.routeRecommendation.modelRecommendation.profileBinding = oldBinding;
    dispatch.contract.modelScopeDigest = createModelScopeDigest(dispatch.contract);
    Object.assign(dispatch.configurationResolution, {
      profileBinding: oldBinding,
      effort: oldEffort,
    });
    dispatch.resolvedEffort = oldEffort;
    dispatch.spawnArguments.reasoning_effort = oldEffort;
    const reportedExecution = executionObservation(dispatch);
    assert.equal(
      modelPolicy.evaluateModelExecution({
        dispatch,
        expectedChildId: reportedExecution.childId,
        reportedExecution,
      }).accepted,
      false,
    );
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
  const input = resolvedDispatchInput();
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
