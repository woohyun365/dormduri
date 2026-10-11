import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';

import { ALLOWED_CHILD_MODELS, ROLE_EFFORTS } from '../../../agents/codex/model-profiles.mjs';

const repoRoot = resolve(import.meta.dirname, '../../../..');
const hookPath = resolve(repoRoot, '.codex/hooks/knu-subagent-hooks.mjs');
const policyPath = resolve(repoRoot, '.codex/hooks/knu-hook-policy.json');
const SESSION = '01a10cfc-ad92-7063-894c-5da2be8c9650';
const CHILD = '01a10cfd-0302-7160-bff3-21e68e480903';
const ASTRA = 'gpt-6-astra';
const SOL = 'gpt-6.1-sol';
const LUNA = 'gpt-6-luna';
const GRANDCHILD = '01a10cfd-5d1e-7a40-9c0b-0f3b8e2a1c77';
// Guard and completion cases need a few pairs only; project-codex-config binds the installed copy to the owner.
const POLICY = {
  allowedModels: [...ALLOWED_CHILD_MODELS],
  roster: Object.keys(ROLE_EFFORTS),
  allowedRoleModels: {
    ...Object.fromEntries(Object.keys(ROLE_EFFORTS).map((role) => [role, [ASTRA]])),
    knu_explorer: [ASTRA, SOL],
    knu_explorer_xhigh: [ASTRA, LUNA, SOL],
  },
  roleEfforts: ROLE_EFFORTS,
};

// Loaded per test so a missing module fails each case on its own reason.
const hooks = () => import('../../../../.codex/hooks/knu-subagent-hooks.mjs');
const records = () => import('../../../agents/codex/subagent-hook-records.mjs');

// A registration whose spawn arguments are the call's plain arguments, as `codex:register` writes it before the spawn.
function registrationFor(call) {
  const input = call.tool_input;
  return {
    schema: 'knu-codex-task-registration/v1',
    sessionId: SESSION,
    taskName: input.task_name,
    kind: 'lane',
    laneId: 'lane-one',
    dispatchToken: 'k3x9',
    retry: false,
    spawnArguments: Object.fromEntries(
      ['task_name', 'agent_type', 'model', 'reasoning_effort', 'fork_turns']
        .filter((field) => input[field] !== undefined)
        .map((field) => [field, input[field]]),
    ),
  };
}

function registryFor(call) {
  const registration = registrationFor(call);
  const digest = `sha256:${createHash('sha256').update(JSON.stringify(registration)).digest('hex')}`;
  return {
    read: (taskName) => (taskName === registration.taskName ? { registration, digest } : null),
    used: () => false,
    settled: () => false,
  };
}

// A Parent (or, with child, a child) apply_patch call as code mode sends it: the patch text is tool_input.command.
function patchCall(patch, { child = false } = {}) {
  return {
    session_id: SESSION,
    turn_id: 'turn-1',
    hook_event_name: 'PreToolUse',
    model: 'gpt-6-astra',
    tool_name: 'apply_patch',
    tool_use_id: 'exec-1',
    tool_input: { command: `*** Begin Patch\n${patch}\n*** End Patch` },
    ...(child ? { agent_id: CHILD, agent_type: 'knu_executor' } : {}),
  };
}

function spawnCall(input, { toolName = 'collaborationspawn_agent', child = false } = {}) {
  return {
    session_id: SESSION,
    turn_id: 'turn-1',
    hook_event_name: 'PreToolUse',
    model: 'gpt-6-astra',
    tool_name: toolName,
    tool_use_id: 'call_1',
    tool_input: {
      task_name: 'lane_one_k3x9',
      agent_type: 'knu_explorer',
      model: 'gpt-6-astra',
      fork_turns: 'none',
      message: 'secret task text',
      ...input,
    },
    ...(child ? { agent_id: CHILD, agent_type: 'knu_explorer' } : {}),
  };
}

test('guard allows a repo roster spawn with an allowed explicit model and a fresh fork', async () => {
  const { decideToolUse } = await hooks();
  for (const [input, toolName] of [
    [{}, 'collaborationspawn_agent'],
    [{ agent_type: 'knu_reviewer' }, 'teamspawn_agent'],
  ]) {
    const call = spawnCall(input, { toolName });
    const { registration, ...decision } = decideToolUse(call, POLICY, registryFor(call));
    assert.deepEqual(decision, { action: 'allow', tool: 'spawn_agent', caller: 'root' });
    assert.deepEqual(registration.spawnArguments, registrationFor(call).spawnArguments);
  }
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
    // codex-cli 0.162.0 (#51329) reads a positive integer as a full-history fork.
    [{ fork_turns: '3' }, 'full-history-fork'],
    [{ fork_turns: 2 }, 'full-history-fork'],
    [{ fork_turns: 1 }, 'full-history-fork'],
  ];
  for (const [input, reason] of cases)
    assert.deepEqual(
      decideToolUse(spawnCall(input), POLICY),
      { action: 'deny', tool: 'spawn_agent', caller: 'root', reason },
      JSON.stringify(input),
    );
});

