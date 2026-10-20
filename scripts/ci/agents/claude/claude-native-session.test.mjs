import assert from 'node:assert/strict';
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  mkdtempSync,
  symlinkSync,
  readdirSync,
  rmSync,
  realpathSync,
  truncateSync,
  existsSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { execFileSync, spawnSync } from 'node:child_process';
import test from 'node:test';
import {
  ROLE_EFFORT,
  fixture,
  writeChildTranscript,
  writeRole,
} from './fixtures/claude-native-session-fixture.mjs';
import {
  registerClaudeNativeTask,
  handleClaudeNativeSessionEvent,
  completeClaudeNativeTask,
  observeClaudeNativeTask,
  releaseClaudeNativeTask,
  claudeNativeSnapshotDigest,
  claudeReviewInputs,
  REVIEW_INPUTS_LINE,
} from '../../../agents/claude/native-session.mjs';
import { CHILD_TRANSCRIPT_BYTE_LIMIT } from '../../../agents/claude/native-session-evidence.mjs';
import {
  settleClaudeNativeTask,
  writeClaudeReviewPacket,
} from '../../../agents/claude/native-task-helper.mjs';
import * as policy from '../../../agents/claude/model-policy.mjs';

function setup(t) {
  const f = fixture(t);
  writeFileSync(join(f.root, '.git/info/exclude'), '.artifacts/\n');
  const sessionId = randomUUID();
  const registered = registerClaudeNativeTask({ ...f.options, workflowInput: f.input, sessionId });
  const event = {
    hook_event_name: 'PreToolUse',
    session_id: sessionId,
    cwd: f.root,
    permission_mode: 'auto',
    tool_name: 'Agent',
    tool_use_id: 'tool-1',
    tool_input: registered.invocation,
  };
  return { ...f, registered, event };
}
function handle(f, event = f.event) {
  return handleClaudeNativeSessionEvent(event, { root: f.root });
}
// A foreground completion: the finished child's transcript sits beside the parent transcript the
// PostToolUse event names, with the role's effort on each assistant row unless a case overrides it.
// Each registered task gets its own child id, so two children never share a transcript path.
const agentIdOf = (f) => `child-${f.registered.taskId.slice(0, 8)}`;
function finish(f, patch = {}, child = {}) {
  const agentId = patch.agentId ?? agentIdOf(f);
  const completed = (patch.status ?? 'completed') === 'completed';
  const transcriptPath =
    completed && /^[a-zA-Z0-9_-]{1,80}$/u.test(agentId) && child.write !== false
      ? writeChildTranscript(f.root, {
          sessionId: f.event.session_id,
          agentId,
          prompt: f.registered.invocation.prompt,
          model: f.options.expectedResolvedModel,
          effort: ROLE_EFFORT[f.registered.invocation.subagent_type],
          ...child,
        })
      : join(realpathSync(f.root), '.artifacts/transcripts', `${f.event.session_id}.jsonl`);
  return handle(f, {
    ...f.event,
    hook_event_name: 'PostToolUse',
    transcript_path: transcriptPath,
    tool_response: {
      status: 'completed',
      agentId,
      resolvedModel: f.options.expectedResolvedModel,
      content: [{ type: 'text', text: 'oracle' }],
      ...patch,
    },
  });
}

test('auto hook validates selected model but returns no allow: classifier retains ownership', (t) => {
  const f = setup(t);
  assert.deepEqual(handle(f), {});
  assert.equal(f.registered.invocation.model, 'haiku');
  assert.equal(Object.hasOwn(f.registered.invocation, 'run_in_background'), false);
  assert.equal(f.registered.workflow.native.requestStatus, 'eligible');
  assert.equal(f.registered.workflow.dispatchAuthorized, false);
  assert.equal(f.registered.workflow.runtimeQualified, false);
  assert.match(f.registered.invocation.prompt, /KNU_NATIVE_TASK/);
});
for (const [name, mutate] of [
  ['missing model', (e) => delete e.tool_input.model],
  ['wrong model', (e) => (e.tool_input.model = 'opus')],
  ['foreign session', (e) => (e.session_id = randomUUID())],
  ['permission drift', (e) => (e.permission_mode = 'bypassPermissions')],
  ['foreign role', (e) => (e.tool_input.subagent_type = 'knu_reviewer')],
  ['unregistered', (e) => (e.tool_input.prompt = 'no registration')],
  ['background', (e) => (e.tool_input.run_in_background = true)],
  ['missing tool id', (e) => delete e.tool_use_id],
  ['prompt drift', (e) => (e.tool_input.prompt = 'changed\n' + e.tool_input.prompt)],
])
  test(`auto rejects ${name}`, (t) => {
    const f = setup(t);
    mutate(f.event);
    assert.equal(handle(f).hookSpecificOutput.permissionDecision, 'deny');
  });
test('stale source denied before dispatch without requiring a clean checkout', (t) => {
  const f = setup(t);
  writeFileSync(join(f.root, 'sample.txt'), 'different');
  assert.equal(handle(f).hookSpecificOutput.permissionDecision, 'deny');
});
test('replayed task is denied; unrelated OMC role remains outside KNU policy', (t) => {
  const f = setup(t);
  assert.deepEqual(handle(f), {});
  assert.equal(handle(f).hookSpecificOutput.permissionDecision, 'deny');
  assert.deepEqual(
    handle(f, {
      ...f.event,
      tool_input: {
        subagent_type: 'oh-my-claudecode:planner',
        model: 'opus',
        prompt: 'own policy',
      },
    }),
    {},
  );
});
test('healthy same-run completion is observed but not semantic success', (t) => {
  const f = setup(t);
  handle(f);
  finish(f);
  const status = completeClaudeNativeTask(f.registered.taskId, {}, { root: f.root });
  assert.equal(status.observation.valid, true);
  assert.equal(status.valid, false);
  assert.equal(status.runtimeQualified, false);
});
for (const patch of [
  { resolvedModel: 'claude-opus-4-6' },
  { status: 'async_launched' },
  { modelsUsed: ['claude-opus-4-6'] },
  { agentId: '' },
  { content: [] },
])
  test(`completion rejects ${JSON.stringify(patch)}`, (t) => {
    const f = setup(t);
    handle(f);
    finish(f, patch);
    assert.equal(
      completeClaudeNativeTask(f.registered.taskId, {}, { root: f.root }).observation.valid,
      false,
    );
  });
test('posttool without healthy pretool cannot complete', (t) => {
  const f = setup(t);
  finish(f);
  assert.equal(completeClaudeNativeTask(f.registered.taskId, {}, { root: f.root }).valid, false);
});
test('settings connect real project hooks without overriding auto/Home/plugins/tools', () => {
  const settings = JSON.parse(
    readFileSync(new URL('../../../../.claude/settings.json', import.meta.url)),
  );
  // No project permission rules: an Agent(<role>) ask rule did not prompt in a fresh ordinary auto session.
  assert.deepEqual(Object.keys(settings), ['hooks']);
  assert.deepEqual(Object.keys(settings.hooks), [
    'SessionStart',
    'PreToolUse',
    'PostToolUse',
    'PostToolUseFailure',
    'SubagentStop',
  ]);
  assert.equal(settings.hooks.PreToolUse[0].matcher, 'Agent|SendMessage');
  // A separate entry keeps the file guard's exit rules apart from the task hook's.
  assert.equal(settings.hooks.PreToolUse.length, 2);
  assert.equal(settings.hooks.PreToolUse[1].matcher, 'Edit|Write|NotebookEdit');
  const hook = 'node "$CLAUDE_PROJECT_DIR/scripts/agents/claude/native-session.mjs" --hook';
  assert.deepEqual(settings.hooks.PreToolUse[0].hooks, [
    { type: 'command', command: hook, timeout: 10 },
  ]);
  assert.deepEqual(settings.hooks.PreToolUse[1].hooks, [
    { type: 'command', command: `${hook} --file-guard`, timeout: 10 },
  ]);
  assert.equal(settings.hooks.PostToolUse[0].matcher, 'Agent');
});

