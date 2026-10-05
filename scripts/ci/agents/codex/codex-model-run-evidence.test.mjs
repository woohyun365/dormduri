import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createModelProfileBinding,
  getModelProfile,
  MODEL_RECOVERY_SUSPENDED_REASON,
} from '../../../agents/codex/model-profiles.mjs';
import {
  createModelRunEvidence,
  validateModelRunEvidence,
  resolveModelRunEvidencePath,
  writeModelRunEvidence,
} from '../../../agents/codex/model-run-evidence.mjs';

const UNLISTED_MODEL = 'gpt-x-unlisted';
const UNLISTED_REASON = {
  name: 'TypeError',
  message: 'Model is outside the allowed child model list.',
};
const EVIDENCE_REASON = { name: 'TypeError', message: 'Invalid bounded model-run evidence.' };
const RECOVERY_SUSPENDED = { name: 'TypeError', message: MODEL_RECOVERY_SUSPENDED_REASON };

const digest = `sha256:${'a'.repeat(64)}`;
function fixture() {
  const profileBinding = structuredClone(createModelProfileBinding(getModelProfile('extract')));
  const pair = { model: profileBinding.model, effort: profileBinding.resolvedEffort };
  return {
    schemaVersion: 1,
    runId: 'synthetic-run',
    taskId: 'task-1',
    laneId: 'lane-1',
    profileBinding,
    sourceDigest: digest,
    configDigest: digest,
    scopeDigest: digest,
    selectionRefs: ['evidence:selection'],
    writerClearance: 'cleared',
    finalDisposition: 'success',
    attempts: [
      {
        attemptId: 'primary',
        alternateOf: null,
        taskId: 'task-1',
        laneId: 'lane-1',
        sourceDigest: digest,
        configDigest: digest,
        scopeDigest: digest,
        requested: pair,
        resolved: pair,
        hostObserved: null,
        stage: 'completed',
        executed: true,
        childId: '/root/synthetic-primary',
        case: 'live',
        disposition: 'success',
        failureCategory: null,
        checks: [
          {
            kind: 'acceptance',
            commandRef: 'command:oracle',
            resultRef: 'artifact:oracle',
            status: 'passed',
          },
          {
            kind: 'independent-qa',
            commandRef: 'command:qa',
            resultRef: 'artifact:qa',
            status: 'passed',
          },
        ],
        factRefs: ['evidence:observed'],
        hypothesis: { cause: 'unknown', confidence: 'unknown', evidenceRefs: [] },
        remediation: null,
        metrics: {
          durationMs: null,
          timeSource: null,
          corrections: null,
          revalidations: null,
          scopeViolations: null,
          qaFindings: null,
        },
        usage: { tokens: null, cost: null, reference: null },
      },
    ],
  };
}
function controlled() {
  const x = fixture();
  const p = x.attempts[0];
  p.case = 'controlled-failure';
  p.disposition = 'failure';
  p.failureCategory = 'verification-failed';
  p.checks.push({
    kind: 'canary',
    commandRef: 'command:canary',
    resultRef: 'artifact:canary',
    status: 'failed',
  });
  p.hypothesis = {
    cause: 'controlled-injection',
    confidence: 'high',
    evidenceRefs: ['evidence:fault-manifest'],
  };
  x.finalDisposition = 'failure';
  return x;
}

// The rescue attempt and recovery selection a record would carry if model recovery were not suspended.
function withRescue(x) {
  const rescue = structuredClone(x.attempts[0]);
  Object.assign(rescue, {
    attemptId: 'rescue',
    alternateOf: 'primary',
    childId: '/root/synthetic-rescue',
    case: 'approved-baseline',
    disposition: 'success',
    failureCategory: null,
    requested: { model: 'gpt-6-astra', effort: 'high' },
    resolved: { model: 'gpt-6-astra', effort: 'high' },
    hypothesis: { cause: 'unknown', confidence: 'unknown', evidenceRefs: [] },
    remediation: {
      action: 'astra-handoff',
      evidenceRefs: ['evidence:recovery'],
      checkRefs: ['artifact:oracle'],
    },
  });
  rescue.checks = rescue.checks.filter((c) => c.kind !== 'canary');
  x.attempts.push(rescue);
  x.finalDisposition = 'success';
  return x;
}

test('run evidence is strict, pure, immutable and preserves null observations and usage', () => {
  const input = fixture();
  const before = structuredClone(input);
  const result = createModelRunEvidence(input);
  assert.deepEqual(result, before);
  assert.deepEqual(input, before);
  assert.equal(result.attempts[0].hostObserved, null);
  assert.equal(result.attempts[0].metrics.corrections, null);
  assert.throws(() => result.attempts.push({}), TypeError);
  assert.doesNotThrow(() => validateModelRunEvidence(result));
  assert.equal(createModelRunEvidence(controlled()).attempts[0].disposition, 'failure');
});