test('guard denies an allowed model that the role has no profile pair for', async () => {
  const { decideToolUse } = await hooks();
  const deny = { action: 'deny', tool: 'spawn_agent', caller: 'root', reason: 'pair-not-allowed' };
  for (const input of [
    { agent_type: 'knu_reviewer', model: SOL },
    { agent_type: 'knu_explorer', model: LUNA },
    { agent_type: 'knu_executor_medium', model: SOL },
    // The pair check runs before the fork check, so a bad pair names its own reason.
    { agent_type: 'knu_reviewer', model: LUNA, fork_turns: 'all' },
  ])
    assert.deepEqual(decideToolUse(spawnCall(input), POLICY), deny, JSON.stringify(input));
  for (const input of [
    { agent_type: 'knu_explorer', model: SOL },
    { agent_type: 'knu_explorer_xhigh', model: LUNA },
  ])
    assert.equal(
      decideToolUse(spawnCall(input), POLICY, registryFor(spawnCall(input))).action,
      'allow',
      JSON.stringify(input),
    );
  // A policy without pairs, or with inherited object keys, allows nothing.
  assert.equal(
    decideToolUse(spawnCall({}), { ...POLICY, allowedRoleModels: undefined }).reason,
    'pair-not-allowed',
  );
  assert.equal(
    decideToolUse(spawnCall({ agent_type: 'knu_explorer' }), {
      ...POLICY,
      allowedRoleModels: Object.create({ knu_explorer: [ASTRA] }),
    }).reason,
    'pair-not-allowed',
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
  // A child writes its own lane: its apply_patch is never guarded or recorded.
  assert.deepEqual(
    decideToolUse(patchCall('*** Add File: README.md\n+x', { child: true }), POLICY),
    {
      action: 'ignore',
    },
  );
});

test('a root apply_patch with no writer running prints nothing and writes no record', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'knu-hook-patch-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, '.codex/hooks'), { recursive: true });
  copyFileSync(hookPath, join(root, '.codex/hooks/knu-subagent-hooks.mjs'));
  copyFileSync(policyPath, join(root, '.codex/hooks/knu-hook-policy.json'));
  const result = spawnSync(process.execPath, [join(root, '.codex/hooks/knu-subagent-hooks.mjs')], {
    cwd: root,
    input: JSON.stringify({ ...patchCall('*** Update File: README.md\n+x'), cwd: root }),
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, '');
  assert.equal(
    existsSync(join(root, '.codex/state/knu-subagent-hooks', `${SESSION}.jsonl`)),
    false,
  );
});

test('hook records keep identities and sizes but never message text', async () => {
  const { buildHookRecord } = await hooks();
  const record = buildHookRecord(spawnCall({}), {
    policy: POLICY,
    registry: registryFor(spawnCall({})),
    now: '2026-10-06T00:00:00Z',
  });
  assert.equal(record.event, 'PreToolUse');
  assert.equal(record.sessionId, SESSION);
  assert.equal(record.decision, 'allow');
  assert.deepEqual(record.input, {
    task_name: 'lane_one_k3x9',
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
  // The deny text names the only fork the guard and the registration accept.
  assert.match(output.hookSpecificOutput.permissionDecisionReason, /fork_turns "none";/u);
  assert.doesNotMatch(output.hookSpecificOutput.permissionDecisionReason, /positive integer/u);

  // The installed copy carries the profile pairs: the reviewer runs only on its review profile model.
  const unpaired = run(spawnCall({ agent_type: 'knu_reviewer', model: SOL }));
  assert.equal(unpaired.status, 0, unpaired.stderr);
  assert.notEqual(
    unpaired.stdout,
    '',
    'the installed pair guard must deny the reviewer on 6.1 Sol',
  );
  assert.match(
    JSON.parse(unpaired.stdout).hookSpecificOutput.permissionDecisionReason,
    /pair-not-allowed/u,
  );

  // A spawn needs its registration in the Parent session's registration directory.
  const registrations = join(root, '.artifacts/tools/codex-native', SESSION);
  mkdirSync(registrations, { recursive: true });
  writeFileSync(
    join(registrations, 'lane_one_k3x9.json'),
    JSON.stringify(registrationFor(spawnCall({}))),
  );
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
      ['PreToolUse', 'deny', 'pair-not-allowed'],
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
  // A broken copy, stale v1 and v2 copies and a v3 copy without valid pairs or writer roles all fail closed.
  const writerRoles = ['knu_executor'];
  const unpaired = { allowedModels: POLICY.allowedModels, roster: POLICY.roster, writerRoles };
  const paired = { ...unpaired, allowedRoleModels: POLICY.allowedRoleModels };
  for (const policy of [
    '{broken',
    JSON.stringify({ schema: 'knu-codex-hook-policy/v1', ...unpaired }),
    JSON.stringify({ schema: 'knu-codex-hook-policy/v2', ...paired, writerRoles: undefined }),
    JSON.stringify({ schema: 'knu-codex-hook-policy/v3', ...unpaired }),
    JSON.stringify({ schema: 'knu-codex-hook-policy/v3', ...unpaired, allowedRoleModels: [] }),
    JSON.stringify({
      schema: 'knu-codex-hook-policy/v3',
      ...unpaired,
      allowedRoleModels: { knu_explorer: 'gpt-6-astra' },
    }),
    JSON.stringify({ schema: 'knu-codex-hook-policy/v3', ...paired, writerRoles: undefined }),
    JSON.stringify({ schema: 'knu-codex-hook-policy/v3', ...paired, writerRoles: [] }),
    JSON.stringify({ schema: 'knu-codex-hook-policy/v3', ...paired, writerRoles: ['worker'] }),
  ]) {
    writeFileSync(join(root, '.codex/hooks/knu-hook-policy.json'), policy);
    const result = spawnSync(
      process.execPath,
      [join(root, '.codex/hooks/knu-subagent-hooks.mjs')],
      { cwd: root, input: JSON.stringify(spawnCall({})), encoding: 'utf8' },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.notEqual(result.stdout, '', `a stale or broken policy must deny: ${policy}`);
    const output = JSON.parse(result.stdout).hookSpecificOutput;
    assert.equal(output.permissionDecision, 'deny', policy);
    assert.match(output.permissionDecisionReason, /guard-error/u, policy);
  }
});

test('completion is accepted only when the bound start and stop records match the lane contract', async () => {
  const { evaluateHookCompletion, laneTaskPath } = await records();
  assert.equal(laneTaskPath('lane-one'), '/root/lane_one');
  const taskPath = laneTaskPath('lane-one', 'k3x9');
  assert.equal(taskPath, '/root/lane_one_k3x9');
  const accepted = evaluateHookCompletion({
    observation: observation(),
    taskPath,
    expectedRole: 'knu_explorer',
    expectedModel: ASTRA,
  });
  assert.deepEqual(accepted, {
    accepted: true,
    reason: null,
    agentId: CHILD,
    agentType: 'knu_explorer',
    model: ASTRA,
    effort: 'high',
  });
  // Another lane's unbound child does not decide this lane.
  const other = observation();
  other.records.push(startRecord({ agentId: GRANDCHILD, agentPath: '/root/other_lane' }));
  assert.equal(
    evaluateHookCompletion({
      observation: other,
      taskPath,
      expectedRole: 'knu_explorer',
      expectedModel: ASTRA,
    }).accepted,
    true,
  );
});

test('completion is refused for missing, partial, mismatched or out-of-policy observations', async () => {
  const { evaluateHookCompletion } = await records();
  const refuse = (obs, expectedRole = 'knu_explorer', taskPath = '/root/lane_one_k3x9') =>
    evaluateHookCompletion({ observation: obs, taskPath, expectedRole, expectedModel: ASTRA })
      .reason;
  assert.equal(refuse(undefined), 'observation-missing');
  assert.equal(refuse(observation({ records: [] })), 'observation-missing');
  assert.equal(refuse(observation(), 'knu_explorer', '/root/other_lane'), 'observation-missing');
  assert.equal(refuse(observation({ sessionId: 'another-session' })), 'observation-missing');
  assert.equal(refuse(observation({ drop: 'SubagentStop' })), 'observation-incomplete');
  assert.equal(refuse(observation({ drop: 'SubagentStart' })), 'observation-incomplete');
  // A skipped line may have been a descendant start, so any malformed line (or an unknown count) refuses the lane.
  assert.equal(refuse({ ...observation(), malformed: 1 }), 'observation-malformed');
  assert.equal(refuse({ ...observation(), malformed: undefined }), 'observation-malformed');
  assert.equal(refuse(observation(), 'knu_explorer_xhigh'), 'observation-mismatch');
  assert.equal(refuse(observation({ parentThreadId: 'foreign' })), 'observation-mismatch');
  // A start record without a readable rollout still needs the stop record to name the Parent thread.
  const [bind, start, stop] = observation().records;
  assert.equal(
    refuse(
      observation({
        records: [bind, { ...start, parentThreadId: null }, { ...stop, parentThreadId: 'foreign' }],
      }),
    ),
    'observation-mismatch',
  );
  assert.equal(refuse(observation({ model: 'gpt-x-unlisted' })), 'model-not-allowed');
  assert.equal(refuse(observation({ agentType: 'default' }), 'default'), 'role-not-in-roster');
});

test('completion needs the root PreToolUse allow record that bound this task name', async () => {
  const { evaluateHookCompletion } = await records();
  const refuse = (obs) =>
    evaluateHookCompletion({
      observation: obs,
      taskPath: '/root/lane_one_k3x9',
      expectedRole: 'knu_explorer',
      expectedModel: ASTRA,
    }).reason;
  const [bind, start, stop] = observation().records;
  // PreToolUse failed open, was denied, came from a child, named another task or sat in another session.
  for (const unbound of [
    [start, stop],
    [{ ...bind, decision: 'deny', reason: 'model-not-allowed' }, start, stop],
    [{ ...bind, caller: 'child', agentId: CHILD }, start, stop],
    [{ ...bind, input: { ...bind.input, task_name: 'other_lane' } }, start, stop],
    [{ ...bind, sessionId: 'another-session' }, start, stop],
  ])
    assert.equal(refuse(observation({ records: unbound })), 'observation-unbound');
  // The bind must name the role and model that started.
  assert.equal(
    refuse(
      observation({
        records: [
          { ...bind, input: { ...bind.input, agent_type: 'knu_explorer_xhigh' } },
          start,
          stop,
        ],
      }),
    ),
    'observation-mismatch',
  );
  assert.equal(
    refuse(
      observation({ records: [{ ...bind, input: { ...bind.input, model: SOL } }, start, stop] }),
    ),
    'model-mismatch',
  );
});

test('a root PreToolUse record that names no task never binds or blocks a child', async () => {
  const { evaluateHookCompletion, reviewTasks } = await records();
  const [bind, start, stop] = observation().records;
  // Parent write records carry paths, not a task name, whatever their decision.
  const writes = ['allow', 'deny', 'record'].map((decision) => ({
    ...bind,
    toolName: 'apply_patch',
    decision,
    input: { paths: ['README.md'] },
    registration: undefined,
  }));
  const verdict = (records) =>
    evaluateHookCompletion({
      observation: observation({ records }),
      taskPath: '/root/lane_one_k3x9',
      expectedRole: 'knu_explorer',
      expectedModel: ASTRA,
    });
  assert.equal(verdict([...writes, start, stop]).reason, 'observation-unbound');
  assert.equal(verdict([...writes, bind, start, ...writes, stop]).accepted, true);
  assert.deepEqual(reviewTasks(observation({ records: writes }), 'k3x9'), []);
});

test('a descendant start under the lane child refuses the lane', async () => {
  const { evaluateHookCompletion } = await records();
  const refuse = (extra) => {
    const obs = observation();
    obs.records.push(extra);
    return evaluateHookCompletion({
      observation: obs,
      taskPath: '/root/lane_one_k3x9',
      expectedRole: 'knu_explorer',
      expectedModel: ASTRA,
    }).reason;
  };
  // A grandchild is found by its nested task path or by naming the lane child as its parent thread.
  assert.equal(
    refuse(
      startRecord({
        agentId: GRANDCHILD,
        agentPath: '/root/lane_one_k3x9/helper',
        parentThreadId: CHILD,
      }),
    ),
    'observation-foreign',
  );
  assert.equal(
    refuse(startRecord({ agentId: GRANDCHILD, agentPath: null, parentThreadId: CHILD })),
    'observation-foreign',
  );
  assert.equal(
    refuse(
      startRecord({
        agentId: GRANDCHILD,
        agentPath: '/root/lane_one_k3x9/helper',
        parentThreadId: null,
      }),
    ),
    'observation-foreign',
  );
  // A sibling whose name only shares the prefix is not a descendant.
  assert.equal(
    refuse(
      startRecord({ agentId: GRANDCHILD, agentPath: '/root/lane_one_b', parentThreadId: SESSION }),
    ),
    null,
  );
});

test('completion compares the observed model and own-turn effort with the lane contract', async () => {
  const { evaluateHookCompletion } = await records();
  const check = (obs, { expectedRole = 'knu_explorer', expectedModel = ASTRA } = {}) =>
    evaluateHookCompletion({
      observation: obs,
      taskPath: '/root/lane_one_k3x9',
      expectedRole,
      expectedModel,
    });
  // The contract asked for 6.1 Sol; an allowed Astra child of the same role does not complete it.
  assert.equal(check(observation(), { expectedModel: SOL }).reason, 'model-mismatch');
  assert.equal(check(observation({ model: SOL }), { expectedModel: SOL }).accepted, true);
  // An allowed model the role has no pair for is refused even when the bind and contract agree.
  assert.equal(
    check(observation({ agentType: 'knu_explorer_medium', model: SOL }), {
      expectedRole: 'knu_explorer_medium',
      expectedModel: SOL,
    }).reason,
    'pair-not-allowed',
  );
  assert.equal(
    check(observation(), { expectedModel: LUNA }).reason,
    'pair-not-allowed',
    'the contract pair itself must be allowed',
  );
  const [bind, start, stop] = observation().records;
  const withTurn = (ownTurn) => observation({ records: [bind, start, { ...stop, ownTurn }] });
  assert.equal(check(withTurn(null)).reason, 'effort-unobserved');
  assert.equal(check(withTurn({ model: ASTRA, effort: null })).reason, 'effort-unobserved');
  assert.equal(check(withTurn({ model: SOL, effort: 'high' })).reason, 'model-mismatch');
  // A bound Sol spawn is not the Astra contract even when its own turn reports Astra.
  const solSpawn = observation({ model: SOL }).records;
  assert.equal(
    check(
      observation({
        records: [
          ...solSpawn.slice(0, 2),
          { ...solSpawn[2], ownTurn: { model: ASTRA, effort: 'high' } },
        ],
      }),
    ).reason,
    'model-mismatch',
  );
  const effort = check(withTurn({ model: ASTRA, effort: 'medium' }));
  assert.equal(effort.reason, 'effort-mismatch');
  assert.equal(effort.effort, 'medium', 'a refusal reports the observed effort');
  // The role file pins the effort: knu_explorer_xhigh runs xhigh, not the Parent's high.
  assert.equal(
    check(
      observation({
        agentType: 'knu_explorer_xhigh',
        records: [
          {
            ...bind,
            input: { ...bind.input, agent_type: 'knu_explorer_xhigh' },
            registration: {
              ...bind.registration,
              spawnArguments: {
                ...bind.registration.spawnArguments,
                agent_type: 'knu_explorer_xhigh',
                reasoning_effort: 'xhigh',
              },
            },
          },
          { ...start, agentType: 'knu_explorer_xhigh' },
          { ...stop, agentType: 'knu_explorer_xhigh', ownTurn: { model: ASTRA, effort: 'xhigh' } },
        ],
      }),
      { expectedRole: 'knu_explorer_xhigh' },
    ).accepted,
    true,
  );
});

test('completion reads only the parent session record file and refuses a session with malformed lines', async (t) => {
  const { readHookRecords, checkLaneCompletion, HOOK_RECORD_DIRECTORY } = await records();
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
  // The read result is the observation: a truncated line may have been a descendant start of this lane.
  const lane = observation({ taskName: 'lane_one_k3x9' }).records;
  writeFileSync(
    join(root, HOOK_RECORD_DIRECTORY, `${SESSION}.jsonl`),
    [
      ...lane.map((r) => JSON.stringify(r)),
      '{"event":"SubagentStart","agentPath":"/root/lane_one_k3x9/x"',
    ].join('\n'),
  );
  const check = (observed) =>
    checkLaneCompletion({
      observation: observed,
      laneId: 'lane-one',
      dispatchToken: 'k3x9',
      expectedRole: 'knu_explorer',
      expectedModel: ASTRA,
    }).reason;
  const truncated = readHookRecords({ root, sessionId: SESSION });
  assert.equal(check(truncated), 'observation-malformed');
  assert.equal(
    check({ ...truncated, malformed: 0 }),
    null,
    'the same records without the bad line are accepted',
  );
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

// One lane child as the hook writes it: the root PreToolUse allow record that bound its task name and sealed its
// registration, then its start and stop. The stop own-turn effort defaults to the role pin.
function observation({
  records: given,
  sessionId = SESSION,
  drop,
  model = ASTRA,
  agentType = 'knu_explorer',
  parentThreadId = SESSION,
  taskName = 'lane_one_k3x9',
} = {}) {
  const base = {
    schema: 'knu-codex-subagent-hook/v1',
    sessionId: SESSION,
    agentId: CHILD,
    agentType,
  };
  const all = given ?? [
    {
      schema: 'knu-codex-subagent-hook/v1',
      sessionId: SESSION,
      event: 'PreToolUse',
      toolName: 'collaborationspawn_agent',
      caller: 'root',
      decision: 'allow',
      input: { task_name: taskName, agent_type: agentType, model, fork_turns: 'none' },
      registration: {
        digest: `sha256:${'0'.repeat(64)}`,
        taskName,
        kind: 'lane',
        laneId: 'lane-one',
        dispatchToken: 'k3x9',
        retry: taskName.endsWith('_retry'),
        spawnArguments: {
          task_name: taskName,
          agent_type: agentType,
          model,
          reasoning_effort: ROLE_EFFORTS[agentType] ?? 'high',
          fork_turns: 'none',
        },
      },
    },
    { ...base, event: 'SubagentStart', model, agentPath: `/root/${taskName}`, parentThreadId },
    {
      ...base,
      event: 'SubagentStop',
      model,
      agentPath: `/root/${taskName}`,
      parentThreadId,
      ownTurn: { model, effort: ROLE_EFFORTS[agentType] ?? 'high' },
    },
  ];
  return {
    sessionId,
    records: all.filter(({ event }) => event !== drop),
    malformed: 0,
    allowedModels: POLICY.allowedModels,
    roster: POLICY.roster,
    allowedRoleModels: POLICY.allowedRoleModels,
    roleEfforts: POLICY.roleEfforts,
  };
}

function startRecord({ agentId, agentPath, parentThreadId = SESSION, agentType = 'default' }) {
  return {
    schema: 'knu-codex-subagent-hook/v1',
    sessionId: SESSION,
    event: 'SubagentStart',
    agentId,
    agentType,
    model: ASTRA,
    agentPath,
    parentThreadId,
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
  const usage = [
    '--lane',
    'lane-one',
    '--token',
    'k3x9',
    '--role',
    'knu_explorer',
    '--model',
    ASTRA,
  ];
  const refused = run(usage, { CODEX_THREAD_ID: 'knu-test-session-without-records' });
  assert.equal(refused.status, 1, refused.stderr);
  assert.deepEqual(
    (({
      completionAuthority,
      sessionId,
      taskPath,
      expectedModel,
      accepted,
      reason,
      unboundStarts,
    }) => ({
      completionAuthority,
      sessionId,
      taskPath,
      expectedModel,
      accepted,
      reason,
      unboundStarts,
    }))(JSON.parse(refused.stdout)),
    {
      completionAuthority: 'codex-subagent-hook',
      sessionId: 'knu-test-session-without-records',
      taskPath: '/root/lane_one_k3x9',
      expectedModel: ASTRA,
      accepted: false,
      reason: 'observation-missing',
      unboundStarts: 0,
    },
  );
  assert.equal(run(['--lane', 'lane-one', '--role', 'knu_explorer']).status, 2);
  // The expected model is part of the dispatch contract, so the command cannot run without it.
  const noModel = run(usage.slice(0, -2), { CODEX_THREAD_ID: 'knu-test-session-without-records' });
  assert.equal(noModel.status, 2);
  assert.match(noModel.stderr, /--model/u);
  // Through a symlinked path the command still decides; a silent exit 0 would read as accepted.
  const linkDirectory = mkdtempSync(join(tmpdir(), 'knu-completion-link-'));
  try {
    const link = join(linkDirectory, 'completion.mjs');
    symlinkSync(command, link);
    const linked = spawnSync(process.execPath, [link, ...usage], {
      cwd: repoRoot,
      encoding: 'utf8',
      env: { ...process.env, CODEX_THREAD_ID: 'knu-test-session-without-records' },
    });
    assert.equal(linked.status, 1, 'symlinked completion command must still refuse');
    assert.equal(JSON.parse(linked.stdout).reason, 'observation-missing');
  } finally {
    rmSync(linkDirectory, { recursive: true, force: true });
  }
  const noSession = run(usage);
  assert.equal(noSession.status, 2);
  assert.match(noSession.stderr, /session id/u);
  // The command passes the malformed count on: a bad line in the session file refuses an otherwise bound lane. A copy
  // under a temporary root keeps the test out of the checkout `.codex`, which workspace-write sandboxes cannot write.
  const root = mkdtempSync(join(tmpdir(), 'knu-completion-root-'));
  try {
    const copy = join(root, 'scripts/agents/codex');
    mkdirSync(copy, { recursive: true });
    for (const name of ['subagent-hook-records.mjs', 'model-profiles.mjs'])
      copyFileSync(resolve(repoRoot, 'scripts/agents/codex', name), join(copy, name));
    const sessionId = 'knu-test-malformed';
    const file = join(root, '.codex/state/knu-subagent-hooks', `${sessionId}.jsonl`);
    mkdirSync(dirname(file), { recursive: true });
    const lane = observation({ taskName: 'lane_one_k3x9', parentThreadId: sessionId }).records.map(
      (r) => JSON.stringify({ ...r, sessionId }),
    );
    const runCopy = () =>
      spawnSync(process.execPath, [join(copy, 'subagent-hook-records.mjs'), ...usage], {
        cwd: root,
        encoding: 'utf8',
        env: { ...process.env, CODEX_THREAD_ID: sessionId },
      });
    writeFileSync(file, `${[...lane, '{oops'].join('\n')}\n`);
    const malformed = runCopy();
    assert.equal(malformed.status, 1, malformed.stderr);
    assert.equal(JSON.parse(malformed.stdout).reason, 'observation-malformed');
    writeFileSync(file, `${lane.join('\n')}\n`);
    assert.equal(runCopy().status, 0, 'the intact file is accepted');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('dispatch tokens name each dispatch and a missing token or a reused path refuses completion', async () => {
  const { checkLaneCompletion, laneTaskName, laneTaskPath } = await records();
  assert.equal(laneTaskName('lane-one', 'k3x9'), 'lane_one_k3x9');
  assert.equal(laneTaskPath('lane-one', 'k3x9'), '/root/lane_one_k3x9');
  assert.throws(() => laneTaskName('lane-one', 'Bad'), /dispatch token/u);
  const tokened = observation({ taskName: 'lane_one_k3x9' });
  const check = (obs, dispatchToken = 'k3x9') =>
    checkLaneCompletion({
      observation: obs,
      laneId: 'lane-one',
      dispatchToken,
      expectedRole: 'knu_explorer',
      expectedModel: ASTRA,
    });
  assert.equal(check(tokened).accepted, true);
  assert.equal(check(tokened, null).reason, 'dispatch-token-missing');
  assert.equal(check(tokened, 'zz99').reason, 'observation-missing');
  // A widened allowlist in the observation is ignored; the owner allowlist decides.
  const unlisted = observation({ model: 'gpt-x-unlisted', taskName: 'lane_one_k3x9' });
  assert.equal(
    check({ ...unlisted, allowedModels: ['gpt-x-unlisted'] }).reason,
    'model-not-allowed',
  );
  // Widened pairs or a lowered role effort in the observation are ignored the same way.
  const unpaired = observation({
    model: SOL,
    agentType: 'knu_explorer_medium',
    taskName: 'lane_one_k3x9',
  });
  assert.equal(
    checkLaneCompletion({
      observation: { ...unpaired, allowedRoleModels: { knu_explorer_medium: [SOL] } },
      laneId: 'lane-one',
      dispatchToken: 'k3x9',
      expectedRole: 'knu_explorer_medium',
      expectedModel: SOL,
    }).reason,
    'pair-not-allowed',
  );
  const lowered = observation({ taskName: 'lane_one_k3x9' });
  lowered.records[2] = { ...lowered.records[2], ownTurn: { model: ASTRA, effort: 'medium' } };
  assert.equal(
    check({ ...lowered, roleEfforts: { knu_explorer: 'medium' } }).reason,
    'effort-mismatch',
  );
  assert.throws(
    () =>
      checkLaneCompletion({
        observation: tokened,
        laneId: 'lane-one',
        dispatchToken: 'k3x9',
        expectedRole: 'knu_explorer',
      }),
    /expected model/u,
  );
  const twice = observation({
    records: [
      ...tokened.records,
      ...tokened.records.map((record) => ({ ...record, agentId: 'second-child' })),
    ],
  });
  assert.equal(check(twice).reason, 'observation-ambiguous');
});

test('a recovery retry runs on its own task path and the completion command checks it with --retry', async () => {
  const { checkLaneCompletion, laneTaskName, laneTaskPath } = await records();
  assert.equal(laneTaskName('lane-one', 'k3x9', { retry: true }), 'lane_one_k3x9_retry');
  assert.equal(laneTaskPath('lane-one', 'k3x9', { retry: true }), '/root/lane_one_k3x9_retry');
  assert.throws(() => laneTaskName('lane-one', undefined, { retry: true }), /dispatch token/u);
  const retry = observation({ taskName: 'lane_one_k3x9_retry' });
  const check = (retryFlag) =>
    checkLaneCompletion({
      observation: retry,
      laneId: 'lane-one',
      dispatchToken: 'k3x9',
      expectedRole: 'knu_explorer',
      expectedModel: ASTRA,
      retry: retryFlag,
    });
  assert.equal(check(true).accepted, true);
  // The primary path is a different child; while the retry child goes unreported it does not complete the lane.
  assert.equal(check(false).reason, 'retry-unreported');
  // A primary check refuses the lane while the session holds its unreported retry child.
  const both = observation({ taskName: 'lane_one_k3x9' });
  both.records.push(
    ...retry.records.map((r) => (r.agentId ? { ...r, agentId: 'child-retry' } : r)),
  );
  assert.equal(
    checkLaneCompletion({
      observation: both,
      laneId: 'lane-one',
      dispatchToken: 'k3x9',
      expectedRole: 'knu_explorer',
      expectedModel: ASTRA,
    }).reason,
    'retry-unreported',
  );
  // `retry` is reserved, so a lane and token never spell another lane's retry task name.
  const { isDispatchToken } = await records();
  assert.equal(isDispatchToken('retry'), false);
  assert.throws(() => laneTaskName('lane-one-k3x9', 'retry'), /dispatch token/u);
  const root = mkdtempSync(join(tmpdir(), 'knu-completion-retry-'));
  try {
    const copy = join(root, 'scripts/agents/codex');
    mkdirSync(copy, { recursive: true });
    for (const name of ['subagent-hook-records.mjs', 'model-profiles.mjs'])
      copyFileSync(resolve(repoRoot, 'scripts/agents/codex', name), join(copy, name));
    const sessionId = 'knu-test-retry';
    const file = join(root, '.codex/state/knu-subagent-hooks', `${sessionId}.jsonl`);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(
      file,
      `${observation({ taskName: 'lane_one_k3x9_retry', parentThreadId: sessionId })
        .records.map((r) => JSON.stringify({ ...r, sessionId }))
        .join('\n')}\n`,
    );
    const usage = [
      '--lane',
      'lane-one',
      '--token',
      'k3x9',
      '--role',
      'knu_explorer',
      '--model',
      ASTRA,
    ];
    const run = (args) =>
      spawnSync(process.execPath, [join(copy, 'subagent-hook-records.mjs'), ...args], {
        cwd: root,
        encoding: 'utf8',
        env: { ...process.env, CODEX_THREAD_ID: sessionId },
      });
    const accepted = run([...usage, '--retry']);
    assert.equal(accepted.status, 0, accepted.stderr);
    assert.equal(JSON.parse(accepted.stdout).taskPath, '/root/lane_one_k3x9_retry');
    const primary = run(usage);
    assert.equal(primary.status, 1);
    assert.equal(JSON.parse(primary.stdout).reason, 'retry-unreported');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('the completion report counts session starts that no allow record bound', async () => {
  const { countUnboundStarts } = await records();
  const obs = observation();
  assert.equal(countUnboundStarts(obs), 0);
  obs.records.push(
    startRecord({ agentId: GRANDCHILD, agentPath: '/root/other_lane' }),
    startRecord({
      agentId: 'grand-2',
      agentPath: '/root/lane_one_k3x9/helper',
      parentThreadId: CHILD,
    }),
    {
      ...startRecord({ agentId: 'elsewhere', agentPath: '/root/x' }),
      sessionId: 'another-session',
    },
  );
  assert.equal(countUnboundStarts(obs), 2);
});

// Parent write guard: while a writer lane spawned by the root is neither accepted nor released, a root apply_patch may
// not write a tracked or unignored path. The registry names the open writers; the workspace classifies patch targets.
const WRITER_POLICY = {
  ...POLICY,
  writerRoles: ['knu_executor_medium', 'knu_executor', 'knu_executor_xhigh'],
};

function writeRegistry(writers, seen = []) {
  return {
    read: () => null,
    used: () => false,
    settled: () => false,
    released: () => false,
    writers: (roles) => {
      seen.push(roles);
      return writers;
    },
  };
}

function workspaceOf(verdicts, seen = []) {
  return {
    classify: (targets, cwd) => {
      seen.push({ targets, cwd });
      return targets.map((path) => ({ path, verdict: verdicts[path] ?? 'guarded' }));
    },
  };
}

test('a root apply_patch that writes a tracked path while a writer runs is denied with the paths and writers', async () => {
  const { decideToolUse } = await hooks();
  const roles = [];
  const classified = [];
  const call = {
    ...patchCall('*** Update File: README.md\n@@\n-a\n+secret patch text'),
    cwd: '/repo',
  };
  assert.deepEqual(
    decideToolUse(
      call,
      WRITER_POLICY,
      writeRegistry(['lane_one_k3x9'], roles),
      workspaceOf({}, classified),
    ),
    {
      action: 'deny',
      tool: 'apply_patch',
      caller: 'root',
      reason: 'parent-write-during-writer',
      write: { writers: ['lane_one_k3x9'], paths: [{ path: 'README.md', verdict: 'guarded' }] },
    },
  );
  assert.deepEqual(roles, [WRITER_POLICY.writerRoles]);
  assert.deepEqual(classified, [{ targets: ['README.md'], cwd: '/repo' }]);
});

test('a root apply_patch to ignored or outside paths while a writer runs is recorded, not denied', async () => {
  const { decideToolUse } = await hooks();
  const call = patchCall('*** Add File: .artifacts/a.md\n+x\n*** Add File: /elsewhere/b.md\n+y');
  assert.deepEqual(
    decideToolUse(
      call,
      WRITER_POLICY,
      writeRegistry(['lane_one_k3x9']),
      workspaceOf({ '.artifacts/a.md': 'ignored', '/elsewhere/b.md': 'outside' }),
    ),
    {
      action: 'record',
      tool: 'apply_patch',
      caller: 'root',
      write: {
        writers: ['lane_one_k3x9'],
        paths: [
          { path: '.artifacts/a.md', verdict: 'ignored' },
          { path: '/elsewhere/b.md', verdict: 'outside' },
        ],
      },
    },
  );
});

test('every patch target counts: added, updated, deleted and the destination of a move', async () => {
  const { decideToolUse } = await hooks();
  const classified = [];
  const patch = [
    '*** Add File: a.md',
    '+x',
    '*** Delete File: b.md',
    '*** Update File: .artifacts/c.md',
    '*** Move to: d.md',
    '@@',
    '-x',
    '+y',
  ].join('\n');
  const decision = decideToolUse(
    patchCall(patch),
    WRITER_POLICY,
    writeRegistry(['lane_one_k3x9']),
    workspaceOf({ 'a.md': 'ignored', 'b.md': 'ignored', '.artifacts/c.md': 'ignored' }, classified),
  );
  assert.equal(classified.length, 1, 'the guard classifies the apply_patch targets once');
  assert.deepEqual(classified[0].targets, ['a.md', 'b.md', '.artifacts/c.md', 'd.md']);
  assert.equal(decision.action, 'deny');
  assert.deepEqual(
    decision.write.paths.filter(({ verdict }) => verdict === 'guarded'),
    [{ path: 'd.md', verdict: 'guarded' }],
  );
});

test('indented file headers count, and a file header the guard cannot read is recorded', async () => {
  const { decideToolUse } = await hooks();
  const classified = [];
  const registry = writeRegistry(['lane_one_k3x9']);
  const indented = decideToolUse(
    patchCall('*** Begin Patch\n  *** Update File: README.md\n@@\n-a\n+b\n*** End Patch'),
    WRITER_POLICY,
    registry,
    workspaceOf({}, classified),
  );
  assert.deepEqual(classified[0]?.targets, ['README.md'], 'an indented header is a target');
  assert.equal(indented.action, 'deny');
  // A header line without a readable path next to an ignored target: recorded with the reason, never silent.
  const unread = decideToolUse(
    patchCall('*** Add File: .artifacts/a.md\n+x\n*** Update File:\n@@\n-a\n+b\n*** End of File'),
    WRITER_POLICY,
    registry,
    workspaceOf({ '.artifacts/a.md': 'ignored' }),
  );
  assert.equal(unread.action, 'record');
  assert.equal(unread.reason, 'write-target-unknown', 'an unreadable file header is recorded');
  assert.deepEqual(unread.write.paths, [{ path: '.artifacts/a.md', verdict: 'ignored' }]);
  // Other patch markers are not file headers.
  const plain = decideToolUse(
    patchCall('*** Begin Patch\n*** Add File: .artifacts/a.md\n+x\n*** End of File\n*** End Patch'),
    WRITER_POLICY,
    registry,
    workspaceOf({ '.artifacts/a.md': 'ignored' }),
  );
  assert.equal(plain.reason, undefined);
});

test('no open writer, a child caller or an unreadable patch leaves the write unguarded', async () => {
  const { decideToolUse } = await hooks();
  const untouched = {
    classify: () => {
      throw new Error('classify must not run');
    },
  };
  const call = patchCall('*** Update File: README.md\n+x');
  assert.deepEqual(decideToolUse(call, WRITER_POLICY, writeRegistry([]), untouched), {
    action: 'ignore',
  });
  assert.deepEqual(
    decideToolUse(
      patchCall('*** Update File: README.md\n+x', { child: true }),
      WRITER_POLICY,
      writeRegistry(['lane_one_k3x9']),
      untouched,
    ),
    { action: 'ignore' },
  );
  // apply_patch refuses a patch with no file header itself; the guard records that it could not read a target.
  assert.deepEqual(
    decideToolUse(
      { ...call, tool_input: { command: 'not a patch' } },
      WRITER_POLICY,
      writeRegistry(['lane_one_k3x9']),
      untouched,
    ),
    {
      action: 'record',
      tool: 'apply_patch',
      caller: 'root',
      reason: 'write-target-unknown',
      write: { writers: ['lane_one_k3x9'], paths: [] },
    },
  );
});

// A git repository root with the installed hook and policy, a tracked file, ignored directories and a writer
// registration; `run` feeds one payload to the installed hook.
function writerRoot(t, { git = true } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'knu-hook-writer-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, '.codex/hooks'), { recursive: true });
  copyFileSync(hookPath, join(root, '.codex/hooks/knu-subagent-hooks.mjs'));
  copyFileSync(policyPath, join(root, '.codex/hooks/knu-hook-policy.json'));
  writeFileSync(join(root, '.gitignore'), '.artifacts/\n.codex/state/\n');
  writeFileSync(join(root, 'README.md'), 'tracked\n');
  mkdirSync(join(root, 'docs'));
  if (git) {
    const git = (...args) => spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' });
    git('init', '-q');
    git('add', 'README.md', '.gitignore');
  }
  const registrations = join(root, '.artifacts/tools/codex-native', SESSION);
  mkdirSync(registrations, { recursive: true });
  const register = (call) =>
    writeFileSync(
      join(registrations, `${call.tool_input.task_name}.json`),
      JSON.stringify(registrationFor(call)),
    );
  const run = (payload, cwd = root) =>
    spawnSync(process.execPath, [join(root, '.codex/hooks/knu-subagent-hooks.mjs')], {
      cwd,
      input: JSON.stringify({ cwd, ...payload }),
      encoding: 'utf8',
    });
  const reason = (result) => {
    assert.equal(result.status, 0, result.stderr);
    return result.stdout === ''
      ? null
      : JSON.parse(result.stdout).hookSpecificOutput.permissionDecisionReason;
  };
  const lines = () => {
    const file = join(root, '.codex/state/knu-subagent-hooks', `${SESSION}.jsonl`);
    return existsSync(file)
      ? readFileSync(file, 'utf8')
          .trim()
          .split('\n')
          .map((line) => JSON.parse(line))
      : [];
  };
  return { root, registrations, register, run, reason, lines };
}

const writerSpawn = spawnCall({ agent_type: 'knu_executor', reasoning_effort: 'high' });

test('the installed hook denies tracked Parent writes from the writer spawn until its acceptance', (t) => {
  const { root, registrations, register, run, reason, lines } = writerRoot(t);
  const patch = (body, cwd) => reason(run(patchCall(body), cwd));
  const update = (path) => `*** Update File: ${path}\n@@\n-tracked\n+secret patch text`;

  // A reviewer is not a writer: its spawn does not open the guard.
  const reviewer = spawnCall({
    task_name: 'review_k3x9_1',
    agent_type: 'knu_reviewer',
    reasoning_effort: 'xhigh',
  });
  writeFileSync(
    join(registrations, 'review_k3x9_1.json'),
    JSON.stringify({
      ...registrationFor(reviewer),
      kind: 'review',
      reviewId: 'review-k3x9-1',
      round: 1,
      reviewOf: ['lane-one'],
      laneId: undefined,
      retry: undefined,
    }),
  );
  assert.equal(reason(run(reviewer)), null);
  assert.equal(patch(update('README.md')), null);

  register(writerSpawn);
  assert.equal(reason(run(writerSpawn)), null);
  const denied = patch(update('README.md'));
  assert.match(denied, /parent-write-during-writer/u);
  assert.match(denied, /lane_one_k3x9/u);
  assert.match(denied, /codex:release --task lane_one_k3x9 --ended/u);
  // An untracked file outside the ignore rules is guarded as well, and so is a relative path from another cwd.
  assert.match(patch('*** Add File: docs/new.md\n+x'), /parent-write-during-writer/u);
  assert.match(patch(update('../README.md'), join(root, 'docs')), /parent-write-during-writer/u);
  // Ignored paths and paths outside the repository stay writable.
  assert.equal(patch('*** Add File: .artifacts/notes.md\n+x'), null);
  const outside = mkdtempSync(join(tmpdir(), 'knu-hook-outside-'));
  t.after(() => rmSync(outside, { recursive: true, force: true }));
  assert.equal(patch(`*** Add File: ${join(outside, 'x.md')}\n+x`), null);
  // A move into a tracked path and a link from an ignored directory to a tracked file are tracked writes.
  assert.match(
    patch('*** Update File: .artifacts/notes.md\n*** Move to: moved.md\n@@\n-x\n+y'),
    /parent-write-during-writer/u,
  );
  symlinkSync(join(root, 'README.md'), join(root, '.artifacts/link.md'));
  assert.match(patch(update('.artifacts/link.md')), /parent-write-during-writer/u);
  // The child writes its own lane.
  assert.equal(reason(run(patchCall(update('README.md'), { child: true }))), null);

  writeFileSync(
    join(registrations, 'lane_one_k3x9.accepted.json'),
    JSON.stringify({
      schema: 'knu-codex-task-acceptance/v1',
      sessionId: SESSION,
      taskName: 'lane_one_k3x9',
      agentId: CHILD,
    }),
  );
  assert.equal(patch(update('README.md')), null);

  const writes = lines().filter(({ toolName }) => toolName === 'apply_patch');
  assert.deepEqual(
    writes.map(({ decision, reason: why }) => [decision, why ?? null]),
    [
      ['deny', 'parent-write-during-writer'],
      ['deny', 'parent-write-during-writer'],
      ['deny', 'parent-write-during-writer'],
      ['record', null],
      ['record', null],
      ['deny', 'parent-write-during-writer'],
      ['deny', 'parent-write-during-writer'],
    ],
  );
  assert.deepEqual(writes[0].write, {
    writers: ['lane_one_k3x9'],
    paths: [{ path: 'README.md', verdict: 'guarded' }],
  });
  assert.deepEqual(writes[3].write.paths, [{ path: '.artifacts/notes.md', verdict: 'ignored' }]);
  assert.deepEqual(writes[4].write.paths, [{ path: null, verdict: 'outside' }]);
  assert.ok(writes.every(({ caller }) => caller === 'root'));
  assert.doesNotMatch(JSON.stringify(lines()), /secret patch text/u);
});

test('a release record of this session closes the guard; another session or schema does not', (t) => {
  const { registrations, register, run, reason } = writerRoot(t);
  register(writerSpawn);
  assert.equal(reason(run(writerSpawn)), null);
  const patch = () => reason(run(patchCall('*** Update File: README.md\n+x')));
  const release = (changes) =>
    JSON.stringify({
      schema: 'knu-codex-task-release/v1',
      sessionId: SESSION,
      taskName: 'lane_one_k3x9',
      agentIds: [CHILD],
      ...changes,
    });
  writeFileSync(join(registrations, 'foreign.released.json'), release({ sessionId: 'other' }));
  writeFileSync(
    join(registrations, 'old.released.json'),
    release({ schema: 'knu-codex-task-release/v0' }),
  );
  assert.match(patch(), /parent-write-during-writer/u);
  writeFileSync(join(registrations, 'lane_one_k3x9.released.json'), release());
  assert.equal(patch(), null);
  // A released child is not resumed: a writer resumed outside the guard would write next to the Parent.
  for (const target of ['lane_one_k3x9', CHILD, '/root/lane_one_k3x9'])
    assert.match(
      reason(
        run({
          ...writerSpawn,
          tool_name: 'collaborationfollowup_task',
          tool_input: { target, message: 'again' },
        }),
      ),
      /released-child/u,
      target,
    );
});

test('a Parent write guard that cannot decide lets the write through and records the error', (t) => {
  // Not a git repository: the ignore check fails while a writer is open.
  const plain = writerRoot(t, { git: false });
  plain.register(writerSpawn);
  assert.equal(plain.reason(plain.run(writerSpawn)), null);
  assert.equal(plain.reason(plain.run(patchCall('*** Update File: README.md\n+x'))), null);
  const [error] = plain.lines().filter(({ toolName }) => toolName === 'apply_patch');
  assert.ok(error, 'the guard records a guard-error for the apply_patch it let through');
  assert.equal(error.decision, 'record');
  assert.equal(error.reason, 'guard-error');
  assert.equal(typeof error.error, 'string');

  // A broken policy still denies a spawn, but never blocks a file edit.
  const broken = writerRoot(t);
  writeFileSync(join(broken.root, '.codex/hooks/knu-hook-policy.json'), '{broken');
  assert.match(broken.reason(broken.run(writerSpawn)), /guard-error/u);
  assert.equal(broken.reason(broken.run(patchCall('*** Update File: README.md\n+x'))), null);
  assert.deepEqual(
    broken.lines().map(({ toolName, reason: why }) => [toolName, why]),
    [['apply_patch', 'guard-error']],
  );

  // A torn record line hides whether a writer is open: the guard records the error and lets the edit through.
  const torn = writerRoot(t);
  torn.register(writerSpawn);
  assert.equal(torn.reason(torn.run(writerSpawn)), null);
  const tornFile = join(torn.root, '.codex/state/knu-subagent-hooks', `${SESSION}.jsonl`);
  writeFileSync(tornFile, `{"torn\n${readFileSync(tornFile, 'utf8')}`);
  assert.equal(
    torn.reason(torn.run(patchCall('*** Update File: README.md\n+x'))),
    null,
    'a torn record line is a guard-error that lets the edit through',
  );
  const tornLast = JSON.parse(readFileSync(tornFile, 'utf8').trim().split('\n').at(-1));
  assert.deepEqual(
    [tornLast.toolName, tornLast.reason],
    ['apply_patch', 'guard-error'],
    'a torn record line is a guard-error, not a closed guard',
  );

  // An unreadable record file fails the guard too; the edit still goes through.
  const unreadable = writerRoot(t);
  mkdirSync(join(unreadable.root, '.codex/state/knu-subagent-hooks', `${SESSION}.jsonl`), {
    recursive: true,
  });
  const result = unreadable.run(patchCall('*** Update File: README.md\n+x'));
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, '');
});
