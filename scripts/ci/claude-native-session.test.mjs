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
} from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { execFileSync, spawnSync } from 'node:child_process';
import test from 'node:test';
import { fixture } from './fixtures/claude-native-qualification-fixture.mjs';
import {
  registerClaudeNativeTask,
  handleClaudeNativeSessionEvent,
  completeClaudeNativeTask,
  releaseClaudeNativeTask,
} from '../agents/claude/native-session.mjs';

function setup(t) {
  const f = fixture(t);
  writeFileSync(join(f.root, '.git/info/exclude'), 'artifacts/\n');
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
  assert.deepEqual(Object.keys(settings), ['hooks']);
  assert.deepEqual(Object.keys(settings.hooks), [
    'SessionStart',
    'PreToolUse',
    'PostToolUse',
    'PostToolUseFailure',
    'SubagentStop',
  ]);
  assert.equal(settings.hooks.PreToolUse[0].matcher, 'Agent|SendMessage');
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
  writeFileSync(join(f.root, '.git/info/exclude'), 'artifacts/\n');
  mkdirSync(join(f.root, 'artifacts/local'), { recursive: true });
  symlinkSync(outside, join(f.root, 'artifacts/local/claude-native'));
  assert.throws(
    () =>
      registerClaudeNativeTask({ ...f.options, workflowInput: f.input, sessionId: randomUUID() }),
    /ancestor symlink/,
  );
  assert.deepEqual(readdirSync(outside), []);
});
function writer(t) {
  const f = fixture(t);
  writeFileSync(join(f.root, '.git/info/exclude'), 'artifacts/\n');
  writeFileSync(
    join(f.root, '.claude/agents/knu_executor.md'),
    '---\nname: knu_executor\ntools: Read, Grep, Glob, Edit, Write, Bash\n---\nImplement bounded work.\n',
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
  assert.deepEqual(checked.errors, ['independent QA exchange required']);
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
    const base = join(realpathSync(f.root), 'artifacts/transcripts'),
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
