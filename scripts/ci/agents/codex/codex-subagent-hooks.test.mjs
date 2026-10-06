import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

import { ALLOWED_CHILD_MODELS, ROLE_EFFORTS } from '../../../agents/codex/model-profiles.mjs';

const repoRoot = resolve(import.meta.dirname, '../../../..');
const hookPath = resolve(repoRoot, '.codex/hooks/knu-subagent-hooks.mjs');
const policyPath = resolve(repoRoot, '.codex/hooks/knu-hook-policy.json');
const SESSION = '01a10cfc-ad92-7063-894c-5da2be8c9650';
const CHILD = '01a10cfd-0302-7160-bff3-21e68e480903';
const POLICY = { allowedModels: [...ALLOWED_CHILD_MODELS], roster: Object.keys(ROLE_EFFORTS) };

// Loaded per test so a missing module fails each case on its own reason.
const hooks = () => import('../../../../.codex/hooks/knu-subagent-hooks.mjs');
const records = () => import('../../../agents/codex/subagent-hook-records.mjs');

function spawnCall(input, { toolName = 'collaborationspawn_agent', child = false } = {}) {
  return {
    session_id: SESSION,
    turn_id: 'turn-1',
    hook_event_name: 'PreToolUse',
    model: 'gpt-6-astra',
    tool_name: toolName,
    tool_use_id: 'call_1',
    tool_input: {
      task_name: 'lane_one',
      agent_type: 'knu_explorer',
      model: 'gpt-6-astra',
      fork_turns: 'none',
      message: 'secret task text',
      ...input,
    },
    ...(child ? { agent_id: CHILD, agent_type: 'knu_explorer' } : {}),
  };
}

test('guard allows a repo roster spawn with an allowed explicit model and a bounded fork', async () => {
  const { decideToolUse } = await hooks();
  for (const [input, toolName] of [
    [{}, 'collaborationspawn_agent'],
    [{ fork_turns: '3' }, 'collaborationspawn_agent'],
    [{ fork_turns: 2 }, 'collaborationspawn_agent'],
    [{ agent_type: 'knu_reviewer' }, 'teamspawn_agent'],
  ])
    assert.deepEqual(decideToolUse(spawnCall(input, { toolName }), POLICY), {
      action: 'allow',
      tool: 'spawn_agent',
      caller: 'root',
    });
});

test('guard denies each spawn outside the three conditions with its own reason', async () => {
  const { decideToolUse } = await hooks();
  const cases = [
    [{ agent_type: 'default' }, 'role-not-in-roster'],
    [{ agent_type: 'worker' }, 'role-not-in-roster'],
    [{ agent_type: undefined }, 'role-not-in-roster'],
    [{ model: undefined }, 'model-missing'],
    [{ model: '' }, 'model-missing'],
    [{ model: 'gpt-x-unlisted' }, 'model-not-allowed'],
    [{ fork_turns: undefined }, 'full-history-fork'],
    [{ fork_turns: 'all' }, 'full-history-fork'],
    [{ fork_turns: '0' }, 'full-history-fork'],
  ];
  for (const [input, reason] of cases)
    assert.deepEqual(
      decideToolUse(spawnCall(input), POLICY),
      { action: 'deny', tool: 'spawn_agent', caller: 'root', reason },
      JSON.stringify(input),
    );
});

test('guard denies child spawns and every unnamespaced spawn_agent before reading arguments', async () => {
  const { decideToolUse } = await hooks();
  assert.equal(decideToolUse(spawnCall({}, { child: true }), POLICY).reason, 'child-spawn-denied');
  // V1 roots and namespace-less V2 providers both arrive as bare spawn_agent (W7-32).
  assert.deepEqual(decideToolUse(spawnCall({}, { toolName: 'spawn_agent' }), POLICY), {
    action: 'deny',
    tool: 'spawn_agent',
    caller: 'root',
    reason: 'unnamespaced-spawn-denied',
  });
  assert.equal(
    decideToolUse({ ...spawnCall({}), tool_input: 'not-json' }, POLICY).reason,
    'spawn-input-invalid',
  );
});