test('denied records do not invent child identity, host telemetry or quality failures', () => {
  const x = fixture();
  const p = x.attempts[0];
  Object.assign(p, {
    stage: 'pre-dispatch',
    executed: false,
    childId: null,
    resolved: null,
    disposition: 'not-executed',
    failureCategory: 'role-routing-unavailable',
  });
  p.checks = [];
  x.finalDisposition = 'not-executed';
  assert.doesNotThrow(() => createModelRunEvidence(x));
  p.childId = '/root/invented';
  assert.throws(() => createModelRunEvidence(x));
});

test('records reject identity, binding, effort, retry, cause and remediation contradictions', () => {
  for (const mutate of [
    (x) => {
      x.attempts[0].taskId = 'other';
    },
    (x) => {
      x.attempts[0].scopeDigest = `sha256:${'b'.repeat(64)}`;
    },
    (x) => {
      x.profileBinding.policyRevision = '2026-09-24.1';
    },
    (x) => {
      x.attempts[0].requested.effort = 'max';
    },
    (x) => {
      x.attempts[0].hostObserved = { model: 'gpt-6-astra', effort: 'high' };
    },
    (x) => {
      x.attempts[0].hypothesis.cause = 'reasoning-insufficiency';
    },
    (x) => {
      x.attempts[0].remediation = {
        action: 'repair-context',
        evidenceRefs: [],
        checkRefs: ['artifact:absent'],
      };
    },
    (x) => {
      x.attempts[0].checks[0].status = 'failed';
    },
    (x) => {
      x.finalDisposition = 'failure';
    },
    (x) => {
      x.attempts[0].metrics.durationMs = 0;
    },
    (x) => {
      x.attempts[0].usage.tokens = 0;
    },
  ]) {
    const x = fixture();
    mutate(x);
    assert.throws(() => createModelRunEvidence(x), String(mutate));
  }
  for (const mutate of [
    (x) => {
      x.attempts[0].disposition = 'success';
      x.attempts[0].failureCategory = null;
    },
    (x) => {
      x.attempts[0].checks = x.attempts[0].checks.filter((c) => c.kind !== 'canary');
    },
    (x) => {
      withRescue(x);
    },
  ]) {
    const x = controlled();
    mutate(x);
    assert.throws(() => createModelRunEvidence(x), String(mutate));
  }
});

test('sanitized allowlist rejects raw text, credentials, unknown fields and path traversal', () => {
  for (const mutate of [
    (x) => {
      x.prompt = 'secret';
    },
    (x) => {
      x.attempts[0].usage.apiKey = 'secret';
    },
    (x) => {
      x.selectionRefs = ['Bearer secret'];
    },
    (x) => {
      x.selectionRefs = ['https://example.com/?token=secret'];
    },
    (x) => {
      x.selectionRefs = ['../secret'];
    },
    (x) => {
      x.runId = '../outside';
    },
    (x) => {
      x.attempts[0].hypothesis.rawReasoning = 'hidden';
    },
    (x) => {
      x.attempts[0].factRefs = Array(65).fill('evidence:a');
    },
  ]) {
    const x = fixture();
    mutate(x);
    assert.throws(() => createModelRunEvidence(x), String(mutate));
  }
  assert.equal(
    resolveModelRunEvidencePath('/repo', '2026-09-24', 'run-1'),
    '/repo/.artifacts/tools/agent-thread-lifecycle/2026-09-24/model-activation/run-1/attempts.json',
  );
  for (const [date, run, environment] of [
    ['2026-09-24', '../escape', {}],
    ['2026-09-24', '/tmp/escape', {}],
    ['2026-09-31', 'run', {}],
    ['../escape', 'run', {}],
    ['2026-09-24', 'run', { KNU_ARTIFACTS_DIR: '/tmp' }],
    ['2026-09-24', 'run', { KNU_ARTIFACTS_DIR: '.artifacts/tools/../outside' }],
  ])
    assert.throws(() => resolveModelRunEvidencePath('/repo', date, run, environment));
});

test('explicit write boundary reports failures without raw errors or blocking recovery', async () => {
  let calls = 0;
  const input = { record: fixture(), repoRoot: '/repo', date: '2026-09-24' };
  const result = await writeModelRunEvidence({
    ...input,
    writeFile: async () => {
      calls++;
      throw new Error('token=secret /private/path');
    },
  });
  assert.equal(calls, 1);
  assert.deepEqual(result, {
    status: 'observability-gap',
    reference: null,
    errorCode: 'write-failed',
    recoveryBlocked: false,
  });
  const success = await writeModelRunEvidence({
    ...input,
    writeFile: async (path, content) => {
      assert.match(path, /attempts.json$/);
      assert.deepEqual(JSON.parse(content), input.record);
    },
  });
  assert.equal(success.status, 'written');
});

