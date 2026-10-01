import assert from 'node:assert/strict';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import test from 'node:test';
import {
  ROLE_EFFORT,
  fixture,
  writeChildTranscript,
  writeRole,
} from './fixtures/claude-native-session-fixture.mjs';
import {
  handleClaudeNativeSessionEvent,
  completeClaudeNativeTask,
  isClaudeNativeEvidencePath,
} from '../agents/claude/native-session.mjs';
import {
  prepareClaudeNativeTask,
  buildClaudeNativeReview,
  settleClaudeNativeTask,
} from '../agents/claude/native-task-helper.mjs';
import { validateAdapterReview, validateCrossModelPacket } from '../agents/common/index.mjs';

const cliPath = resolve(import.meta.dirname, '../agents/claude/native-session.mjs');
const PACKET_KEYS = [
  'schemaVersion',
  'packetId',
  'objective',
  'nonScope',
  'authority',
  'snapshot',
  'sources',
  'evidence',
  'boundaries',
  'review',
  'lifecycle',
  'intent',
];
const SENTINEL = 'BUILDER-REASONING-SENTINEL';

function repo(t) {
  const f = fixture(t);
  writeFileSync(join(f.root, '.git/info/exclude'), '.artifacts/\n');
  writeRole(
    f.root,
    'knu_executor',
    'Read, Grep, Glob, Edit, Write, Bash',
    'Implement bounded work.',
  );
  writeRole(
    f.root,
    'knu_executor_xhigh',
    'Read, Grep, Glob, Edit, Write, Bash',
    'Implement bounded work.',
  );
  writeRole(f.root, 'knu_reviewer', 'Read, Grep, Glob', 'Review only.');
  execFileSync('git', ['add', '.'], { cwd: f.root });
  return { root: realpathSync(f.root), sessionId: randomUUID() };
}
const facts = (keys) =>
  keys.map((key) => ({ key, sourceRef: 'plan:helper-test', confidence: 'high' }));
function explorerSpec(r, patch = {}) {
  return {
    sessionId: r.sessionId,
    request: 'sample.txt 내용을 분석해줘.',
    role: 'knu_explorer',
    profileId: 'bounded-extraction',
    selectionBasisRef: 'plan:helper-test/extract',
    expectedResolvedModel: 'claude-haiku-4-5-20251001',
    kind: 'extract',
    impactRisk: 'low',
    complexity: 'bounded',
    uncertainty: 'resolved',
    childValue: 'independent-extraction',
    owner: 'explorer',
    readScope: ['sample.txt'],
    writeScope: [],
    acceptance: ['oracle returned'],
    reviewDisposition: { required: false, reason: 'bounded extraction checked by oracle' },
    facts: facts([
      'source-bound',
      'fixed-input',
      'single-step',
      'output-schema',
      'acceptance',
      'independent-check',
    ]),
    prompt: 'Read sample.txt only.',
    ...patch,
  };
}
function builderSpec(r) {
  return {
    sessionId: r.sessionId,
    request: 'sample.txt 변경을 구현해줘.',
    role: 'knu_executor',
    profileId: 'bounded-standard',
    selectionBasisRef: 'plan:helper-test/build',
    expectedResolvedModel: 'claude-sonnet-5-5',
    kind: 'build',
    impactRisk: 'medium',
    complexity: 'bounded',
    uncertainty: 'resolved',
    childValue: 'bounded-build',
    owner: 'builder',
    readScope: ['sample.txt'],
    writeScope: ['sample.txt'],
    acceptance: ['sample.txt updated'],
    reviewDisposition: { required: true, reason: 'build requires independent QA' },
    facts: facts([
      'source-bound',
      'bounded-scope',
      'acceptance',
      'oracle',
      'independent-qa',
      'regression',
      'one-writer',
    ]),
    prompt: 'Update sample.txt only.',
  };
}
function dispatch(r, prepared, toolUseId, response, effort) {
  const event = {
    hook_event_name: 'PreToolUse',
    session_id: r.sessionId,
    cwd: r.root,
    permission_mode: 'auto',
    tool_name: 'Agent',
    tool_use_id: toolUseId,
    tool_input: prepared.invocation,
  };
  assert.deepEqual(handleClaudeNativeSessionEvent(event, { root: r.root }), {});
  if (response === undefined) return;
  const agentId = `${toolUseId}-agent`;
  handleClaudeNativeSessionEvent(
    {
      ...event,
      hook_event_name: 'PostToolUse',
      transcript_path: writeChildTranscript(r.root, {
        sessionId: r.sessionId,
        agentId,
        prompt: prepared.invocation.prompt,
        model: prepared.registerInput.expectedResolvedModel,
        effort: effort ?? ROLE_EFFORT[prepared.invocation.subagent_type],
      }),
      tool_response: {
        status: 'completed',
        agentId,
        resolvedModel: prepared.registerInput.expectedResolvedModel,
        content: [{ type: 'text', text: response }],
      },
    },
    { root: r.root },
  );
}
function settledBuilder(t) {
  const r = repo(t);
  const subject = prepareClaudeNativeTask(builderSpec(r), { root: r.root });
  dispatch(r, subject, 'build-1');
  writeFileSync(join(r.root, 'sample.txt'), 'updated');
  handleClaudeNativeSessionEvent(
    {
      hook_event_name: 'PostToolUse',
      session_id: r.sessionId,
      cwd: r.root,
      permission_mode: 'auto',
      tool_name: 'Agent',
      tool_use_id: 'build-1',
      tool_input: subject.invocation,
      transcript_path: writeChildTranscript(r.root, {
        sessionId: r.sessionId,
        agentId: 'build-agent',
        prompt: subject.invocation.prompt,
        model: 'claude-sonnet-5-5',
        effort: 'high',
      }),
      tool_response: {
        status: 'completed',
        agentId: 'build-agent',
        resolvedModel: 'claude-sonnet-5-5',
        content: [{ type: 'text', text: `${SENTINEL}: I chose this approach because...` }],
      },
    },
    { root: r.root },
  );
  return { ...r, subject };
}
function runnerEvidence(snapshotDigest, patch = {}) {
  return {
    runner: 'parent',
    records: [
      {
        command: 'node --test scripts/ci/sample.test.mjs',
        exit: 0,
        environment: 'repository root, Node.js test runner',
        observedResult: '3/3 pass',
        outputPaths: ['.artifacts/plans/helper-test/runner.log'],
        sourceDigest: snapshotDigest,
        ...patch,
      },
    ],
  };
}

test('prepare assembles and registers a task from a minimal spec without authorizing dispatch', (t) => {
  const r = repo(t);
  const prepared = prepareClaudeNativeTask(explorerSpec(r), { root: r.root });
  assert.equal(prepared.dispatchAuthorized, false);
  assert.equal(prepared.invocation.subagent_type, 'knu_explorer');
  assert.equal(prepared.invocation.model, 'haiku');
  assert.ok(existsSync(join(prepared.evidenceDirectory, 'task.json')));
  const native = prepared.registerInput.workflowInput.nativeRequest;
  assert.equal(native.selectedBy, 'lead');
  assert.equal(native.selectionBasisRef, 'plan:helper-test/extract');
  assert.equal(Date.parse(native.expiresAt) - Date.parse(native.issuedAt), 15 * 60000);
  assert.deepEqual(native.task.allowedTools, ['Read', 'Grep', 'Glob']);
  assert.equal(prepared.lifetimeMinutes, 15);
  dispatch(r, prepared, 'explore-1');
});

test('prepare names spec problems before registration and keeps policy reasons concrete', (t) => {
  const r = repo(t);
  const { selectionBasisRef, ...withoutBasis } = explorerSpec(r);
  void selectionBasisRef;
  for (const [spec, reason] of [
    [withoutBasis, /selection-basis-required/],
    [explorerSpec(r, { lifetimeMinutes: 31 }), /binding-lifetime-exceeds-30m/],
    [explorerSpec(r, { rationale: 'x' }), /unknown-field:rationale/],
    [
      explorerSpec(r, {
        facts: facts(['source-bound']).map((f) => ({ ...f, sourceRef: '.hidden/a' })),
      }),
      /unsafe-reference:nativeRequest\.task\.facts\[0\]\.sourceRef/,
    ],
    [explorerSpec(r, { request: 'sample.txt 보안 정책 영향을 분석해줘.' }), /risk-downgrade/],
    [
      explorerSpec(r, { facts: [{ key: 'source-bound', sourceRef: 'plan:helper-test' }] }),
      /fact-confidence-not-high:source-bound/,
    ],
    [explorerSpec(r, { role: '../x' }), /unknown-role/],
    [explorerSpec(r, { writeScope: null }), /writeScope-array-required/],
  ])
    assert.throws(() => prepareClaudeNativeTask(spec, { root: r.root }), reason);
});

