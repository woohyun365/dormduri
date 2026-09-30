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
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { execFileSync, spawnSync } from 'node:child_process';
import test from 'node:test';
import { fixture } from './fixtures/claude-native-session-fixture.mjs';
import {
  registerClaudeNativeTask,
  handleClaudeNativeSessionEvent,
  completeClaudeNativeTask,
  releaseClaudeNativeTask,
} from '../agents/claude/native-session.mjs';

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
function finish(f, patch = {}) {
  return handle(f, {
    ...f.event,
    hook_event_name: 'PostToolUse',
    tool_response: {
      status: 'completed',
      agentId: 'child-1',
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
    readFileSync(new URL('../../.claude/settings.json', import.meta.url)),
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
  writeFileSync(
    join(f.root, '.claude/agents/knu_executor.md'),
    '---\nname: knu_executor\ntools: Read, Grep, Glob, Edit, Write, Bash\n---\nImplement bounded work.\n',
  );
  writeFileSync(
    join(f.root, '.claude/agents/knu_reviewer.md'),
    '---\nname: knu_reviewer\ntools: Read, Grep, Glob\n---\nReview only.\n',
  );
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
  f.options.expectedResolvedModel = 'claude-sonnet-5';
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

function reviewPacket(subject, snapshot) {
  const { basePacket } = JSON.parse(
    readFileSync(join(import.meta.dirname, 'fixtures/cross-model-handoff-cases.json')),
  );
  return {
    ...structuredClone(basePacket),
    packetId: 'native-review-packet',
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
    readFileSync(join(import.meta.dirname, 'fixtures/cross-model-handoff-cases.json')),
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
  const registered = registerClaudeNativeTask({
    workflowInput: input,
    sessionId: options.sessionId ?? subject.event.session_id,
    prompt: 'Review the frozen subject packet only.',
    expectedResolvedModel,
    independentReview: {
      subjectTaskId: subject.registered.taskId,
      reviewerId: 'reviewer',
      builderIds: ['builder'],
      packet,
      ...options.independentReview,
    },
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
  assert.match(qa.registered.invocation.prompt, /native-review-packet/);
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

  // The hooks skip a task copied from another checkout; linked-review settlement still refuses it.
  rmSync(empty, { recursive: true });
  plantForeignTask(subject.root);
  const foreign = builderLinkedTo(passingReview());
  assert.equal(foreign.valid, false);
  assert.ok(foreign.errors.some((error) => /unreadable native task/.test(error)));
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
function asyncReview(t, subject, packet, parentRows = []) {
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
    {
      type: 'assistant',
      sessionId: qa.event.session_id,
      agentId,
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
  const semantic = semanticResult(qa);
  semantic.reviewResult = result;
  assert.equal(
    completeClaudeNativeTask(qa.registered.taskId, semantic, { root: qa.root }).valid,
    true,
  );
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
    tool_input: { to: 'child-1', message: 'resume' },
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
  const script = new URL('../agents/claude/native-session.mjs', import.meta.url).pathname;
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
  assert.equal(checked.observation.finalSnapshot.untrackedInputDigests[0].path, 'new.txt');
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
      agent_type: 'knu_explorer',
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
      agent_type: 'knu_explorer',
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
// Parent edit, so they are refused as unattributable instead of being recorded as child changes.
function readOnlyWithOtherFile(t) {
  const f = fixture(t);
  writeFileSync(join(f.root, '.git/info/exclude'), '.artifacts/\n');
  writeFileSync(join(f.root, 'other.txt'), 'outside read scope');
  execFileSync('git', ['add', 'other.txt'], { cwd: f.root });
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
for (const [kind, path, change] of [
  ['tracked edit in read scope', 'sample.txt', (p) => writeFileSync(p, 'parent edit')],
  ['tracked edit outside read scope', 'other.txt', (p) => writeFileSync(p, 'parent edit')],
  ['new file in read scope', 'in-scope-new.txt', (p) => writeFileSync(p, 'new')],
  ['new file outside read scope', 'outside-new.txt', (p) => writeFileSync(p, 'new')],
  ['deletion in read scope', 'sample.txt', (p) => rmSync(p)],
  ['deletion outside read scope', 'other.txt', (p) => rmSync(p)],
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

test('an edit after the child stopped is post-completion drift, not a child change', (t) => {
  const f = readOnlyWithOtherFile(t);
  handle(f);
  finish(f);
  writeFileSync(join(f.root, 'other.txt'), 'parent edit after stop');
  const checked = completeClaudeNativeTask(f.registered.taskId, semanticResult(f), {
    root: f.root,
  });
  assert.equal(checked.valid, false);
  assert.ok(checked.errors.includes('post-completion-file-drift'), checked.errors.join());
  assert.deepEqual(
    JSON.parse(readFileSync(join(f.registered.evidenceDirectory, 'completion.json'))).errors,
    [],
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
    agent_type: 'knu_explorer',
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
const hookScript = new URL('../agents/claude/native-session.mjs', import.meta.url).pathname;
function runHook(root, event, env = {}) {
  return spawnSync(process.execPath, [hookScript, '--hook'], {
    cwd: root,
    env: { ...process.env, CLAUDE_PROJECT_DIR: root, ...env },
    input: JSON.stringify(event),
    encoding: 'utf8',
  });
}
function plantForeignTask(root) {
  const id = randomUUID();
  const dir = join(realpathSync(root), '.artifacts/tools/claude-native', id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, 'task.json'),
    JSON.stringify({
      record: { version: 1, taskId: id, root: '/moved/checkout' },
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
    agent_type: 'knu_explorer',
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
    (e, f) => writeFileSync(join(f.root, '.claude/agents/knu_explorer.md'), 'changed role\n'),
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