function semanticResult(f) {
  const path = join(f.registered.evidenceDirectory, 'completion.json');
  const observed = JSON.parse(readFileSync(path));
  const w = f.registered.workflow,
    lane = w.lanes[0];
  return {
    responseDigest: observed.responseDigest,
    acceptance: [
      { criterion: lane.acceptance[0], passed: true, evidenceRef: 'fixture:independent-oracle' },
    ],
    results: [
      {
        resultId: 'actual-1',
        dispatchId: lane.dispatchId,
        laneId: lane.id,
        owner: lane.owner,
        hostId: 'claude-code',
        adapterIdentity: w.adapterIdentity,
        sourceSnapshot: observed.finalSnapshot,
        status: 'complete',
        checks: ['independent oracle compared'],
        findings: [],
        gaps: [],
        changedPaths: [],
      },
    ],
  };
}
test('same response + independently checked acceptance completes common contract, never grants host authority', (t) => {
  const f = setup(t);
  handle(f);
  finish(f);
  const checked = completeClaudeNativeTask(f.registered.taskId, semanticResult(f), {
    root: f.root,
  });
  assert.equal(checked.valid, true, JSON.stringify(checked.errors));
  assert.equal(checked.dispatchAuthorized, false);
  assert.equal(checked.runtimeQualified, false);
});
test('foreign digest, missing criterion, partial result or later source changes cannot complete', (t) => {
  const f = setup(t);
  handle(f);
  finish(f);
  const input = semanticResult(f);
  assert.equal(completeClaudeNativeTask(f.registered.taskId, input, { root: f.root }).valid, true);
  for (const update of [
    { responseDigest: 'wrong' },
    { acceptance: [] },
    { results: [{ ...input.results[0], status: 'partial', gaps: ['unfinished'] }] },
  ])
    assert.equal(
      completeClaudeNativeTask(f.registered.taskId, { ...input, ...update }, { root: f.root })
        .valid,
      false,
    );
  writeFileSync(join(f.root, 'sample.txt'), 'late change');
  assert.equal(completeClaudeNativeTask(f.registered.taskId, input, { root: f.root }).valid, false);
});
test('ambient forced model conflict denied without scrubbing the normal environment', (t) => {
  const f = setup(t);
  const old = [
    process.env.CLAUDE_CODE_SUBAGENT_MODEL_FORCE,
    process.env.CLAUDE_CODE_SUBAGENT_MODEL,
  ];
  try {
    process.env.CLAUDE_CODE_SUBAGENT_MODEL_FORCE = '1';
    process.env.CLAUDE_CODE_SUBAGENT_MODEL = 'opus';
    assert.match(handle(f).hookSpecificOutput.permissionDecisionReason, /forced model/);
  } finally {
    for (const [key, value] of [
      ['CLAUDE_CODE_SUBAGENT_MODEL_FORCE', old[0]],
      ['CLAUDE_CODE_SUBAGENT_MODEL', old[1]],
    ]) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
test('expired registration and task/lane ownership disagreement reject before writing task state', (t) => {
  const f = fixture(t);
  const base = { ...f.options, workflowInput: f.input, sessionId: randomUUID() };
  f.input.nativeRequest.issuedAt = new Date(Date.now() - 120000).toISOString();
  f.input.nativeRequest.expiresAt = new Date(Date.now() - 60000).toISOString();
  assert.throws(() => registerClaudeNativeTask(base), /expired/);
  f.input.nativeRequest.issuedAt = new Date(Date.now() - 1000).toISOString();
  f.input.nativeRequest.expiresAt = new Date(Date.now() + 60000).toISOString();
  f.input.directAssignment.writeOwnership = ['sample.txt'];
  assert.throws(() => registerClaudeNativeTask(base));
});

test('completion receipt cannot be replayed to another task with no pre/post', (t) => {
  const f = setup(t);
  handle(f);
  finish(f);
  const another = registerClaudeNativeTask({
    ...f.options,
    workflowInput: f.input,
    sessionId: f.event.session_id,
  });
  writeFileSync(
    join(another.evidenceDirectory, 'completion.json'),
    readFileSync(join(f.registered.evidenceDirectory, 'completion.json')),
  );
  const g = { ...f, registered: another };
  assert.equal(
    completeClaudeNativeTask(another.taskId, semanticResult(g), { root: f.root }).valid,
    false,
  );
});
test('read-only child actual mutation cannot be hidden with empty reported changedPaths', (t) => {
  const f = setup(t);
  handle(f);
  writeFileSync(join(f.root, 'sample.txt'), 'unauthorized mutation');
  finish(f);
  assert.equal(
    completeClaudeNativeTask(f.registered.taskId, semanticResult(f), { root: f.root }).valid,
    false,
  );
});

test('registration rejects artifact ancestor symlink before writing outside repository', (t) => {
  const f = fixture(t);
  const outside = mkdtempSync(join(tmpdir(), 'native-outside-'));
  t.after(() => rmSync(outside, { recursive: true, force: true }));
  writeFileSync(join(f.root, '.git/info/exclude'), '.artifacts/\n');
  mkdirSync(join(f.root, '.artifacts/tools'), { recursive: true });
  symlinkSync(outside, join(f.root, '.artifacts/tools/claude-native'));
  assert.throws(
    () =>
      registerClaudeNativeTask({ ...f.options, workflowInput: f.input, sessionId: randomUUID() }),
    /ancestor symlink/,
  );
  assert.deepEqual(readdirSync(outside), []);
});
function writer(t) {
  const f = fixture(t);
  writeFileSync(join(f.root, '.git/info/exclude'), '.artifacts/\n');
  writeRole(
    f.root,
    'knu_executor',
    'Read, Grep, Glob, Edit, Write, Bash',
    'Implement bounded work.',
  );
  writeRole(f.root, 'knu_reviewer', 'Read, Grep, Glob', 'Review only.');
  execFileSync('git', ['add', '.'], { cwd: f.root });
  delete f.input.currentSnapshot;
  f.input.request = 'sample.txt 변경을 구현해줘.';
  f.input.directAssignment.writeOwnership = ['sample.txt'];
  f.input.directAssignment.owner = 'builder';
  f.input.reviewDisposition.required = true;
  f.input.nativeRequest.profileId = 'bounded-standard';
  Object.assign(f.input.nativeRequest.task, {
    kind: 'build',
    impactRisk: 'medium',
    role: 'knu_executor',
    allowedTools: ['Read', 'Grep', 'Glob', 'Edit', 'Write', 'Bash'],
    writeScope: ['sample.txt'],
    writeOwner: 'builder',
    facts: [
      'source-bound',
      'bounded-scope',
      'acceptance',
      'oracle',
      'independent-qa',
      'regression',
      'one-writer',
    ].map((key) => ({ key, sourceRef: 'fixture', confidence: 'high' })),
  });
  f.options.expectedResolvedModel = 'claude-sonnet-5-5';
  const sessionId = randomUUID();
  const registered = registerClaudeNativeTask({ ...f.options, workflowInput: f.input, sessionId });
  return {
    ...f,
    registered,
    event: {
      hook_event_name: 'PreToolUse',
      session_id: sessionId,
      cwd: f.root,
      permission_mode: 'auto',
      tool_name: 'Agent',
      tool_use_id: 'write-1',
      tool_input: registered.invocation,
    },
  };
}

// The helper names a native review packet review-<reviewId>; the registry finds the reviewer's
// prompt record by that id.
const REVIEW_PACKET_ID = 'review-natrev00-0000beef';
function reviewPacket(subject, snapshot) {
  const { basePacket } = JSON.parse(
    readFileSync(join(import.meta.dirname, '../common/fixtures/cross-model-handoff-cases.json')),
  );
  return {
    ...structuredClone(basePacket),
    packetId: REVIEW_PACKET_ID,
    objective: subject.registered.workflow.envelope.requestSummary,
    snapshot,
    authority: {
      ...basePacket.authority,
      integrationOwner: 'parent',
      writeOwner: 'builder',
      runnerOwner: 'parent',
      parentClarificationOwner: 'parent',
    },
    boundaries: {
      ...basePacket.boundaries,
      allowedReadPaths: ['sample.txt'],
      permittedOutputPaths: ['.artifacts/tools/claude-native'],
    },
    lifecycle: {
      ...basePacket.lifecycle,
      dispatchId: 'native-review-dispatch',
      cancelOwner: 'parent',
      cleanupOwner: 'parent',
    },
    intent: { ...basePacket.intent, direction: 'same-host-independent-review' },
  };
}

function reviewResult(packet, model, verdict = 'PASS') {
  const { baseResult } = JSON.parse(
    readFileSync(join(import.meta.dirname, '../common/fixtures/cross-model-handoff-cases.json')),
  );
  return {
    ...structuredClone(baseResult),
    packetId: packet.packetId,
    dispatchId: packet.lifecycle.dispatchId,
    resultId: 'native-review-result',
    reviewedSnapshot: packet.snapshot,
    identity: {
      requestedModelIntent: packet.intent.modelIntent,
      resolvedModel: model,
      observedModel: model,
    },
    acceptanceCoverage: [
      {
        criterion: 'oracle returned',
        sourceRefs: ['fixture'],
        evidenceRefs: ['fixture:review'],
        gap: null,
      },
    ],
    commandsActuallyRun: [],
    verdict,
    disposition: { owner: 'parent', nextAction: 'Adjudicate the native review.' },
    cleanup: { owner: 'parent', status: 'complete', handoff: 'No cleanup required.' },
    handoff: { integrationOwner: 'parent', requestedWriteOwner: null },
  };
}

const PROMPT_RECORD_DIR = '.artifacts/tools/claude-review-packets';
const sha256 = (value) => `sha256:${createHash('sha256').update(value).digest('hex')}`;
function writePromptRecord(root, packet, prompt) {
  const reviewId = /^review-([a-z0-9]{8}-[a-f0-9]{8})$/u.exec(packet?.packetId ?? '')?.[1];
  if (reviewId === undefined) return;
  const path = join(root, PROMPT_RECORD_DIR, `${reviewId}.prompt.json`);
  rmSync(path, { force: true });
  if (prompt === null) return;
  mkdirSync(join(root, PROMPT_RECORD_DIR), { recursive: true });
  writeFileSync(
    path,
    `${JSON.stringify({ schema: 'claude-review-prompt/v1', reviewId, promptDigest: sha256(prompt) })}\n`,
  );
}
function reviewer(t, subject, packet, options = {}) {
  const input = structuredClone(subject.input);
  input.request = 'sample.txt 변경을 독립 검토해줘.';
  input.currentSnapshot = options.currentSnapshot ?? packet.snapshot;
  input.directAssignment = {
    owner: 'reviewer',
    dispatchId: 'native-review-lane',
    acceptance: ['review subject acceptance'],
    writeOwnership: [],
  };
  input.reviewDisposition = { required: false, reason: 'terminal independent native review' };
  input.nativeRequest.profileId = 'complex-critical';
  Object.assign(input.nativeRequest.task, {
    taskId: 'review-task',
    kind: 'review',
    impactRisk: 'medium',
    complexity: 'bounded',
    uncertainty: 'resolved',
    role: 'knu_reviewer',
    allowedTools: ['Read', 'Grep', 'Glob'],
    readScope: options.readScope ?? ['sample.txt'],
    writeScope: [],
    writeOwner: null,
    childValue: 'independent-review',
    independent: true,
    facts: [
      'source-bound',
      'bounded-scope',
      'acceptance',
      'oracle',
      'independent-qa',
      'fresh-context',
    ].map((key) => ({ key, sourceRef: 'fixture', confidence: 'high' })),
  });
  const expectedResolvedModel = 'claude-opus-4-6';
  const prompt = options.prompt ?? 'Review the frozen subject packet only.';
  const independentReview = {
    subjectTaskId: subject.registered.taskId,
    reviewerId: 'reviewer',
    builderIds: ['builder'],
    packet,
    ...options.independentReview,
  };
  // `review` records the digest of the prompt it built; promptRecord null leaves no record and a
  // string records another prompt.
  writePromptRecord(
    subject.root,
    independentReview.packet,
    options.promptRecord === undefined ? prompt : options.promptRecord,
  );
  const registered = registerClaudeNativeTask({
    workflowInput: input,
    sessionId: options.sessionId ?? subject.event.session_id,
    prompt,
    expectedResolvedModel,
    independentReview,
  });
  return {
    ...subject,
    input,
    options: { ...subject.options, expectedResolvedModel },
    registered,
    event: {
      ...subject.event,
      session_id: options.sessionId ?? subject.event.session_id,
      tool_use_id: 'review-1',
      tool_input: registered.invocation,
    },
  };
}

test('terminal native reviewer receipt completes its subject without recursive QA', (t) => {
  const subject = writer(t);
  handle(subject);
  writeFileSync(join(subject.root, 'sample.txt'), 'allowed output');
  finish(subject);
  const subjectObservation = JSON.parse(
    readFileSync(join(subject.registered.evidenceDirectory, 'completion.json')),
  );
  const packet = reviewPacket(subject, subjectObservation.finalSnapshot);
  const qa = reviewer(t, subject, packet);
  const result = reviewResult(packet, qa.options.expectedResolvedModel);
  assert.match(qa.registered.invocation.prompt, new RegExp(REVIEW_PACKET_ID, 'u'));
  handle(qa);
  finish(qa, { content: [{ type: 'text', text: JSON.stringify(result) }] });
  const qaSemantic = semanticResult(qa);
  qaSemantic.reviewResult = result;
  assert.equal(
    completeClaudeNativeTask(qa.registered.taskId, qaSemantic, { root: qa.root }).valid,
    true,
  );
  const subjectSemantic = semanticResult(subject);
  subjectSemantic.results[0].changedPaths = ['sample.txt'];
  subjectSemantic.reviewerTaskId = qa.registered.taskId;
  assert.equal(
    completeClaudeNativeTask(subject.registered.taskId, subjectSemantic, { root: subject.root })
      .valid,
    true,
  );
  const rawReviewOnly = structuredClone(subjectSemantic);
  delete rawReviewOnly.reviewerTaskId;
  rawReviewOnly.review = {
    requestDigest: subject.registered.workflow.requestDigest,
    reviewerId: 'reviewer',
    builderIds: ['builder'],
    packet,
    result,
  };
  assert.equal(
    completeClaudeNativeTask(subject.registered.taskId, rawReviewOnly, { root: subject.root })
      .valid,
    false,
  );
  releaseClaudeNativeTask(qa.registered.taskId, { root: qa.root, ended: true });
  assert.equal(
    completeClaudeNativeTask(subject.registered.taskId, subjectSemantic, { root: subject.root })
      .valid,
    false,
  );
});

// register --input reaches the registry without prepare, so the registry itself compares the prompt
// with the digest `review` recorded under the packet's review id.
test('a native reviewer registers only with the prompt its review recorded', (t) => {
  const { subject, packet } = reviewedSubject(t);
  assert.throws(
    () => reviewer(t, subject, packet, { promptRecord: null }),
    /review-prompt-unbound/u,
  );
  assert.throws(
    () => reviewer(t, subject, packet, { promptRecord: 'Review the frozen subject packet only!' }),
    /review-prompt-changed/u,
  );
  // A packet id that names no review has no record to compare with.
  assert.throws(
    () => reviewer(t, subject, { ...packet, packetId: 'native-review-packet' }),
    /review-prompt-unbound/u,
  );
  assert.equal(reviewer(t, subject, packet).registered.invocation.subagent_type, 'knu_reviewer');
});

test('terminal reviewer rejects self, stale packet, missing observation and raw review override', (t) => {
  const missing = writer(t);
  const missingPacket = reviewPacket(missing, missing.registered.workflow.currentSnapshot);
  assert.throws(() => reviewer(t, missing, missingPacket), /completion\.json|observation/);

  const subject = writer(t);
  handle(subject);
  writeFileSync(join(subject.root, 'sample.txt'), 'allowed output');
  finish(subject);
  const observation = JSON.parse(
    readFileSync(join(subject.registered.evidenceDirectory, 'completion.json')),
  );
  const packet = reviewPacket(subject, observation.finalSnapshot);
  assert.throws(
    () =>
      reviewer(t, subject, packet, {
        independentReview: { builderIds: ['builder', 'reviewer'] },
      }),
    /independent/,
  );
  const stale = structuredClone(packet);
  stale.snapshot.headSHA = 'f'.repeat(40);
  assert.throws(
    () => reviewer(t, subject, stale, { currentSnapshot: observation.finalSnapshot }),
    /stale/,
  );
  const crossHost = structuredClone(packet);
  crossHost.intent.direction = 'codex-maker-claude-checker';
  assert.throws(() => reviewer(t, subject, crossHost), /same-host/);
  const manual = structuredClone(packet);
  manual.lifecycle.transport = 'manual';
  assert.throws(() => reviewer(t, subject, manual), /native/);

  const qa = reviewer(t, subject, packet);
  const result = reviewResult(packet, 'unknown');
  const subjectSemantic = semanticResult(subject);
  subjectSemantic.results[0].changedPaths = ['sample.txt'];
  subjectSemantic.reviewerTaskId = qa.registered.taskId;
  assert.equal(
    completeClaudeNativeTask(subject.registered.taskId, subjectSemantic, { root: subject.root })
      .valid,
    false,
  );
  const foreign = structuredClone(subjectSemantic);
  foreign.reviewerTaskId = randomUUID();
  assert.equal(
    completeClaudeNativeTask(subject.registered.taskId, foreign, { root: subject.root }).valid,
    false,
  );
  handle(qa);
  finish(qa, { content: [{ type: 'text', text: JSON.stringify(result) }] });
  const qaSemantic = semanticResult(qa);
  qaSemantic.reviewResult = { ...result, verdict: 'FAIL' };
  assert.equal(
    completeClaudeNativeTask(qa.registered.taskId, qaSemantic, { root: qa.root }).valid,
    false,
  );
  qaSemantic.reviewResult = result;
  assert.equal(
    completeClaudeNativeTask(qa.registered.taskId, qaSemantic, { root: qa.root }).valid,
    true,
  );
  finish(qa, { content: [{ type: 'text', text: JSON.stringify(result) }] });
  assert.equal(
    completeClaudeNativeTask(subject.registered.taskId, subjectSemantic, { root: subject.root })
      .valid,
    false,
  );
  subjectSemantic.review = {
    requestDigest: subject.registered.workflow.requestDigest,
    reviewerId: 'builder',
  };
  const overridden = completeClaudeNativeTask(subject.registered.taskId, subjectSemantic, {
    root: subject.root,
  });
  assert.equal(overridden.valid, false);
  assert.ok(overridden.errors.includes('native reviewer link cannot override review payload'));
});

test('terminal reviewer records complete FAIL but rejects partial BLOCKED and cannot pass builder', (t) => {
  const subject = writer(t);
  handle(subject);
  writeFileSync(join(subject.root, 'sample.txt'), 'allowed output');
  finish(subject);
  const observation = JSON.parse(
    readFileSync(join(subject.registered.evidenceDirectory, 'completion.json')),
  );
  const packet = reviewPacket(subject, observation.finalSnapshot);
  const failedQa = reviewer(t, subject, packet);
  const failedResult = reviewResult(packet, 'unknown', 'FAIL');
  handle(failedQa);
  finish(failedQa, { content: [{ type: 'text', text: JSON.stringify(failedResult) }] });
  const failedSemantic = semanticResult(failedQa);
  failedSemantic.reviewResult = failedResult;
  assert.equal(
    completeClaudeNativeTask(failedQa.registered.taskId, failedSemantic, {
      root: failedQa.root,
    }).valid,
    true,
  );
  const subjectSemantic = semanticResult(subject);
  subjectSemantic.results[0].changedPaths = ['sample.txt'];
  subjectSemantic.reviewerTaskId = failedQa.registered.taskId;
  assert.equal(
    completeClaudeNativeTask(subject.registered.taskId, subjectSemantic, { root: subject.root })
      .valid,
    false,
  );

  const blockedQa = reviewer(t, subject, packet);
  const blockedResult = {
    ...reviewResult(packet, 'unknown'),
    status: 'partial',
    verdict: 'BLOCKED',
    blocker: 'Reviewer did not finish.',
  };
  handle(blockedQa);
  finish(blockedQa, { content: [{ type: 'text', text: JSON.stringify(blockedResult) }] });
  const blockedSemantic = semanticResult(blockedQa);
  blockedSemantic.reviewResult = blockedResult;
  assert.equal(
    completeClaudeNativeTask(blockedQa.registered.taskId, blockedSemantic, {
      root: blockedQa.root,
    }).valid,
    false,
  );
});
test('read-only reviewer cites runner-owned checks as runner commands; unexecuted checks block PASS', (t) => {
  const subject = writer(t);
  handle(subject);
  writeFileSync(join(subject.root, 'sample.txt'), 'allowed output');
  finish(subject);
  const observation = JSON.parse(
    readFileSync(join(subject.registered.evidenceDirectory, 'completion.json')),
  );
  const packet = reviewPacket(subject, observation.finalSnapshot);
  packet.authority.runnerOwner = 'parent';
  const runnerCommand = (runner) => ({
    runner,
    exit: 0,
    observedResult: 'node --test sample: 1 pass',
    environment: 'node, same reviewed snapshot',
    outputPaths: [],
  });
  const reviewed = (result) => {
    const qa = reviewer(t, subject, packet);
    handle(qa);
    finish(qa, { content: [{ type: 'text', text: JSON.stringify(result) }] });
    const semantic = semanticResult(qa);
    semantic.reviewResult = result;
    return completeClaudeNativeTask(qa.registered.taskId, semantic, { root: qa.root });
  };

  const unexecuted = reviewResult(packet, 'unknown');
  unexecuted.notRun = ['node --test sample (runner-owned, not provided)'];
  const pending = reviewed(unexecuted);
  assert.equal(pending.valid, false);
  assert.ok(pending.errors.some((error) => /PASS requires/.test(error)));

  const selfReported = reviewResult(packet, 'unknown');
  selfReported.commandsActuallyRun = [runnerCommand('reviewer')];
  const misattributed = reviewed(selfReported);
  assert.equal(misattributed.valid, false);
  assert.ok(misattributed.errors.some((error) => /commandsActuallyRun\[0\]\.runner/.test(error)));

  const runnerEvidence = reviewResult(packet, 'unknown');
  runnerEvidence.commandsActuallyRun = [runnerCommand('parent')];
  assert.equal(reviewed(runnerEvidence).valid, true);
});
test('a reviewer FAIL receipt cannot be bypassed by linking another reviewer of the same subject', (t) => {
  const subject = writer(t);
  handle(subject);
  writeFileSync(join(subject.root, 'sample.txt'), 'allowed output');
  finish(subject);
  const observation = JSON.parse(
    readFileSync(join(subject.registered.evidenceDirectory, 'completion.json')),
  );
  const packet = reviewPacket(subject, observation.finalSnapshot);
  const completeReview = (verdict) => {
    const qa = reviewer(t, subject, packet);
    const result = reviewResult(packet, 'unknown', verdict);
    handle(qa);
    finish(qa, { content: [{ type: 'text', text: JSON.stringify(result) }] });
    const semantic = semanticResult(qa);
    semantic.reviewResult = result;
    assert.equal(
      completeClaudeNativeTask(qa.registered.taskId, semantic, { root: qa.root }).valid,
      true,
    );
    return qa;
  };
  completeReview('FAIL');
  const passing = completeReview('PASS');
  const subjectSemantic = semanticResult(subject);
  subjectSemantic.results[0].changedPaths = ['sample.txt'];
  subjectSemantic.reviewerTaskId = passing.registered.taskId;
  const shopped = completeClaudeNativeTask(subject.registered.taskId, subjectSemantic, {
    root: subject.root,
  });
  assert.equal(shopped.valid, false);
  assert.ok(shopped.errors.some((error) => /FAIL review receipt/.test(error)));
});
test('a delivered non-PASS or unsettled review of the subject blocks linking another reviewer', (t) => {
  const subject = writer(t);
  handle(subject);
  writeFileSync(join(subject.root, 'sample.txt'), 'allowed output');
  finish(subject);
  const observation = JSON.parse(
    readFileSync(join(subject.registered.evidenceDirectory, 'completion.json')),
  );
  const packet = reviewPacket(subject, observation.finalSnapshot);
  const passingReview = () => {
    const qa = reviewer(t, subject, packet);
    const result = reviewResult(packet, 'unknown');
    handle(qa);
    finish(qa, { content: [{ type: 'text', text: JSON.stringify(result) }] });
    const semantic = semanticResult(qa);
    semantic.reviewResult = result;
    assert.equal(
      completeClaudeNativeTask(qa.registered.taskId, semantic, { root: qa.root }).valid,
      true,
    );
    return qa;
  };
  const builderLinkedTo = (qa) => {
    const semantic = semanticResult(subject);
    semantic.results[0].changedPaths = ['sample.txt'];
    semantic.reviewerTaskId = qa.registered.taskId;
    return completeClaudeNativeTask(subject.registered.taskId, semantic, { root: subject.root });
  };

  const unsettled = reviewer(t, subject, packet);
  handle(unsettled);
  const pending = builderLinkedTo(passingReview());
  assert.equal(pending.valid, false);
  assert.ok(pending.errors.some((error) => /unsettled or released review attempt/.test(error)));

  finish(unsettled, {
    content: [{ type: 'text', text: JSON.stringify(reviewResult(packet, 'unknown', 'FAIL')) }],
  });
  const delivered = builderLinkedTo(passingReview());
  assert.equal(delivered.valid, false);
  assert.ok(delivered.errors.some((error) => /delivered non-PASS review/.test(error)));

  const empty = join(subject.root, '.artifacts/tools/claude-native', randomUUID());
  mkdirSync(empty);
  const malformed = builderLinkedTo(passingReview());
  assert.equal(malformed.valid, false);
  assert.ok(malformed.errors.some((error) => /unreadable native task/.test(error)));

  // The hooks skip a task copied from another checkout; linked-review settlement still refuses one
  // that names this subject.
  rmSync(empty, { recursive: true });
  plantForeignTask(subject.root, subject.registered.taskId);
  const foreign = builderLinkedTo(passingReview());
  assert.equal(foreign.valid, false);
  assert.ok(foreign.errors.some((error) => /unreadable native task/.test(error)));
});
test('a task copied from another checkout blocks a linked builder only when it may be its review', (t) => {
  const subject = writer(t);
  handle(subject);
  writeFileSync(join(subject.root, 'sample.txt'), 'allowed output');
  finish(subject);
  const observation = JSON.parse(
    readFileSync(join(subject.registered.evidenceDirectory, 'completion.json')),
  );
  const packet = reviewPacket(subject, observation.finalSnapshot);
  const qa = reviewer(t, subject, packet);
  const result = reviewResult(packet, 'unknown');
  handle(qa);
  finish(qa, { content: [{ type: 'text', text: JSON.stringify(result) }] });
  const semantic = semanticResult(qa);
  semantic.reviewResult = result;
  assert.equal(
    completeClaudeNativeTask(qa.registered.taskId, semantic, { root: qa.root }).valid,
    true,
  );
  const base = join(realpathSync(subject.root), '.artifacts/tools/claude-native');
  const linkBuilder = () => {
    const builder = semanticResult(subject);
    builder.results[0].changedPaths = ['sample.txt'];
    builder.reviewerTaskId = qa.registered.taskId;
    return completeClaudeNativeTask(subject.registered.taskId, builder, { root: subject.root });
  };
  const refusedFor = (id) => {
    const outcome = linkBuilder();
    assert.equal(outcome.valid, false);
    assert.deepEqual(outcome.errors, [`unreadable native task: ${id}`]);
  };

  const naming = plantForeignTask(subject.root, subject.registered.taskId);
  refusedFor(naming);
  rmSync(join(base, naming), { recursive: true });

  const elsewhere = mkdtempSync(join(tmpdir(), 'knu-foreign-'));
  t.after(() => rmSync(elsewhere, { recursive: true, force: true }));
  const real = plantForeignTask(elsewhere);
  const linked = randomUUID();
  symlinkSync(
    join(realpathSync(elsewhere), '.artifacts/tools/claude-native', real),
    join(base, linked),
  );
  refusedFor(linked);
  rmSync(join(base, linked));

  // A record of this checkout that fails its digest is damaged, not copied.
  const tampered = plantForeignTask(subject.root);
  const tamperedPath = join(base, tampered, 'task.json');
  const copy = JSON.parse(readFileSync(tamperedPath));
  copy.record.root = realpathSync(subject.root);
  writeFileSync(tamperedPath, JSON.stringify(copy));
  refusedFor(tampered);
  rmSync(join(base, tampered), { recursive: true });

  for (const text of [
    '{"record":',
    '{"record":{"version":1}}',
    '{"record":{"root":""}}',
    '{"record":{"root":"moved/checkout"}}',
  ]) {
    const garbled = randomUUID();
    mkdirSync(join(base, garbled));
    writeFileSync(join(base, garbled, 'task.json'), text);
    refusedFor(garbled);
    rmSync(join(base, garbled), { recursive: true });
  }

  plantForeignTask(subject.root);
  plantForeignTask(subject.root, randomUUID());
  const unrelated = linkBuilder();
  assert.deepEqual(
    { valid: unrelated.valid, errors: unrelated.errors },
    { valid: true, errors: [] },
  );
});
function reviewedSubject(t) {
  const subject = writer(t);
  handle(subject);
  writeFileSync(join(subject.root, 'sample.txt'), 'allowed output');
  finish(subject);
  const observation = JSON.parse(
    readFileSync(join(subject.registered.evidenceDirectory, 'completion.json')),
  );
  const packet = reviewPacket(subject, observation.finalSnapshot);
  const builderLinkedTo = (qa) => {
    const semantic = semanticResult(subject);
    semantic.results[0].changedPaths = ['sample.txt'];
    semantic.reviewerTaskId = qa.registered.taskId;
    return completeClaudeNativeTask(subject.registered.taskId, semantic, { root: subject.root });
  };
  return { subject, packet, builderLinkedTo };
}
function completedReview(t, subject, packet, verdict = 'PASS') {
  const qa = reviewer(t, subject, packet);
  const result = reviewResult(packet, 'unknown', verdict);
  handle(qa);
  finish(qa, { content: [{ type: 'text', text: JSON.stringify(result) }] });
  const semantic = semanticResult(qa);
  semantic.reviewResult = result;
  assert.equal(
    completeClaudeNativeTask(qa.registered.taskId, semantic, { root: qa.root }).valid,
    true,
  );
  return qa;
}
// Settles a reviewer through SubagentStop + parent notification, as ordinary auto does.
function asyncReview(t, subject, packet, parentRows = [], effort = 'xhigh', padding = '') {
  const qa = reviewer(t, subject, packet);
  const result = reviewResult(packet, 'unknown');
  const agentId = `review-${randomUUID().slice(0, 8)}`;
  handle(qa);
  finish(qa, { status: 'async_launched', agentId, prompt: qa.registered.invocation.prompt });
  const base = join(realpathSync(qa.root), '.artifacts/transcripts'),
    childDir = join(base, qa.event.session_id, 'subagents');
  mkdirSync(childDir, { recursive: true });
  const childPath = join(childDir, `agent-${agentId}.jsonl`),
    parentPath = join(base, `${qa.event.session_id}.jsonl`);
  const childRows = [
    {
      type: 'user',
      sessionId: qa.event.session_id,
      agentId,
      message: { content: qa.registered.invocation.prompt },
    },
    // A long tool result, as a researcher reading many pages produces.
    ...(padding
      ? [
          {
            type: 'user',
            sessionId: qa.event.session_id,
            agentId,
            message: {
              content: [{ type: 'tool_result', tool_use_id: 'toolu_pad', content: padding }],
            },
          },
        ]
      : []),
    {
      type: 'assistant',
      sessionId: qa.event.session_id,
      agentId,
      ...(effort === null ? {} : { effort }),
      message: {
        model: qa.options.expectedResolvedModel,
        content: [{ type: 'text', text: JSON.stringify(result) }],
      },
    },
  ];
  writeFileSync(childPath, childRows.map((r) => JSON.stringify(r)).join('\n') + '\n');
  const notification = {
    type: 'user',
    sessionId: qa.event.session_id,
    message: {
      content: `<task-notification>\n<task-id>${agentId}</task-id>\n<tool-use-id>${qa.event.tool_use_id}</tool-use-id>\n<status>completed</status>\n</task-notification>`,
    },
  };
  const extraRows = typeof parentRows === 'function' ? parentRows(qa) : parentRows;
  writeFileSync(
    parentPath,
    [...extraRows, notification].map((r) => JSON.stringify(r)).join('\n') + '\n',
  );
  handle(qa, {
    hook_event_name: 'SubagentStop',
    session_id: qa.event.session_id,
    cwd: qa.root,
    agent_id: agentId,
    agent_type: 'knu_reviewer',
    agent_transcript_path: childPath,
    transcript_path: parentPath,
  });
  // A background settlement failure names its reason here instead of a missing completion file.
  assert.ok(
    existsSync(join(qa.registered.evidenceDirectory, 'completion.json')),
    observeClaudeNativeTask(qa.registered.taskId, { root: qa.root }).errors.join(','),
  );
  const semantic = semanticResult(qa);
  semantic.reviewResult = result;
  const completed = completeClaudeNativeTask(qa.registered.taskId, semantic, { root: qa.root });
  // Only a child that ran at the reviewer role's effort completes.
  assert.equal(completed.valid, effort === 'xhigh', completed.errors.join(','));
  return qa;
}

test('undispatched, PASS and failed-call sibling reviews do not block a PASS review', (t) => {
  const { subject, packet, builderLinkedTo } = reviewedSubject(t);
  reviewer(t, subject, packet); // registered, never dispatched
  completedReview(t, subject, packet, 'PASS');
  const failedCall = reviewer(t, subject, packet);
  handle(failedCall);
  handle(failedCall, { ...failedCall.event, hook_event_name: 'PostToolUseFailure' });
  const linked = builderLinkedTo(completedReview(t, subject, packet));
  assert.equal(linked.valid, true, linked.errors.join(','));
});

test('released attempts and malformed sibling receipts block without throwing', (t) => {
  const { subject, packet, builderLinkedTo } = reviewedSubject(t);
  const released = reviewer(t, subject, packet);
  handle(released);
  releaseClaudeNativeTask(released.registered.taskId, { root: released.root, ended: true });
  const pending = builderLinkedTo(completedReview(t, subject, packet));
  assert.ok(pending.errors.some((error) => /unsettled or released review attempt/.test(error)));

  const second = reviewedSubject(t);
  const broken = completedReview(t, second.subject, second.packet);
  writeFileSync(join(broken.registered.evidenceDirectory, 'review-receipt.json'), '{');
  let result;
  assert.doesNotThrow(() => {
    result = second.builderLinkedTo(completedReview(t, second.subject, second.packet));
  });
  assert.ok(result.errors.some((error) => /FAIL review receipt/.test(error)));

  // Only an error-only failed call is exempt; failed content and unreadable completions still block.
  for (const damage of ['failed-with-content', 'malformed-completion']) {
    const third = reviewedSubject(t);
    const sibling = reviewer(t, third.subject, third.packet);
    handle(sibling);
    finish(sibling, {
      status: damage === 'failed-with-content' ? 'failed' : 'completed',
      content: [
        { type: 'text', text: JSON.stringify(reviewResult(third.packet, 'unknown', 'FAIL')) },
      ],
    });
    if (damage === 'malformed-completion')
      writeFileSync(join(sibling.registered.evidenceDirectory, 'completion.json'), '{');
    let linked;
    assert.doesNotThrow(() => {
      linked = third.builderLinkedTo(completedReview(t, third.subject, third.packet));
    });
    const expected =
      damage === 'malformed-completion' ? /unreadable native task/ : /delivered non-PASS review/;
    assert.ok(
      linked.errors.some((error) => expected.test(error)),
      damage,
    );
  }
});

test('a sibling review dispatched while hooks were not running blocks the linked PASS', (t) => {
  const { subject, packet, builderLinkedTo } = reviewedSubject(t);
  const unseen = reviewer(t, subject, packet); // hooks never recorded this dispatch
  const agentCall = (prompt) => ({
    type: 'assistant',
    sessionId: subject.event.session_id,
    message: { content: [{ type: 'tool_use', id: 'x', name: 'Agent', input: { prompt } }] },
  });
  const mentioned = {
    type: 'user',
    sessionId: subject.event.session_id,
    message: { content: [{ type: 'tool_result', content: unseen.registered.invocation.prompt }] },
  };
  const quiet = builderLinkedTo(asyncReview(t, subject, packet, [mentioned]));
  assert.equal(quiet.valid, true, quiet.errors.join(','));
  const shopped = builderLinkedTo(
    asyncReview(t, subject, packet, [agentCall(unseen.registered.invocation.prompt)]),
  );
  assert.equal(shopped.valid, false);
  assert.ok(shopped.errors.some((error) => /dispatch not observed by hooks/.test(error)));
});

test('the unseen-dispatch check ignores denied or non-Agent calls and blocks when unreadable', (t) => {
  const { subject, packet, builderLinkedTo } = reviewedSubject(t);
  const sibling = reviewer(t, subject, packet);
  const marker = sibling.registered.invocation.prompt;
  const row = (type, content) => ({
    type,
    sessionId: subject.event.session_id,
    message: { content },
  });
  const denied = [
    row('assistant', [
      { type: 'tool_use', id: 'denied-1', name: 'Agent', input: { prompt: marker } },
    ]),
    row('user', [
      {
        type: 'tool_result',
        tool_use_id: 'denied-1',
        is_error: true,
        content: 'KNU native task: expired binding',
      },
    ]),
    row('assistant', [
      { type: 'tool_use', id: 'bash-1', name: 'Bash', input: { command: `echo '${marker}'` } },
    ]),
  ];
  // A long Lead session: unrelated rows beyond the old 8 MiB cap must not block settlement.
  denied.unshift(row('user', 'x'.repeat(9 * 1024 * 1024)));
  const quiet = builderLinkedTo(asyncReview(t, subject, packet, denied));
  assert.equal(quiet.valid, true, quiet.errors.join(','));

  const settled = asyncReview(t, subject, packet);
  const parentPath = join(
    realpathSync(subject.root),
    '.artifacts/transcripts',
    `${subject.event.session_id}.jsonl`,
  );
  writeFileSync(parentPath, readFileSync(parentPath, 'utf8') + `{${marker}\n`);
  const malformed = builderLinkedTo(settled);
  assert.equal(malformed.valid, false);
  assert.ok(malformed.errors.some((error) => /review dispatch check unavailable/.test(error)));
  rmSync(parentPath);
  const missing = builderLinkedTo(settled);
  assert.ok(missing.errors.some((error) => /review dispatch check unavailable/.test(error)));
});

test('a hook-less retry of an attempted or linked reviewer blocks; a refused attempt does not', (t) => {
  const row = (subject, type, content) => ({
    type,
    sessionId: subject.event.session_id,
    message: { content },
  });
  const call = (subject, id, prompt, isError) => [
    row(subject, 'assistant', [{ type: 'tool_use', id, name: 'Agent', input: { prompt } }]),
    row(subject, 'user', [
      {
        type: 'tool_result',
        tool_use_id: id,
        is_error: isError,
        content: isError ? 'denied' : 'ok',
      },
    ]),
  ];

  // Sibling failed once with hooks healthy, then ran again while PreToolUse was down.
  const retried = reviewedSubject(t);
  const sibling = reviewer(t, retried.subject, retried.packet);
  handle(sibling);
  handle(sibling, { ...sibling.event, hook_event_name: 'PostToolUseFailure' });
  const siblingRetry = call(
    retried.subject,
    'retry-1',
    sibling.registered.invocation.prompt,
    false,
  );
  const shopped = retried.builderLinkedTo(
    asyncReview(t, retried.subject, retried.packet, siblingRetry),
  );
  assert.ok(
    shopped.errors.some((e) => /not observed by hooks: .*/.test(e)),
    shopped.errors.join(),
  );

  // The linked reviewer's own second, unobserved call.
  const self = reviewedSubject(t);
  const selfRetry = self.builderLinkedTo(
    asyncReview(t, self.subject, self.packet, (qa) =>
      call(self.subject, 'retry-2', qa.registered.invocation.prompt, false),
    ),
  );
  assert.ok(
    selfRetry.errors.some((e) => /not observed by hooks/.test(e)),
    selfRetry.errors.join(),
  );

  // The same unobserved retry made with the short agent input, which is all the transcript holds.
  const shortSelf = reviewedSubject(t);
  const shortRetry = shortSelf.builderLinkedTo(
    asyncReview(t, shortSelf.subject, shortSelf.packet, (qa) =>
      call(shortSelf.subject, 'retry-short', qa.registered.agentInput.prompt, false),
    ),
  );
  assert.ok(
    shortRetry.errors.some((e) => /not observed by hooks/.test(e)),
    shortRetry.errors.join(),
  );

  // PreToolUse recorded the call, then a later permission step refused it: no Post event follows.
  const refused = reviewedSubject(t);
  const blocked = reviewer(t, refused.subject, refused.packet);
  blocked.event = { ...blocked.event, tool_use_id: 'refused-1' };
  handle(blocked);
  const refusal = call(refused.subject, 'refused-1', blocked.registered.invocation.prompt, true);
  const linked = refused.builderLinkedTo(asyncReview(t, refused.subject, refused.packet, refusal));
  assert.equal(linked.valid, true, linked.errors.join(','));

  // A refused attempt made with the short agent input is matched the same way.
  const refusedShort = reviewedSubject(t);
  const blockedShort = reviewer(t, refusedShort.subject, refusedShort.packet);
  blockedShort.event = {
    ...blockedShort.event,
    tool_use_id: 'refused-short',
    tool_input: blockedShort.registered.agentInput,
  };
  // The reviewer's short input must really reach injection, or the row below passes vacuously.
  assert.deepEqual(
    handle(blockedShort).hookSpecificOutput?.updatedInput,
    blockedShort.registered.invocation,
  );
  const shortRefusal = call(
    refusedShort.subject,
    'refused-short',
    blockedShort.registered.agentInput.prompt,
    true,
  );
  const linkedShort = refusedShort.builderLinkedTo(
    asyncReview(t, refusedShort.subject, refusedShort.packet, shortRefusal),
  );
  assert.equal(linkedShort.valid, true, linkedShort.errors.join(','));
  const running = call(refused.subject, 'refused-1', blocked.registered.invocation.prompt, false);
  const pending = refused.builderLinkedTo(asyncReview(t, refused.subject, refused.packet, running));
  assert.ok(pending.errors.some((e) => /unsettled or released review attempt/.test(e)));
});

test('an undrifted background PASS sibling does not block another PASS review', (t) => {
  const { subject, packet, builderLinkedTo } = reviewedSubject(t);
  asyncReview(t, subject, packet);
  const linked = builderLinkedTo(asyncReview(t, subject, packet));
  assert.equal(linked.valid, true, linked.errors.join(','));
});

test('a foreground-completed reviewer cannot be resumed and its unreadable completion blocks', (t) => {
  const { subject, packet, builderLinkedTo } = reviewedSubject(t);
  const settled = completedReview(t, subject, packet);
  const resume = handle(settled, {
    ...settled.event,
    tool_name: 'SendMessage',
    tool_input: { to: agentIdOf(settled), message: 'resume' },
  });
  assert.equal(resume.hookSpecificOutput.permissionDecision, 'deny');
  // Messaging a child the registry never bound (for example an OMC child) stays untouched.
  assert.deepEqual(
    handle(settled, {
      ...settled.event,
      tool_name: 'SendMessage',
      tool_input: { to: 'unrelated-omc-agent', message: 'hello' },
    }),
    {},
  );
  writeFileSync(join(settled.registered.evidenceDirectory, 'completion.json'), '{');
  const linked = builderLinkedTo(completedReview(t, subject, packet));
  assert.ok(
    linked.errors.some((e) => /unreadable native task/.test(e)),
    linked.errors.join(),
  );
});

test('a settled sibling review resumed afterwards blocks a later PASS', (t) => {
  const { subject, packet, builderLinkedTo } = reviewedSubject(t);
  const resumed = asyncReview(t, subject, packet);
  const proof = JSON.parse(
    readFileSync(join(resumed.registered.evidenceDirectory, 'transcript-proof.json')),
  );
  writeFileSync(proof.path, readFileSync(proof.path, 'utf8') + '{"type":"assistant"}\n');
  const linked = builderLinkedTo(asyncReview(t, subject, packet));
  assert.equal(linked.valid, false);
  assert.ok(linked.errors.some((e) => /child transcript changed after settlement/.test(e)));
});

test('each reviewer session transcript is compared for synchronous and cross-session reviews', (t) => {
  const { subject, packet, builderLinkedTo } = reviewedSubject(t);
  const base = join(realpathSync(subject.root), '.artifacts/transcripts');
  mkdirSync(base, { recursive: true });
  const call = (sessionId, id, prompt, isError) =>
    [
      {
        type: 'assistant',
        sessionId,
        message: { content: [{ type: 'tool_use', id, name: 'Agent', input: { prompt } }] },
      },
      {
        type: 'user',
        sessionId,
        message: {
          content: [{ type: 'tool_result', tool_use_id: id, is_error: isError, content: 'x' }],
        },
      },
    ]
      .map((r) => JSON.stringify(r))
      .join('\n') + '\n';

  // A sibling in another session: PreToolUse recorded it, then a later permission step refused it.
  const otherSession = randomUUID();
  const otherPath = join(base, `${otherSession}.jsonl`);
  const refused = reviewer(t, subject, packet, { sessionId: otherSession });
  refused.event = { ...refused.event, tool_use_id: 'refused-x', transcript_path: otherPath };
  handle(refused);
  writeFileSync(
    otherPath,
    call(otherSession, 'refused-x', refused.registered.invocation.prompt, true),
  );

  // The linked reviewer completes synchronously in the subject's session.
  const mainPath = join(base, `${subject.event.session_id}.jsonl`);
  writeFileSync(mainPath, '');
  const qa = reviewer(t, subject, packet);
  qa.event = { ...qa.event, transcript_path: mainPath };
  const result = reviewResult(packet, 'unknown');
  handle(qa);
  finish(qa, { content: [{ type: 'text', text: JSON.stringify(result) }] });
  const semantic = semanticResult(qa);
  semantic.reviewResult = result;
  assert.equal(
    completeClaudeNativeTask(qa.registered.taskId, semantic, { root: qa.root }).valid,
    true,
  );
  const clean = builderLinkedTo(qa);
  assert.equal(clean.valid, true, clean.errors.join(','));

  // A hook-less retry of that sibling in its own session is still caught.
  writeFileSync(
    otherPath,
    readFileSync(otherPath, 'utf8') +
      call(otherSession, 'retry-x', refused.registered.invocation.prompt, false),
  );
  const shopped = builderLinkedTo(qa);
  assert.ok(
    shopped.errors.some((e) => /not observed by hooks/.test(e)),
    shopped.errors.join(),
  );
});

test('a parent transcript above the cap is a gap, not a pass', (t) => {
  const { subject, packet, builderLinkedTo } = reviewedSubject(t);
  const settled = asyncReview(t, subject, packet);
  const parentPath = join(
    realpathSync(subject.root),
    '.artifacts/transcripts',
    `${subject.event.session_id}.jsonl`,
  );
  truncateSync(parentPath, 128 * 1024 * 1024 + 1); // sparse; refused before it is read
  const result = builderLinkedTo(settled);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => /review dispatch check unavailable/.test(e)));
});

test('reviewer completion requires a delivered JSON object, not a falsy JSON value', (t) => {
  const subject = writer(t);
  handle(subject);
  writeFileSync(join(subject.root, 'sample.txt'), 'allowed output');
  finish(subject);
  const observation = JSON.parse(
    readFileSync(join(subject.registered.evidenceDirectory, 'completion.json')),
  );
  const qa = reviewer(t, subject, reviewPacket(subject, observation.finalSnapshot));
  handle(qa);
  finish(qa, { content: [{ type: 'text', text: 'null' }] });
  const semantic = semanticResult(qa);
  semantic.reviewResult = null;
  const completion = completeClaudeNativeTask(qa.registered.taskId, semantic, { root: qa.root });
  assert.equal(completion.valid, false);
  assert.ok(completion.errors.some((error) => /JSON object/.test(error)));
});
test('reviewer registration rejects the reviewer as runner and unbound packet scope', (t) => {
  const subject = writer(t);
  handle(subject);
  writeFileSync(join(subject.root, 'sample.txt'), 'allowed output');
  finish(subject);
  const observation = JSON.parse(
    readFileSync(join(subject.registered.evidenceDirectory, 'completion.json')),
  );
  const packet = reviewPacket(subject, observation.finalSnapshot);
  const selfRunner = structuredClone(packet);
  selfRunner.authority.runnerOwner = 'reviewer';
  assert.throws(() => reviewer(t, subject, selfRunner), /reviewer cannot be the packet runner/);
  const objective = structuredClone(packet);
  objective.objective = 'different request';
  assert.throws(() => reviewer(t, subject, objective), /objective mismatch/);
  const writerMismatch = structuredClone(packet);
  writerMismatch.authority.writeOwner = 'someone-else';
  assert.throws(() => reviewer(t, subject, writerMismatch), /writer\/builders mismatch/);
  const wider = structuredClone(packet);
  wider.boundaries.allowedReadPaths = ['sample.txt', 'other.txt'];
  assert.throws(() => reviewer(t, subject, wider), /exceeds reviewer task scope/);
  const uncovered = structuredClone(packet);
  uncovered.boundaries.allowedReadPaths = ['other.txt'];
  assert.throws(
    () => reviewer(t, subject, uncovered, { readScope: ['other.txt'] }),
    /does not cover subject changes/,
  );
  const qa = reviewer(t, subject, packet);
  assert.throws(
    () => reviewer(t, qa, reviewPacket(qa, observation.finalSnapshot)),
    /reviewer-of-reviewer/,
  );
});
test('one native writer at a time, allowed writes observed, independent QA cannot be omitted', (t) => {
  const f = writer(t);
  const other = registerClaudeNativeTask({
    ...f.options,
    workflowInput: f.input,
    sessionId: f.event.session_id,
  });
  assert.deepEqual(handle(f), {});
  assert.equal(
    handle(f, { ...f.event, tool_use_id: 'write-2', tool_input: other.invocation })
      .hookSpecificOutput.permissionDecision,
    'deny',
  );
  writeFileSync(join(f.root, 'sample.txt'), 'allowed output');
  finish(f);
  const r = semanticResult(f);
  r.results[0].changedPaths = ['sample.txt'];
  const checked = completeClaudeNativeTask(f.registered.taskId, r, { root: f.root });
  assert.equal(checked.observation.valid, true);
  assert.ok(checked.errors.includes('independent QA exchange required'));
  f.input.reviewDisposition.required = false;
  assert.throws(
    () =>
      registerClaudeNativeTask({ ...f.options, workflowInput: f.input, sessionId: randomUUID() }),
    /independent QA/,
  );
});
test('actual hook CLI returns no allow on good and deny on missing model', (t) => {
  const f = setup(t);
  const script = new URL('../../../agents/claude/native-session.mjs', import.meta.url).pathname;
  const good = spawnSync(process.execPath, [script, '--hook'], {
    cwd: f.root,
    env: { ...process.env, CLAUDE_PROJECT_DIR: f.root },
    input: JSON.stringify(f.event),
    encoding: 'utf8',
  });
  assert.equal(good.status, 0, good.stderr);
  assert.deepEqual(JSON.parse(good.stdout), {});
  delete f.event.tool_input.model;
  const bad = spawnSync(process.execPath, [script, '--hook'], {
    cwd: f.root,
    env: { ...process.env, CLAUDE_PROJECT_DIR: f.root },
    input: JSON.stringify(f.event),
    encoding: 'utf8',
  });
  assert.equal(bad.status, 0);
  assert.equal(JSON.parse(bad.stdout).hookSpecificOutput.permissionDecision, 'deny');
});

test('writer replay cannot strand a lease and tool failure releases only its writer', (t) => {
  const f = writer(t);
  handle(f);
  finish(f);
  assert.equal(handle(f).hookSpecificOutput.permissionDecision, 'deny');
  const other = registerClaudeNativeTask({
    ...f.options,
    workflowInput: f.input,
    sessionId: f.event.session_id,
  });
  const event = { ...f.event, tool_use_id: 'write-next', tool_input: other.invocation };
  assert.deepEqual(handle(f, event), {});
  handle(f, { ...event, hook_event_name: 'PostToolUseFailure', error: 'synthetic failure' });
  const third = registerClaudeNativeTask({
    ...f.options,
    workflowInput: f.input,
    sessionId: f.event.session_id,
  });
  assert.deepEqual(
    handle(f, { ...event, tool_use_id: 'write-third', tool_input: third.invocation }),
    {},
  );
  assert.throws(() => releaseClaudeNativeTask(third.taskId, { root: f.root }), /ended/);
  assert.equal(
    releaseClaudeNativeTask(third.taskId, { root: f.root, ended: true }).completed,
    false,
  );
});
test('duplicate completion invalidates the result instead of silently preserving an earlier PASS', (t) => {
  const f = setup(t);
  handle(f);
  finish(f);
  const input = semanticResult(f);
  assert.equal(completeClaudeNativeTask(f.registered.taskId, input, { root: f.root }).valid, true);
  finish(f);
  assert.equal(completeClaudeNativeTask(f.registered.taskId, input, { root: f.root }).valid, false);
});

test('ordinary executor new files are fingerprinted without staging, then common QA remains required', (t) => {
  const f = writer(t);
  f.input.directAssignment.writeOwnership = ['new.txt'];
  f.input.nativeRequest.task.writeScope = ['new.txt'];
  const r = registerClaudeNativeTask({
    ...f.options,
    workflowInput: f.input,
    sessionId: f.event.session_id,
  });
  f.registered = r;
  f.event.tool_input = r.invocation;
  assert.deepEqual(handle(f), {});
  writeFileSync(join(f.root, 'new.txt'), 'new output');
  finish(f);
  const input = semanticResult(f);
  input.results[0].changedPaths = ['new.txt'];
  const checked = completeClaudeNativeTask(r.taskId, input, { root: f.root });
  assert.equal(checked.observation.valid, true, JSON.stringify(checked.errors));
  // Against HEAD the fixture's staged role files are new too; new.txt is fingerprinted among them.
  assert.ok(
    checked.observation.finalSnapshot.untrackedInputDigests.some(({ path }) => path === 'new.txt'),
  );
  assert.deepEqual(checked.errors, [
    'native required QA requires linked reviewerTaskId',
    'independent QA exchange required',
  ]);
});

test('foreign completion and async child do not release a live writer lease', (t) => {
  const f = writer(t);
  handle(f);
  const next = registerClaudeNativeTask({
    ...f.options,
    workflowInput: f.input,
    sessionId: f.event.session_id,
  });
  handle(f, { ...f.event, hook_event_name: 'PostToolUseFailure', tool_use_id: 'foreign-tool' });
  const event = { ...f.event, tool_use_id: 'write-next', tool_input: next.invocation };
  assert.equal(handle(f, event).hookSpecificOutput.permissionDecision, 'deny');
  finish(f, { status: 'async_launched' });
  assert.equal(handle(f, event).hookSpecificOutput.permissionDecision, 'deny');
  releaseClaudeNativeTask(f.registered.taskId, { root: f.root, ended: true });
  assert.deepEqual(handle(f, event), {});
});

for (const stopFirst of [false, true])
  test(`async stop/notification association, stopFirst=${stopFirst}`, (t) => {
    const f = setup(t);
    handle(f);
    const agentId = 'async-child';
    const launch = {
      ...f.event,
      hook_event_name: 'PostToolUse',
      tool_response: {
        status: 'async_launched',
        agentId,
        resolvedModel: f.options.expectedResolvedModel,
        prompt: f.registered.invocation.prompt,
      },
    };
    if (!stopFirst) handle(f, launch);
    assert.equal(completeClaudeNativeTask(f.registered.taskId, {}, { root: f.root }).valid, false);
    const base = join(realpathSync(f.root), '.artifacts/transcripts'),
      childDir = join(base, f.event.session_id, 'subagents');
    mkdirSync(childDir, { recursive: true });
    const childPath = join(childDir, `agent-${agentId}.jsonl`),
      parentPath = join(base, `${f.event.session_id}.jsonl`);
    const rows = [
      {
        type: 'user',
        sessionId: f.event.session_id,
        agentId,
        message: { content: f.registered.invocation.prompt },
      },
      {
        type: 'assistant',
        sessionId: f.event.session_id,
        agentId,
        message: {
          model: f.options.expectedResolvedModel,
          content: [{ type: 'text', text: 'oracle' }],
        },
      },
    ];
    writeFileSync(childPath, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
    writeFileSync(parentPath, '');
    const stop = {
      hook_event_name: 'SubagentStop',
      session_id: f.event.session_id,
      cwd: f.root,
      agent_id: agentId,
      agent_type: f.registered.invocation.subagent_type,
      agent_transcript_path: childPath,
      transcript_path: parentPath,
    };
    handle(f, stop);
    if (stopFirst) handle(f, launch);
    assert.equal(completeClaudeNativeTask(f.registered.taskId, {}, { root: f.root }).valid, false);
    writeFileSync(
      parentPath,
      JSON.stringify({
        type: 'user',
        sessionId: f.event.session_id,
        message: {
          content: `<task-notification>\n<task-id>${agentId}</task-id>\n<tool-use-id>${f.event.tool_use_id}</tool-use-id>\n<status>completed</status>\n</task-notification>`,
        },
      }) + '\n',
    );
    completeClaudeNativeTask(f.registered.taskId, {}, { root: f.root });
    assert.equal(
      completeClaudeNativeTask(f.registered.taskId, semanticResult(f), { root: f.root }).valid,
      true,
    );
    assert.equal(
      handle(f, {
        ...f.event,
        tool_name: 'SendMessage',
        tool_input: { to: agentId, message: 'resume' },
      }).hookSpecificOutput.permissionDecision,
      'deny',
    );
    writeFileSync(childPath, readFileSync(childPath) + '{}\n');
    assert.equal(
      completeClaudeNativeTask(f.registered.taskId, semanticResult(f), { root: f.root }).valid,
      false,
    );
  });

for (const damage of ['intact', 'oversized', 'malformed'])
  test(`settlement of a ${damage} parent transcript`, (t) => {
    const f = setup(t);
    handle(f);
    const agentId = 'async-cap';
    handle(f, {
      ...f.event,
      hook_event_name: 'PostToolUse',
      tool_response: {
        status: 'async_launched',
        agentId,
        resolvedModel: f.options.expectedResolvedModel,
        prompt: f.registered.invocation.prompt,
      },
    });
    const base = join(realpathSync(f.root), '.artifacts/transcripts'),
      childDir = join(base, f.event.session_id, 'subagents');
    mkdirSync(childDir, { recursive: true });
    const childPath = join(childDir, `agent-${agentId}.jsonl`),
      parentPath = join(base, `${f.event.session_id}.jsonl`);
    const childRows = [
      {
        type: 'user',
        sessionId: f.event.session_id,
        agentId,
        message: { content: f.registered.invocation.prompt },
      },
      {
        type: 'assistant',
        sessionId: f.event.session_id,
        agentId,
        message: {
          model: f.options.expectedResolvedModel,
          content: [{ type: 'text', text: 'oracle' }],
        },
      },
    ];
    writeFileSync(childPath, childRows.map((r) => JSON.stringify(r)).join('\n') + '\n');
    const notification = JSON.stringify({
      type: 'user',
      sessionId: f.event.session_id,
      message: {
        content: `<task-notification>\n<task-id>${agentId}</task-id>\n<tool-use-id>${f.event.tool_use_id}</tool-use-id>\n<status>completed</status>\n</task-notification>`,
      },
    });
    // A malformed row naming the child must not be skipped; an oversized file is refused before reading.
    writeFileSync(
      parentPath,
      (damage === 'malformed' ? `{"agent":"${agentId}"\n` : '') + notification + '\n',
    );
    if (damage === 'oversized') truncateSync(parentPath, 128 * 1024 * 1024 + 1);
    handle(f, {
      hook_event_name: 'SubagentStop',
      session_id: f.event.session_id,
      cwd: f.root,
      agent_id: agentId,
      agent_type: f.registered.invocation.subagent_type,
      agent_transcript_path: childPath,
      transcript_path: parentPath,
    });
    const result = completeClaudeNativeTask(
      f.registered.taskId,
      {},
      {
        root: f.root,
      },
    );
    // The intact control uses the same fixture and must settle, so a refusal below comes from the damage.
    if (damage === 'intact') {
      assert.ok(existsSync(join(f.registered.evidenceDirectory, 'completion.json')));
      assert.ok(!result.errors.includes('no-completion-observation'), result.errors.join());
      return;
    }
    assert.equal(result.valid, false);
    assert.ok(result.errors.includes('no-completion-observation'), result.errors.join());
  });

test('native input key order does not break actual hook association', (t) => {
  const f = setup(t);
  f.event.tool_input = Object.fromEntries(Object.entries(f.event.tool_input).reverse());
  assert.deepEqual(handle(f), {});
  finish(f);
  assert.equal(
    completeClaudeNativeTask(f.registered.taskId, semanticResult(f), { root: f.root }).valid,
    true,
  );
});

test('registration names the concrete policy reason instead of only the generic gap', (t) => {
  const cases = [
    [
      (f) => {
        f.input.nativeRequest.expiresAt = new Date(Date.now() + 31 * 60000).toISOString();
      },
      /binding-lifetime-exceeds-30m/,
    ],
    [
      (f) => {
        f.input.nativeRequest.task.facts[0].sourceRef = '.hidden/supporting/x.md';
      },
      /unsafe-reference:nativeRequest\.task\.facts\[0\]\.sourceRef/,
    ],
    [
      (f) => {
        f.input.nativeRequest.selectionBasisRef = '.hidden/x.md';
      },
      /unsafe-reference:nativeRequest\.selectionBasisRef/,
    ],
    [
      (f) => {
        f.input.request = 'sample.txt 보안 정책 영향을 분석해줘.';
      },
      /risk-downgrade/,
    ],
  ];
  for (const [mutate, reason] of cases) {
    const f = fixture(t);
    mutate(f);
    assert.throws(
      () =>
        registerClaudeNativeTask({ ...f.options, workflowInput: f.input, sessionId: randomUUID() }),
      (error) =>
        reason.test(error.message) && /strict-native-dispatch-not-qualified/.test(error.message),
    );
  }
});

// Registration-to-settlement changes outside the child's write scope cannot be told apart from a
// Parent edit. A writer's are refused as unattributable. A read-only task depends only on the files
// it was given or seen reading, so a change elsewhere (another session's edit or commit) is recorded
// in its dependency judgment instead; the stored completion stays repository-wide.
function readOnlyWithOtherFile(t) {
  const f = fixture(t);
  writeFileSync(join(f.root, '.git/info/exclude'), '.artifacts/\n');
  writeFileSync(join(f.root, 'other.txt'), 'outside read scope');
  mkdirSync(join(f.root, 'dir'));
  writeFileSync(join(f.root, 'dir/a.txt'), 'under a searched directory');
  execFileSync('git', ['add', 'other.txt', 'dir/a.txt'], { cwd: f.root });
  execFileSync(
    'git',
    ['-c', 'user.name=T', '-c', 'user.email=t@example.invalid', 'commit', '-qm', 'other'],
    { cwd: f.root },
  );
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: f.root, encoding: 'utf8' }).trim();
  Object.assign(f.input.currentSnapshot, { baseSHA: head, headSHA: head });
  f.input.nativeRequest.task.readScope = ['sample.txt', 'in-scope-new.txt'];
  const sessionId = randomUUID();
  const registered = registerClaudeNativeTask({ ...f.options, workflowInput: f.input, sessionId });
  return {
    ...f,
    registered,
    event: {
      hook_event_name: 'PreToolUse',
      session_id: sessionId,
      cwd: f.root,
      permission_mode: 'auto',
      tool_name: 'Agent',
      tool_use_id: 'tool-1',
      tool_input: registered.invocation,
    },
  };
}
const commitIn = (root, ...paths) => {
  execFileSync('git', ['add', '--', ...paths], { cwd: root });
  execFileSync(
    'git',
    [
      '-c',
      'user.name=T',
      '-c',
      'user.email=t@example.invalid',
      'commit',
      '-qm',
      'c',
      '--',
      ...paths,
    ],
    { cwd: root },
  );
};
for (const [kind, path, change] of [
  ['tracked edit in read scope', 'sample.txt', (p) => writeFileSync(p, 'parent edit')],
  ['new file in read scope', 'in-scope-new.txt', (p) => writeFileSync(p, 'new')],
  ['deletion in read scope', 'sample.txt', (p) => rmSync(p)],
])
  test(`unattributable change: ${kind}`, (t) => {
    const f = readOnlyWithOtherFile(t);
    handle(f);
    change(join(f.root, path));
    finish(f);
    const observed = JSON.parse(
      readFileSync(join(f.registered.evidenceDirectory, 'completion.json')),
    );
    assert.deepEqual(observed.errors, [`unattributable-change:${path}`]);
    assert.deepEqual(observed.changedPaths, []);
    const checked = completeClaudeNativeTask(f.registered.taskId, semanticResult(f), {
      root: f.root,
    });
    assert.equal(checked.valid, false);
    assert.ok(checked.errors.includes(`unattributable-change:${path}`), checked.errors.join());
    assert.ok(!checked.errors.includes('reported-change-path-mismatch'), checked.errors.join());
    assert.ok(!checked.errors.some((e) => e.startsWith('outside-write')), checked.errors.join());
    assert.deepEqual(checked.dependencyJudgment.inside, [path]);
  });