test('review refuses a subject whose completion has not been observed', (t) => {
  const r = repo(t);
  const subject = prepareClaudeNativeTask(builderSpec(r), { root: r.root });
  dispatch(r, subject, 'build-1');
  assert.throws(
    () => buildClaudeNativeReview({ subjectTaskId: subject.taskId }, { root: r.root }),
    /no-completion-observation/,
  );
});

test('review builds a same-host packet with no builder reasoning; commands come only from runner records', (t) => {
  const r = settledBuilder(t);
  const status = buildClaudeNativeReview({ subjectTaskId: r.subject.taskId }, { root: r.root });
  assert.equal(status.settlement, 'native-subject');
  assert.match(status.snapshotDigest, /^sha256:[a-f0-9]{64}$/u);
  assert.equal(status.logHeader, `KNU review snapshot ${status.snapshotDigest}`);
  assert.equal(status.packet, undefined);

  const evidence = runnerEvidence(status.snapshotDigest);
  const review = buildClaudeNativeReview(
    {
      subjectTaskId: r.subject.taskId,
      runnerEvidence: evidence,
      selectionBasisRef: 'plan:helper-test/review',
      reviewerModel: 'claude-opus-4-6',
    },
    { root: r.root },
  );
  assert.equal(review.dispatchAuthorized, false);
  assert.deepEqual(Object.keys(review.packet).sort(), [...PACKET_KEYS].sort());
  assert.equal(review.packet.intent.direction, 'same-host-independent-review');
  assert.equal(review.packet.authority.runnerOwner, 'parent');
  const snapshot = JSON.parse(
    readFileSync(join(r.subject.evidenceDirectory, 'completion.json')),
  ).finalSnapshot;
  const packetCheck = validateCrossModelPacket(review.packet, { currentSnapshot: snapshot });
  assert.equal(packetCheck.valid, true, packetCheck.errors.join('; '));
  for (const text of [JSON.stringify(review.packet), review.reviewerPrompt])
    assert.ok(!text.includes(SENTINEL));
  assert.equal(review.reviewerPrompt.split('\n')[0], status.logHeader);
  assert.deepEqual(
    review.resultTemplate.commandsActuallyRun,
    evidence.records.map(
      ({ command, sourceDigest, ...rest }) => (
        void command,
        void sourceDigest,
        { runner: 'parent', ...rest }
      ),
    ),
  );

  const filled = structuredClone(review.resultTemplate);
  filled.identity.resolvedModel = filled.identity.observedModel = 'claude-opus-4-6';
  filled.acceptanceCoverage = filled.acceptanceCoverage.map((c) => ({
    ...c,
    sourceRefs: ['sample.txt'],
    evidenceRefs: ['runner:node --test'],
    gap: null,
  }));
  filled.verdict = 'PASS';
  const qa = validateAdapterReview({
    reviewerId: review.reviewerSpec.owner,
    builderIds: review.reviewerSpec.independentReview.builderIds,
    packet: review.packet,
    result: filled,
    currentSnapshot: snapshot,
  });
  assert.equal(qa.valid, true, qa.errors.join('; '));
  assert.equal(
    validateAdapterReview({
      reviewerId: review.reviewerSpec.owner,
      builderIds: review.reviewerSpec.independentReview.builderIds,
      packet: review.packet,
      result: { ...filled, acceptanceCoverage: review.resultTemplate.acceptanceCoverage },
      currentSnapshot: snapshot,
    }).valid,
    false,
    'an unfilled template cannot pass',
  );

  const reviewer = prepareClaudeNativeTask(review.reviewerSpec, { root: r.root });
  assert.match(reviewer.invocation.prompt, /KNU_INDEPENDENT_REVIEW_PACKET:/u);
  assert.equal(reviewer.invocation.subagent_type, 'knu_reviewer');
});

test('runner evidence has a fixed record format bound to the current round snapshot', (t) => {
  const r = settledBuilder(t);
  const { snapshotDigest } = buildClaudeNativeReview(
    { subjectTaskId: r.subject.taskId },
    { root: r.root },
  );
  const build = (runnerEvidencePatch, options = {}) =>
    buildClaudeNativeReview(
      {
        subjectTaskId: r.subject.taskId,
        runnerEvidence: runnerEvidencePatch,
        selectionBasisRef: 'plan:helper-test/review',
        reviewerModel: 'claude-opus-4-6',
        ...options,
      },
      { root: r.root },
    );
  assert.throws(
    () => build(runnerEvidence(snapshotDigest, { rationale: 'builder thinks it is fine' })),
    /runner evidence record fields/,
  );
  assert.throws(
    () => build(runnerEvidence(`sha256:${'0'.repeat(64)}`)),
    /not the current subject snapshot/,
  );
  assert.throws(() => build({ ...runnerEvidence(snapshotDigest), runner: 'reviewer' }), /runner/);
  assert.throws(() => build({ runner: 'parent', records: [] }), /at least one runner record/);
  assert.throws(
    () => build(runnerEvidence(snapshotDigest), { selectionBasisRef: undefined }),
    /selection-basis-required/,
  );
  const failing = build(runnerEvidence(snapshotDigest, { exit: 1, observedResult: '1 fail' }));
  assert.deepEqual(failing.packet.evidence.knownFailures, [
    'node --test scripts/ci/sample.test.mjs',
  ]);
});

function settledExplorer(t, text) {
  const r = repo(t);
  const subject = prepareClaudeNativeTask(explorerSpec(r), { root: r.root });
  dispatch(r, subject, 'explore-1', text);
  return { ...r, subject };
}
function reviewOf(r, records) {
  const { snapshotDigest } = buildClaudeNativeReview(
    { subjectTaskId: r.subject.taskId },
    { root: r.root },
  );
  return buildClaudeNativeReview(
    {
      subjectTaskId: r.subject.taskId,
      runnerEvidence: records
        ? {
            runner: 'parent',
            records: records.map((record) => ({ ...record, sourceDigest: snapshotDigest })),
          }
        : runnerEvidence(snapshotDigest),
      selectionBasisRef: 'plan:helper-test/review',
      reviewerModel: 'claude-opus-4-6',
    },
    { root: r.root },
  );
}
function passing(review) {
  const delivered = structuredClone(review.resultTemplate);
  delivered.acceptanceCoverage = delivered.acceptanceCoverage.map((c) => ({
    ...c,
    sourceRefs: ['sample.txt'],
    evidenceRefs: ['runner:node --test'],
    gap: null,
  }));
  delivered.verdict = 'PASS';
  delivered.confidence = 'high';
  return JSON.stringify(delivered);
}
const responsePathOf = (taskId) => `.artifacts/tools/claude-native/${taskId}/subject-response.txt`;

test('a read-only subject is reviewed from its bound response, its read scope and the runner outputs', (t) => {
  const claim = 'sample.txt holds the value 42. I checked it myself and it is correct.';
  const r = settledExplorer(t, claim);
  const review = reviewOf(r);
  const responsePath = responsePathOf(r.subject.taskId);
  // The response is the deliverable under review; the reviewer can check its claim against sample.txt.
  assert.deepEqual(review.packet.boundaries.allowedReadPaths, [
    responsePath,
    'sample.txt',
    '.artifacts/plans/helper-test/runner.log',
  ]);
  assert.deepEqual(review.reviewerSpec.readScope, review.packet.boundaries.allowedReadPaths);
  assert.equal(readFileSync(join(r.root, responsePath), 'utf8'), claim);
  assert.ok(!review.reviewerPrompt.includes(claim), 'the response is read from its file');
  assert.match(review.reviewerPrompt, new RegExp(`${responsePath}.*not evidence`, 'u'));

  const reviewer = prepareClaudeNativeTask(review.reviewerSpec, { root: r.root });
  dispatch(r, reviewer, 'review-1', passing(review));
  const reviewed = settleClaudeNativeTask(
    reviewer.taskId,
    judgment(reviewer, 'terminal review result delivered for the frozen packet'),
    { root: r.root },
  );
  assert.equal(reviewed.valid, true, reviewed.errors.join('; '));
});

