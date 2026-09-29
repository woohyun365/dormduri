import assert from 'node:assert/strict';
import { existsSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import test from 'node:test';
import { fixture } from './fixtures/claude-native-qualification-fixture.mjs';
import {
  handleClaudeNativeSessionEvent,
  completeClaudeNativeTask,
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
  writeFileSync(
    join(f.root, '.claude/agents/knu_executor.md'),
    '---\nname: knu_executor\ntools: Read, Grep, Glob, Edit, Write, Bash\n---\nImplement bounded work.\n',
  );
  writeFileSync(
    join(f.root, '.claude/agents/knu_reviewer.md'),
    '---\nname: knu_reviewer\ntools: Read, Grep, Glob\n---\nReview only.\n',
  );
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
    expectedResolvedModel: 'claude-sonnet-5',
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
function dispatch(r, prepared, toolUseId, response) {
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
  handleClaudeNativeSessionEvent(
    {
      ...event,
      hook_event_name: 'PostToolUse',
      tool_response: {
        status: 'completed',
        agentId: `${toolUseId}-agent`,
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
      tool_response: {
        status: 'completed',
        agentId: 'build-agent',
        resolvedModel: 'claude-sonnet-5',
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
  assert.match(review.reviewerPrompt, /KNU_REVIEW_PACKET:/u);
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
    /parent-adjudication/,
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