for (const [kind, path, change] of [
  ['tracked edit outside its reads', 'other.txt', (p) => writeFileSync(p, 'parent edit')],
  ['new file outside its reads', 'outside-new.txt', (p) => writeFileSync(p, 'new')],
  ['deletion outside its reads', 'other.txt', (p) => rmSync(p)],
])
  test(`a read-only task records a ${kind} and settles`, (t) => {
    const f = readOnlyWithOtherFile(t);
    handle(f);
    change(join(f.root, path));
    finish(f);
    const observed = JSON.parse(
      readFileSync(join(f.registered.evidenceDirectory, 'completion.json')),
    );
    // The stored observation stays repository-wide; a recovery binding still reads it.
    assert.deepEqual(observed.errors, [`unattributable-change:${path}`]);
    const checked = completeClaudeNativeTask(f.registered.taskId, semanticResult(f), {
      root: f.root,
    });
    assert.equal(checked.valid, true, checked.errors.join());
    assert.equal(checked.dependencyJudgment.basis, 'dependency');
    assert.deepEqual(checked.dependencyJudgment.inside, []);
    assert.deepEqual(checked.dependencyJudgment.outside, [path]);
    assert.equal(checked.dependencyJudgment.headChanged, false);
  });

test('a writer changing only its write scope has no unattributable change at either point', (t) => {
  const f = writer(t);
  handle(f);
  writeFileSync(join(f.root, 'sample.txt'), 'allowed output');
  finish(f);
  const observed = JSON.parse(
    readFileSync(join(f.registered.evidenceDirectory, 'completion.json')),
  );
  assert.deepEqual(observed.errors, []);
  assert.deepEqual(observed.changedPaths, ['sample.txt']);
  const input = semanticResult(f);
  input.results[0].changedPaths = ['sample.txt'];
  const checked = completeClaudeNativeTask(f.registered.taskId, input, { root: f.root });
  assert.ok(
    !checked.errors.some((e) => e.startsWith('unattributable-change')),
    checked.errors.join(),
  );
  assert.ok(!checked.errors.includes('reported-change-path-mismatch'), checked.errors.join());
});