test('a changed response artifact is refused and a writer response never becomes review input', (t) => {
  const r = settledExplorer(t, 'sample.txt holds the value 42.');
  const review = reviewOf(r);
  const responsePath = responsePathOf(r.subject.taskId);
  writeFileSync(join(r.root, responsePath), 'sample.txt holds the value 7.');
  assert.throws(
    () => prepareClaudeNativeTask(review.reviewerSpec, { root: r.root }),
    /subject response artifact does not match the settled response/,
  );
  assert.throws(() => reviewOf(r), /subject response artifact does not match/);

  const w = settledBuilder(t);
  const writerReview = reviewOf(w);
  const writerResponse = responsePathOf(w.subject.taskId);
  assert.ok(!writerReview.packet.boundaries.allowedReadPaths.includes(writerResponse));
  assert.ok(!existsSync(join(w.root, writerResponse)));
  const spec = structuredClone(writerReview.reviewerSpec);
  spec.readScope = [...spec.readScope, writerResponse];
  const { packet } = spec.independentReview;
  packet.boundaries.allowedReadPaths = [...spec.readScope];
  packet.sources.contracts = [...spec.readScope];
  assert.throws(
    () => prepareClaudeNativeTask(spec, { root: w.root }),
    /writer subject response is not review input/,
  );
});

test('other native task evidence never enters a review read path', (t) => {
  const w = settledBuilder(t);
  const evidenceOf = (id, file) => `.artifacts/tools/claude-native/${id}/${file}`;
  const record = (outputPath) => ({
    command: 'node --test scripts/ci/sample.test.mjs',
    exit: 0,
    environment: 'repository root, Node.js test runner',
    observedResult: '3/3 pass',
    outputPaths: ['.artifacts/plans/helper-test/runner.log', outputPath],
  });
  // A writer's completion.json holds its full response; a runner cannot relabel it as its output.
  assert.throws(
    () => reviewOf(w, [record(evidenceOf(w.subject.taskId, 'completion.json'))]),
    /native task evidence is not review input/,
  );
  const r = settledExplorer(t, 'sample.txt holds the value 42.');
  assert.throws(
    () => reviewOf(r, [record(evidenceOf(r.subject.taskId, 'task.json'))]),
    /native task evidence is not review input/,
  );
  // Registration refuses the same paths in a hand-edited spec that skipped the helper.
  for (const [subject, file] of [
    [w, 'completion.json'],
    [r, 'task.json'],
  ]) {
    const spec = structuredClone(reviewOf(subject).reviewerSpec);
    spec.readScope = [...spec.readScope, evidenceOf(subject.subject.taskId, file)];
    spec.independentReview.packet.boundaries.allowedReadPaths = [...spec.readScope];
    spec.independentReview.packet.sources.contracts = [...spec.readScope];
    assert.throws(
      () => prepareClaudeNativeTask(spec, { root: subject.root }),
      /native task evidence is not review input/,
    );
  }
});

test('native task evidence stays out of review paths under another case, a symlink or a Parent subject', (t) => {
  const w = settledBuilder(t);
  const record = (outputPath) => ({
    command: 'node --test scripts/ci/sample.test.mjs',
    exit: 0,
    environment: 'repository root, Node.js test runner',
    observedResult: '3/3 pass',
    outputPaths: [outputPath],
  });
  const completion = `.artifacts/tools/claude-native/${w.subject.taskId}/completion.json`;
  // A case-insensitive filesystem opens the same file under another spelling.
  assert.throws(
    () => reviewOf(w, [record(completion.replace('claude-native', 'Claude-Native'))]),
    /native task evidence is not review input/,
  );
  mkdirSync(join(w.root, '.artifacts/plans/helper-test'), { recursive: true });
  symlinkSync(
    join(w.root, completion),
    join(w.root, '.artifacts/plans/helper-test/completion-link.json'),
  );
  assert.throws(
    () => reviewOf(w, [record('.artifacts/plans/helper-test/completion-link.json')]),
    /native task evidence is not review input/,
  );
  assert.throws(
    () => reviewOf(w, [record('.artifacts/plans/helper-test')]),
    /native task evidence is not review input/,
  );
  // A symlinked directory, or one nested under a real directory, still leads to the task records.
  symlinkSync('helper-test', join(w.root, '.artifacts/plans/helper-alias'));
  mkdirSync(join(w.root, '.artifacts/plans/helper-outer'), { recursive: true });
  symlinkSync('../helper-alias', join(w.root, '.artifacts/plans/helper-outer/nested'));
  for (const path of ['.artifacts/plans/helper-alias', '.artifacts/plans/helper-outer'])
    assert.throws(() => reviewOf(w, [record(path)]), /native task evidence is not review input/);
  // A link cycle is scanned once and a plain runner directory stays usable.
  mkdirSync(join(w.root, '.artifacts/plans/helper-cycle'), { recursive: true });
  symlinkSync('.', join(w.root, '.artifacts/plans/helper-cycle/self'));
  reviewOf(w, [record('.artifacts/plans/helper-cycle')]);
  assert.throws(
    () =>
      buildClaudeNativeReview(
        {
          parentSubject: {
            request: 'sample.txt 변경을 구현해줘.',
            owner: 'parent',
            acceptance: ['sample.txt updated'],
            paths: ['sample.txt', completion],
          },
        },
        { root: w.root },
      ),
    /native task evidence is not review input/,
  );
});

test('a read-only subject review without its response artifact is refused at registration', (t) => {
  const r = settledExplorer(t, 'sample.txt holds the value 42.');
  const spec = structuredClone(reviewOf(r).reviewerSpec);
  const without = spec.readScope.filter((path) => path !== responsePathOf(r.subject.taskId));
  spec.readScope = without;
  spec.independentReview.packet.boundaries.allowedReadPaths = [...without];
  spec.independentReview.packet.sources.contracts = [...without];
  assert.throws(
    () => prepareClaudeNativeTask(spec, { root: r.root }),
    /read-only subject review needs its response artifact/,
  );
});

test('the response artifact comes from the digest-bound response, not a mirrored field', (t) => {
  const claim = 'sample.txt holds the value 42.';
  const r = settledExplorer(t, claim);
  const completionPath = join(r.subject.evidenceDirectory, 'completion.json');
  const completion = JSON.parse(readFileSync(completionPath, 'utf8'));
  completion.content = [{ type: 'text', text: 'sample.txt holds the value 7.' }];
  writeFileSync(completionPath, JSON.stringify(completion));
  const review = reviewOf(r);
  assert.equal(readFileSync(join(r.root, responsePathOf(r.subject.taskId)), 'utf8'), claim);
  prepareClaudeNativeTask(review.reviewerSpec, { root: r.root });
});

