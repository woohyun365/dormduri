import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import { createModelScopeDigest, recommendDelegation } from '../agents/child-task-contract.mjs';
import { discoverContextPack } from '../agents/domain-guide-registry.mjs';
import { buildTaskEnvelope } from '../agents/intake-policy.mjs';
import {
  createSemanticEvidenceId,
  createSemanticFactId,
  createSemanticSourceId,
} from '../agents/routing-policy.mjs';
import {
  createDispatchRecommendation,
  createLifecycleRecommendation,
  evaluateRecovery,
  prepareLeaderSynthesis,
} from '../agents/orchestration-policy.mjs';

const repoRoot = resolve(import.meta.dirname, '../..');
const runtimeCapabilityCases = JSON.parse(
  readFileSync(resolve(repoRoot, 'scripts/ci/fixtures/runtime-capability-cases.json'), 'utf8'),
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
  assert.equal(ready.dispatches[0].agentType, 'knu_explorer');
  assert.equal(ready.dispatches[0].requiresLeaderRuntimeConfirmation, true);
  assert.equal(unsupported.execution, 'leader-sequential');
  assert.deepEqual(unsupported.dispatches, []);
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
  });

  assert.equal(synthesis.readyForLeaderDecision, true);
  assert.equal(synthesis.facts.length, 2);
  assert.equal(synthesis.leaderOwnership.finalDecision, true);
  assert.equal(synthesis.leaderOwnership.finalUserResponse, true);
  assert.equal(synthesis.leaderOwnership.finalVerification, true);
  assert.equal(Object.isFrozen(synthesis), true);
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
  const source = readFileSync(resolve(repoRoot, 'scripts/agents/orchestration-policy.mjs'), 'utf8');

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
    assert.equal(result.dispatches[0].requestedModel, 'gpt-5.6-terra');
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
      modelUse(x).admission.model = 'gpt-5.6-sol';
    },
    (x) => {
      modelUse(x).admission.role = 'knu_executor';
    },
    (x) => {
      modelUse(x).admission.cohort = 'bounded-implementation';
    },
    (x) => {
      modelUse(x).admission.effort = 'high';
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
      x.reportedRuntimeEvidence.roles[0].effectiveEffort = 'high';
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
      contract.routeRecommendation.effort = 'high';
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
  model.request.model = 'gpt-5.6-sol';
  model.request.cohort = 'bounded-implementation';
  const id = model.request.verificationFacts.acceptance;
  model.request.verificationFacts = { acceptance: id, regression: id, astraQa: id };
  model.recommendedModel = 'gpt-5.6-sol';
  contract.routeRecommendation.role = 'knu_executor';
  contract.boundary.readOnly = false;
  contract.boundary.writeOwnership = ['apps/web/src/legal/example.test.ts'];
  contract.allowed.tools = ['repository-read', 'workspace-edit', 'test-runner'];
  const role = input.reportedRuntimeEvidence.roles[0];
  Object.assign(role, { agentType: 'knu_executor', effectiveModel: 'gpt-5.6-sol' });
  role.modelSelection.supportedModels.push('gpt-5.6-sol');
  Object.assign(modelUse(input).admission, {
    model: 'gpt-5.6-sol',
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
  for (const id of ['terra-rejected', 'luna-rejected']) {
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

function modelUse(input) {
  return input.modelUseByLane['legal-repository-map'];
}

function modelDispatchInput(purpose = 'pilot') {
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
      model: 'gpt-5.6-terra',
      purpose,
      cohort: 'bounded-read-only',
      verificationFacts: {
        acceptance: parts[0].facts[0].factId,
        independentCheck: parts[1].facts[0].factId,
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
      effectiveEffort: 'medium',
    },
  };
  const delegation = recommendDelegation({
    envelope,
    contextPack,
    laneCandidates: [lane],
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
          agentType: 'knu_explorer',
          available: true,
          effectiveModel: 'gpt-5.6-terra',
          effectiveEffort: 'medium',
          explicitEffortSupport: true,
          modelSelection: {
            supportedModels: ['gpt-6-astra', 'gpt-5.6-terra'],
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
          kind: purpose === 'pilot' ? 'pilot' : 'adoption',
          reference: 'synthetic-owner-authorization',
          quality: purpose === 'pilot' ? 'unadopted' : 'go',
          model: 'gpt-5.6-terra',
          role: 'knu_explorer',
          effort: 'medium',
          cohort: 'bounded-read-only',
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

function runtimeFixture(id) {
  const fixture = runtimeCapabilityCases.find((candidate) => candidate.id === id);
  assert.ok(fixture, `Missing runtime capability fixture: ${id}`);
  return fixture;
}

function legalDelegation({ oneLane = false } = {}) {
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
    laneCandidates: oneLane
      ? [repositoryLane(contextPack)]
      : [repositoryLane(contextPack), officialLane(contextPack)],
  });
}

function repositoryLane(contextPack) {
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
    pass2Evidence: semanticEvidence(contextPack, 'SEC-05-disclosure'),
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