test('live failure and blocked records retain unknown cause without fabricated usage', () => {
  const x = fixture();
  const a = x.attempts[0];
  a.disposition = 'failure';
  a.failureCategory = 'verification-failed';
  a.checks[0].status = 'failed';
  x.finalDisposition = 'failure';
  assert.equal(createModelRunEvidence(x).attempts[0].hypothesis.cause, 'unknown');
  a.disposition = 'blocked';
  a.failureCategory = 'quota-exhausted';
  x.finalDisposition = 'blocked';
  assert.doesNotThrow(() => createModelRunEvidence(x));
  a.remediation = {
    action: 'astra-handoff',
    evidenceRefs: ['evidence:blocked'],
    checkRefs: ['artifact:oracle'],
  };
  assert.throws(() => createModelRunEvidence(x));
  a.remediation.action = 'stop';
  assert.doesNotThrow(() => createModelRunEvidence(x));
});

test('observed measurements require provenance; raw symbol fields and sparse references are rejected', () => {
  const x = fixture();
  x.attempts[0].metrics = {
    durationMs: 21,
    timeSource: 'monotonic-clock',
    corrections: 1,
    revalidations: 2,
    scopeViolations: 0,
    qaFindings: 0,
  };
  x.attempts[0].usage = { tokens: 12, cost: 0.1, reference: 'artifact:usage' };
  x.attempts[0].hostObserved = structuredClone(x.attempts[0].resolved);
  assert.doesNotThrow(() => createModelRunEvidence(x));
  x[Symbol('secret')] = 'raw';
  assert.throws(() => createModelRunEvidence(x));
  const sparse = fixture();
  sparse.selectionRefs = Array(2);
  assert.throws(() => createModelRunEvidence(sparse));
});

test('a rescue attempt cannot be recorded while model recovery is suspended', () => {
  // With or without a selection, the alternate reaches the suspended recovery policy and is rejected.
  assert.throws(() => createModelRunEvidence(withRescue(controlled())), RECOVERY_SUSPENDED);
  const x = withRescue(controlled());
  x.recoveryBinding = { kind: 'model-recovery', primary: {}, rescue: {}, assessment: {} };
  assert.throws(() => createModelRunEvidence(x), RECOVERY_SUSPENDED);
  const single = controlled();
  single.recoveryBinding = x.recoveryBinding;
  assert.throws(() => createModelRunEvidence(single), RECOVERY_SUSPENDED);
});

test('failed model resolution and host mismatches are preserved but cannot become success', () => {
  for (const field of ['resolved', 'hostObserved']) {
    for (const mismatch of [
      { model: 'gpt-6-astra', effort: 'high' },
      { model: 'gpt-6-luna', effort: 'high' },
      { model: 'gpt-6-astra', effort: 'low' },
    ]) {
      for (const disposition of ['failure', 'blocked']) {
        const x = fixture();
        const a = x.attempts[0];
        x.finalDisposition = a.disposition = disposition;
        a.failureCategory = 'verification-failed';
        a.checks[0].status = 'failed';
        a.hypothesis = {
          cause: 'host-support',
          confidence: 'high',
          evidenceRefs: ['evidence:mismatch'],
        };
        a[field] = mismatch;
        const before = structuredClone(x);
        assert.deepEqual(createModelRunEvidence(x), before);
        assert.deepEqual(x, before);
        const success = structuredClone(x);
        success.finalDisposition = success.attempts[0].disposition = 'success';
        success.attempts[0].failureCategory = null;
        success.attempts[0].checks[0].status = 'passed';
        assert.throws(() => createModelRunEvidence(success));
      }
    }
  }
  const blocked = fixture();
  const a = blocked.attempts[0];
  Object.assign(a, {
    disposition: 'blocked',
    failureCategory: 'tool-unavailable',
    executed: false,
    stage: 'pre-dispatch',
    childId: null,
    resolved: { model: 'gpt-6-astra', effort: 'high' },
  });
  a.checks.forEach((c) => (c.status = 'not-run'));
  blocked.finalDisposition = 'blocked';
  assert.deepEqual(createModelRunEvidence(blocked), blocked);
  for (const model of ['unknown', UNLISTED_MODEL]) {
    const bad = structuredClone(blocked);
    bad.attempts[0].resolved = { model, effort: 'high' };
    assert.throws(() => createModelRunEvidence(bad), UNLISTED_REASON);
  }
  // A listed Sol model keeps these cases about effort, not about the allowlist.
  const sol = getModelProfile('standard-build').model;
  for (const invalid of [
    { model: sol, effort: 'max' },
    { model: sol, effort: 'low' },
    { model: 'gpt-6-astra', effort: 'high', extra: true },
  ]) {
    const bad = structuredClone(blocked);
    bad.attempts[0].resolved = invalid;
    assert.throws(() => createModelRunEvidence(bad), EVIDENCE_REASON);
  }
});

test('mismatch logging is preserved on a failed candidate and cannot authorize a rescue', () => {
  const mismatch = controlled();
  mismatch.attempts[0].hostObserved = { model: 'gpt-6-astra', effort: 'high' };
  assert.deepEqual(createModelRunEvidence(mismatch), mismatch);
  assert.throws(() => createModelRunEvidence(withRescue(mismatch)), RECOVERY_SUSPENDED);
});