test('a RED record passes only at its declared expected exit and the reviewer sees both exits', (t) => {
  const r = settledBuilder(t);
  const green = {
    command: 'node --test scripts/ci/sample.test.mjs',
    exit: 0,
    environment: 'repository root, Node.js test runner',
    observedResult: '3/3 pass',
    outputPaths: ['.artifacts/plans/helper-test/runner.log'],
  };
  const red = {
    ...green,
    command: 'node --test scripts/ci/red.test.mjs',
    exit: 1,
    purpose: 'red',
    expectedExit: 1,
    observedResult: '1 fail before the fix',
    outputPaths: ['.artifacts/plans/helper-test/red.log'],
  };
  const matched = reviewOf(r, [green, red]);
  assert.deepEqual(matched.packet.evidence.knownFailures, []);
  assert.deepEqual(matched.resultTemplate.commandsActuallyRun[1], {
    runner: 'parent',
    exit: 1,
    purpose: 'red',
    expectedExit: 1,
    observedResult: '1 fail before the fix',
    environment: 'repository root, Node.js test runner',
    outputPaths: ['.artifacts/plans/helper-test/red.log'],
  });
  assert.ok(
    matched.packet.evidence.tests.includes(
      'node --test scripts/ci/red.test.mjs (RED: expected exit 1, actual exit 1)',
    ),
  );
  assert.match(matched.reviewerPrompt, /purpose "red"/u);
  // A GREEN or differently failing run declared as RED stays a known failure.
  for (const exit of [0, 2]) {
    const mismatched = reviewOf(r, [green, { ...red, exit }]);
    assert.deepEqual(mismatched.packet.evidence.knownFailures, [
      'node --test scripts/ci/red.test.mjs',
    ]);
    assert.ok(
      mismatched.packet.evidence.tests.includes(
        `node --test scripts/ci/red.test.mjs (RED: expected exit 1, actual exit ${exit})`,
      ),
    );
  }
  const { purpose, ...withoutPurpose } = red;
  const { expectedExit, ...withoutExpected } = red;
  void purpose;
  void expectedExit;
  for (const record of [
    withoutPurpose,
    withoutExpected,
    { ...red, expectedExit: 0 },
    // A process exit status is 1 to 255 when it fails; anything else cannot be observed.
    { ...red, exit: -1, expectedExit: -1 },
    { ...red, exit: 256, expectedExit: 256 },
    { ...red, expectedExit: 1.5 },
    { ...red, purpose: 'green' },
  ])
    assert.throws(() => reviewOf(r, [green, record]), /records\[1\]: RED/);

  const reviewer = prepareClaudeNativeTask(matched.reviewerSpec, { root: r.root });
  dispatch(r, reviewer, 'review-1', passing(matched));
  const reviewed = settleClaudeNativeTask(
    reviewer.taskId,
    judgment(reviewer, 'terminal review result delivered for the frozen packet'),
    { root: r.root },
  );
  assert.equal(reviewed.valid, true, reviewed.errors.join('; '));
});

test('an oversized reviewer prompt is refused by the helper before registration', (t) => {
  const r = repo(t);
  const parentSubject = {
    request: 'sample.txt 변경을 구현해줘.',
    owner: 'parent',
    acceptance: Array.from({ length: 40 }, (_, i) => `criterion ${i} `.padEnd(200, 'x')),
    paths: ['sample.txt'],
  };
  const { snapshotDigest } = buildClaudeNativeReview({ parentSubject }, { root: r.root });
  assert.throws(
    () =>
      buildClaudeNativeReview(
        {
          parentSubject,
          runnerEvidence: runnerEvidence(snapshotDigest),
          selectionBasisRef: 'plan:helper-test/review',
          reviewerModel: 'claude-opus-4-6',
          sessionId: r.sessionId,
        },
        { root: r.root },
      ),
    /reviewer-prompt-exceeds-12000-chars/,
  );
});

test('a Parent-authored subject is marked parent-adjudication and keeps the terminal gate unchanged', (t) => {
  const r = repo(t);
  writeFileSync(join(r.root, 'sample.txt'), 'parent edit');
  const status = buildClaudeNativeReview(
    {
      parentSubject: {
        request: 'sample.txt 변경을 구현해줘.',
        owner: 'parent',
        acceptance: ['sample.txt updated'],
        paths: ['sample.txt'],
      },
    },
    { root: r.root },
  );
  const review = buildClaudeNativeReview(
    {
      parentSubject: {
        request: 'sample.txt 변경을 구현해줘.',
        owner: 'parent',
        acceptance: ['sample.txt updated'],
        paths: ['sample.txt'],
      },
      runnerEvidence: { ...runnerEvidence(status.snapshotDigest), runner: 'lead-runner' },
      selectionBasisRef: 'plan:helper-test/parent-review',
      reviewerModel: 'claude-opus-4-6',
      sessionId: r.sessionId,
    },
    { root: r.root },
  );
  assert.equal(review.settlement, 'parent-adjudication');
  assert.equal(review.snapshotDigest, status.snapshotDigest);
  const parentPacket = validateCrossModelPacket(review.packet, {
    currentSnapshot: review.packet.snapshot,
  });
  assert.equal(parentPacket.valid, true, parentPacket.errors.join('; '));
  assert.equal(review.reviewerSpec.independentReview, undefined);
  assert.equal(review.reviewerSpec.reviewDisposition.required, true);
  assert.match(review.reviewerPrompt, /KNU_REVIEW_PACKET_FILE:/u);
  writeFileSync(join(r.root, 'sample.txt'), 'parent edit after the review was built');
  assert.throws(
    () => prepareClaudeNativeTask(review.reviewerSpec, { root: r.root }),
    /review-snapshot-stale/,
  );
  writeFileSync(join(r.root, 'sample.txt'), 'parent edit');
  const reviewer = prepareClaudeNativeTask(review.reviewerSpec, { root: r.root });
  const result = structuredClone(review.resultTemplate);
  result.verdict = 'PASS';
  dispatch(r, reviewer, 'review-1', JSON.stringify(result));
  const completion = JSON.parse(readFileSync(join(reviewer.evidenceDirectory, 'completion.json')));
  assert.equal(completion.valid, true, completion.errors.join());
  // The Parent judges this reviewer from settle's observation, so settle offers no judgment template.
  const settleStatus = settleClaudeNativeTask(reviewer.taskId, undefined, { root: r.root });
  assert.equal(settleStatus.judgmentTemplatePath, null);
  assert.ok(!existsSync(templateOf(reviewer)));
  const checked = completeClaudeNativeTask(
    reviewer.taskId,
    { responseDigest: completion.responseDigest },
    { root: r.root },
  );
  assert.ok(checked.errors.includes('native required QA requires linked reviewerTaskId'));
  assert.ok(!existsSync(join(reviewer.evidenceDirectory, 'review-receipt.json')));
  assert.throws(
    () =>
      settleClaudeNativeTask(
        reviewer.taskId,
        { responseDigest: completion.responseDigest, acceptance: [], checks: ['read'] },
        { root: r.root },
      ),
    // The refusal points the Lead at settle's observation errors, not at completion.json validity.
    /parent-adjudication: .*settle --task observation \(observationErrors empty\)/u,
  );
  assert.ok(!existsSync(join(reviewer.evidenceDirectory, 'review-receipt.json')));
});

test('a terminal reviewer without a native subject still cannot waive QA', (t) => {
  const r = repo(t);
  assert.throws(
    () =>
      prepareClaudeNativeTask(
        {
          ...explorerSpec(r),
          request: 'sample.txt 수정 결과를 독립 검토해줘.',
          role: 'knu_reviewer',
          profileId: 'complex-critical',
          expectedResolvedModel: 'claude-opus-4-6',
          kind: 'review',
          impactRisk: 'medium',
          childValue: 'independent-review',
          owner: 'reviewer',
          reviewDisposition: { required: false, reason: 'no subject task' },
          facts: facts([
            'source-bound',
            'bounded-scope',
            'acceptance',
            'oracle',
            'independent-qa',
            'fresh-context',
          ]),
        },
        { root: r.root },
      ),
    /independent QA required for this profile/,
  );
});

test('CLI prepare and review status use tracked commands only', (t) => {
  const r = repo(t);
  const specPath = join(r.root, '.artifacts-spec.json');
  writeFileSync(join(r.root, '.git/info/exclude'), '.artifacts/\n.artifacts-spec.json\n');
  writeFileSync(specPath, JSON.stringify(builderSpec(r)));
  const run = (...args) =>
    spawnSync(process.execPath, [cliPath, ...args], { cwd: r.root, encoding: 'utf8' });
  const prepared = run('prepare', '--spec', specPath);
  assert.equal(prepared.status, 0, prepared.stderr);
  const output = JSON.parse(prepared.stdout);
  assert.equal(output.dispatchAuthorized, false);
  const status = run('review', '--subject', output.taskId);
  assert.equal(status.status, 1);
  assert.match(status.stderr, /no-completion-observation/);
});