test('guard only records follow-up and message tools and ignores unrelated tools', async () => {
  const { decideToolUse } = await hooks();
  const call = (toolName, child) => ({
    ...spawnCall({}, { toolName, child }),
    tool_input: { target: '/root', message: 'x' },
  });
  assert.deepEqual(decideToolUse(call('collaborationsend_message', true), POLICY), {
    action: 'record',
    tool: 'send_message',
    caller: 'child',
  });
  assert.equal(decideToolUse(call('collaborationfollowup_task', false), POLICY).action, 'record');
  assert.deepEqual(decideToolUse({ ...call('Bash'), tool_name: 'Bash' }, POLICY), {
    action: 'ignore',
  });
});

test('hook records keep identities and sizes but never message text', async () => {
  const { buildHookRecord } = await hooks();
  const record = buildHookRecord(spawnCall({}), {
    policy: POLICY,
    now: '2026-10-06T00:00:00Z',
  });
  assert.equal(record.event, 'PreToolUse');
  assert.equal(record.sessionId, SESSION);
  assert.equal(record.decision, 'allow');
  assert.deepEqual(record.input, {
    task_name: 'lane_one',
    agent_type: 'knu_explorer',
    model: 'gpt-6-astra',
    fork_turns: 'none',
    messageBytes: Buffer.byteLength('secret task text'),
  });
  assert.doesNotMatch(JSON.stringify(record), /secret task text/u);
});