test('a writer still refuses a change outside its write scope as unattributable', (t) => {
  const f = writer(t);
  handle(f);
  writeFileSync(join(f.root, 'sample.txt'), 'allowed output');
  writeFileSync(join(f.root, 'outside-new.txt'), 'another session');
  finish(f);
  const input = semanticResult(f);
  input.results[0].changedPaths = ['sample.txt'];
  const checked = completeClaudeNativeTask(f.registered.taskId, input, { root: f.root });
  assert.equal(checked.valid, false);
  assert.ok(
    checked.errors.includes('unattributable-change:outside-new.txt'),
    checked.errors.join(),
  );
  assert.equal(checked.dependencyJudgment.basis, 'repository');
});

// After the child stopped, settle --judgment and complete both judge drift over the dependencies.
const explorerJudgment = (f) => ({
  responseDigest: JSON.parse(readFileSync(join(f.registered.evidenceDirectory, 'completion.json')))
    .responseDigest,
  acceptance: [
    {
      criterion: f.registered.workflow.lanes[0].acceptance[0],
      passed: true,
      evidenceRef: 'fixture:independent-oracle',
    },
  ],
  checks: ['independent oracle compared'],
});
for (const via of ['complete', 'settle --judgment'])
  for (const [kind, path, change, inside] of [
    [
      'an edit outside its reads',
      'other.txt',
      (p) => writeFileSync(p, 'parent edit after stop'),
      false,
    ],
    ['a new file outside its reads', 'outside-new.txt', (p) => writeFileSync(p, 'new'), false],
    [
      'an edit in its read scope',
      'sample.txt',
      (p) => writeFileSync(p, 'parent edit after stop'),
      true,
    ],
  ])
    test(`after a read-only child stopped, ${kind} through ${via}`, (t) => {
      const f = readOnlyWithOtherFile(t);
      handle(f);
      finish(f);
      change(join(f.root, path));
      const checked =
        via === 'complete'
          ? completeClaudeNativeTask(f.registered.taskId, semanticResult(f), { root: f.root })
          : settleClaudeNativeTask(f.registered.taskId, explorerJudgment(f), { root: f.root });
      assert.deepEqual(
        JSON.parse(readFileSync(join(f.registered.evidenceDirectory, 'completion.json'))).errors,
        [],
      );
      if (inside) {
        assert.equal(checked.valid, false);
        assert.ok(checked.errors.includes('post-completion-file-drift'), checked.errors.join());
        assert.deepEqual(checked.dependencyJudgment.inside, [path]);
        return;
      }
      assert.equal(checked.valid, true, checked.errors.join());
      assert.deepEqual(checked.dependencyJudgment.outside, [path]);
      // The fan-in source reasons this change raised are replaced by the judgment and recorded.
      assert.ok(checked.dependencyJudgment.replacedSourceGaps.length > 0);
      for (const gap of checked.dependencyJudgment.replacedSourceGaps)
        assert.match(
          gap,
          /^(?:current-source-head-mismatch|current-source-diff-mismatch|current-untracked-input-mismatch)$/u,
        );
    });

for (const [kind, path, inside] of [
  ['outside its reads', 'other.txt', false],
  ['in its read scope', 'sample.txt', true],
])
  test(`a commit ${kind} after a read-only child stopped`, (t) => {
    const f = readOnlyWithOtherFile(t);
    handle(f);
    finish(f);
    writeFileSync(join(f.root, path), 'committed by another session');
    commitIn(f.root, path);
    const checked = completeClaudeNativeTask(f.registered.taskId, semanticResult(f), {
      root: f.root,
    });
    assert.equal(checked.dependencyJudgment.headChanged, true);
    assert.equal(checked.valid, !inside, checked.errors.join());
    if (!inside)
      assert.ok(
        checked.dependencyJudgment.replacedSourceGaps.includes('current-source-head-mismatch'),
      );
  });

// What the child's transcript shows it reading joins the dependencies: a Read file, everything under
// a Grep or Glob directory. A search without a path or another tool falls back to the repository.
const readOnlyTools = {
  'a file it read': (root) => [{ name: 'Read', input: { file_path: join(root, 'other.txt') } }],
  'a directory it searched': (root) => [
    { name: 'Grep', input: { pattern: 'a', path: join(realpathSync(root), 'dir') } },
  ],
};
for (const [kind, path] of [
  ['a file it read', 'other.txt'],
  ['a directory it searched', 'dir/a.txt'],
])
  for (const when of ['during the run', 'after it stopped'])
    test(`a read-only task refuses a change to ${kind} ${when}`, (t) => {
      const f = readOnlyWithOtherFile(t);
      handle(f);
      if (when === 'during the run') writeFileSync(join(f.root, path), 'changed');
      finish(f, {}, { tools: readOnlyTools[kind](f.root) });
      if (when === 'after it stopped') writeFileSync(join(f.root, path), 'changed');
      const checked = completeClaudeNativeTask(f.registered.taskId, semanticResult(f), {
        root: f.root,
      });
      assert.equal(checked.valid, false);
      assert.ok(
        checked.errors.includes(
          when === 'during the run'
            ? `unattributable-change:${path}`
            : 'post-completion-file-drift',
        ),
        checked.errors.join(),
      );
      assert.equal(checked.dependencyJudgment.basis, 'dependency');
      assert.deepEqual(checked.dependencyJudgment.inside, [path]);
    });

test('a file beside a searched directory stays outside the dependencies', (t) => {
  const f = readOnlyWithOtherFile(t);
  handle(f);
  writeFileSync(join(f.root, 'other.txt'), 'changed');
  finish(f, {}, { tools: readOnlyTools['a directory it searched'](f.root) });
  const checked = completeClaudeNativeTask(f.registered.taskId, semanticResult(f), {
    root: f.root,
  });
  assert.equal(checked.valid, true, checked.errors.join());
  assert.deepEqual(checked.dependencyJudgment.outside, ['other.txt']);
});

// A hand-back (how a live child delivers its answer) and web tools read no repository file, so the
// dependency judgment holds with them; a live read-only settlement depends on this.
test('a read-only task with a hand-back and web tools keeps the dependency judgment', (t) => {
  const f = readOnlyWithOtherFile(t);
  handle(f);
  writeFileSync(join(f.root, 'other.txt'), 'changed');
  finish(
    f,
    {},
    {
      tools: [
        { name: 'WebSearch', input: { query: 'oracle' } },
        { name: 'WebFetch', input: { url: 'https://example.invalid/', prompt: 'read' } },
        { name: 'SubagentHandback', input: { message: 'oracle' } },
      ],
    },
  );
  const checked = completeClaudeNativeTask(f.registered.taskId, semanticResult(f), {
    root: f.root,
  });
  assert.equal(checked.valid, true, checked.errors.join());
  assert.equal(checked.dependencyJudgment.basis, 'dependency');
  assert.deepEqual(checked.dependencyJudgment.outside, ['other.txt']);
});

for (const [kind, child, reason] of [
  [
    'a search of the repository root',
    { tools: (root) => [{ name: 'Grep', input: { pattern: 'a', path: realpathSync(root) } }] },
    'whole-repository:Grep',
  ],
  [
    'a search of a directory above the repository',
    {
      tools: (root) => [
        { name: 'Glob', input: { pattern: '*', path: dirname(realpathSync(root)) } },
      ],
    },
    'whole-repository:Glob',
  ],
  [
    'a read of a case variant of a file name',
    { tools: (root) => [{ name: 'Read', input: { file_path: join(root, 'OTHER.txt') } }] },
    'case-variant:Read',
  ],
])
  test(`a read-only task with ${kind} is judged over the whole repository`, (t) => {
    const f = readOnlyWithOtherFile(t);
    handle(f);
    writeFileSync(join(f.root, 'other.txt'), 'changed');
    finish(f, {}, { tools: child.tools(f.root) });
    const checked = completeClaudeNativeTask(f.registered.taskId, semanticResult(f), {
      root: f.root,
    });
    assert.equal(checked.valid, false);
    assert.ok(checked.errors.includes('unattributable-change:other.txt'), checked.errors.join());
    assert.deepEqual(
      [checked.dependencyJudgment.basis, checked.dependencyJudgment.reason],
      ['repository', reason],
    );
  });

for (const [kind, child] of [
  ['a search without a path', { tools: [{ name: 'Glob', input: { pattern: '**/*.txt' } }] }],
  [
    'a tool it cannot attribute',
    { tools: [{ name: 'Bash', input: { command: 'cat other.txt' } }] },
  ],
  ['no child transcript', { write: false }],
])
  test(`a read-only task with ${kind} is judged over the whole repository`, (t) => {
    const f = readOnlyWithOtherFile(t);
    handle(f);
    writeFileSync(join(f.root, 'other.txt'), 'changed');
    finish(f, {}, child);
    const checked = completeClaudeNativeTask(f.registered.taskId, semanticResult(f), {
      root: f.root,
    });
    assert.equal(checked.valid, false);
    assert.ok(checked.errors.includes('unattributable-change:other.txt'), checked.errors.join());
    assert.equal(checked.dependencyJudgment.basis, 'repository');
    assert.equal(typeof checked.dependencyJudgment.reason, 'string');
  });

test('a change outside a read-only task before its call still makes the workflow stale', (t) => {
  const f = readOnlyWithOtherFile(t);
  writeFileSync(join(f.root, 'other.txt'), 'another session');
  const out = handle(f);
  assert.equal(out.hookSpecificOutput.permissionDecision, 'deny');
  assert.match(out.hookSpecificOutput.permissionDecisionReason, /stale workflow/u);
});

test('a read-only task still refuses adapter identity drift outside its reads', (t) => {
  const f = readOnlyWithOtherFile(t);
  handle(f);
  finish(f);
  writeRole(
    f.root,
    f.registered.invocation.subagent_type,
    'Read, Grep, Glob',
    'Changed after the child stopped.',
  );
  const checked = completeClaudeNativeTask(f.registered.taskId, semanticResult(f), {
    root: f.root,
  });
  assert.equal(checked.valid, false);
  assert.ok(checked.errors.includes('adapter/role/settings drift'), checked.errors.join());
});

test('a read-only fan-in keeps its other gaps', (t) => {
  const f = readOnlyWithOtherFile(t);
  handle(f);
  finish(f);
  writeFileSync(join(f.root, 'other.txt'), 'parent edit after stop');
  const input = semanticResult(f);
  input.results[0].laneId = 'another-lane';
  const checked = completeClaudeNativeTask(f.registered.taskId, input, { root: f.root });
  assert.equal(checked.valid, false);
  assert.ok(
    !checked.errors.some((e) => /^current-(?:source|untracked)-/u.test(e)),
    checked.errors.join(),
  );
});

// A native reviewer's result is compared with its packet snapshot: a change outside the reviewer's
// dependencies (during its run or after it stopped, an edit or a commit) does not void it; a change
// to a file it reads does. The builder's own completion check stays repository-wide.
for (const [kind, path, change, inside] of [
  ['a new file outside its reads during the run', 'outside-new.txt', 'during', false],
  ['a new file outside its reads after it stopped', 'outside-new.txt', 'after', false],
  ['a commit outside its reads after it stopped', 'outside-new.txt', 'commit', false],
  ['an edit to its read path during the run', 'sample.txt', 'during', true],
  ['an edit to its read path after it stopped', 'sample.txt', 'after', true],
])
  test(`native reviewer complete with ${kind}`, (t) => {
    const { subject, packet, builderLinkedTo } = reviewedSubject(t);
    const qa = reviewer(t, subject, packet);
    const result = reviewResult(packet, qa.options.expectedResolvedModel);
    handle(qa);
    if (change === 'during') writeFileSync(join(qa.root, path), 'changed');
    finish(qa, { content: [{ type: 'text', text: JSON.stringify(result) }] });
    if (change === 'after') writeFileSync(join(qa.root, path), 'changed');
    if (change === 'commit') {
      writeFileSync(join(qa.root, path), 'committed');
      commitIn(qa.root, path);
    }
    const semantic = semanticResult(qa);
    semantic.reviewResult = result;
    const checked = completeClaudeNativeTask(qa.registered.taskId, semantic, { root: qa.root });
    assert.equal(checked.valid, !inside, checked.errors.join());
    if (inside) return;
    assert.deepEqual(checked.dependencyJudgment.outside, [path]);
    assert.equal(checked.dependencyJudgment.headChanged, change === 'commit');
    if (change === 'during')
      assert.ok(
        builderLinkedTo(qa).errors.includes('review snapshot mismatch'),
        'the builder still compares the review receipt with its own final snapshot',
      );
  });