const templateOf = (prepared) => join(prepared.evidenceDirectory, 'judgment-template.json');
const templateIn = (status) => JSON.parse(readFileSync(status.judgmentTemplatePath, 'utf8'));
function judgment(prepared, criterion, extra = {}) {
  const completion = JSON.parse(readFileSync(join(prepared.evidenceDirectory, 'completion.json')));
  return {
    responseDigest: completion.responseDigest,
    acceptance: [{ criterion, passed: true, evidenceRef: 'fixture:lead-check' }],
    checks: ['Lead compared the delivered response with the source'],
    ...extra,
  };
}

test('settle refuses before the completion notification and rejects unknown judgment fields', (t) => {
  const r = repo(t);
  const subject = prepareClaudeNativeTask(builderSpec(r), { root: r.root });
  dispatch(r, subject, 'build-1');
  assert.throws(
    () =>
      settleClaudeNativeTask(
        subject.taskId,
        { responseDigest: 'x', acceptance: [], checks: ['c'] },
        { root: r.root },
      ),
    /no-completion-observation.*task-notification/su,
  );
  const settled = settledBuilder(t);
  assert.throws(
    () =>
      settleClaudeNativeTask(
        settled.subject.taskId,
        { ...judgment(settled.subject, 'sample.txt updated'), results: [] },
        { root: settled.root },
      ),
    /unknown-field:results/,
  );
  assert.throws(
    () =>
      settleClaudeNativeTask(
        settled.subject.taskId,
        { acceptance: [], checks: ['c'] },
        { root: settled.root },
      ),
    /response-digest-required/,
  );
});

test('executor → reviewer → complete runs with the tracked helper commands only', (t) => {
  const r = settledBuilder(t);
  const { snapshotDigest } = buildClaudeNativeReview(
    { subjectTaskId: r.subject.taskId },
    { root: r.root },
  );
  const review = buildClaudeNativeReview(
    {
      subjectTaskId: r.subject.taskId,
      runnerEvidence: runnerEvidence(snapshotDigest),
      selectionBasisRef: 'plan:helper-test/review',
      reviewerModel: 'claude-opus-4-6',
    },
    { root: r.root },
  );
  const reviewer = prepareClaudeNativeTask(review.reviewerSpec, { root: r.root });
  const delivered = structuredClone(review.resultTemplate);
  delivered.acceptanceCoverage = delivered.acceptanceCoverage.map((c) => ({
    ...c,
    sourceRefs: ['sample.txt'],
    evidenceRefs: ['runner:node --test'],
    gap: null,
  }));
  delivered.verdict = 'PASS';
  delivered.confidence = 'high';
  dispatch(r, reviewer, 'review-1', JSON.stringify(delivered));

  const reviewed = settleClaudeNativeTask(
    reviewer.taskId,
    judgment(reviewer, 'terminal review result delivered for the frozen packet'),
    { root: r.root },
  );
  assert.equal(reviewed.valid, true, reviewed.errors.join('; '));
  assert.ok(existsSync(join(reviewer.evidenceDirectory, 'review-receipt.json')));

  const settled = settleClaudeNativeTask(
    r.subject.taskId,
    judgment(r.subject, 'sample.txt updated', { reviewerTaskId: reviewer.taskId }),
    { root: r.root },
  );
  assert.equal(settled.valid, true, settled.errors.join('; '));
  assert.deepEqual(settled.submitted.results[0].changedPaths, ['sample.txt']);
  assert.equal(settled.dispatchAuthorized, false);
});

test('a helper-built review cannot add, drop or change runner records', (t) => {
  const r = settledBuilder(t);
  const { snapshotDigest } = buildClaudeNativeReview(
    { subjectTaskId: r.subject.taskId },
    { root: r.root },
  );
  const review = buildClaudeNativeReview(
    {
      subjectTaskId: r.subject.taskId,
      runnerEvidence: runnerEvidence(snapshotDigest),
      selectionBasisRef: 'plan:helper-test/review',
      reviewerModel: 'claude-opus-4-6',
    },
    { root: r.root },
  );
  const reviewer = prepareClaudeNativeTask(review.reviewerSpec, { root: r.root });
  const delivered = structuredClone(review.resultTemplate);
  delivered.acceptanceCoverage = delivered.acceptanceCoverage.map((c) => ({
    ...c,
    sourceRefs: ['sample.txt'],
    evidenceRefs: ['runner:node --test'],
    gap: null,
  }));
  delivered.verdict = 'PASS';
  delivered.confidence = 'high';
  delivered.commandsActuallyRun.push({
    runner: 'parent',
    exit: 0,
    observedResult: 'claimed but never run',
    environment: 'reviewer',
    outputPaths: ['.artifacts/plans/helper-test/extra.log'],
  });
  dispatch(r, reviewer, 'review-1', JSON.stringify(delivered));

  const reviewed = settleClaudeNativeTask(
    reviewer.taskId,
    judgment(reviewer, 'terminal review result delivered for the frozen packet'),
    { root: r.root },
  );
  assert.equal(reviewed.valid, false);
  assert.ok(
    reviewed.errors.includes('review commandsActuallyRun differs from the bound runner records'),
    reviewed.errors.join('; '),
  );
  assert.ok(!existsSync(join(reviewer.evidenceDirectory, 'review-receipt.json')));
});

test('CLI settle reads a judgment file', (t) => {
  const r = settledBuilder(t);
  const path = join(r.root, '.artifacts-judgment.json');
  writeFileSync(join(r.root, '.git/info/exclude'), '.artifacts/\n.artifacts-judgment.json\n');
  writeFileSync(path, JSON.stringify(judgment(r.subject, 'sample.txt updated')));
  const run = spawnSync(
    process.execPath,
    [cliPath, 'settle', '--task', r.subject.taskId, '--judgment', path],
    { cwd: r.root, encoding: 'utf8' },
  );
  assert.equal(run.status, 1, run.stderr);
  assert.ok(
    JSON.parse(run.stdout).errors.includes('native required QA requires linked reviewerTaskId'),
  );
});

test('settle without a judgment settles the observation and shows what the Lead judges', (t) => {
  const r = repo(t);
  const subject = prepareClaudeNativeTask(builderSpec(r), { root: r.root });
  dispatch(r, subject, 'build-1');
  assert.throws(
    () => settleClaudeNativeTask(subject.taskId, undefined, { root: r.root }),
    /no-completion-observation.*task-notification/su,
  );
  const settled = settledBuilder(t);
  const status = settleClaudeNativeTask(settled.subject.taskId, undefined, { root: settled.root });
  const completion = JSON.parse(
    readFileSync(join(settled.subject.evidenceDirectory, 'completion.json')),
  );
  assert.equal(status.responseDigest, completion.responseDigest);
  assert.deepEqual(status.changedPaths, ['sample.txt']);
  assert.deepEqual(status.acceptance, ['sample.txt updated']);
  assert.match(status.response, /BUILDER-REASONING-SENTINEL/u);
  assert.equal(status.valid, undefined, 'status is not a completion decision');
  assert.equal(status.dispatchAuthorized, false);
});

test('settle status writes a judgment template once and keeps the Lead edits', (t) => {
  const settled = settledBuilder(t);
  const { taskId } = settled.subject;
  const status = settleClaudeNativeTask(taskId, undefined, { root: settled.root });
  assert.equal(status.judgmentTemplatePath, templateOf(settled.subject));
  const completion = JSON.parse(
    readFileSync(join(settled.subject.evidenceDirectory, 'completion.json')),
  );
  // This builder needs independent QA, so the template also asks for the linked reviewer.
  assert.deepEqual(templateIn(status), {
    responseDigest: completion.responseDigest,
    acceptance: [{ criterion: 'sample.txt updated', passed: null, evidenceRef: null }],
    checks: [],
    reviewerTaskId: null,
  });
  const edited = { ...templateIn(status), checks: ['Lead read sample.txt'] };
  writeFileSync(status.judgmentTemplatePath, JSON.stringify(edited));
  const again = settleClaudeNativeTask(taskId, undefined, { root: settled.root });
  assert.equal(again.judgmentTemplatePath, status.judgmentTemplatePath);
  assert.deepEqual(templateIn(again), edited);
  assert.equal(again.valid, undefined, 'status is still not a completion decision');
});