test('subagent records read agent path and own-turn model and effort from the child rollout', async (t) => {
  const { buildHookRecord } = await hooks();
  const directory = mkdtempSync(join(tmpdir(), 'knu-hook-rollout-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const rollout = join(directory, 'rollout.jsonl');
  writeFileSync(rollout, childRollout({ effort: 'medium' }).join('\r\n'));
  const start = buildHookRecord(
    {
      session_id: SESSION,
      hook_event_name: 'SubagentStart',
      model: 'gpt-6.1-sol',
      transcript_path: rollout,
      agent_id: CHILD,
      agent_type: 'knu_explorer_medium',
    },
    { policy: POLICY },
  );
  assert.equal(start.agentPath, '/root/lane_one');
  assert.equal(start.parentThreadId, SESSION);
  assert.equal(start.model, 'gpt-6.1-sol');
  const stop = buildHookRecord(
    {
      session_id: SESSION,
      hook_event_name: 'SubagentStop',
      model: 'gpt-6.1-sol',
      transcript_path: '/elsewhere/parent.jsonl',
      agent_transcript_path: rollout,
      agent_id: CHILD,
      agent_type: 'knu_explorer_medium',
      last_assistant_message: 'final answer text',
    },
    { policy: POLICY },
  );
  assert.equal(stop.agentPath, '/root/lane_one');
  assert.deepEqual(stop.ownTurn, { model: 'gpt-6.1-sol', effort: 'medium' });
  assert.equal(stop.lastMessageBytes, Buffer.byteLength('final answer text'));
  assert.doesNotMatch(JSON.stringify(stop), /final answer text/u);
  const unreadable = buildHookRecord(
    {
      session_id: SESSION,
      hook_event_name: 'SubagentStop',
      agent_id: CHILD,
      agent_type: 'knu_explorer_medium',
      agent_transcript_path: join(directory, 'missing.jsonl'),
    },
    { policy: POLICY },
  );
  assert.equal(unreadable.agentPath, null);
  assert.equal(unreadable.ownTurn, null);
});

test('the installed hook writes session records under .codex/state and prints the decision', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'knu-hook-root-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, '.codex/hooks'), { recursive: true });
  copyFileSync(hookPath, join(root, '.codex/hooks/knu-subagent-hooks.mjs'));
  copyFileSync(policyPath, join(root, '.codex/hooks/knu-hook-policy.json'));
  const run = (payload) =>
    spawnSync(process.execPath, [join(root, '.codex/hooks/knu-subagent-hooks.mjs')], {
      cwd: root,
      input: JSON.stringify(payload),
      encoding: 'utf8',
    });

  const denied = run(spawnCall({ model: 'gpt-x-unlisted' }));
  assert.equal(denied.status, 0, denied.stderr);
  const output = JSON.parse(denied.stdout);
  assert.equal(output.hookSpecificOutput.hookEventName, 'PreToolUse');
  assert.equal(output.hookSpecificOutput.permissionDecision, 'deny');
  assert.match(output.hookSpecificOutput.permissionDecisionReason, /model-not-allowed/u);

  const allowed = run(spawnCall({}));
  assert.equal(allowed.status, 0, allowed.stderr);
  assert.equal(allowed.stdout, '');

  const stop = run({
    session_id: SESSION,
    hook_event_name: 'SubagentStop',
    agent_id: CHILD,
    agent_type: 'knu_explorer',
    agent_transcript_path: null,
  });
  assert.equal(stop.status, 0, stop.stderr);
  assert.deepEqual(JSON.parse(stop.stdout), {});

  const lines = readFileSync(
    join(root, '.codex/state/knu-subagent-hooks', `${SESSION}.jsonl`),
    'utf8',
  )
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  assert.deepEqual(
    lines.map(({ event, decision, reason }) => [event, decision ?? null, reason ?? null]),
    [
      ['PreToolUse', 'deny', 'model-not-allowed'],
      ['PreToolUse', 'allow', null],
      ['SubagentStop', null, null],
    ],
  );
  assert.ok(lines.every(({ policyDigest }) => /^sha256:[0-9a-f]{64}$/u.test(policyDigest)));
});

test('a guard failure denies the spawn instead of failing open', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'knu-hook-broken-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, '.codex/hooks'), { recursive: true });
  copyFileSync(hookPath, join(root, '.codex/hooks/knu-subagent-hooks.mjs'));
  writeFileSync(join(root, '.codex/hooks/knu-hook-policy.json'), '{broken');
  const result = spawnSync(process.execPath, [join(root, '.codex/hooks/knu-subagent-hooks.mjs')], {
    cwd: root,
    input: JSON.stringify(spawnCall({})),
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout).hookSpecificOutput;
  assert.equal(output.permissionDecision, 'deny');
  assert.match(output.permissionDecisionReason, /guard-error/u);
});

test('completion is accepted only when start and stop records bind the lane to an allowed roster child', async () => {
  const { evaluateHookCompletion, laneTaskPath } = await records();
  const taskPath = laneTaskPath('lane-one');
  assert.equal(taskPath, '/root/lane_one');
  const accepted = evaluateHookCompletion({
    observation: observation(),
    taskPath,
    expectedRole: 'knu_explorer',
  });
  assert.deepEqual(accepted, {
    accepted: true,
    reason: null,
    agentId: CHILD,
    agentType: 'knu_explorer',
    model: 'gpt-6-astra',
    effort: 'high',
  });
});

test('completion is refused for missing, partial, mismatched or out-of-policy observations', async () => {
  const { evaluateHookCompletion } = await records();
  const refuse = (obs, expectedRole = 'knu_explorer', taskPath = '/root/lane_one') =>
    evaluateHookCompletion({ observation: obs, taskPath, expectedRole }).reason;
  assert.equal(refuse(undefined), 'observation-missing');
  assert.equal(refuse(observation({ records: [] })), 'observation-missing');
  assert.equal(refuse(observation(), 'knu_explorer', '/root/other_lane'), 'observation-missing');
  assert.equal(refuse(observation({ sessionId: 'another-session' })), 'observation-missing');
  assert.equal(refuse(observation({ drop: 'SubagentStop' })), 'observation-incomplete');
  assert.equal(refuse(observation({ drop: 'SubagentStart' })), 'observation-incomplete');
  assert.equal(refuse(observation(), 'knu_explorer_xhigh'), 'observation-mismatch');
  assert.equal(refuse(observation({ parentThreadId: 'foreign' })), 'observation-mismatch');
  // A start record without a readable rollout still needs the stop record to name the Parent thread.
  const [start, stop] = observation().records;
  assert.equal(
    refuse(
      observation({
        records: [
          { ...start, parentThreadId: null },
          { ...stop, parentThreadId: 'foreign' },
        ],
      }),
    ),
    'observation-mismatch',
  );
  assert.equal(refuse(observation({ model: 'gpt-x-unlisted' })), 'model-not-allowed');
  assert.equal(refuse(observation({ agentType: 'default' }), 'default'), 'role-not-in-roster');
});

test('completion reads only the parent session record file and skips malformed lines', async (t) => {
  const { readHookRecords, HOOK_RECORD_DIRECTORY } = await records();
  const root = mkdtempSync(join(tmpdir(), 'knu-hook-records-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, HOOK_RECORD_DIRECTORY), { recursive: true });
  writeFileSync(
    join(root, HOOK_RECORD_DIRECTORY, `${SESSION}.jsonl`),
    [JSON.stringify(observation().records[0]), '{oops', ''].join('\r\n'),
  );
  const read = readHookRecords({ root, sessionId: SESSION });
  assert.equal(read.records.length, 1);
  assert.equal(read.malformed, 1);
  assert.deepEqual(readHookRecords({ root, sessionId: 'absent' }).records, []);
  assert.throws(() => readHookRecords({ root, sessionId: '../escape' }), /session id/u);
});

function childRollout({ effort = 'high', model = 'gpt-6.1-sol' } = {}) {
  return [
    JSON.stringify({
      type: 'session_meta',
      payload: {
        id: CHILD,
        source: {
          subagent: {
            thread_spawn: {
              parent_thread_id: SESSION,
              depth: 1,
              agent_path: '/root/lane_one',
              agent_role: 'knu_explorer_medium',
            },
          },
        },
      },
    }),
    JSON.stringify({ type: 'turn_context', payload: { model: 'gpt-6-astra', effort: 'low' } }),
    JSON.stringify({ type: 'turn_context', payload: { model, effort } }),
  ];
}

function observation({
  records: given,
  sessionId = SESSION,
  drop,
  model = 'gpt-6-astra',
  agentType = 'knu_explorer',
  parentThreadId = SESSION,
} = {}) {
  const base = {
    schema: 'knu-codex-subagent-hook/v1',
    sessionId: SESSION,
    agentId: CHILD,
    agentType,
  };
  const all = given ?? [
    { ...base, event: 'SubagentStart', model, agentPath: '/root/lane_one', parentThreadId },
    {
      ...base,
      event: 'SubagentStop',
      model,
      agentPath: '/root/lane_one',
      parentThreadId,
      ownTurn: { model, effort: 'high' },
    },
  ];
  return {
    sessionId,
    records: all.filter(({ event }) => event !== drop),
    allowedModels: POLICY.allowedModels,
    roster: POLICY.roster,
  };
}

test('the completion command reports a refusal for the Parent session and rejects bad usage', () => {
  const command = resolve(repoRoot, 'scripts/agents/codex/subagent-hook-records.mjs');
  const run = (args, env = {}) =>
    spawnSync(process.execPath, [command, ...args], {
      cwd: repoRoot,
      encoding: 'utf8',
      env: { ...process.env, CODEX_THREAD_ID: '', ...env },
    });
  const refused = run(['--lane', 'lane-one', '--role', 'knu_explorer'], {
    CODEX_THREAD_ID: 'knu-test-session-without-records',
  });
  assert.equal(refused.status, 1, refused.stderr);
  assert.deepEqual(
    (({ completionAuthority, sessionId, taskPath, accepted, reason }) => ({
      completionAuthority,
      sessionId,
      taskPath,
      accepted,
      reason,
    }))(JSON.parse(refused.stdout)),
    {
      completionAuthority: 'codex-subagent-hook',
      sessionId: 'knu-test-session-without-records',
      taskPath: '/root/lane_one',
      accepted: false,
      reason: 'observation-missing',
    },
  );
  assert.equal(run(['--lane', 'lane-one']).status, 2);
  const noSession = run(['--lane', 'lane-one', '--role', 'knu_explorer']);
  assert.equal(noSession.status, 2);
  assert.match(noSession.stderr, /session id/u);
});