function asyncStopped(t, notificationRow) {
  const f = setup(t);
  handle(f);
  const agentId = 'resumed-child';
  handle(f, {
    ...f.event,
    hook_event_name: 'PostToolUse',
    tool_response: {
      status: 'async_launched',
      agentId,
      resolvedModel: f.options.expectedResolvedModel,
      prompt: f.registered.invocation.prompt,
    },
  });
  const base = join(realpathSync(f.root), '.artifacts/transcripts'),
    childDir = join(base, f.event.session_id, 'subagents');
  mkdirSync(childDir, { recursive: true });
  const childPath = join(childDir, `agent-${agentId}.jsonl`),
    parentPath = join(base, `${f.event.session_id}.jsonl`);
  const rows = [
    {
      type: 'user',
      sessionId: f.event.session_id,
      agentId,
      message: { content: f.registered.invocation.prompt },
    },
    {
      type: 'assistant',
      sessionId: f.event.session_id,
      agentId,
      message: {
        model: f.options.expectedResolvedModel,
        content: [{ type: 'text', text: 'oracle' }],
      },
    },
  ];
  writeFileSync(childPath, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
  const prompt = `<task-notification>\n<task-id>${agentId}</task-id>\n<tool-use-id>${f.event.tool_use_id}</tool-use-id>\n<status>completed</status>\n</task-notification>`;
  writeFileSync(
    parentPath,
    JSON.stringify(notificationRow({ sessionId: f.event.session_id, prompt })) + '\n',
  );
  handle(f, {
    hook_event_name: 'SubagentStop',
    session_id: f.event.session_id,
    cwd: f.root,
    agent_id: agentId,
    agent_type: f.registered.invocation.subagent_type,
    agent_transcript_path: childPath,
    transcript_path: parentPath,
  });
  return { ...f, childPath, parentPath };
}
const attachmentRow =
  (processSessionId) =>
  ({ sessionId, prompt }) => ({
    type: 'attachment',
    isSidechain: false,
    sessionId,
    session_id: processSessionId ?? sessionId,
    attachment: { type: 'queued_command', commandMode: 'task-notification', prompt },
  });

test('a resumed session notification settles: row sessionId matches, process session_id differs', (t) => {
  const f = asyncStopped(t, attachmentRow(randomUUID()));
  assert.ok(existsSync(join(f.registered.evidenceDirectory, 'completion.json')));
  assert.equal(
    completeClaudeNativeTask(f.registered.taskId, semanticResult(f), { root: f.root }).valid,
    true,
  );
});

test('a notification whose row sessionId or process id is foreign does not settle', (t) => {
  for (const row of [
    ({ prompt }) => ({ ...attachmentRow()({ sessionId: randomUUID(), prompt }) }),
    ({ sessionId, prompt }) => ({ ...attachmentRow('not-a-session')({ sessionId, prompt }) }),
  ]) {
    const f = asyncStopped(t, row);
    const result = completeClaudeNativeTask(f.registered.taskId, {}, { root: f.root });
    assert.equal(result.valid, false);
    assert.ok(result.errors.includes('no-completion-observation'), result.errors.join());
    assert.ok(
      result.errors.includes(
        'stopped-task-settlement-failed: matching task completion notification required',
      ),
      result.errors.join(),
    );
  }
});

test('complete names the stopped-task settlement failure instead of hiding it', (t) => {
  const f = asyncStopped(t, attachmentRow());
  // The hook settled; a fresh stop with a changed child transcript is refused and reported.
  rmSync(join(f.registered.evidenceDirectory, 'completion.json'));
  rmSync(join(f.registered.evidenceDirectory, 'transcript-proof.json'));
  writeFileSync(
    f.childPath,
    readFileSync(f.childPath, 'utf8').replace(/claude-haiku/gu, 'claude-sonnet'),
  );
  const result = completeClaudeNativeTask(f.registered.taskId, {}, { root: f.root });
  assert.ok(result.errors.includes('no-completion-observation'), result.errors.join());
  assert.ok(
    result.errors.includes('stopped-task-settlement-failed: transcript model mismatch'),
    result.errors.join(),
  );
});

test('an async launch mismatch names the expected and observed model', (t) => {
  const f = setup(t);
  handle(f);
  const out = handle(f, {
    ...f.event,
    hook_event_name: 'PostToolUse',
    tool_response: {
      status: 'async_launched',
      agentId: 'async-other-model',
      resolvedModel: 'claude-haiku-9',
      prompt: f.registered.invocation.prompt,
    },
  });
  assert.match(
    out.hookSpecificOutput.additionalContext,
    new RegExp(
      `async launch model mismatch: expected ${f.options.expectedResolvedModel}, observed claude-haiku-9`,
    ),
  );
});

// A task directory copied from another checkout, a damaged record or a broken launch file must not
// stop unmanaged messaging or another child's stop from being recorded. Completion still refuses it.
const hookScript = new URL('../../../agents/claude/native-session.mjs', import.meta.url).pathname;
function runHook(root, event, env = {}) {
  return spawnSync(process.execPath, [hookScript, '--hook'], {
    cwd: root,
    env: { ...process.env, CLAUDE_PROJECT_DIR: root, ...env },
    input: JSON.stringify(event),
    encoding: 'utf8',
  });
}
function plantForeignTask(root, subjectTaskId) {
  const id = randomUUID();
  const dir = join(realpathSync(root), '.artifacts/tools/claude-native', id);
  mkdirSync(dir, { recursive: true });
  const independentReview = subjectTaskId === undefined ? undefined : { subjectTaskId };
  writeFileSync(
    join(dir, 'task.json'),
    JSON.stringify({
      record: { version: 1, taskId: id, root: '/moved/checkout', independentReview },
      invocation: { prompt: 'x' },
    }),
  );
  return id;
}
// Registers a launched background child whose stop has not been seen yet.
function launchedChild(t, agentId = 'async-child', preInput) {
  const f = setup(t);
  handle(f, preInput ? { ...f.event, tool_input: preInput(f.registered.invocation) } : f.event);
  handle(f, {
    ...f.event,
    hook_event_name: 'PostToolUse',
    tool_response: {
      status: 'async_launched',
      agentId,
      resolvedModel: f.options.expectedResolvedModel,
      prompt: f.registered.invocation.prompt,
    },
  });
  const base = join(realpathSync(f.root), '.artifacts/transcripts'),
    childDir = join(base, f.event.session_id, 'subagents');
  mkdirSync(childDir, { recursive: true });
  const childPath = join(childDir, `agent-${agentId}.jsonl`),
    parentPath = join(base, `${f.event.session_id}.jsonl`);
  const rows = [
    {
      type: 'user',
      sessionId: f.event.session_id,
      agentId,
      message: { content: f.registered.invocation.prompt },
    },
    {
      type: 'assistant',
      sessionId: f.event.session_id,
      agentId,
      message: {
        model: f.options.expectedResolvedModel,
        content: [{ type: 'text', text: 'oracle' }],
      },
    },
  ];
  writeFileSync(childPath, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
  writeFileSync(parentPath, '');
  const stop = {
    hook_event_name: 'SubagentStop',
    session_id: f.event.session_id,
    cwd: realpathSync(f.root),
    agent_id: agentId,
    agent_type: f.registered.invocation.subagent_type,
    agent_transcript_path: childPath,
    transcript_path: parentPath,
    stop_hook_active: false,
  };
  const notify = () =>
    writeFileSync(
      parentPath,
      JSON.stringify({
        type: 'user',
        sessionId: f.event.session_id,
        message: {
          content: `<task-notification>\n<task-id>${agentId}</task-id>\n<tool-use-id>${f.event.tool_use_id}</tool-use-id>\n<status>completed</status>\n</task-notification>`,
        },
      }) + '\n',
    );
  return { ...f, agentId, stop, notify };
}
const stopRecorded = (f) => existsSync(join(f.registered.evidenceDirectory, 'stop.json'));

test('a foreign task does not block messaging a child the registry never bound', (t) => {
  const f = setup(t);
  plantForeignTask(f.root);
  const run = runHook(realpathSync(f.root), {
    ...f.event,
    cwd: realpathSync(f.root),
    tool_name: 'SendMessage',
    tool_input: { to: 'unrelated-omc-agent', message: 'hello' },
  });
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(JSON.parse(run.stdout), {});
});

test('a foreign task does not stop a registered child from recording its stop and settling', (t) => {
  const f = launchedChild(t);
  plantForeignTask(f.root);
  const run = runHook(realpathSync(f.root), f.stop);
  assert.equal(run.status, 0, run.stderr);
  assert.ok(stopRecorded(f), 'stop.json is written for the registered child');
  f.notify();
  completeClaudeNativeTask(f.registered.taskId, {}, { root: f.root });
  const done = completeClaudeNativeTask(f.registered.taskId, semanticResult(f), { root: f.root });
  assert.equal(done.valid, true, done.errors?.join(','));
});

test('a SubagentStop hook error is a non-blocking exit 1, not a blocking exit 2', (t) => {
  const f = launchedChild(t);
  const sub = join(realpathSync(f.root), 'sub');
  mkdirSync(sub, { recursive: true });
  const run = runHook(realpathSync(f.root), { ...f.stop, cwd: sub });
  assert.equal(run.status, 1);
  assert.match(run.stderr, /KNU hook failed: invalid stop identity/u);
  assert.equal(stopRecorded(f), false);
  // Without a stop record the completion boundary still refuses the task.
  f.notify();
  const result = completeClaudeNativeTask(f.registered.taskId, {}, { root: f.root });
  assert.equal(result.valid, false);
});

test('a broken launch file of another task does not stop a registered child from recording its stop', (t) => {
  const f = launchedChild(t);
  const other = registerClaudeNativeTask({
    ...f.options,
    workflowInput: f.input,
    sessionId: f.event.session_id,
  });
  writeFileSync(join(other.evidenceDirectory, 'launch.json'), '{');
  const run = runHook(realpathSync(f.root), f.stop);
  assert.equal(run.status, 0, run.stderr);
  assert.ok(stopRecorded(f));
});

test('a bound child stays unresumable while a foreign task is present', (t) => {
  const f = launchedChild(t);
  plantForeignTask(f.root);
  assert.equal(
    handle(f, {
      ...f.event,
      tool_name: 'SendMessage',
      tool_input: { to: f.agentId, message: 'resume' },
    }).hookSpecificOutput.permissionDecision,
    'deny',
  );
});

test('a damaged task is skipped by the message guard but its completion is refused', (t) => {
  const f = launchedChild(t);
  const path = join(f.registered.evidenceDirectory, 'task.json');
  const stored = JSON.parse(readFileSync(path));
  stored.record.request = 'tampered';
  writeFileSync(path, JSON.stringify(stored));
  assert.deepEqual(
    handle(f, {
      ...f.event,
      tool_name: 'SendMessage',
      tool_input: { to: f.agentId, message: 'resume' },
    }),
    {},
  );
  assert.throws(
    () => completeClaudeNativeTask(f.registered.taskId, {}, { root: f.root }),
    /task digest mismatch/u,
  );
});

test('PostToolUse hook errors keep exit 2, which shows stderr to Claude without blocking', (t) => {
  const f = setup(t);
  const run = runHook(
    realpathSync(f.root),
    { ...f.event, hook_event_name: 'PostToolUse', tool_response: { status: 'completed' } },
    { CLAUDE_PROJECT_DIR: join(realpathSync(f.root), 'missing') },
  );
  assert.equal(run.status, 2);
  assert.match(run.stderr, /KNU hook failed/u);
});

// The Lead may call Agent with a short input that names the registered task; PreToolUse injects the
// registered invocation. The short input is built here from the invocation itself, not from any
// field the helper returns, so it exists before the change too.
const shortInput = ({ description, subagent_type, model, prompt }) => ({
  description,
  subagent_type,
  model,
  prompt: prompt.slice(prompt.lastIndexOf('KNU_NATIVE_TASK:')),
});
const denial = (out) => out.hookSpecificOutput?.permissionDecisionReason;

test('a short agent input is checked and replaced by the registered invocation without allow', (t) => {
  const f = setup(t);
  const out = handle(f, { ...f.event, tool_input: shortInput(f.registered.invocation) });
  assert.equal(denial(out), undefined, denial(out));
  assert.deepEqual(out, {
    hookSpecificOutput: { hookEventName: 'PreToolUse', updatedInput: f.registered.invocation },
  });
  assert.deepEqual(f.registered.agentInput, shortInput(f.registered.invocation));
  // PostToolUse reports the injected input; the attempt was recorded against it.
  finish(f);
  const status = completeClaudeNativeTask(f.registered.taskId, {}, { root: f.root });
  assert.equal(status.observation.valid, true, status.errors.join(','));
});

test('a background child started from the short input records its stop and settles', (t) => {
  const f = launchedChild(t, 'short-child', shortInput);
  assert.equal(handle(f, f.stop).hookSpecificOutput, undefined);
  f.notify();
  completeClaudeNativeTask(f.registered.taskId, {}, { root: f.root });
  const status = completeClaudeNativeTask(f.registered.taskId, semanticResult(f), {
    root: f.root,
  });
  assert.equal(status.observation.valid, true, status.errors.join(','));
  assert.equal(status.valid, true, status.errors.join(','));
});

test('SessionStart points the Lead at prepare and the short agent input', (t) => {
  const f = setup(t);
  const context = handle(f, {
    hook_event_name: 'SessionStart',
    session_id: f.event.session_id,
    cwd: f.root,
  }).hookSpecificOutput.additionalContext;
  assert.match(context, /pnpm claude:native prepare --spec <JSON file>/u);
  assert.match(context, /agentInput/u);
  assert.doesNotMatch(context, /register --input/u);
  // The skills are the routine entry; the helper command stays as their low-level form.
  for (const skill of ['/knu-delegate', '/knu-review', '/knu-settle'])
    assert.ok(context.includes(skill), skill);
  for (const boundary of [
    'Registration is not permission approval',
    'do not substitute them for a required KNU role',
    'Missing/error hook is not fail-closed',
  ])
    assert.ok(context.includes(boundary), boundary);
});

// Every PreToolUse gate refuses the short input for the same reason as the full invocation.
const gates = [
  ['missing model', /native input\/model mismatch/u, (e) => delete e.tool_input.model],
  ['wrong model', /native input\/model mismatch/u, (e) => (e.tool_input.model = 'opus')],
  [
    'foreign role',
    /native input\/model mismatch/u,
    (e) => (e.tool_input.subagent_type = 'knu_reviewer'),
  ],
  ['background', /native input\/model mismatch/u, (e) => (e.tool_input.run_in_background = true)],
  ['changed description', /native input\/model mismatch/u, (e) => (e.tool_input.description = 'x')],
  ['foreign session', /foreign session\/root/u, (e) => (e.session_id = randomUUID())],
  [
    'permission drift',
    /expected auto permission mode/u,
    (e) => (e.permission_mode = 'bypassPermissions'),
  ],
  ['missing tool id', /missing tool id/u, (e) => delete e.tool_use_id],
  [
    'stale source (stale workflow)',
    /stale workflow/u,
    (e, f) => writeFileSync(join(f.root, 'sample.txt'), 'different'),
  ],
  [
    'adapter drift',
    /adapter\/role\/settings drift/u,
    (e, f) =>
      writeFileSync(
        join(f.root, '.claude/agents', `${f.registered.invocation.subagent_type}.md`),
        'changed role\n',
      ),
  ],
  [
    'expired binding',
    /expired binding/u,
    (e, f, t) => t.mock.timers.enable({ apis: ['Date'], now: Date.now() + 10 * 60 * 1000 }),
  ],
  [
    'forced ambient model',
    /conflicting ambient forced model/u,
    () => {
      const saved = {
        CLAUDE_CODE_SUBAGENT_MODEL_FORCE: process.env.CLAUDE_CODE_SUBAGENT_MODEL_FORCE,
        CLAUDE_CODE_SUBAGENT_MODEL: process.env.CLAUDE_CODE_SUBAGENT_MODEL,
      };
      process.env.CLAUDE_CODE_SUBAGENT_MODEL_FORCE = '1';
      process.env.CLAUDE_CODE_SUBAGENT_MODEL = 'claude-other-1';
      return () => {
        for (const [key, value] of Object.entries(saved))
          if (value === undefined) delete process.env[key];
          else process.env[key] = value;
      };
    },
  ],
  [
    'replay',
    /task already attempted/u,
    (e, f) => handle(f, { ...e, tool_input: f.registered.invocation, tool_use_id: 'first' }),
  ],
];
for (const [name, reason, mutate] of gates)
  test(`the short input and the full invocation are both refused for ${name}`, (t) => {
    const reasons = ['full', 'short'].map((mode) => {
      const f = setup(t);
      const event = structuredClone({
        ...f.event,
        tool_input:
          mode === 'short' ? shortInput(f.registered.invocation) : f.registered.invocation,
      });
      const restore = mutate(event, f, t);
      try {
        return denial(handle(f, event));
      } finally {
        if (typeof restore === 'function') restore();
        t.mock.timers.reset();
      }
    });
    assert.match(reasons[0] ?? '', reason, `full: ${reasons[0]}`);
    assert.equal(reasons[1], reasons[0]);
  });

test('the short input and the full invocation are both refused for input file drift', (t) => {
  const reasons = ['full', 'short'].map((mode) => {
    const f = fixture(t);
    writeFileSync(join(f.root, '.git/info/exclude'), '.artifacts/\nnotes.local\n');
    writeFileSync(join(f.root, 'notes.local'), 'before');
    f.input.nativeRequest.task.readScope = ['sample.txt', 'notes.local'];
    const sessionId = randomUUID();
    const registered = registerClaudeNativeTask({
      ...f.options,
      workflowInput: f.input,
      sessionId,
    });
    writeFileSync(join(f.root, 'notes.local'), 'after');
    return denial(
      handleClaudeNativeSessionEvent(
        {
          hook_event_name: 'PreToolUse',
          session_id: sessionId,
          cwd: f.root,
          permission_mode: 'auto',
          tool_name: 'Agent',
          tool_use_id: 'tool-1',
          tool_input: mode === 'short' ? shortInput(registered.invocation) : registered.invocation,
        },
        { root: f.root },
      ),
    );
  });
  assert.match(reasons[0] ?? '', /input file drift/u, `full: ${reasons[0]}`);
  assert.equal(reasons[1], reasons[0]);
});

// Prompt gates: each input form gets its own malformed prompt; both must be refused for the same reason.
for (const [name, reason, full, short] of [
  [
    'an unregistered prompt',
    /registered task required/u,
    () => 'no registration',
    (p) => `${p} and more`,
  ],
  [
    'a changed prompt or digest',
    /native input\/model mismatch/u,
    (p) => `changed\n${p}`,
    (p) => p.replace(/sha256:[a-f0-9]{64}$/u, `sha256:${'0'.repeat(64)}`),
  ],
  [
    'an unknown task id',
    /no such file or directory/u,
    (p, id) => `x\n\nKNU_NATIVE_TASK:${id}:sha256:${'0'.repeat(64)}`,
    (p, id) => `KNU_NATIVE_TASK:${id}:sha256:${'0'.repeat(64)}`,
  ],
])
  test(`the short input and the full invocation are both refused for ${name}`, (t) => {
    const unknown = randomUUID();
    const reasons = [full, short].map((change, index) => {
      const f = setup(t);
      const input =
        index === 0 ? { ...f.registered.invocation } : shortInput(f.registered.invocation);
      input.prompt = change(input.prompt, unknown);
      const out = handle(f, { ...f.event, tool_input: input });
      assert.equal(out.hookSpecificOutput.updatedInput, undefined);
      return denial(out)?.replace(realpathSync(f.root), '<root>');
    });
    assert.match(reasons[0] ?? '', reason, `full: ${reasons[0]}`);
    assert.equal(reasons[1], reasons[0]);
  });

for (const [name, edit] of [
  [
    'prompt',
    (invocation) => (invocation.prompt = `Do something else.\n\n${shortInput(invocation).prompt}`),
  ],
  ['extra key', (invocation) => (invocation.run_in_background = true)],
])
  test(`an edited task.json ${name} is not injected for a short input`, (t) => {
    const f = setup(t);
    const path = join(f.registered.evidenceDirectory, 'task.json');
    const task = JSON.parse(readFileSync(path, 'utf8'));
    edit(task.invocation);
    writeFileSync(path, JSON.stringify(task));
    const out = handle(f, { ...f.event, tool_input: shortInput(f.registered.invocation) });
    assert.equal(denial(out), 'KNU native task: task digest mismatch');
    assert.equal(out.hookSpecificOutput.updatedInput, undefined);
  });

test('a writer lease held by another task refuses the short input like the full invocation', (t) => {
  const reasons = ['full', 'short'].map((mode) => {
    const f = writer(t);
    const other = registerClaudeNativeTask({
      ...f.options,
      workflowInput: f.input,
      sessionId: f.event.session_id,
    });
    handle(f, { ...f.event, tool_input: other.invocation, tool_use_id: 'other' });
    return denial(
      handle(f, {
        ...f.event,
        tool_input:
          mode === 'short' ? shortInput(f.registered.invocation) : f.registered.invocation,
      }),
    );
  });
  // The lease path differs per fixture root, so only the reason itself is compared.
  const [full, short] = reasons.map((r) => r?.replace(/'[^']*'/u, '<writer lease>'));
  assert.match(full ?? '', /EEXIST: file already exists, open <writer lease>/u, `full: ${full}`);
  assert.equal(short, full);
});

// Without the injection, or when another hook rewrote the input afterwards, PostToolUse sees an input
// other than the registered invocation. Completion is refused whatever the reported reason is.
for (const [name, reported, input] of [
  ['the short input itself', /NOT VERIFIED: registered task required/u, (i) => shortInput(i)],
  [
    'another rewrite that keeps the marker',
    /NOT VERIFIED: native input\/model mismatch/u,
    (i) => ({ ...i, prompt: `other\n\n${shortInput(i).prompt}` }),
  ],
  [
    'a rewrite that drops the role and marker',
    null,
    (i) => ({ ...i, subagent_type: 'Explore', prompt: 'other' }),
  ],
])
  test(`PostToolUse with ${name} is not verified and completion is refused`, (t) => {
    const f = setup(t);
    handle(f, { ...f.event, tool_input: shortInput(f.registered.invocation) });
    const out = handle(f, {
      ...f.event,
      hook_event_name: 'PostToolUse',
      tool_input: input(f.registered.invocation),
      tool_response: { status: 'completed', agentId: 'child-1', content: [] },
    });
    if (reported) assert.match(out.hookSpecificOutput.additionalContext, reported);
    else assert.deepEqual(out, {});
    const status = completeClaudeNativeTask(f.registered.taskId, {}, { root: f.root });
    assert.deepEqual(status.observation.errors, ['no-completion-observation']);
    assert.equal(status.valid, false);
  });

test('a writer lease left by a rewritten input is freed only by an explicit release', (t) => {
  const f = writer(t);
  handle(f, { ...f.event, tool_input: shortInput(f.registered.invocation) });
  handle(f, {
    ...f.event,
    hook_event_name: 'PostToolUseFailure',
    tool_input: shortInput(f.registered.invocation),
  });
  const next = registerClaudeNativeTask({
    ...f.options,
    workflowInput: f.input,
    sessionId: f.event.session_id,
  });
  const nextEvent = { ...f.event, tool_input: next.invocation, tool_use_id: 'next' };
  assert.equal(handle(f, nextEvent).hookSpecificOutput?.permissionDecision, 'deny');
  releaseClaudeNativeTask(f.registered.taskId, { root: f.root, ended: true });
  assert.deepEqual(handle(f, nextEvent), {});
});

test('a failed call started from the short input is recorded as a failed observation', (t) => {
  const f = setup(t);
  handle(f, { ...f.event, tool_input: shortInput(f.registered.invocation) });
  handle(f, { ...f.event, hook_event_name: 'PostToolUseFailure' });
  const completion = JSON.parse(
    readFileSync(join(f.registered.evidenceDirectory, 'completion.json'), 'utf8'),
  );
  assert.equal(completion.valid, false);
  assert.equal(completion.completionSource, 'PostToolUseFailure');
});

test('a background launch that reports another prompt is refused', (t) => {
  const f = setup(t);
  handle(f);
  const out = handle(f, {
    ...f.event,
    hook_event_name: 'PostToolUse',
    tool_response: {
      status: 'async_launched',
      agentId: 'async-other-prompt',
      resolvedModel: f.options.expectedResolvedModel,
      prompt: 'another prompt',
    },
  });
  assert.match(out.hookSpecificOutput.additionalContext, /async launch prompt mismatch/u);
});

// The file guard runs as its own CLI entry, so these tests spawn it instead of importing it.
function runGuard(root, event, input = JSON.stringify(event)) {
  return spawnSync(process.execPath, [hookScript, '--hook', '--file-guard'], {
    cwd: root,
    env: { ...process.env, CLAUDE_PROJECT_DIR: root },
    input,
    encoding: 'utf8',
  });
}
function fileEvent(f, tool, path, patch = {}) {
  return {
    hook_event_name: 'PreToolUse',
    session_id: f.event.session_id,
    cwd: f.root,
    permission_mode: 'auto',
    tool_name: tool,
    tool_use_id: 'file-1',
    tool_input: { [tool === 'NotebookEdit' ? 'notebook_path' : 'file_path']: path, content: 'x' },
    ...patch,
  };
}
function guarded(run) {
  assert.equal(run.status, 0, run.stderr);
  const out = JSON.parse(run.stdout);
  assert.doesNotMatch(run.stdout, /"allow"/u);
  return out;
}
const denied = (run) => guarded(run).hookSpecificOutput?.permissionDecision === 'deny';

test('file guard denies a main-thread write to a tracked file while this session holds the writer lease', (t) => {
  const f = writer(t);
  assert.deepEqual(handle(f), {});
  const out = guarded(runGuard(f.root, fileEvent(f, 'Write', join(f.root, 'sample.txt'))));
  assert.equal(out.hookSpecificOutput.permissionDecision, 'deny');
  assert.match(
    out.hookSpecificOutput.permissionDecisionReason,
    new RegExp(f.registered.taskId, 'u'),
  );
  assert.match(out.hookSpecificOutput.permissionDecisionReason, /release --task/u);
});

test('file guard denies new non-ignored files and NotebookEdit, not ignored paths', (t) => {
  const f = writer(t);
  handle(f);
  assert.ok(denied(runGuard(f.root, fileEvent(f, 'Write', join(f.root, 'new-file.md')))));
  assert.ok(denied(runGuard(f.root, fileEvent(f, 'NotebookEdit', 'sample.txt'))));
  assert.deepEqual(
    guarded(runGuard(f.root, fileEvent(f, 'Write', join(f.root, '.artifacts/x')))),
    {},
  );
  // A relative path resolves against the event cwd, and missing directories resolve upwards.
  mkdirSync(join(f.root, 'sub'));
  const nested = fileEvent(f, 'Write', 'a/b/c.md', { cwd: join(f.root, 'sub') });
  assert.ok(denied(runGuard(f.root, nested)));
  const ignoredNested = fileEvent(f, 'Write', '../.artifacts/a/b.md', { cwd: join(f.root, 'sub') });
  assert.deepEqual(guarded(runGuard(f.root, ignoredNested)), {});
});

test('file guard denies a subagent write to native evidence under any case', (t) => {
  const f = setup(t);
  const id = f.registered.taskId;
  const child = { agent_id: 'child-1', agent_type: 'knu_explorer' };
  for (const [tool, path] of [
    ['Write', `.artifacts/tools/claude-native/${id}/judgment-template.json`],
    ['Edit', `.artifacts/tools/Claude-Native/${id}/judgment-template.json`],
  ])
    assert.ok(denied(runGuard(f.root, fileEvent(f, tool, join(f.root, path), child))), path);
});

test('file guard payload errors are non-blocking exit 1 with a guard message', (t) => {
  const f = setup(t);
  for (const input of ['{', 'x'.repeat(1024 * 1024 + 1)]) {
    const run = runGuard(f.root, null, input);
    assert.equal(run.status, 1);
    assert.match(run.stderr, /KNU file guard failed/u);
  }
});

test('file guard internal errors are non-blocking exit 1 and never deny', (t) => {
  const f = setup(t);
  const lease = join(f.root, '.artifacts/tools/claude-native/writer.json');
  writeFileSync(lease, '{');
  const damaged = runGuard(f.root, fileEvent(f, 'Write', join(f.root, 'sample.txt')));
  assert.equal(damaged.status, 1);
  assert.match(damaged.stderr, /KNU file guard failed/u);
  assert.doesNotMatch(damaged.stdout, /deny/u);
  const bare = mkdtempSync(join(tmpdir(), 'file-guard-no-git-'));
  t.after(() => rmSync(bare, { recursive: true, force: true }));
  mkdirSync(join(bare, '.artifacts/tools/claude-native'), { recursive: true });
  writeFileSync(
    join(bare, '.artifacts/tools/claude-native/writer.json'),
    JSON.stringify({ taskId: 'task-x', sessionId: f.event.session_id }),
  );
  const noGit = runGuard(bare, fileEvent({ ...f, root: bare }, 'Write', join(bare, 'a.txt')));
  assert.equal(noGit.status, 1);
  assert.match(noGit.stderr, /KNU file guard failed/u);
  assert.doesNotMatch(noGit.stdout, /deny/u);
});

test('file guard leaves ordinary work alone', (t) => {
  const plain = fixture(t);
  const plainEvent = fileEvent(
    { event: { session_id: randomUUID() }, root: plain.root },
    'Write',
    join(plain.root, 'sample.txt'),
  );
  assert.deepEqual(guarded(runGuard(plain.root, plainEvent)), {});
  const reader = setup(t);
  assert.deepEqual(
    guarded(runGuard(reader.root, fileEvent(reader, 'Write', join(reader.root, 'sample.txt')))),
    {},
  );
  const f = writer(t);
  handle(f);
  const outside = join(tmpdir(), `file-guard-outside-${randomUUID()}.txt`);
  const evidence = `.artifacts/tools/claude-native/${f.registered.taskId}/judgment-template.json`;
  for (const event of [
    fileEvent(f, 'Write', join(f.root, 'sample.txt'), { session_id: randomUUID() }),
    fileEvent(f, 'Write', join(f.root, 'sample.txt'), {
      agent_id: 'child-1',
      agent_type: 'knu_executor',
    }),
    fileEvent(f, 'Write', join(f.root, evidence)),
    fileEvent(f, 'Write', outside),
    fileEvent(f, 'Write', join(f.root, 'sample.txt'), { tool_input: { content: 'x' } }),
    fileEvent(f, 'NotebookEdit', '.artifacts/notes.ipynb'),
  ])
    assert.deepEqual(guarded(runGuard(f.root, event)), {}, JSON.stringify(event.tool_input));
  releaseClaudeNativeTask(f.registered.taskId, { root: f.root, ended: true });
  assert.deepEqual(
    guarded(runGuard(f.root, fileEvent(f, 'Write', join(f.root, 'sample.txt')))),
    {},
  );
});

// Effort is judged when the task is observed (settle/complete), never frozen into completion.json.
const effortErrors = (f) =>
  observeClaudeNativeTask(f.registered.taskId, { root: f.root }).errors.filter((e) =>
    e.startsWith('effort-'),
  );
const recordOf = (f) =>
  JSON.parse(readFileSync(join(f.registered.evidenceDirectory, 'task.json'))).record;
const childPathOf = (f, agentId = agentIdOf(f)) =>
  join(
    realpathSync(f.root),
    '.artifacts/transcripts',
    f.event.session_id,
    'subagents',
    `agent-${agentId}.jsonl`,
  );

test('registration binds the role effort and refuses a role without a supported one', (t) => {
  const f = setup(t);
  const role = f.registered.invocation.subagent_type;
  assert.equal(recordOf(f).expectedEffort, ROLE_EFFORT[role]);
  for (const header of ['', 'effort: max\n', 'effort: low\n']) {
    const g = fixture(t);
    delete g.input.currentSnapshot;
    writeFileSync(
      join(g.root, '.claude/agents', `${role}.md`),
      `---\nname: ${role}\ntools: Read, Grep, Glob\n${header}---\nRead only.\n`,
    );
    assert.throws(
      () =>
        registerClaudeNativeTask({ ...g.options, workflowInput: g.input, sessionId: randomUUID() }),
      /invalid-role-effort/u,
      header || 'missing effort',
    );
  }
});

test('foreground effort matches, mismatches or stays unobserved at observation time', (t) => {
  for (const [effort, expected] of [
    ['high', []],
    ['xhigh', ['effort-mismatch']],
    [undefined, ['effort-unobserved']],
  ]) {
    const f = writer(t);
    handle(f);
    writeFileSync(join(f.root, 'sample.txt'), 'allowed output');
    finish(f, {}, { effort });
    const completion = JSON.parse(
      readFileSync(join(f.registered.evidenceDirectory, 'completion.json')),
    );
    assert.equal(completion.valid, true, 'completion.json carries no effort verdict');
    assert.deepEqual(effortErrors(f), expected, String(effort));
    const observed = observeClaudeNativeTask(f.registered.taskId, { root: f.root });
    assert.deepEqual(observed.observedEfforts, effort ? [effort] : [], String(effort));
  }
});

test('a foreground transcript written after PostToolUse is pending, then judged', (t) => {
  const f = writer(t);
  handle(f);
  writeFileSync(join(f.root, 'sample.txt'), 'allowed output');
  finish(f, {}, { write: false });
  assert.ok(existsSync(join(f.registered.evidenceDirectory, 'completion.json')));
  assert.deepEqual(effortErrors(f), ['effort-transcript-pending']);
  // While pending the child stays bound: resuming it needs a new registration.
  const resume = handle(f, {
    ...f.event,
    tool_name: 'SendMessage',
    tool_input: { to: agentIdOf(f), message: 'continue' },
  });
  assert.equal(resume.hookSpecificOutput?.permissionDecision, 'deny');
  // A partial last row is still being written.
  mkdirSync(join(childPathOf(f), '..'), { recursive: true });
  writeFileSync(
    childPathOf(f),
    `${JSON.stringify({ type: 'user', sessionId: f.event.session_id, agentId: agentIdOf(f), message: { content: f.registered.invocation.prompt } })}\n{"type":"assis`,
  );
  assert.deepEqual(effortErrors(f), ['effort-transcript-pending']);
  // A Parent edit while effort is still pending is drift: completion already fixed the files.
  writeFileSync(join(f.root, 'sample.txt'), 'parent edit while pending');
  assert.ok(
    observeClaudeNativeTask(f.registered.taskId, { root: f.root }).errors.includes(
      'post-completion-file-drift',
    ),
  );
  writeFileSync(join(f.root, 'sample.txt'), 'allowed output');
  writeChildTranscript(f.root, {
    sessionId: f.event.session_id,
    agentId: agentIdOf(f),
    prompt: f.registered.invocation.prompt,
    model: f.options.expectedResolvedModel,
    effort: 'high',
  });
  assert.deepEqual(effortErrors(f), []);
  // A Parent edit after completion is drift whether or not effort was settled yet.
  writeFileSync(join(f.root, 'sample.txt'), 'parent edit');
  assert.ok(
    observeClaudeNativeTask(f.registered.taskId, { root: f.root }).errors.includes(
      'post-completion-file-drift',
    ),
  );
});

test('a foreground transcript that never appears is unobserved once the task lifetime ends', (t) => {
  const f = writer(t);
  handle(f);
  writeFileSync(join(f.root, 'sample.txt'), 'allowed output');
  finish(f, {}, { write: false });
  t.mock.timers.enable({ apis: ['Date'], now: Date.now() + 10 * 60 * 1000 });
  assert.deepEqual(effortErrors(f), ['effort-unobserved']);
});

test('an expired Haiku task without a transcript is unobserved as well', (t) => {
  const f = setup(t);
  handle(f);
  finish(f, {}, { write: false });
  assert.deepEqual(effortErrors(f), ['effort-transcript-pending']);
  t.mock.timers.enable({ apis: ['Date'], now: Date.now() + 10 * 60 * 1000 });
  assert.deepEqual(effortErrors(f), ['effort-unobserved']);
});

test('foreground child identity is checked before its transcript is trusted', (t) => {
  const bad = writer(t);
  handle(bad);
  finish(bad, { agentId: '../x' });
  const completion = JSON.parse(
    readFileSync(join(bad.registered.evidenceDirectory, 'completion.json')),
  );
  assert.equal(completion.valid, false);
  assert.ok(completion.errors.includes('invalid-child-identity'), completion.errors.join());

  const foreign = writer(t);
  handle(foreign);
  writeFileSync(join(foreign.root, 'sample.txt'), 'allowed output');
  finish(foreign);
  const rows = readFileSync(childPathOf(foreign), 'utf8').replaceAll(
    `"agentId":"${agentIdOf(foreign)}"`,
    '"agentId":"other-child"',
  );
  writeFileSync(childPathOf(foreign), rows);
  assert.deepEqual(effortErrors(foreign), ['effort-transcript-foreign']);
});

test('Haiku is not held to an effort it does not support, but its transcript identity still is', (t) => {
  const f = setup(t);
  assert.equal(
    policy.claudeModelSupportsEffort(f.options.expectedResolvedModel),
    false,
    'the capability table lists the fixture Haiku ID without effort',
  );
  handle(f);
  finish(f, {}, { effort: undefined });
  assert.deepEqual(effortErrors(f), []);
  const g = setup(t);
  handle(g);
  finish(g, {}, { write: false });
  assert.deepEqual(effortErrors(g), ['effort-transcript-pending']);
  const other = setup(t);
  handle(other);
  finish(other);
  const rows = readFileSync(childPathOf(other), 'utf8').replaceAll(
    `"agentId":"${agentIdOf(other)}"`,
    '"agentId":"other-child"',
  );
  writeFileSync(childPathOf(other), rows);
  assert.deepEqual(effortErrors(other), ['effort-transcript-foreign']);
  const h = setup(t);
  handle(h);
  finish(h, {}, { prompt: 'another prompt' });
  assert.deepEqual(effortErrors(h), ['effort-transcript-foreign']);
});

test('background completion judges effort from the settled child transcript', (t) => {
  const { subject, packet } = reviewedSubject(t);
  const qa = asyncReview(t, subject, packet);
  assert.deepEqual(effortErrors(qa), []);
  assert.deepEqual(
    observeClaudeNativeTask(qa.registered.taskId, { root: qa.root }).observedEfforts,
    ['xhigh'],
  );
  const proof = JSON.parse(
    readFileSync(join(qa.registered.evidenceDirectory, 'transcript-proof.json')),
  );
  const high = asyncReview(t, subject, packet, [], 'high');
  assert.deepEqual(effortErrors(high), ['effort-mismatch']);
  const unmarked = asyncReview(t, subject, packet, [], null);
  assert.deepEqual(effortErrors(unmarked), ['effort-unobserved']);
  assert.ok(proof.path.endsWith('.jsonl'));
});

// Extraction skips review only in the bounded-extraction risk range, whichever profile runs it.
// Sonnet and Opus extract with knu_explorer; the xhigh explorer is the Haiku extraction role.
function extraction(t, profileId, model, patch = {}) {
  const f = fixture(t);
  writeFileSync(join(f.root, '.git/info/exclude'), '.artifacts/\n');
  f.input.nativeRequest.profileId = profileId;
  Object.assign(f.input.nativeRequest.task, { role: 'knu_explorer', ...patch });
  f.options.expectedResolvedModel = model;
  return (required) => {
    const input = structuredClone(f.input);
    input.reviewDisposition = required
      ? { required: true, reason: 'independent QA for this extraction' }
      : input.reviewDisposition;
    return registerClaudeNativeTask({
      ...f.options,
      workflowInput: input,
      sessionId: randomUUID(),
    });
  };
}
test('extract QA exemption keeps the low, bounded, resolved range on Sonnet and refuses the rest', (t) => {
  const sonnet = extraction(t, 'bounded-standard', 'claude-sonnet-5-5');
  assert.equal(sonnet(false).invocation.model, 'sonnet');
  const readFacts = ['source-bound', 'bounded-scope', 'acceptance', 'oracle', 'independent-qa'].map(
    (key) => ({ key, sourceRef: 'test-case', confidence: 'high' }),
  );
  for (const [name, register] of [
    [
      'medium-risk Sonnet extract',
      extraction(t, 'bounded-standard', 'claude-sonnet-5-5', { impactRisk: 'medium' }),
    ],
    [
      'high-risk Opus extract',
      extraction(t, 'complex-critical', 'claude-opus-5-5', { impactRisk: 'high' }),
    ],
    [
      'Sonnet read',
      extraction(t, 'bounded-standard', 'claude-sonnet-5-5', { kind: 'read', facts: readFacts }),
    ],
  ]) {
    assert.throws(() => register(false), /independent QA required for this profile/u, name);
    assert.ok(register(true).taskId, `${name} registers with independent QA`);
  }
});

test('the xhigh executor registers for a high-risk Opus build and binds xhigh', (t) => {
  const f = writer(t);
  writeRole(
    f.root,
    'knu_executor_xhigh',
    'Read, Grep, Glob, Edit, Write, Bash',
    'Implement bounded work.',
  );
  execFileSync('git', ['add', '.'], { cwd: f.root });
  const input = structuredClone(f.input);
  input.nativeRequest.profileId = 'complex-critical';
  Object.assign(input.nativeRequest.task, {
    impactRisk: 'high',
    complexity: 'complex',
    role: 'knu_executor_xhigh',
  });
  const registered = registerClaudeNativeTask({
    ...f.options,
    expectedResolvedModel: 'claude-opus-5-5',
    workflowInput: input,
    sessionId: randomUUID(),
  });
  assert.equal(registered.invocation.subagent_type, 'knu_executor_xhigh');
  assert.equal(registered.invocation.model, 'opus');
  const { record } = JSON.parse(readFileSync(join(registered.evidenceDirectory, 'task.json')));
  assert.equal(record.expectedEffort, 'xhigh');
});

// Recovery: one retry, bound to a first task that ran, was observed and was not accepted, climbs one
// ladder step without changing the task facts. Every other bound retry is refused before any write.
const LADDER_MODEL = {
  'bounded-standard': 'claude-sonnet-5-5',
  'complex-critical': 'claude-opus-5-5',
};
function ladder(t, kind = 'extract') {
  const f = fixture(t);
  writeFileSync(join(f.root, '.git/info/exclude'), '.artifacts/\n');
  if (kind === 'build') {
    for (const role of ['knu_executor', 'knu_executor_xhigh'])
      writeRole(f.root, role, 'Read, Grep, Glob, Edit, Write, Bash', 'Implement bounded work.');
    writeRole(f.root, 'knu_reviewer', 'Read, Grep, Glob', 'Review only.');
    execFileSync('git', ['add', '.'], { cwd: f.root });
    delete f.input.currentSnapshot;
    f.input.request = 'sample.txt 변경을 구현해줘.';
    f.input.directAssignment.writeOwnership = ['sample.txt'];
    f.input.directAssignment.owner = 'builder';
    f.input.reviewDisposition.required = true;
    Object.assign(f.input.nativeRequest.task, {
      kind: 'build',
      impactRisk: 'medium',
      allowedTools: ['Read', 'Grep', 'Glob', 'Edit', 'Write', 'Bash'],
      writeScope: ['sample.txt'],
      writeOwner: 'builder',
      facts: [
        'source-bound',
        'bounded-scope',
        'acceptance',
        'oracle',
        'independent-qa',
        'regression',
        'one-writer',
      ].map((key) => ({ key, sourceRef: 'fixture', confidence: 'high' })),
    });
  }
  return { ...f, sessionId: randomUUID() };
}
function registerAs(f, { profileId, role, recovery, sessionId = f.sessionId, patch = {}, model }) {
  const input = structuredClone(f.input);
  input.nativeRequest.profileId = profileId;
  Object.assign(input.nativeRequest.task, { role, ...patch });
  const options = { ...f.options, expectedResolvedModel: model ?? LADDER_MODEL[profileId] };
  const registered = registerClaudeNativeTask({
    ...options,
    workflowInput: input,
    sessionId,
    ...(recovery === undefined ? {} : { recovery }),
  });
  return {
    ...f,
    options,
    registered,
    event: {
      hook_event_name: 'PreToolUse',
      session_id: sessionId,
      cwd: f.root,
      permission_mode: 'auto',
      tool_name: 'Agent',
      tool_use_id: `tool-${registered.taskId.slice(0, 8)}`,
      tool_input: registered.invocation,
    },
  };
}
// Runs the task to a completed, observed child; Parent judges acceptance as not met.
function ranUnaccepted(g, child = {}) {
  assert.deepEqual(handle(g), {});
  finish(g, {}, child);
  const r = semanticResult(g);
  r.acceptance[0].passed = false;
  assert.equal(completeClaudeNativeTask(g.registered.taskId, r, { root: g.root }).valid, false);
  return g;
}
const taskInputOf = (g) => recordOf(g).input.nativeRequest.task;
const markerFiles = (f) => {
  const dir = join(realpathSync(f.root), '.artifacts/tools/claude-native/recovery', f.sessionId);
  return existsSync(dir) ? readdirSync(dir) : [];
};

test('a bound retry climbs ladder step 1 and passes register, PreToolUse and complete', (t) => {
  const f = ladder(t);
  const a = ranUnaccepted(registerAs(f, { profileId: 'bounded-standard', role: 'knu_explorer' }));
  const b = registerAs(f, {
    profileId: 'complex-critical',
    role: 'knu_explorer',
    recovery: { of: a.registered.taskId, cause: 'result-error' },
  });
  assert.deepEqual(taskInputOf(b).recovery, {
    of: a.registered.taskId,
    cause: 'result-error',
    step: 1,
    fromProfileId: 'bounded-standard',
    fromRole: 'knu_explorer',
  });
  assert.equal(b.registered.invocation.model, 'opus');
  assert.equal(
    JSON.parse(readFileSync(join(a.registered.evidenceDirectory, 'recovery.json'))).taskId,
    b.registered.taskId,
  );
  assert.equal(markerFiles(f).length, 1);
  assert.deepEqual(handle(b), {});
  finish(b);
  const done = completeClaudeNativeTask(b.registered.taskId, semanticResult(b), { root: f.root });
  assert.equal(done.valid, true, JSON.stringify(done.errors));
  assert.ok(existsSync(join(b.registered.evidenceDirectory, 'accepted.json')));
  // The superseded first task can no longer complete.
  const late = completeClaudeNativeTask(a.registered.taskId, semanticResult(a), { root: f.root });
  assert.equal(late.valid, false);
  assert.ok(late.errors.includes('observation-error'), JSON.stringify(late.errors));
});

test('a bound retry climbs ladder step 2 to the xhigh executor for a complex build', (t) => {
  const f = ladder(t, 'build');
  const complex = { complexity: 'complex' };
  const a = registerAs(f, { profileId: 'complex-critical', role: 'knu_executor', patch: complex });
  assert.deepEqual(handle(a), {});
  writeFileSync(join(f.root, 'sample.txt'), 'first attempt');
  finish(a);
  const b = registerAs(f, {
    profileId: 'complex-critical',
    role: 'knu_executor_xhigh',
    patch: complex,
    recovery: { of: a.registered.taskId, cause: 'omission' },
  });
  assert.equal(taskInputOf(b).recovery.step, 2);
  assert.equal(recordOf(b).expectedEffort, 'xhigh');
  assert.deepEqual(handle(b), {});
  finish(b);
  // A build still needs its independent QA; recovery adds no other completion error.
  const done = completeClaudeNativeTask(b.registered.taskId, semanticResult(b), { root: f.root });
  assert.equal(done.observation.valid, true);
  assert.ok(done.errors.includes('independent QA exchange required'));
  assert.deepEqual(
    done.errors.filter((error) => !/QA/u.test(error)),
    [],
  );
});

test('step 0 re-registers the same profile and role for missing context', (t) => {
  const f = ladder(t);
  const a = ranUnaccepted(registerAs(f, { profileId: 'bounded-standard', role: 'knu_explorer' }));
  const b = registerAs(f, {
    profileId: 'bounded-standard',
    role: 'knu_explorer',
    recovery: { of: a.registered.taskId, cause: 'context-missing' },
  });
  assert.equal(taskInputOf(b).recovery.step, 0);
  assert.deepEqual(handle(b), {});
  finish(b);
  assert.equal(
    completeClaudeNativeTask(b.registered.taskId, semanticResult(b), { root: f.root }).valid,
    true,
  );
});

// Only an exact ID the capability table lists without effort skips the effort comparison. Any other
// Haiku ID is held to the role effort, so a child at another effort is refused at settlement and
// cannot bind a retry. The profile and role come from the fixture extraction task.
const EFFORT_HAIKU = 'claude-haiku-synthetic-effort';
const otherEffort = (role) => (ROLE_EFFORT[role] === 'high' ? 'xhigh' : 'high');
const extractionTask = (f) => ({
  profileId: f.input.nativeRequest.profileId,
  role: f.input.nativeRequest.task.role,
});

test('a Haiku ID with effort support is held to the role effort at settlement', (t) => {
  const f = ladder(t);
  const task = extractionTask(f);
  const matched = registerAs(f, { ...task, model: EFFORT_HAIKU });
  assert.deepEqual(handle(matched), {});
  finish(matched);
  assert.deepEqual(effortErrors(matched), []);
  const other = registerAs(f, { ...task, model: EFFORT_HAIKU });
  assert.deepEqual(handle(other), {});
  finish(other, {}, { effort: otherEffort(task.role) });
  assert.deepEqual(effortErrors(other), ['effort-mismatch']);
});

test('a Haiku first task with effort support binds a retry only after running at the role effort', (t) => {
  const f = ladder(t);
  const task = extractionTask(f);
  const a = ranUnaccepted(registerAs(f, { ...task, model: EFFORT_HAIKU }), {
    effort: otherEffort(task.role),
  });
  assert.throws(
    () =>
      registerAs(f, {
        ...task,
        model: EFFORT_HAIKU,
        recovery: { of: a.registered.taskId, cause: 'context-missing' },
      }),
    /recovery-not-ran/u,
    'the first Haiku task ran at another effort',
  );
  const b = ranUnaccepted(registerAs(f, { ...task, model: EFFORT_HAIKU }));
  const retry = registerAs(f, {
    ...task,
    model: EFFORT_HAIKU,
    recovery: { of: b.registered.taskId, cause: 'context-missing' },
  });
  assert.equal(taskInputOf(retry).recovery.step, 0, 'the first Haiku task ran at the role effort');
});

// An extraction that ran climbs one step to Sonnet in the same role and effort. It never skips to
// Opus or changes role, and the retry is not retried again.
test('a bound extraction retry climbs to bounded-standard in the same role and no further', (t) => {
  const f = ladder(t);
  const task = extractionTask(f);
  const a = ranUnaccepted(registerAs(f, { ...task, model: f.options.expectedResolvedModel }));
  const up = (of, profileId, role = task.role) =>
    registerAs(f, { profileId, role, recovery: { of, cause: 'result-error' } });
  assert.throws(() => up(a.registered.taskId, 'complex-critical'), /recovery-step/u, 'skip');
  assert.throws(
    () => up(a.registered.taskId, 'bounded-standard', 'knu_explorer'),
    /recovery-step/u,
    'another role',
  );
  const b = up(a.registered.taskId, 'bounded-standard');
  assert.deepEqual(taskInputOf(b).recovery, {
    of: a.registered.taskId,
    cause: 'result-error',
    step: 1,
    fromProfileId: task.profileId,
    fromRole: task.role,
  });
  assert.equal(b.registered.invocation.model, 'sonnet');
  assert.equal(recordOf(b).expectedEffort, ROLE_EFFORT[task.role]);
  assert.deepEqual(handle(b), {});
  finish(b);
  const done = completeClaudeNativeTask(b.registered.taskId, semanticResult(b), { root: f.root });
  assert.equal(done.valid, true, JSON.stringify(done.errors));
  assert.throws(() => up(b.registered.taskId, 'complex-critical'), /recovery-chain/u, 'chain');
});

test('recovery reasons are judged in a fixed order and each refuses on its own', (t) => {
  const f = ladder(t);
  const up = (of, cause = 'result-error', extra = {}) =>
    registerAs(f, {
      profileId: 'complex-critical',
      role: 'knu_explorer',
      recovery: { of, cause },
      ...extra,
    });
  const a = ranUnaccepted(registerAs(f, { profileId: 'bounded-standard', role: 'knu_explorer' }));
  assert.throws(() => up(a.registered.taskId, 'quota'), /recovery-cause/u);
  assert.throws(() => up(randomUUID()), /recovery-not-bound/u, 'missing first task');
  assert.throws(
    () => up(a.registered.taskId, 'result-error', { sessionId: randomUUID() }),
    /recovery-not-bound/u,
    'other session',
  );
  assert.throws(
    () =>
      up(a.registered.taskId, 'result-error', {
        patch: { readScope: ['sample.txt', '.claude/agents'] },
      }),
    /recovery-not-bound/u,
    'changed facts',
  );
  // Step: result-error must climb one step; context-missing must stay; no skipping.
  assert.throws(
    () =>
      registerAs(f, {
        profileId: 'bounded-standard',
        role: 'knu_explorer',
        recovery: { of: a.registered.taskId, cause: 'result-error' },
      }),
    /recovery-step/u,
  );
  assert.throws(() => up(a.registered.taskId, 'context-missing'), /recovery-step/u);
  assert.equal(markerFiles(f).length, 0, 'refused registrations write nothing');
  const b = ranUnaccepted(up(a.registered.taskId));
  // b is itself a retry with the same facts, so chain is reported before used.
  assert.throws(() => up(b.registered.taskId, 'context-missing'), /recovery-chain/u);
  assert.throws(() => up(a.registered.taskId), /recovery-used/u, 'A→B then A→C');
});

test('a duplicate first task with the same facts shares the one retry', (t) => {
  const f = ladder(t);
  const first = () =>
    ranUnaccepted(registerAs(f, { profileId: 'bounded-standard', role: 'knu_explorer' }));
  const a = first();
  const twin = first();
  const up = (of) =>
    registerAs(f, {
      profileId: 'complex-critical',
      role: 'knu_explorer',
      recovery: { of, cause: 'result-error' },
    });
  up(a.registered.taskId);
  assert.throws(() => up(twin.registered.taskId), /recovery-used/u);
});

test('only a first task that ran, was observed valid with its effort and was not accepted binds', (t) => {
  const f = ladder(t);
  const first = () => registerAs(f, { profileId: 'bounded-standard', role: 'knu_explorer' });
  const up = (g) => () =>
    registerAs(f, {
      profileId: 'complex-critical',
      role: 'knu_explorer',
      recovery: { of: g.registered.taskId, cause: 'omission' },
    });
  const released = first();
  releaseClaudeNativeTask(released.registered.taskId, { root: f.root, ended: true });
  assert.throws(up(released), /recovery-not-ran/u, 'released without dispatch');
  const pending = first();
  assert.deepEqual(handle(pending), {});
  finish(pending, {}, { write: false });
  assert.throws(up(pending), /recovery-not-ran/u, 'effort still pending');
  const mismatch = ranUnaccepted(first(), { effort: 'xhigh' });
  assert.throws(up(mismatch), /recovery-not-ran/u, 'effort mismatch');
  const mutated = first();
  assert.deepEqual(handle(mutated), {});
  writeFileSync(join(f.root, 'sample.txt'), 'read-only child changed this');
  finish(mutated);
  assert.equal(
    JSON.parse(readFileSync(join(mutated.registered.evidenceDirectory, 'completion.json'))).valid,
    false,
  );
  writeFileSync(join(f.root, 'sample.txt'), 'oracle');
  assert.throws(up(mutated), /recovery-not-ran/u, 'saved observation invalid');
  const accepted = first();
  assert.deepEqual(handle(accepted), {});
  finish(accepted);
  assert.equal(
    completeClaudeNativeTask(accepted.registered.taskId, semanticResult(accepted), {
      root: f.root,
    }).valid,
    true,
  );
  assert.ok(existsSync(join(accepted.registered.evidenceDirectory, 'accepted.json')));
  assert.throws(up(accepted), /recovery-accepted/u);
});

test('a retry refused by another register check consumes nothing and leaves the first task live', (t) => {
  const f = ladder(t);
  const a = ranUnaccepted(registerAs(f, { profileId: 'bounded-standard', role: 'knu_explorer' }));
  const recovery = { of: a.registered.taskId, cause: 'result-error' };
  assert.throws(
    () =>
      registerAs(f, {
        profileId: 'complex-critical',
        role: 'knu_explorer',
        recovery,
        model: 'claude-sonnet-5-5',
      }),
    /expected model\/profile mismatch/u,
  );
  assert.deepEqual(markerFiles(f), []);
  assert.equal(existsSync(join(a.registered.evidenceDirectory, 'recovery.json')), false);
  assert.equal(existsSync(join(a.registered.evidenceDirectory, 'observation-error.json')), false);
  assert.ok(registerAs(f, { profileId: 'complex-critical', role: 'knu_explorer', recovery }));
});

test('recovery made outside the registry is refused and PreToolUse checks the binding file', (t) => {
  const f = ladder(t);
  const a = ranUnaccepted(registerAs(f, { profileId: 'bounded-standard', role: 'knu_explorer' }));
  const forged = {
    of: a.registered.taskId,
    cause: 'result-error',
    step: 1,
    fromProfileId: 'bounded-standard',
    fromRole: 'knu_explorer',
  };
  assert.throws(
    () =>
      registerAs(f, {
        profileId: 'complex-critical',
        role: 'knu_explorer',
        patch: { recovery: forged },
      }),
    /recovery-unregistered/u,
  );
  assert.throws(
    () =>
      registerAs(f, {
        profileId: 'complex-critical',
        role: 'knu_explorer',
        patch: { recovery: { ...forged, step: 2 } },
        recovery: { of: a.registered.taskId, cause: 'result-error' },
      }),
    /recovery-unregistered/u,
  );
  const b = registerAs(f, {
    profileId: 'complex-critical',
    role: 'knu_explorer',
    recovery: { of: a.registered.taskId, cause: 'result-error' },
  });
  writeFileSync(
    join(a.registered.evidenceDirectory, 'recovery.json'),
    JSON.stringify({ taskId: randomUUID() }),
  );
  assert.equal(handle(b).hookSpecificOutput?.permissionDecision, 'deny');
});

test('an unbound bounded task on the Opus profile still needs a critical signal', (t) => {
  const f = ladder(t);
  assert.throws(
    () => registerAs(f, { profileId: 'complex-critical', role: 'knu_explorer' }),
    /critical-signal/u,
  );
});

test('a duplicate first task whose facts differ only in key order still shares the one retry', (t) => {
  const f = ladder(t);
  const a = ranUnaccepted(registerAs(f, { profileId: 'bounded-standard', role: 'knu_explorer' }));
  const reordered = structuredClone(f.input);
  const { required, reason } = reordered.reviewDisposition;
  reordered.reviewDisposition = { reason, required };
  reordered.nativeRequest.task.facts = reordered.nativeRequest.task.facts.map(
    ({ key, sourceRef, confidence }) => ({ confidence, sourceRef, key }),
  );
  const twin = ranUnaccepted(
    registerAs({ ...f, input: reordered }, { profileId: 'bounded-standard', role: 'knu_explorer' }),
  );
  const up = (g, of) =>
    registerAs(g, {
      profileId: 'complex-critical',
      role: 'knu_explorer',
      recovery: { of, cause: 'result-error' },
    });
  up(f, a.registered.taskId);
  assert.throws(() => up({ ...f, input: reordered }, twin.registered.taskId), /recovery-used/u);
  assert.equal(markerFiles(f).length, 1);
});

test('a superseded first task reports used even after its writer retry changed files', (t) => {
  const f = ladder(t, 'build');
  const a = ranUnaccepted(registerAs(f, { profileId: 'bounded-standard', role: 'knu_executor' }));
  const b = registerAs(f, {
    profileId: 'complex-critical',
    role: 'knu_executor',
    recovery: { of: a.registered.taskId, cause: 'result-error' },
  });
  assert.deepEqual(handle(b), {});
  writeFileSync(join(f.root, 'sample.txt'), 'retry output');
  finish(b);
  assert.throws(
    () =>
      registerAs(f, {
        profileId: 'complex-critical',
        role: 'knu_executor',
        recovery: { of: a.registered.taskId, cause: 'result-error' },
      }),
    /recovery-used/u,
  );
});

test('a bounded build retry climbs ladder step 1 and completes without the critical signal', (t) => {
  const f = ladder(t, 'build');
  const a = registerAs(f, { profileId: 'bounded-standard', role: 'knu_executor' });
  assert.deepEqual(handle(a), {});
  writeFileSync(join(f.root, 'sample.txt'), 'first attempt');
  finish(a);
  const b = registerAs(f, {
    profileId: 'complex-critical',
    role: 'knu_executor',
    recovery: { of: a.registered.taskId, cause: 'result-error' },
  });
  assert.equal(taskInputOf(b).recovery.step, 1);
  assert.equal(b.registered.invocation.model, 'opus');
  assert.deepEqual(handle(b), {});
  finish(b);
  // A build still needs its independent QA; recovery adds no other completion error.
  const done = completeClaudeNativeTask(b.registered.taskId, semanticResult(b), { root: f.root });
  assert.equal(done.observation.valid, true);
  assert.ok(done.errors.includes('independent QA exchange required'));
  assert.deepEqual(
    done.errors.filter((error) => !/QA/u.test(error)),
    [],
  );
});

test('a working-tree change after the first task completes forfeits its bound retry', (t) => {
  const f = ladder(t, 'build');
  const a = registerAs(f, { profileId: 'bounded-standard', role: 'knu_executor' });
  assert.deepEqual(handle(a), {});
  writeFileSync(join(f.root, 'sample.txt'), 'first attempt');
  finish(a);
  writeFileSync(join(f.root, 'sample.txt'), 'reverted by the Parent');
  assert.throws(
    () =>
      registerAs(f, {
        profileId: 'complex-critical',
        role: 'knu_executor',
        recovery: { of: a.registered.taskId, cause: 'result-error' },
      }),
    /recovery-not-ran: .*post-completion/u,
  );
  assert.equal(markerFiles(f).length, 0);
});

// Settlement judges a read-only task over its dependencies, but a recovery binding keeps the
// repository-wide observation: a change anywhere during the first task forfeits its retry.
test('a read-only first task with a change outside its reads still forfeits its bound retry', (t) => {
  const f = ladder(t);
  const a = registerAs(f, { profileId: 'bounded-standard', role: 'knu_explorer' });
  assert.deepEqual(handle(a), {});
  writeFileSync(join(f.root, 'outside.txt'), 'another session');
  finish(a);
  rmSync(join(f.root, 'outside.txt'));
  const r = semanticResult(a);
  r.acceptance[0].passed = false;
  const settled = completeClaudeNativeTask(a.registered.taskId, r, { root: f.root });
  assert.deepEqual(settled.dependencyJudgment.outside, ['outside.txt']);
  assert.ok(!settled.errors.some((e) => e.includes('outside.txt')), settled.errors.join());
  assert.throws(
    () =>
      registerAs(f, {
        profileId: 'complex-critical',
        role: 'knu_explorer',
        recovery: { of: a.registered.taskId, cause: 'result-error' },
      }),
    /recovery-not-ran: .*unattributable-change:outside\.txt/u,
  );
  assert.equal(markerFiles(f).length, 0);
});

// A first-round review group (V1c): members share a group line on prompt line 2, and the Parent may
// close a member's non-PASS only with a review-adjudication/v1 record whose rejections cite a
// reproduction log bound to the builder's snapshot. A single reviewer's FAIL stays unclosable.
const GROUP_ID = 'abcd1234';
const GROUP_DIR = '.artifacts/plans/group-test';
const groupPrompt = (index, { size = 2, composition = 'e2', groupId = GROUP_ID } = {}) =>
  `KNU review snapshot sha256:${'0'.repeat(64)}\nKNU review group ${groupId} ${index}/${size} ${composition}\nReview the frozen subject packet only.`;
const groupFinding = (id, severity = 'medium') => ({
  ...(id === undefined ? {} : { id }),
  severity,
  location: 'sample.txt:1',
  impact: 'fixture impact',
  reproduction: 'fixture reproduction',
  evidence: 'fixture evidence',
});
const failing =
  (findings, extra = {}) =>
  (result) => ({ ...result, findings, ...extra });
const gapped = (gap) => (result) => ({
  ...result,
  acceptanceCoverage: result.acceptanceCoverage.map((entry) => ({ ...entry, gap })),
});
function groupMember(t, subject, packet, index, options = {}) {
  const {
    verdict = 'PASS',
    patch = (result) => result,
    prompt,
    readScope,
    dispatch = 'delivered',
  } = options;
  const qa = reviewer(t, subject, packet, {
    prompt: prompt ?? groupPrompt(index, options),
    readScope,
  });
  const result = patch(reviewResult(packet, 'unknown', verdict));
  handle(qa);
  if (dispatch === 'failed-call') {
    handle(qa, { ...qa.event, hook_event_name: 'PostToolUseFailure' });
    return { qa, result: null };
  }
  if (dispatch === 'unsettled') return { qa, result: null };
  finish(qa, { content: [{ type: 'text', text: JSON.stringify(result) }] });
  const semantic = semanticResult(qa);
  semantic.reviewResult = result;
  // A FAIL with a coverage gap does not complete; it stays a delivered non-PASS review.
  completeClaudeNativeTask(qa.registered.taskId, semantic, { root: qa.root });
  return { qa, result };
}
const blockingSeverity = (severity) => ['critical', 'high', 'medium'].includes(severity);
// Writes each delivered result, a reproduction log headed by `header`, and the adjudication record.
function writeGroupAdjudication(subject, members, options = {}) {
  const root = realpathSync(subject.root);
  mkdirSync(join(root, GROUP_DIR), { recursive: true });
  const observation = JSON.parse(
    readFileSync(join(subject.registered.evidenceDirectory, 'completion.json')),
  );
  const header =
    options.header ??
    `KNU review snapshot ${claudeNativeSnapshotDigest(observation.finalSnapshot)}`;
  const log = options.log ?? `${GROUP_DIR}/repro.log`;
  if (options.writeLog !== false) {
    mkdirSync(join(root, log, '..'), { recursive: true });
    writeFileSync(join(root, log), `${header}\nrg exit=1\nexit=0\n`);
  }
  const delivered = members.filter((member) => member.result);
  const reviews = delivered.map((member, index) => {
    const resultPath = `${GROUP_DIR}/r1-result-${index + 1}.json`;
    writeFileSync(join(root, resultPath), JSON.stringify(member.result));
    return { taskId: member.qa.registered.taskId, resultPath };
  });
  const findings = delivered.flatMap((member) =>
    member.result.findings.map((finding, index) => ({
      id: finding.id ?? `${member.qa.registered.taskId}#${index}`,
      severity: finding.severity,
      disposition: blockingSeverity(finding.severity) ? 'rejected' : 'fixed',
      reason: `not reproduced: \`${log}\``,
    })),
  );
  const record = {
    schema: 'review-adjudication/v1',
    subject: 'group fixture',
    round: 1,
    reviews,
    findings,
  };
  const path = `${GROUP_DIR}/r1-adjudication.json`;
  writeFileSync(
    join(root, path),
    JSON.stringify(options.edit ? (options.edit(record, root) ?? record) : record),
  );
  return path;
}
function linkGroup(subject, linked, reviewAdjudication) {
  const semantic = semanticResult(subject);
  semantic.results[0].changedPaths = ['sample.txt'];
  semantic.reviewerTaskId = linked.qa.registered.taskId;
  if (reviewAdjudication !== undefined) semantic.reviewAdjudication = reviewAdjudication;
  return completeClaudeNativeTask(subject.registered.taskId, semantic, { root: subject.root });
}
// One PASS member and one FAIL member whose findings come from `failPatch`.
function groupCase(t, { failPatch = failing([groupFinding('m2-F1')]), ...options } = {}) {
  const { subject, packet } = reviewedSubject(t);
  const pass = groupMember(t, subject, packet, 1);
  const fail = groupMember(t, subject, packet, 2, { verdict: 'FAIL', patch: failPatch });
  const members = [pass, fail];
  const path =
    options.adjudication === false
      ? undefined
      : writeGroupAdjudication(subject, members, options.adjudication ?? {});
  return { subject, packet, pass, fail, members, path, linked: linkGroup(subject, pass, path) };
}
const rejectedWith = (outcome, pattern) =>
  assert.ok(
    outcome.valid === false && outcome.errors.some((error) => pattern.test(error)),
    outcome.errors.join(' | '),
  );

test('a group FAIL rejected with a bound reproduction log lets the PASS member complete the builder', (t) => {
  const { linked } = groupCase(t);
  assert.equal(linked.valid, true, linked.errors.join(' | '));
  // A FAIL member whose coverage gap and knownGaps name its rejected finding is closed with it.
  const named = groupCase(t, {
    failPatch: (result) =>
      gapped('criterion unmet until m2-F1 is fixed')(
        failing([groupFinding('m2-F1')], { knownGaps: ['m2-F1: acceptance blocked'] })(result),
      ),
  });
  assert.equal(named.linked.valid, true, named.linked.errors.join(' | '));
  // A finding without an id is named by its `<taskId>#<index>` id.
  const unnamed = groupCase(t, {
    failPatch: failing([groupFinding(undefined)]),
  });
  assert.equal(unnamed.linked.valid, true, unnamed.linked.errors.join(' | '));
});

test('a group non-PASS needs a valid adjudication record that names every delivered member', (t) => {
  const missing = groupCase(t, { adjudication: false });
  rejectedWith(missing.linked, /review-adjudication-required/u);
  // The current refusal stays alongside the new reason.
  rejectedWith(missing.linked, /FAIL review receipt|delivered non-PASS review/u);
  rejectedWith(
    groupCase(t, {
      adjudication: {
        edit: (record) => ({ ...record, reviews: record.reviews.slice(1) }),
      },
    }).linked,
    /review-adjudication-invalid: .*every member/u,
  );
  rejectedWith(
    groupCase(t, {
      adjudication: {
        edit: (record) => ({
          ...record,
          round: 2,
          findings: record.findings.map((f) => ({ ...f, origin: 'fix-induced' })),
        }),
      },
    }).linked,
    /review-adjudication-invalid: .*round 1/u,
  );
  rejectedWith(
    groupCase(t, {
      adjudication: { edit: (record) => ({ ...record, findings: [] }) },
    }).linked,
    /review-adjudication-invalid: missing-finding/u,
  );
  rejectedWith(
    groupCase(t, {
      adjudication: {
        edit: (record, root) => {
          const path = join(root, record.reviews[1].resultPath);
          const result = JSON.parse(readFileSync(path));
          writeFileSync(path, JSON.stringify({ ...result, confidence: 'low' }));
          return record;
        },
      },
    }).linked,
    /review-adjudication-result-mismatch/u,
  );
  const outside = groupCase(t, { adjudication: false });
  rejectedWith(
    linkGroup(outside.subject, outside.pass, '../outside.json'),
    /review-adjudication-invalid/u,
  );
  // Members that ignore the id prefix collide; their results cannot share one record.
  {
    const { subject, packet } = reviewedSubject(t);
    const pass = groupMember(t, subject, packet, 1, {
      patch: failing([groupFinding('F1', 'low')]),
    });
    const fail = groupMember(t, subject, packet, 2, {
      verdict: 'FAIL',
      patch: failing([groupFinding('F1')]),
    });
    rejectedWith(
      linkGroup(subject, pass, writeGroupAdjudication(subject, [pass, fail])),
      /review-adjudication-invalid: duplicate-result-id F1/u,
    );
  }
});

test('every blocking finding of a group non-PASS is rejected with a log bound to the same snapshot', (t) => {
  for (const disposition of ['fixed', 'deferred'])
    rejectedWith(
      groupCase(t, {
        adjudication: {
          edit: (record) => ({
            ...record,
            findings: record.findings.map((f) => ({ ...f, disposition })),
          }),
        },
      }).linked,
      /review-blocking-not-rejected: m2-F1/u,
    );
  // Lowering the severity in the record does not turn a delivered medium into a non-blocking one.
  rejectedWith(
    groupCase(t, {
      adjudication: {
        edit: (record) => ({
          ...record,
          findings: record.findings.map((f) => ({ ...f, severity: 'low', disposition: 'fixed' })),
        }),
      },
    }).linked,
    /review-blocking-not-rejected: m2-F1/u,
  );
  for (const adjudication of [
    { writeLog: false },
    { header: `KNU review snapshot sha256:${'f'.repeat(64)}` },
    {
      edit: (record) => ({
        ...record,
        findings: record.findings.map((f) => ({ ...f, reason: 'not reproduced' })),
      }),
    },
    // A packet runner output is pre-review evidence, not a reproduction.
    { log: '.artifacts/tools/cross-model-handoff/test-output.txt' },
  ])
    rejectedWith(groupCase(t, { adjudication }).linked, /review-rejection-unbound: m2-F1/u);
  // A native task record is never a reproduction log, even with the right first line.
  const native = groupCase(t, { adjudication: false });
  const nativeLog = `.artifacts/tools/claude-native/${native.fail.qa.registered.taskId}/repro.log`;
  rejectedWith(
    linkGroup(
      native.subject,
      native.pass,
      writeGroupAdjudication(native.subject, native.members, { log: nativeLog }),
    ),
    /review-rejection-unbound: m2-F1/u,
  );
});

test('a group non-PASS without blocking findings, with notRun or with an unnamed gap stays open', (t) => {
  rejectedWith(
    groupCase(t, {
      failPatch: failing([groupFinding('m2-F1')], { notRun: ['node --test sample'] }),
    }).linked,
    /review-not-run-not-rejectable/u,
  );
  for (const failPatch of [
    (result) => gapped('criterion unverified')(failing([])(result)),
    failing([], { knownGaps: ['criterion unverified'] }),
    (result) => gapped('m2-L1 only')(failing([groupFinding('m2-L1', 'low')])(result)),
    // A FAIL with only low findings and no gap has nothing to reject either.
    failing([groupFinding('m2-L1', 'low')]),
  ])
    rejectedWith(groupCase(t, { failPatch }).linked, /review-gap-not-rejectable/u);
  // Rejecting the blocking finding does not close a gap or knownGaps entry that does not name it.
  for (const failPatch of [
    (result) => gapped('criterion 3 has no test output')(failing([groupFinding('m2-F1')])(result)),
    failing([groupFinding('m2-F1')], { knownGaps: ['criterion 3 unverified'] }),
    // m2-F10 is another id, not m2-F1.
    (result) => gapped('blocked by m2-F10')(failing([groupFinding('m2-F1')])(result)),
  ])
    rejectedWith(groupCase(t, { failPatch }).linked, /review-gap-not-rejectable: /u);
});

test('only the members of one first-round group can close a non-PASS member', (t) => {
  // An extra reviewer outside the group, even a PASS one, is reviewer shopping.
  {
    const { subject, packet } = reviewedSubject(t);
    const pass = groupMember(t, subject, packet, 1);
    const fail = groupMember(t, subject, packet, 2, {
      verdict: 'FAIL',
      patch: failing([groupFinding('m2-F1')]),
    });
    const extra = groupMember(t, subject, packet, 0, {
      prompt: 'Review the frozen subject packet only.',
    });
    rejectedWith(
      linkGroup(subject, pass, writeGroupAdjudication(subject, [pass, fail, extra])),
      /review-group-mismatch/u,
    );
  }
  {
    const { subject, packet } = reviewedSubject(t);
    const pass = groupMember(t, subject, packet, 1);
    const fail = groupMember(t, subject, packet, 2, {
      verdict: 'FAIL',
      groupId: 'ffff0000',
      patch: failing([groupFinding('m2-F1')]),
    });
    rejectedWith(
      linkGroup(subject, pass, writeGroupAdjudication(subject, [pass, fail])),
      /review-group-mismatch/u,
    );
  }
  {
    // A member index above the group size.
    const { subject, packet } = reviewedSubject(t);
    const pass = groupMember(t, subject, packet, 1);
    const fail = groupMember(t, subject, packet, 3, {
      verdict: 'FAIL',
      patch: failing([groupFinding('m3-F1')]),
    });
    rejectedWith(
      linkGroup(subject, pass, writeGroupAdjudication(subject, [pass, fail])),
      /review-group-mismatch/u,
    );
  }
  {
    // A single reviewer's FAIL stays unclosable by an adjudication record.
    const { subject, packet } = reviewedSubject(t);
    const single = groupMember(t, subject, packet, 0, {
      verdict: 'FAIL',
      prompt: 'Review the frozen subject packet only.',
      patch: failing([groupFinding('F1')]),
    });
    const pass = groupMember(t, subject, packet, 0, {
      prompt: 'Review the frozen subject packet only.',
    });
    const outcome = linkGroup(subject, pass, writeGroupAdjudication(subject, [single, pass]));
    rejectedWith(outcome, /FAIL review receipt/u);
  }
  {
    // Re-dispatching a member index to find a PASS inside the group is refused.
    const { subject, packet } = reviewedSubject(t);
    const fail = groupMember(t, subject, packet, 1, {
      verdict: 'FAIL',
      patch: failing([groupFinding('m1-F1')]),
    });
    const retry = groupMember(t, subject, packet, 1);
    const pass = groupMember(t, subject, packet, 2);
    rejectedWith(
      linkGroup(subject, retry, writeGroupAdjudication(subject, [fail, retry, pass])),
      /review-group-duplicate-member/u,
    );
  }
  {
    // A reviewer registered but never dispatched is not a member and does not block.
    const { subject, packet } = reviewedSubject(t);
    reviewer(t, subject, packet);
    const pass = groupMember(t, subject, packet, 1);
    const fail = groupMember(t, subject, packet, 2, {
      verdict: 'FAIL',
      patch: failing([groupFinding('m2-F1')]),
    });
    const outcome = linkGroup(subject, pass, writeGroupAdjudication(subject, [pass, fail]));
    assert.equal(outcome.valid, true, outcome.errors.join(' | '));
  }
  {
    // An earlier attempt of the same index that failed as an Agent call is not a member.
    const { subject, packet } = reviewedSubject(t);
    groupMember(t, subject, packet, 1, { dispatch: 'failed-call' });
    const pass = groupMember(t, subject, packet, 1);
    const fail = groupMember(t, subject, packet, 2, {
      verdict: 'FAIL',
      patch: failing([groupFinding('m2-F1')]),
    });
    const outcome = linkGroup(subject, pass, writeGroupAdjudication(subject, [pass, fail]));
    assert.equal(outcome.valid, true, outcome.errors.join(' | '));
  }
  {
    // An unsettled member has no known verdict.
    const { subject, packet } = reviewedSubject(t);
    const pass = groupMember(t, subject, packet, 1, { size: 3 });
    const fail = groupMember(t, subject, packet, 2, {
      size: 3,
      verdict: 'FAIL',
      patch: failing([groupFinding('m2-F1')]),
    });
    groupMember(t, subject, packet, 3, { size: 3, dispatch: 'unsettled' });
    rejectedWith(
      linkGroup(subject, pass, writeGroupAdjudication(subject, [pass, fail])),
      /unsettled or released review attempt/u,
    );
  }
  {
    // With every member FAIL there is no PASS member to link.
    const { subject, packet } = reviewedSubject(t);
    const first = groupMember(t, subject, packet, 1, {
      verdict: 'FAIL',
      patch: failing([groupFinding('m1-F1')]),
    });
    const second = groupMember(t, subject, packet, 2, {
      verdict: 'FAIL',
      patch: failing([groupFinding('m2-F1')]),
    });
    assert.equal(
      linkGroup(subject, first, writeGroupAdjudication(subject, [first, second])).valid,
      false,
    );
  }
});

test('a group non-PASS member whose result or receipt cannot be read keeps blocking', (t) => {
  for (const text of [
    'FAIL m2-F1 medium (not JSON)',
    'null',
    JSON.stringify({ verdict: 'FAIL' }),
  ]) {
    const { subject, packet } = reviewedSubject(t);
    const pass = groupMember(t, subject, packet, 1);
    const qa = reviewer(t, subject, packet, { prompt: groupPrompt(2) });
    handle(qa);
    finish(qa, { content: [{ type: 'text', text }] });
    const outcome = linkGroup(subject, pass, writeGroupAdjudication(subject, [pass]));
    rejectedWith(outcome, /review-group-unreadable-member/u);
    rejectedWith(outcome, /delivered non-PASS review/u);
  }
  // A FAIL member whose receipt was damaged after it completed.
  const { subject, packet } = reviewedSubject(t);
  const pass = groupMember(t, subject, packet, 1);
  const fail = groupMember(t, subject, packet, 2, {
    verdict: 'FAIL',
    patch: failing([groupFinding('m2-F1')]),
  });
  const path = writeGroupAdjudication(subject, [pass, fail]);
  writeFileSync(join(fail.qa.registered.evidenceDirectory, 'review-receipt.json'), '{');
  rejectedWith(linkGroup(subject, pass, path), /review-group-unreadable-member/u);
});

test('a packet runner output is not a reproduction under another spelling or as a copy', (t) => {
  for (const log of [
    '.artifacts/tools/cross-model-handoff/./test-output.txt',
    '.artifacts/tools//cross-model-handoff/test-output.txt',
  ])
    rejectedWith(
      groupCase(t, { adjudication: { log } }).linked,
      /review-rejection-unbound: m2-F1/u,
    );
  // A byte-identical copy of the runner output under a new name.
  const copied = groupCase(t, { adjudication: false });
  const root = realpathSync(copied.subject.root);
  const path = writeGroupAdjudication(copied.subject, copied.members, {
    log: '.artifacts/tools/cross-model-handoff/test-output.txt',
  });
  mkdirSync(join(root, GROUP_DIR), { recursive: true });
  writeFileSync(
    join(root, GROUP_DIR, 'copy.log'),
    readFileSync(join(root, '.artifacts/tools/cross-model-handoff/test-output.txt')),
  );
  const record = JSON.parse(readFileSync(join(root, path)));
  record.findings = record.findings.map((f) => ({
    ...f,
    reason: `not reproduced: \`${GROUP_DIR}/copy.log\``,
  }));
  writeFileSync(join(root, path), JSON.stringify(record));
  rejectedWith(linkGroup(copied.subject, copied.pass, path), /review-rejection-unbound: m2-F1/u);
});

test('a gap may name an id-less finding by its task id and index', (t) => {
  const { subject, packet } = reviewedSubject(t);
  const pass = groupMember(t, subject, packet, 1);
  const qa = reviewer(t, subject, packet, { prompt: groupPrompt(2) });
  const id = `${qa.registered.taskId}#0`;
  const result = gapped(`criterion blocked by ${id}`)(
    failing([groupFinding(undefined)], { knownGaps: [`${id} unresolved`] })(
      reviewResult(packet, 'unknown', 'FAIL'),
    ),
  );
  handle(qa);
  finish(qa, { content: [{ type: 'text', text: JSON.stringify(result) }] });
  const fail = { qa, result };
  const outcome = linkGroup(subject, pass, writeGroupAdjudication(subject, [pass, fail]));
  assert.equal(outcome.valid, true, outcome.errors.join(' | '));
});

test('settle forwards the reviewAdjudication judgment field to builder completion', (t) => {
  const { subject, pass, members } = groupCase(t, { adjudication: false });
  const path = writeGroupAdjudication(subject, members);
  const semantic = semanticResult(subject);
  const judgment = {
    responseDigest: semantic.responseDigest,
    acceptance: semantic.acceptance,
    checks: ['group adjudication checked'],
    reviewerTaskId: pass.qa.registered.taskId,
  };
  const root = realpathSync(subject.root);
  assert.throws(
    () =>
      settleClaudeNativeTask(
        subject.registered.taskId,
        { ...judgment, reviewAdjudication: '' },
        { root },
      ),
    /review-adjudication-path-required/u,
  );
  rejectedWith(
    settleClaudeNativeTask(subject.registered.taskId, judgment, { root }),
    /review-adjudication-required/u,
  );
  const settled = settleClaudeNativeTask(
    subject.registered.taskId,
    { ...judgment, reviewAdjudication: path },
    { root },
  );
  assert.equal(settled.valid, true, settled.errors.join(' | '));
});

// The child transcript limit guards memory, not integrity: a 5 MiB transcript (a long researcher
// run reached 10.39 MiB) settles with every row still checked.
const FIVE_MIB = 5 * 1024 * 1024;
test('a 5 MiB child transcript keeps its foreground effort observation', (t) => {
  const f = setup(t);
  handle(f);
  finish(f, {}, { text: 'x'.repeat(FIVE_MIB) });
  assert.deepEqual(effortErrors(f), []);
});
test('a 5 MiB child transcript settles in the background', (t) => {
  const { subject, packet } = reviewedSubject(t);
  asyncReview(t, subject, packet, [], 'xhigh', 'x'.repeat(FIVE_MIB));
});
test('a child transcript over the limit is refused: background names its size, foreground its reason', (t) => {
  const f = setup(t);
  handle(f);
  finish(f);
  truncateSync(childPathOf(f), CHILD_TRANSCRIPT_BYTE_LIMIT + 1); // sparse
  assert.deepEqual(effortErrors(f), ['effort-transcript-too-large']);
  const { subject, packet } = reviewedSubject(t);
  assert.throws(
    () => asyncReview(t, subject, packet, [], 'xhigh', 'x'.repeat(CHILD_TRANSCRIPT_BYTE_LIMIT)),
    new RegExp(
      `stopped-task-settlement-failed: transcript byte limit: \\d+ > ${CHILD_TRANSCRIPT_BYTE_LIMIT}`,
      'u',
    ),
  );
});

// A group member that read ignored inputs carries its own manifest. Only the linked member passes
// through currentObservation, so builder completion judges every delivered member's manifest.
const MEMBER_INPUT = '.artifacts/plans/group-inputs/plan.md';
function groupWithInputs(t, change) {
  const { subject, packet } = reviewedSubject(t);
  const root = realpathSync(subject.root);
  mkdirSync(join(root, MEMBER_INPUT, '..'), { recursive: true });
  writeFileSync(join(root, MEMBER_INPUT), 'rev 1\n');
  const readScope = ['sample.txt', MEMBER_INPUT];
  const files = claudeReviewInputs(root, readScope);
  assert.deepEqual(Object.keys(files), [MEMBER_INPUT]);
  const bytes = Buffer.from(`${JSON.stringify({ files })}\n`);
  const inputs = writeClaudeReviewPacket(root, 'abcd1234-0000aaaa', bytes, '.inputs.json');
  const pass = groupMember(t, subject, packet, 1);
  const fail = groupMember(t, subject, packet, 2, {
    verdict: 'FAIL',
    patch: failing([groupFinding('m2-F1')]),
    readScope,
    prompt: `${groupPrompt(2)}\n${REVIEW_INPUTS_LINE}${inputs.path} ${inputs.digest}`,
  });
  const path = writeGroupAdjudication(subject, [pass, fail]);
  change?.(root, inputs.path);
  return { fail, outcome: linkGroup(subject, pass, path) };
}
test('builder completion judges the manifest of every delivered group member', (t) => {
  const { outcome } = groupWithInputs(t);
  assert.equal(outcome.valid, true, outcome.errors.join(' | '));
  const changed = groupWithInputs(t, (root) => writeFileSync(join(root, MEMBER_INPUT), 'rev 2\n'));
  rejectedWith(
    changed.outcome,
    new RegExp(
      `^review-input-changed:${MEMBER_INPUT} \\(${changed.fail.qa.registered.taskId}\\)$`,
      'u',
    ),
  );
  const tampered = groupWithInputs(t, (root, manifest) =>
    writeFileSync(join(root, manifest), '{"files":{}}\n'),
  );
  rejectedWith(
    tampered.outcome,
    new RegExp(`^review-input-manifest-changed \\(${tampered.fail.qa.registered.taskId}\\)$`, 'u'),
  );
});