test('an unfilled judgment is refused before complete; a filled template settles', (t) => {
  const r = settledExplorer(t, 'oracle');
  const unfilled = {
    responseDigest: 'sha256:x',
    acceptance: [{ criterion: 'oracle returned', passed: null, evidenceRef: null }],
    checks: ['c'],
  };
  assert.throws(
    () => settleClaudeNativeTask(r.subject.taskId, unfilled, { root: r.root }),
    /invalid settle judgment.*acceptance-unfilled:oracle returned/su,
  );
  const status = settleClaudeNativeTask(r.subject.taskId, undefined, { root: r.root });
  const template = templateIn(status);
  assert.ok(!Object.hasOwn(template, 'reviewerTaskId'), 'no QA is required for this task');
  assert.throws(
    () => settleClaudeNativeTask(r.subject.taskId, template, { root: r.root }),
    /acceptance-unfilled:oracle returned.*checks-required/su,
  );
  template.acceptance[0].passed = true;
  template.acceptance[0].evidenceRef = 'fixture:lead-check';
  template.checks = ['Lead compared the response with sample.txt'];
  writeFileSync(status.judgmentTemplatePath, JSON.stringify(template));
  const settled = settleClaudeNativeTask(r.subject.taskId, templateIn(status), { root: r.root });
  assert.equal(settled.valid, true, settled.errors.join('; '));
});

test('a null reviewerTaskId is refused before complete', (t) => {
  const settled = settledBuilder(t);
  assert.throws(
    () =>
      settleClaudeNativeTask(
        settled.subject.taskId,
        judgment(settled.subject, 'sample.txt updated', { reviewerTaskId: null }),
        { root: settled.root },
      ),
    /invalid settle judgment.*reviewer-task-id-unfilled/su,
  );
});

test('malformed acceptance items are refused as unfilled; passed:false reaches complete', (t) => {
  const r = settledExplorer(t, 'oracle');
  const base = judgment(r.subject, 'oracle returned');
  for (const [acceptance, reason] of [
    [[{ criterion: 'oracle returned', passed: 'true', evidenceRef: 'x' }], 'oracle returned'],
    [[{ criterion: 'oracle returned', passed: true, evidenceRef: '   ' }], 'oracle returned'],
    [[null], '0'],
    [['oracle returned'], '0'],
  ])
    assert.throws(
      () => settleClaudeNativeTask(r.subject.taskId, { ...base, acceptance }, { root: r.root }),
      new RegExp(`invalid settle judgment.*acceptance-unfilled:${reason}`, 'su'),
    );
  const failed = settleClaudeNativeTask(
    r.subject.taskId,
    { ...base, acceptance: [{ ...base.acceptance[0], passed: false }] },
    { root: r.root },
  );
  assert.equal(failed.valid, false);
  assert.ok(failed.errors.includes('semantic-acceptance-required:oracle returned'));
});

test('a linked reviewer template has no reviewerTaskId', (t) => {
  const r = settledExplorer(t, 'sample.txt holds the value 42.');
  const review = reviewOf(r);
  const reviewer = prepareClaudeNativeTask(review.reviewerSpec, { root: r.root });
  dispatch(r, reviewer, 'review-1', passing(review));
  const status = settleClaudeNativeTask(reviewer.taskId, undefined, { root: r.root });
  assert.equal(status.judgmentTemplatePath, templateOf(reviewer));
  assert.ok(!Object.hasOwn(templateIn(status), 'reviewerTaskId'));
});

test('no template is written before a background child is settled', (t) => {
  const r = repo(t);
  const subject = prepareClaudeNativeTask(explorerSpec(r), { root: r.root });
  dispatch(r, subject, 'explore-bg');
  const refused = () =>
    assert.throws(
      () => settleClaudeNativeTask(subject.taskId, undefined, { root: r.root }),
      /cannot settle yet/u,
    );
  refused();
  assert.ok(!existsSync(templateOf(subject)));
  // Background launch and SubagentStop are recorded, but the completion notification has not arrived.
  const event = {
    session_id: r.sessionId,
    cwd: r.root,
    permission_mode: 'auto',
    tool_name: 'Agent',
    tool_use_id: 'explore-bg',
    tool_input: subject.invocation,
  };
  const agentId = 'explore-bg-agent';
  const model = subject.registerInput.expectedResolvedModel;
  handleClaudeNativeSessionEvent(
    {
      ...event,
      hook_event_name: 'PostToolUse',
      tool_response: {
        status: 'async_launched',
        agentId,
        resolvedModel: model,
        prompt: subject.invocation.prompt,
      },
    },
    { root: r.root },
  );
  const base = join(r.root, '.artifacts/transcripts');
  mkdirSync(join(base, r.sessionId, 'subagents'), { recursive: true });
  const childPath = join(base, r.sessionId, 'subagents', `agent-${agentId}.jsonl`);
  const parentPath = join(base, `${r.sessionId}.jsonl`);
  const row = (type, message) => JSON.stringify({ type, sessionId: r.sessionId, agentId, message });
  writeFileSync(
    childPath,
    `${row('user', { content: subject.invocation.prompt })}\n${row('assistant', { model, content: [{ type: 'text', text: 'oracle' }] })}\n`,
  );
  writeFileSync(parentPath, '');
  handleClaudeNativeSessionEvent(
    {
      hook_event_name: 'SubagentStop',
      session_id: r.sessionId,
      cwd: r.root,
      agent_id: agentId,
      agent_type: 'knu_explorer',
      agent_transcript_path: childPath,
      transcript_path: parentPath,
      stop_hook_active: false,
    },
    { root: r.root },
  );
  assert.ok(existsSync(join(subject.evidenceDirectory, 'stop.json')));
  assert.throws(
    () => settleClaudeNativeTask(subject.taskId, undefined, { root: r.root }),
    /cannot settle yet.*stopped-task-settlement-failed: matching task completion notification required/su,
  );
  assert.ok(!existsSync(templateOf(subject)));
  writeFileSync(
    parentPath,
    `${JSON.stringify({ type: 'user', sessionId: r.sessionId, message: { content: `<task-notification>\n<task-id>${agentId}</task-id>\n<tool-use-id>explore-bg</tool-use-id>\n<status>completed</status>\n</task-notification>` } })}\n`,
  );
  const status = settleClaudeNativeTask(subject.taskId, undefined, { root: r.root });
  assert.equal(status.judgmentTemplatePath, templateOf(subject));
});

test('CLI settle status names the judgment template file', (t) => {
  const r = settledBuilder(t);
  const run = spawnSync(process.execPath, [cliPath, 'settle', '--task', r.subject.taskId], {
    cwd: r.root,
    encoding: 'utf8',
  });
  assert.equal(run.status, 0, run.stderr);
  const output = JSON.parse(run.stdout);
  assert.equal(output.judgmentTemplatePath, templateOf(r.subject));
  assert.ok(existsSync(output.judgmentTemplatePath));
});

test('the reviewer prompt names every allowed finding severity', (t) => {
  const r = settledBuilder(t);
  const { snapshotDigest } = buildClaudeNativeReview(
    { subjectTaskId: r.subject.taskId },
    { root: r.root },
  );
  const review = buildClaudeNativeReview(
    {
      subjectTaskId: r.subject.taskId,
      runnerEvidence: runnerEvidence(snapshotDigest),
      selectionBasisRef: 'plan:helper-test/review',
      reviewerModel: 'claude-opus-4-6',
    },
    { root: r.root },
  );
  assert.ok(review.reviewerPrompt.includes('critical, high, medium or low'));
});

test('a non-reviewer child learns that its delivered report is the only text the Parent receives', (t) => {
  const r = repo(t);
  const prepared = prepareClaudeNativeTask(explorerSpec(r), { root: r.root });
  const body = prepared.invocation.prompt.replace(/\n\nKNU_NATIVE_TASK:.*$/su, '');
  const rule = body.slice(explorerSpec(r).prompt.length);
  assert.ok(body.startsWith(`${explorerSpec(r).prompt}\n\n`));
  assert.match(rule, /^\n\nYour delivered report \(the SubagentHandback message/u);
  assert.match(rule, /only text the Parent receives\. .*\(the record limit is 1 MB\)\.$/u);
  // The rule must not stand in for a missing task.
  for (const prompt of ['', '  ', null])
    assert.throws(
      () => prepareClaudeNativeTask(explorerSpec(r, { prompt }), { root: r.root }),
      /invalid prepare spec: .*prompt-required/u,
    );
  // The rule counts toward the register limit instead of silently exceeding it.
  assert.throws(
    () => prepareClaudeNativeTask(explorerSpec(r, { prompt: 'x'.repeat(11950) }), { root: r.root }),
    /invalid prepare spec: prompt-exceeds-12000-chars-with-delivery-rule/u,
  );
});

test('a reviewer prompt gets no delivery rule because it already demands one JSON object', (t) => {
  const r = settledBuilder(t);
  const { snapshotDigest } = buildClaudeNativeReview(
    { subjectTaskId: r.subject.taskId },
    { root: r.root },
  );
  const review = buildClaudeNativeReview(
    {
      subjectTaskId: r.subject.taskId,
      runnerEvidence: runnerEvidence(snapshotDigest),
      selectionBasisRef: 'plan:helper-test/review',
      reviewerModel: 'claude-opus-4-6',
    },
    { root: r.root },
  );
  const reviewer = prepareClaudeNativeTask(review.reviewerSpec, { root: r.root });
  assert.doesNotMatch(reviewer.invocation.prompt, /only text the Parent receives/u);
});

test('prepare returns a short agent input that names the registered task', (t) => {
  const r = repo(t);
  const prepared = prepareClaudeNativeTask(explorerSpec(r), { root: r.root });
  const { description, subagent_type, model, prompt } = prepared.invocation;
  assert.deepEqual(prepared.agentInput, {
    description,
    subagent_type,
    model,
    prompt: `KNU_NATIVE_TASK:${prepared.taskId}:${prompt.split(`KNU_NATIVE_TASK:${prepared.taskId}:`)[1]}`,
  });
  assert.ok(prompt.endsWith(`\n\n${prepared.agentInput.prompt}`));
  assert.equal(prepared.dispatchAuthorized, false);
});

test('prepare accepts the xhigh executor for a high-risk Opus build', (t) => {
  const r = repo(t);
  const prepared = prepareClaudeNativeTask(
    {
      ...builderSpec(r),
      role: 'knu_executor_xhigh',
      profileId: 'complex-critical',
      impactRisk: 'high',
      complexity: 'complex',
      expectedResolvedModel: 'claude-opus-5-5',
    },
    { root: r.root },
  );
  assert.equal(prepared.invocation.subagent_type, 'knu_executor_xhigh');
  assert.equal(prepared.invocation.model, 'opus');
});

test('a Parent-judged reviewer whose effort differs fails settle although completion.json is valid', (t) => {
  const r = repo(t);
  writeFileSync(join(r.root, 'sample.txt'), 'parent edit');
  const parentSubject = {
    request: 'sample.txt 변경을 구현해줘.',
    owner: 'parent',
    acceptance: ['sample.txt updated'],
    paths: ['sample.txt'],
  };
  const { snapshotDigest } = buildClaudeNativeReview({ parentSubject }, { root: r.root });
  const review = buildClaudeNativeReview(
    {
      parentSubject,
      runnerEvidence: { ...runnerEvidence(snapshotDigest), runner: 'lead-runner' },
      selectionBasisRef: 'plan:helper-test/parent-review',
      reviewerModel: 'claude-opus-4-6',
      sessionId: r.sessionId,
    },
    { root: r.root },
  );
  const reviewer = prepareClaudeNativeTask(review.reviewerSpec, { root: r.root });
  const result = structuredClone(review.resultTemplate);
  result.verdict = 'PASS';
  dispatch(r, reviewer, 'review-1', JSON.stringify(result), 'high');
  const completion = JSON.parse(readFileSync(join(reviewer.evidenceDirectory, 'completion.json')));
  assert.equal(completion.valid, true, completion.errors.join());
  const run = spawnSync(process.execPath, [cliPath, 'settle', '--task', reviewer.taskId], {
    cwd: r.root,
    encoding: 'utf8',
  });
  assert.equal(run.status, 1, run.stderr);
  assert.ok(JSON.parse(run.stdout).observationErrors.includes('effort-mismatch'));
});

test('prepare passes a recovery spec to the registry and refuses a malformed one', (t) => {
  const r = repo(t);
  const sonnet = { profileId: 'bounded-standard', expectedResolvedModel: 'claude-sonnet-5-5' };
  const first = prepareClaudeNativeTask(explorerSpec(r, sonnet), { root: r.root });
  dispatch(r, first, 'first-1', 'partial answer');
  const retry = (recovery) =>
    explorerSpec(r, {
      profileId: 'complex-critical',
      expectedResolvedModel: 'claude-opus-5-5',
      recovery,
    });
  for (const [recovery, reason] of [
    [{ of: first.taskId }, /recovery-format/u],
    [{ of: 'not-a-task', cause: 'result-error' }, /recovery-format/u],
    [{ of: first.taskId, cause: 'result-error', step: 1 }, /recovery-format/u],
    ['result-error', /recovery-format/u],
  ])
    assert.throws(() => prepareClaudeNativeTask(retry(recovery), { root: r.root }), reason);
  const prepared = prepareClaudeNativeTask(retry({ of: first.taskId, cause: 'result-error' }), {
    root: r.root,
  });
  assert.deepEqual(prepared.registerInput.recovery, { of: first.taskId, cause: 'result-error' });
  assert.equal(prepared.invocation.model, 'opus');
  assert.equal(
    prepared.registerInput.workflowInput.nativeRequest.task.recovery,
    undefined,
    'the registry, not the helper, writes the checked recovery into the task',
  );
});

// A Parent-authored review hands its packet over as a digest-bound file, so the prompt keeps room
// for the result template; the native subject prompt is left exactly as it was.
function parentReview(r, parentSubject, records) {
  const { snapshotDigest } = buildClaudeNativeReview({ parentSubject }, { root: r.root });
  return buildClaudeNativeReview(
    {
      parentSubject,
      runnerEvidence: records
        ? {
            runner: 'lead-runner',
            records: records.map((record) => ({ ...record, sourceDigest: snapshotDigest })),
          }
        : { ...runnerEvidence(snapshotDigest), runner: 'lead-runner' },
      selectionBasisRef: 'plan:helper-test/parent-review',
      reviewerModel: 'claude-opus-4-6',
      sessionId: r.sessionId,
    },
    { root: r.root },
  );
}
const SMALL_PARENT_SUBJECT = {
  request: 'sample.txt 변경을 구현해줘.',
  owner: 'parent',
  acceptance: ['sample.txt updated'],
  paths: ['sample.txt'],
};
const PACKET_DIR = '.artifacts/tools/claude-review-packets';
const packetFiles = (r) =>
  existsSync(join(r.root, PACKET_DIR)) ? readdirSync(join(r.root, PACKET_DIR)) : [];
const sha256 = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;

test('the native subject reviewer prompt keeps its fixed lines and gets no packet file', (t) => {
  const r = settledBuilder(t);
  const review = reviewOf(r);
  const lines = review.reviewerPrompt.split('\n');
  assert.equal(lines[0], review.logHeader);
  assert.ok(lines.at(-1).startsWith('Result template: '));
  assert.deepEqual(lines.slice(1, -1), [
    'Independent read-only review of one frozen subject (same host, fresh context).',
    '- Read only packet.boundaries.allowedReadPaths at this snapshot. Do not edit, run commands or delegate.',
    '- Judge the source against each acceptanceCoverage criterion; no builder reasoning is provided or needed.',
    '- commandsActuallyRun holds the runner records. Keep them exactly; never add or claim a command yourself.',
    '- notRun lists only required checks nobody ran; knownGaps lists unresolved gaps blocking acceptance.',
    '  Either one, a coverage gap or a critical/high/medium finding forbids PASS.',
    '- Replace each coverage placeholder with sourceRefs and evidenceRefs (gap null), or keep a concrete gap.',
    '- Each finding needs severity (critical, high, medium or low), location, impact, reproduction and evidence.',
    '- Final message: exactly one JSON object from the result template, status "complete", verdict PASS or FAIL.',
  ]);
  assert.ok(!review.reviewerPrompt.includes('KNU_REVIEW_PACKET'));
  assert.equal(review.packetFile, undefined);
  assert.deepEqual(packetFiles(r), []);
});

test('a Parent review prompt names a digest-bound packet file instead of the packet JSON', (t) => {
  const r = repo(t);
  writeFileSync(join(r.root, 'sample.txt'), 'parent edit');
  const review = parentReview(r, SMALL_PARENT_SUBJECT);
  assert.ok(!review.reviewerPrompt.includes('KNU_REVIEW_PACKET:{'));
  const { path, digest } = review.packetFile;
  assert.match(path, /^\.artifacts\/tools\/claude-review-packets\/[a-z0-9]{8}-[a-f0-9]{8}\.json$/u);
  assert.ok(review.reviewerPrompt.split('\n').includes(`KNU_REVIEW_PACKET_FILE:${path} ${digest}`));
  assert.match(review.reviewerPrompt, /Read the packet file first/u);
  const bytes = readFileSync(join(r.root, path));
  assert.equal(bytes.toString('utf8'), `${JSON.stringify(review.packet)}\n`);
  assert.equal(digest, sha256(bytes));
  assert.ok(review.reviewerSpec.readScope.includes(path));
  assert.ok(review.packet.boundaries.allowedReadPaths.includes(path));
  // The file is ignored and is not native task evidence, so the review snapshot is unchanged.
  execFileSync('git', ['check-ignore', '-q', path], { cwd: r.root });
  assert.equal(isClaudeNativeEvidencePath(r.root, path), false);
  prepareClaudeNativeTask(review.reviewerSpec, { root: r.root });
});

test('a Parent review with many read paths and runner records fits the prompt limit', (t) => {
  const r = repo(t);
  const paths = Array.from({ length: 18 }, (_, i) => {
    const path = `docs/development/agent-workflows/adapters/review-input-${String(i).padStart(2, '0')}.md`;
    mkdirSync(join(r.root, 'docs/development/agent-workflows/adapters'), { recursive: true });
    writeFileSync(join(r.root, path), `input ${i}\n`);
    return path;
  });
  execFileSync('git', ['add', '.'], { cwd: r.root });
  const subject = {
    request: 'Parent 작성 변경이 contract와 맞는지 읽기 전용으로 독립 검토해줘.',
    owner: 'parent',
    acceptance: Array.from(
      { length: 6 },
      (_, i) =>
        `Criterion ${i}: the changed behaviour matches the contract, refused inputs write nothing, and the documented reasons follow the fixed order`,
    ),
    paths,
  };
  const records = Array.from({ length: 8 }, (_, i) => ({
    command: `node --test scripts/ci/claude-native-session.test.mjs scripts/ci/claude-native-task-helper.test.mjs # section ${i}`,
    exit: 0,
    environment: 'feat/claude-review-packet-file clean, macOS, Node 24.15, CLI 2.1.286',
    observedResult: `section ${i}: 486/486 pass, repo-policy 1165/1165, prettier clean, no change under scripts/agents/common`,
    outputPaths: [
      `.artifacts/plans/agent-workflow-portability-execution-index/review/runner-${i}.log`,
      `.artifacts/plans/agent-workflow-portability-execution-index/review/green-${i}.tap`,
    ],
  }));
  const review = parentReview(r, subject, records);
  assert.ok(review.reviewerPrompt.length <= 12000, String(review.reviewerPrompt.length));
});

test('a packet file is written once, only after the prompt fits, and only under the packet directory', async (t) => {
  const helper = await import('../agents/claude/native-task-helper.mjs');
  const r = repo(t);
  writeFileSync(join(r.root, 'sample.txt'), 'parent edit');
  parentReview(r, SMALL_PARENT_SUBJECT);
  assert.equal(packetFiles(r).length, 1);
  assert.throws(
    () =>
      parentReview(r, {
        ...SMALL_PARENT_SUBJECT,
        acceptance: Array.from({ length: 40 }, (_, i) => `criterion ${i} `.padEnd(200, 'x')),
      }),
    /reviewer-prompt-exceeds-12000-chars/u,
  );
  assert.equal(packetFiles(r).length, 1);

  const bytes = Buffer.from('{"packet":1}\n');
  const written = helper.writeClaudeReviewPacket(r.root, 'abcd1234-0123abcd', bytes);
  assert.deepEqual(written, {
    path: `${PACKET_DIR}/abcd1234-0123abcd.json`,
    digest: sha256(bytes),
  });
  assert.deepEqual(helper.writeClaudeReviewPacket(r.root, 'abcd1234-0123abcd', bytes), written);
  assert.throws(
    () => helper.writeClaudeReviewPacket(r.root, 'abcd1234-0123abcd', Buffer.from('{}\n')),
    /review packet .* differs/u,
  );
  for (const reviewId of ['../../plans/x', 'ABCD1234-0123abcd', 'abcd1234'])
    assert.throws(
      () => helper.writeClaudeReviewPacket(r.root, reviewId, bytes),
      /invalid review packet id/u,
    );
  const other = repo(t);
  mkdirSync(join(other.root, '.artifacts/tools/claude-native'), { recursive: true });
  symlinkSync(join(other.root, '.artifacts/tools/claude-native'), join(other.root, PACKET_DIR));
  assert.throws(
    () => helper.writeClaudeReviewPacket(other.root, 'abcd1234-0123abcd', bytes),
    /artifact ancestor symlink/u,
  );
});

function readRows(r, agentId, packetPath, { error = false } = {}) {
  const child = join(
    r.root,
    '.artifacts/transcripts',
    r.sessionId,
    'subagents',
    `agent-${agentId}.jsonl`,
  );
  const row = (type, message, extra = {}) =>
    JSON.stringify({ type, sessionId: r.sessionId, agentId, ...extra, message });
  writeFileSync(
    child,
    readFileSync(child, 'utf8') +
      `${row(
        'assistant',
        {
          model: 'claude-opus-4-6',
          content: [
            {
              type: 'tool_use',
              id: 'toolu_packet',
              name: 'Read',
              input: { file_path: join(r.root, packetPath) },
            },
          ],
        },
        { effort: ROLE_EFFORT.knu_reviewer },
      )}\n${row('user', {
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'toolu_packet',
            ...(error ? { is_error: true } : {}),
            content: error ? 'File does not exist.' : '{}',
          },
        ],
      })}\n`,
  );
}
function settledParentReview(t, { read = true, error = false, change = false } = {}) {
  const r = repo(t);
  writeFileSync(join(r.root, 'sample.txt'), 'parent edit');
  const review = parentReview(r, SMALL_PARENT_SUBJECT);
  const reviewer = prepareClaudeNativeTask(review.reviewerSpec, { root: r.root });
  const result = structuredClone(review.resultTemplate);
  result.verdict = 'PASS';
  dispatch(r, reviewer, 'review-1', JSON.stringify(result));
  if (read) readRows(r, 'review-1-agent', review.packetFile.path, { error });
  if (change) writeFileSync(join(r.root, review.packetFile.path), '{}\n');
  return {
    r,
    review,
    status: settleClaudeNativeTask(reviewer.taskId, undefined, { root: r.root }),
  };
}

test('settle reports whether the Parent reviewer read the unchanged packet file', (t) => {
  const { review, status } = settledParentReview(t);
  assert.deepEqual(status.reviewPacket, {
    path: review.packetFile.path,
    expectedDigest: review.packetFile.digest,
    currentDigest: review.packetFile.digest,
    read: true,
  });
  assert.ok(!status.observationErrors.some((e) => e.startsWith('review-packet-')));
  for (const [options, reason] of [
    [{ read: false }, 'review-packet-unread'],
    [{ error: true }, 'review-packet-unread'],
    [{ change: true }, 'review-packet-changed'],
  ])
    assert.ok(
      settledParentReview(t, options).status.observationErrors.includes(reason),
      JSON.stringify(options),
    );
});
