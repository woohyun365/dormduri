import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import test from 'node:test';

import { resolveArtifactPath } from '../../../artifacts/paths.mjs';
import { ALLOWED_CHILD_MODELS, ROLE_EFFORTS } from '../../../agents/codex/model-profiles.mjs';

const repoRoot = resolve(import.meta.dirname, '../../../..');
const hookPath = resolve(repoRoot, '.codex/hooks/knu-subagent-hooks.mjs');
const policyPath = resolve(repoRoot, '.codex/hooks/knu-hook-policy.json');
const SESSION = '01a10cfc-ad92-7063-894c-5da2be8c9650';
const CHILD = '01a10cfd-0302-7160-bff3-21e68e480903';
const ASTRA = 'gpt-6-astra';
const SOL = 'gpt-6.1-sol';
const POLICY = {
  allowedModels: [...ALLOWED_CHILD_MODELS],
  roster: Object.keys(ROLE_EFFORTS),
  allowedRoleModels: {
    ...Object.fromEntries(Object.keys(ROLE_EFFORTS).map((role) => [role, [ASTRA]])),
    knu_explorer: [ASTRA, SOL],
    knu_explorer_medium: [ASTRA, SOL],
  },
  roleEfforts: ROLE_EFFORTS,
};

// Loaded per test so a missing module or export fails each case on its own reason.
const hooks = () => import('../../../../.codex/hooks/knu-subagent-hooks.mjs');
const records = () => import('../../../agents/codex/subagent-hook-records.mjs');
const registry = () => import('../../../agents/codex/task-registry.mjs');

const sha256 = (text) => `sha256:${createHash('sha256').update(text).digest('hex')}`;

function laneRegistration({
  taskName = 'lane_one_disp1',
  laneId = 'lane-one',
  retry = false,
  agentType = 'knu_explorer',
  model = SOL,
  effort = ROLE_EFFORTS[agentType],
} = {}) {
  return {
    schema: 'knu-codex-task-registration/v1',
    sessionId: SESSION,
    taskName,
    kind: 'lane',
    laneId,
    dispatchToken: 'disp1',
    retry,
    spawnArguments: {
      task_name: taskName,
      agent_type: agentType,
      model,
      reasoning_effort: effort,
      fork_turns: 'none',
    },
  };
}

function reviewRegistration({ round = 1, dispatchToken = 'disp1', reviewOf = ['lane-one'] } = {}) {
  const taskName = `review_${dispatchToken}_${round}`;
  return {
    schema: 'knu-codex-task-registration/v1',
    sessionId: SESSION,
    taskName,
    kind: 'review',
    reviewId: `review-${dispatchToken}-${round}`,
    dispatchToken,
    round,
    reviewOf,
    spawnArguments: {
      task_name: taskName,
      agent_type: 'knu_reviewer',
      model: ASTRA,
      reasoning_effort: 'xhigh',
      fork_turns: 'none',
    },
  };
}

function spawnCall(input = {}, { child = false } = {}) {
  return {
    session_id: SESSION,
    turn_id: 'turn-1',
    hook_event_name: 'PreToolUse',
    model: ASTRA,
    tool_name: 'collaborationspawn_agent',
    tool_use_id: 'call_1',
    tool_input: {
      task_name: 'lane_one_disp1',
      agent_type: 'knu_explorer',
      model: SOL,
      reasoning_effort: 'high',
      fork_turns: 'none',
      message: 'secret task text',
      ...input,
    },
    ...(child ? { agent_id: CHILD, agent_type: 'knu_explorer' } : {}),
  };
}

// An in-memory registry with the lookups the hook makes against the session's registration directory.
function memoryRegistry({ registrations = {}, used = [], settled = [], released = [] } = {}) {
  return {
    read: (taskName) => {
      if (!Object.hasOwn(registrations, taskName)) return null;
      const value = registrations[taskName];
      if (value === 'invalid') return { invalid: true };
      const text = JSON.stringify(value);
      return { registration: value, digest: sha256(text) };
    },
    used: (taskName) => used.includes(taskName),
    settled: (target) => settled.includes(target),
    released: (target) => released.includes(target),
  };
}

test('guard allows a registered spawn and seals the registration into the decision', async () => {
  const { decideToolUse } = await hooks();
  const registration = laneRegistration();
  const decision = decideToolUse(
    spawnCall(),
    POLICY,
    memoryRegistry({ registrations: { lane_one_disp1: registration } }),
  );
  const { schema, sessionId, ...sealed } = registration;
  assert.deepEqual(decision, {
    action: 'allow',
    tool: 'spawn_agent',
    caller: 'root',
    registration: { digest: sha256(JSON.stringify(registration)), ...sealed },
  });
  assert.equal(schema, 'knu-codex-task-registration/v1');
  assert.equal(sessionId, SESSION);
});

test('guard denies a spawn without a matching unused registration with its own reason', async () => {
  const { decideToolUse } = await hooks();
  const deny = (reason) => ({ action: 'deny', tool: 'spawn_agent', caller: 'root', reason });
  const registered = (registration) =>
    memoryRegistry({ registrations: { lane_one_disp1: registration } });
  assert.deepEqual(decideToolUse(spawnCall(), POLICY), deny('registration-missing'));
  assert.deepEqual(
    decideToolUse(spawnCall(), POLICY, memoryRegistry()),
    deny('registration-missing'),
  );
  assert.deepEqual(
    decideToolUse(spawnCall(), POLICY, registered('invalid')),
    deny('registration-invalid'),
  );
  // A registration for another session, task name or kind is not this spawn's registration.
  for (const registration of [
    { ...laneRegistration(), sessionId: 'other-session' },
    { ...laneRegistration(), taskName: 'lane_two_disp1' },
    {
      ...laneRegistration({ taskName: 'lane_two_disp1', laneId: 'lane-two' }),
      spawnArguments: laneRegistration().spawnArguments,
    },
    { ...laneRegistration(), kind: 'other' },
    { ...laneRegistration(), schema: 'knu-codex-task-registration/v0' },
    { ...laneRegistration(), spawnArguments: null },
  ])
    assert.deepEqual(
      decideToolUse(spawnCall(), POLICY, registered(registration)),
      deny('registration-invalid'),
      JSON.stringify(registration),
    );
  // Every plain spawn argument must equal the registered one.
  for (const input of [
    { agent_type: 'knu_explorer_medium', reasoning_effort: 'medium' },
    { model: ASTRA },
    { reasoning_effort: 'xhigh' },
  ])
    assert.deepEqual(
      decideToolUse(spawnCall(input), POLICY, registered(laneRegistration())),
      deny('registration-mismatch'),
      JSON.stringify(input),
    );
  // A positive integer fork is a full-history fork (codex-cli 0.162.0), refused before the registration is read.
  for (const fork_turns of ['2', 2])
    assert.deepEqual(
      decideToolUse(spawnCall({ fork_turns }), POLICY, registered(laneRegistration())),
      deny('full-history-fork'),
      JSON.stringify(fork_turns),
    );
  // The policy checks run first, so a spawn outside the policy keeps its own reason.
  assert.equal(
    decideToolUse(spawnCall({ model: 'gpt-x-unlisted' }), POLICY, registered(laneRegistration()))
      .reason,
    'model-not-allowed',
  );
  assert.deepEqual(
    decideToolUse(
      spawnCall(),
      POLICY,
      memoryRegistry({
        registrations: { lane_one_disp1: laneRegistration() },
        used: ['lane_one_disp1'],
      }),
    ),
    deny('registration-used'),
  );
});

test('guard denies the retry spawn of a lane whose primary child was accepted', async () => {
  const { decideToolUse } = await hooks();
  const retry = laneRegistration({ taskName: 'lane_one_disp1_retry', retry: true, model: ASTRA });
  const call = spawnCall({ task_name: 'lane_one_disp1_retry', model: ASTRA });
  assert.equal(
    decideToolUse(
      call,
      POLICY,
      memoryRegistry({ registrations: { lane_one_disp1_retry: retry }, settled: [] }),
    ).action,
    'allow',
  );
  assert.deepEqual(
    decideToolUse(
      call,
      POLICY,
      memoryRegistry({
        registrations: { lane_one_disp1_retry: retry },
        settled: ['lane_one_disp1'],
      }),
    ),
    { action: 'deny', tool: 'spawn_agent', caller: 'root', reason: 'lane-accepted' },
  );
});

test('guard refuses a registration whose own fields do not spell its task name', async () => {
  const { decideToolUse } = await hooks();
  const deny = {
    action: 'deny',
    tool: 'spawn_agent',
    caller: 'root',
    reason: 'registration-invalid',
  };
  // A child can edit a registration before the spawn; fields the task name spells are compared with it.
  const retryCall = spawnCall({ task_name: 'lane_one_disp1_retry', model: ASTRA });
  const retry = laneRegistration({ taskName: 'lane_one_disp1_retry', retry: true, model: ASTRA });
  for (const registration of [
    { ...retry, retry: false },
    { ...retry, retry: 'yes' },
    { ...retry, laneId: 'lane-two' },
    { ...retry, dispatchToken: 'disp2' },
    { ...retry, kind: 'review' },
  ])
    assert.deepEqual(
      decideToolUse(
        retryCall,
        POLICY,
        memoryRegistry({
          registrations: { lane_one_disp1_retry: registration },
          settled: ['lane_one_disp1'],
        }),
      ),
      deny,
      JSON.stringify(registration),
    );
  const reviewCall = spawnCall({
    task_name: 'review_disp1_2',
    agent_type: 'knu_reviewer',
    model: ASTRA,
    reasoning_effort: 'xhigh',
  });
  const review = reviewRegistration({ round: 2 });
  const decide = (registration) =>
    decideToolUse(
      reviewCall,
      POLICY,
      memoryRegistry({ registrations: { review_disp1_2: registration } }),
    );
  assert.equal(decide(review).action, 'allow');
  for (const registration of [
    { ...review, kind: 'lane' },
    { ...review, round: 1 },
    { ...review, round: '2' },
    { ...review, reviewId: 'review-disp1-1' },
    { ...review, dispatchToken: 'zzzz' },
    { ...review, reviewOf: [] },
    { ...review, reviewOf: 'lane-one' },
  ])
    assert.deepEqual(decide(registration), deny, JSON.stringify(registration));
});

test('guard denies follow-up and message calls to an accepted child and records the others', async () => {
  const { decideToolUse } = await hooks();
  const call = (toolName, target, child = false) => ({
    ...spawnCall({}, { child }),
    tool_name: toolName,
    tool_input: { target, message: 'x' },
  });
  const settled = memoryRegistry({ settled: ['lane_one_disp1', CHILD] });
  for (const [toolName, target, child, tool] of [
    ['collaborationfollowup_task', 'lane_one_disp1', false, 'followup_task'],
    ['collaborationsend_message', 'lane_one_disp1', false, 'send_message'],
    ['collaborationsend_message', CHILD, true, 'send_message'],
    // The task path the hook records (`/root/<task name>`) names the same child.
    ['collaborationfollowup_task', '/root/lane_one_disp1', false, 'followup_task'],
    ['collaborationsend_message', '/root/lane_one_disp1', false, 'send_message'],
  ])
    assert.deepEqual(
      decideToolUse(call(toolName, target, child), POLICY, settled),
      {
        action: 'deny',
        tool,
        caller: child ? 'child' : 'root',
        reason: 'settled-child',
      },
      `${toolName} ${target}`,
    );
  assert.deepEqual(
    decideToolUse(call('collaborationfollowup_task', 'lane_two_disp1'), POLICY, settled),
    {
      action: 'record',
      tool: 'followup_task',
      caller: 'root',
    },
  );
  assert.deepEqual(decideToolUse(call('collaborationfollowup_task', 'lane_one_disp1'), POLICY), {
    action: 'record',
    tool: 'followup_task',
    caller: 'root',
  });
});

test('guard denies follow-up and message calls to a released child', async () => {
  const { decideToolUse } = await hooks();
  const call = (toolName, target) => ({
    ...spawnCall(),
    tool_name: toolName,
    tool_input: { target, message: 'x' },
  });
  const released = memoryRegistry({ released: ['lane_one_disp1', CHILD] });
  for (const [toolName, target, tool] of [
    ['collaborationfollowup_task', 'lane_one_disp1', 'followup_task'],
    ['collaborationsend_message', CHILD, 'send_message'],
    ['collaborationfollowup_task', '/root/lane_one_disp1', 'followup_task'],
  ])
    assert.deepEqual(
      decideToolUse(call(toolName, target), POLICY, released),
      { action: 'deny', tool, caller: 'root', reason: 'released-child' },
      `${toolName} ${target}`,
    );
  assert.equal(
    decideToolUse(call('collaborationfollowup_task', 'lane_two_disp1'), POLICY, released).action,
    'record',
  );
});

test('the hook and the registry module name the same registration directory', async () => {
  const { REGISTRY_DIRECTORY } = await hooks();
  const { registryDirectory } = await registry();
  const expected = relative(repoRoot, resolveArtifactPath(repoRoot, ['codex-native', SESSION], {}));
  assert.equal(`${REGISTRY_DIRECTORY}/${SESSION}`, expected);
  assert.equal(relative(repoRoot, registryDirectory(repoRoot, SESSION)), expected);
  // The module ignores a configured artifact directory: the hook cannot read the Parent's environment.
  assert.equal(
    relative(repoRoot, registryDirectory(repoRoot, SESSION, { KNU_ARTIFACTS_DIR: 'elsewhere' })),
    expected,
  );
  assert.throws(() => registryDirectory(repoRoot, '../escape'), /session id/u);
});

test('the installed hook reads registrations and acceptances from the session registration directory', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'knu-hook-registry-'));
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
  const reason = (result) => {
    assert.equal(result.status, 0, result.stderr);
    return result.stdout === ''
      ? null
      : JSON.parse(result.stdout).hookSpecificOutput.permissionDecisionReason;
  };
  const directory = join(root, '.artifacts/tools/codex-native', SESSION);

  assert.match(reason(run(spawnCall())), /registration-missing/u);
  mkdirSync(directory, { recursive: true });
  const text = JSON.stringify(laneRegistration());
  writeFileSync(join(directory, 'lane_one_disp1.json'), text);
  writeFileSync(join(directory, 'lane_bad_disp1.json'), '{broken');
  assert.match(reason(run(spawnCall({ task_name: 'lane_bad_disp1' }))), /registration-invalid/u);
  // A task name that is not a V2 name never reaches the file system, even where a matching file sits.
  writeFileSync(
    join(root, '.artifacts/tools/codex-native/lane_one_disp1.json'),
    JSON.stringify(laneRegistration({ taskName: '../lane_one_disp1' })),
  );
  assert.match(reason(run(spawnCall({ task_name: '../lane_one_disp1' }))), /registration-missing/u);
  assert.equal(reason(run(spawnCall())), null);
  assert.match(reason(run(spawnCall())), /registration-used/u);
  const followup = (target) => ({
    ...spawnCall(),
    tool_name: 'collaborationfollowup_task',
    tool_input: { target, message: 'again' },
  });
  // An acceptance of another session or schema does not settle this session's child.
  const acceptanceText = (changes) =>
    JSON.stringify({
      schema: 'knu-codex-task-acceptance/v1',
      sessionId: SESSION,
      taskName: 'lane_one_disp1',
      agentId: CHILD,
      ...changes,
    });
  writeFileSync(
    join(directory, 'foreign.accepted.json'),
    acceptanceText({ sessionId: 'other-session' }),
  );
  writeFileSync(
    join(directory, 'old.accepted.json'),
    acceptanceText({ schema: 'knu-codex-task-acceptance/v0' }),
  );
  assert.equal(reason(run(followup('lane_one_disp1'))), null);
  writeFileSync(
    join(directory, 'lane_one_disp1.accepted.json'),
    JSON.stringify({
      schema: 'knu-codex-task-acceptance/v1',
      sessionId: SESSION,
      taskName: 'lane_one_disp1',
      agentId: CHILD,
    }),
  );
  assert.match(reason(run(followup('lane_one_disp1'))), /settled-child/u);
  assert.match(reason(run(followup(CHILD))), /settled-child/u);

  const lines = readFileSync(
    join(root, '.codex/state/knu-subagent-hooks', `${SESSION}.jsonl`),
    'utf8',
  )
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  assert.deepEqual(
    lines.map(({ decision, reason: why }) => [decision, why ?? null]),
    [
      ['deny', 'registration-missing'],
      ['deny', 'registration-invalid'],
      ['deny', 'registration-missing'],
      ['allow', null],
      ['deny', 'registration-used'],
      ['record', null],
      ['deny', 'settled-child'],
      ['deny', 'settled-child'],
    ],
  );
  const { schema, sessionId, ...sealed } = JSON.parse(text);
  assert.deepEqual(lines[3].registration, { digest: sha256(text), ...sealed });
  assert.ok(schema && sessionId);
});

// Hook records of one lane child: the sealed root allow record, then start and stop.
function sealedObservation({
  taskName = 'lane_one_disp1',
  registration = laneRegistration({ taskName }),
  seal = true,
  extra = [],
} = {}) {
  const { schema, sessionId, ...sealed } = registration;
  const model = registration.spawnArguments.model;
  const agentType = registration.spawnArguments.agent_type;
  const base = {
    schema: 'knu-codex-subagent-hook/v1',
    sessionId: SESSION,
    agentId: CHILD,
    agentType,
    model,
    agentPath: `/root/${taskName}`,
    parentThreadId: SESSION,
  };
  assert.ok(schema && sessionId);
  return {
    sessionId: SESSION,
    malformed: 0,
    records: [
      {
        schema: 'knu-codex-subagent-hook/v1',
        sessionId: SESSION,
        event: 'PreToolUse',
        toolName: 'collaborationspawn_agent',
        caller: 'root',
        decision: 'allow',
        input: { ...registration.spawnArguments, task_name: taskName },
        ...(seal
          ? { registration: { digest: sha256(JSON.stringify(registration)), ...sealed } }
          : {}),
      },
      { ...base, event: 'SubagentStart' },
      {
        ...base,
        event: 'SubagentStop',
        at: 'stop-1',
        ownTurn: { model, effort: ROLE_EFFORTS[agentType] },
      },
      ...extra,
    ],
  };
}

test('completion refuses an allow record without a registration seal or with a seal for another expectation', async () => {
  const { checkLaneCompletion } = await records();
  const check = (observation, expectedModel = SOL) =>
    checkLaneCompletion({
      observation,
      laneId: 'lane-one',
      dispatchToken: 'disp1',
      expectedRole: 'knu_explorer',
      expectedModel,
    });
  assert.equal(
    check(sealedObservation()).accepted,
    true,
    JSON.stringify(check(sealedObservation())),
  );
  assert.equal(check(sealedObservation({ seal: false })).reason, 'registration-unsealed');
  const sealedWith = (changes, spawn = {}) => {
    const observation = sealedObservation();
    const allow = observation.records[0];
    allow.registration = {
      ...allow.registration,
      ...changes,
      spawnArguments: { ...allow.registration.spawnArguments, ...spawn },
    };
    return observation;
  };
  for (const [changes, spawn] of [
    [{ kind: 'review' }, {}],
    [{}, { agent_type: 'knu_researcher' }],
    [{}, { model: ASTRA }],
    [{}, { reasoning_effort: 'xhigh' }],
  ])
    assert.equal(
      check(sealedWith(changes, spawn)).reason,
      'registration-mismatch',
      JSON.stringify([changes, spawn]),
    );
  assert.equal(check(sealedWith({ digest: undefined })).reason, 'registration-unsealed');
  // A seal whose own fields do not spell the checked task name is not a registration for it.
  for (const changes of [
    { laneId: 'lane-two' },
    { dispatchToken: 'disp2' },
    { retry: true },
    { taskName: 'lane_two_disp1' },
    // A seal that spells another lane is not this lane's registration either.
    { laneId: 'lane-two', taskName: 'lane_two_disp1' },
  ])
    assert.equal(
      check(sealedWith(changes)).reason,
      'registration-invalid',
      JSON.stringify(changes),
    );
});

function acceptanceOf(observation, { taskName = 'lane_one_disp1', stopIndex = 2 } = {}) {
  return {
    schema: 'knu-codex-task-acceptance/v1',
    sessionId: SESSION,
    taskName,
    kind: 'lane',
    agentId: CHILD,
    stopDigest: sha256(JSON.stringify(observation.records[stopIndex])),
    registrationDigest: observation.records[0].registration.digest,
  };
}

test('an acceptance binds the accepted stop, so a resumed child no longer completes the lane', async () => {
  const { checkLaneCompletion, hookRecordDigest } = await records();
  const check = (observation, acceptances, retry = false, expectedModel = SOL) =>
    checkLaneCompletion({
      observation,
      laneId: 'lane-one',
      dispatchToken: 'disp1',
      expectedRole: 'knu_explorer',
      expectedModel,
      retry,
      acceptances,
    });
  const observation = sealedObservation();
  assert.equal(
    hookRecordDigest(observation.records[2]),
    sha256(JSON.stringify(observation.records[2])),
  );
  const acceptance = acceptanceOf(observation);
  assert.equal(check(observation, [acceptance]).accepted, true);
  // Without acceptances the check is the pre-acceptance check; an empty list asks for one.
  assert.equal(check(observation, undefined).accepted, true);
  assert.equal(check(observation, []).reason, 'acceptance-missing');
  assert.equal(
    check(observation, [{ ...acceptance, sessionId: 'other-session' }]).reason,
    'acceptance-missing',
  );
  assert.equal(
    check(observation, [{ ...acceptance, schema: 'knu-codex-task-acceptance/v0' }]).reason,
    'acceptance-missing',
  );
  assert.equal(
    check(observation, [{ ...acceptance, agentId: 'child-x' }]).reason,
    'acceptance-mismatch',
  );
  assert.equal(
    check(observation, [{ ...acceptance, stopDigest: sha256('forged') }]).reason,
    'acceptance-mismatch',
  );
  const stop = observation.records[2];
  const resumed = sealedObservation({ extra: [{ ...stop, at: 'stop-2', lastMessageBytes: 9 }] });
  assert.equal(check(resumed, [acceptanceOf(resumed)]).reason, 'resumed-after-acceptance');
  // Once the primary child was accepted, a retry child does not complete the lane.
  const retry = sealedObservation({
    taskName: 'lane_one_disp1_retry',
    registration: laneRegistration({ taskName: 'lane_one_disp1_retry', retry: true, model: ASTRA }),
  });
  const retryAcceptance = acceptanceOf(retry, { taskName: 'lane_one_disp1_retry' });
  assert.equal(check(retry, [retryAcceptance], true, ASTRA).accepted, true);
  assert.equal(check(retry, [retryAcceptance, acceptance], true, ASTRA).reason, 'lane-accepted');
});

test('a review dispatch names its round and binds the review profile and the reviewed lanes', async () => {
  const { createReviewDispatch } = await registry();
  const dispatch = createReviewDispatch({ laneIds: ['lane-one'], dispatchToken: 'disp1' });
  assert.deepEqual(dispatch, {
    kind: 'review',
    reviewId: 'review-disp1-1',
    dispatchToken: 'disp1',
    round: 1,
    reviewOf: ['lane-one'],
    dispatchOwner: 'leader',
    spawnArguments: {
      task_name: 'review_disp1_1',
      agent_type: 'knu_reviewer',
      model: ASTRA,
      reasoning_effort: 'xhigh',
      fork_turns: 'none',
    },
  });
  assert.equal(
    createReviewDispatch({ laneIds: ['lane-one'], dispatchToken: 'disp1', round: 2 }).spawnArguments
      .task_name,
    'review_disp1_2',
  );
  for (const bad of [
    { laneIds: [], dispatchToken: 'disp1' },
    { laneIds: ['lane-one'], dispatchToken: 'retry' },
    { laneIds: ['lane-one'], dispatchToken: 'disp1', round: 0 },
    { laneIds: ['lane-one'], dispatchToken: 'disp1', extra: true },
  ])
    assert.throws(() => createReviewDispatch(bad), TypeError, JSON.stringify(bad));
});

function laneDispatch({ retry = false, model = retry ? ASTRA : SOL } = {}) {
  return {
    laneId: 'lane-one',
    dispatchToken: 'disp1',
    ...(retry ? { retryOf: 'primary' } : {}),
    spawnArguments: {
      task_name: `lane_one_disp1${retry ? '_retry' : ''}`,
      agent_type: 'knu_explorer',
      model,
      reasoning_effort: 'high',
      fork_turns: 'none',
    },
  };
}

test('registration writes each task once with its spawn arguments and refuses inconsistent ones', async (t) => {
  const { registerDispatch, readRegistration, registryDirectory, createReviewDispatch } =
    await registry();
  const root = mkdtempSync(join(tmpdir(), 'knu-task-registry-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const registration = registerDispatch({ root, sessionId: SESSION, dispatch: laneDispatch() });
  assert.deepEqual(registration, laneRegistration());
  const path = join(registryDirectory(root, SESSION), 'lane_one_disp1.json');
  const text = readFileSync(path, 'utf8');
  assert.deepEqual(JSON.parse(text), registration);
  assert.deepEqual(readRegistration({ root, sessionId: SESSION, taskName: 'lane_one_disp1' }), {
    registration,
    digest: sha256(text),
  });
  assert.equal(readRegistration({ root, sessionId: SESSION, taskName: 'lane_two_disp1' }), null);
  assert.throws(
    () => registerDispatch({ root, sessionId: SESSION, dispatch: laneDispatch() }),
    /already registered/u,
  );
  assert.equal(readFileSync(path, 'utf8'), text, 'a second registration keeps the first');
  const review = registerDispatch({
    root,
    sessionId: SESSION,
    dispatch: createReviewDispatch({ laneIds: ['lane-one'], dispatchToken: 'disp1' }),
  });
  assert.deepEqual(review, {
    schema: 'knu-codex-task-registration/v1',
    sessionId: SESSION,
    taskName: 'review_disp1_1',
    kind: 'review',
    reviewId: 'review-disp1-1',
    dispatchToken: 'disp1',
    round: 1,
    reviewOf: ['lane-one'],
    spawnArguments: {
      task_name: 'review_disp1_1',
      agent_type: 'knu_reviewer',
      model: ASTRA,
      reasoning_effort: 'xhigh',
      fork_turns: 'none',
    },
  });
  const spawn = (changes) => ({
    ...laneDispatch(),
    spawnArguments: { ...laneDispatch().spawnArguments, task_name: 'lane_one_disp2', ...changes },
    dispatchToken: 'disp2',
  });
  for (const [dispatch, message] of [
    [spawn({ task_name: 'lane_one_disp1' }), /task name/u],
    [spawn({ reasoning_effort: 'xhigh' }), /effort/u],
    [spawn({ model: 'gpt-6-luna' }), /pair/u],
    [spawn({ fork_turns: 'all' }), /fork/u],
    [spawn({ agent_type: 'default' }), /pair/u],
    [{ ...spawn({}), dispatchToken: undefined }, /needs a dispatch token/u],
  ])
    assert.throws(
      () => registerDispatch({ root, sessionId: SESSION, dispatch }),
      message,
      JSON.stringify(dispatch),
    );
  assert.throws(
    () => registerDispatch({ root, sessionId: '../x', dispatch: laneDispatch() }),
    /session id/u,
  );
  // A lane id outside lowercase kebab-case would write a file the hook never reads (or outside the directory).
  for (const laneId of ['../x', 'Lane-One', 'lane_one'])
    assert.throws(
      () =>
        registerDispatch({
          root,
          sessionId: SESSION,
          dispatch: {
            ...laneDispatch(),
            laneId,
            spawnArguments: {
              ...laneDispatch().spawnArguments,
              task_name: `${laneId.replaceAll('-', '_')}_disp1`,
            },
          },
        }),
      /lane id/u,
      laneId,
    );
  assert.throws(
    () => readRegistration({ root, sessionId: SESSION, taskName: '../lane_one_disp1' }),
    /task name/u,
  );
});

test('acceptance writes a record for a completed task once and refuses a retry after the primary', async (t) => {
  const { registerDispatch, acceptTask, readAcceptance } = await registry();
  const { hookRecordDigest } = await records();
  const root = mkdtempSync(join(tmpdir(), 'knu-task-accept-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  registerDispatch({ root, sessionId: SESSION, dispatch: laneDispatch() });
  const observation = sealedObservation();
  const accept = (taskName, expectedModel = SOL, given = observation) =>
    acceptTask({
      root,
      sessionId: SESSION,
      taskName,
      expectedRole: 'knu_explorer',
      expectedModel,
      observation: given,
      now: '2026-10-09T00:00:00Z',
    });
  const missing = accept('lane_two_disp1');
  assert.equal(missing.accepted, false);
  assert.equal(missing.reason, 'registration-missing');
  const refused = accept('lane_one_disp1', ASTRA);
  assert.equal(refused.reason, 'model-mismatch');
  assert.equal(readAcceptance({ root, sessionId: SESSION, taskName: 'lane_one_disp1' }), null);
  const verdict = accept('lane_one_disp1');
  assert.equal(verdict.accepted, true, JSON.stringify(verdict));
  assert.deepEqual(readAcceptance({ root, sessionId: SESSION, taskName: 'lane_one_disp1' }), {
    schema: 'knu-codex-task-acceptance/v1',
    sessionId: SESSION,
    taskName: 'lane_one_disp1',
    kind: 'lane',
    agentId: CHILD,
    stopDigest: hookRecordDigest(observation.records[2]),
    registrationDigest: observation.records[0].registration.digest,
    acceptedAt: '2026-10-09T00:00:00Z',
  });
  assert.deepEqual(
    verdict.acceptance,
    readAcceptance({ root, sessionId: SESSION, taskName: 'lane_one_disp1' }),
  );
  assert.throws(() => accept('lane_one_disp1'), /already accepted/u);
  // Success ends the lane: no retry registration and no retry acceptance after it.
  assert.throws(
    () => registerDispatch({ root, sessionId: SESSION, dispatch: laneDispatch({ retry: true }) }),
    /lane-accepted/u,
  );
  const retryDirectory = join(root, '.artifacts/tools/codex-native', SESSION);
  writeFileSync(
    join(retryDirectory, 'lane_one_disp1_retry.json'),
    JSON.stringify(
      laneRegistration({ taskName: 'lane_one_disp1_retry', retry: true, model: ASTRA }),
    ),
  );
  const retry = sealedObservation({
    taskName: 'lane_one_disp1_retry',
    registration: laneRegistration({ taskName: 'lane_one_disp1_retry', retry: true, model: ASTRA }),
  });
  assert.equal(accept('lane_one_disp1_retry', ASTRA, retry).reason, 'lane-accepted');
  assert.equal(existsSync(join(retryDirectory, 'lane_one_disp1_retry.accepted.json')), false);
  // A registration file that does not name its own task or lane is not this task's registration.
  writeFileSync(join(retryDirectory, 'lane_y_disp1.json'), JSON.stringify(laneRegistration()));
  writeFileSync(
    join(retryDirectory, 'lane_x_disp1.json'),
    JSON.stringify(laneRegistration({ taskName: 'lane_x_disp1' })),
  );
  writeFileSync(
    join(retryDirectory, 'lane_z_disp1.json'),
    JSON.stringify({
      ...laneRegistration({ taskName: 'lane_z_disp1', laneId: 'lane-z' }),
      sessionId: 'other',
    }),
  );
  for (const taskName of ['lane_y_disp1', 'lane_x_disp1', 'lane_z_disp1'])
    assert.equal(accept(taskName).reason, 'registration-invalid', taskName);
});

test('acceptance names the last stop of a child that took a follow-up before it was accepted', async (t) => {
  const { registerDispatch, acceptTask } = await registry();
  const { checkLaneCompletion, hookRecordDigest } = await records();
  const root = mkdtempSync(join(tmpdir(), 'knu-task-followup-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  registerDispatch({ root, sessionId: SESSION, dispatch: laneDispatch() });
  const first = sealedObservation();
  const observation = {
    ...first,
    records: [...first.records, { ...first.records[2], at: 'stop-2' }],
  };
  const verdict = acceptTask({
    root,
    sessionId: SESSION,
    taskName: 'lane_one_disp1',
    expectedRole: 'knu_explorer',
    expectedModel: SOL,
    observation,
  });
  assert.equal(verdict.accepted, true, JSON.stringify(verdict));
  assert.equal(verdict.acceptance.stopDigest, hookRecordDigest(observation.records[3]));
  assert.equal(
    checkLaneCompletion({
      observation,
      laneId: 'lane-one',
      dispatchToken: 'disp1',
      expectedRole: 'knu_explorer',
      expectedModel: SOL,
      acceptances: [verdict.acceptance],
    }).accepted,
    true,
  );
});

test('a reviewer child is accepted on the review role and model of its registration', async (t) => {
  const { registerDispatch, acceptTask, createReviewDispatch } = await registry();
  const root = mkdtempSync(join(tmpdir(), 'knu-task-review-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const registration = registerDispatch({
    root,
    sessionId: SESSION,
    dispatch: createReviewDispatch({ laneIds: ['lane-one'], dispatchToken: 'disp1' }),
  });
  const observation = sealedObservation({ taskName: 'review_disp1_1', registration });
  const accept = (expectedRole, expectedModel) =>
    acceptTask({
      root,
      sessionId: SESSION,
      taskName: 'review_disp1_1',
      expectedRole,
      expectedModel,
      observation,
    });
  assert.equal(accept('knu_reviewer', SOL).reason, 'registration-mismatch');
  assert.equal(accept('knu_explorer', ASTRA).reason, 'registration-mismatch');
  const accepted = accept('knu_reviewer', ASTRA);
  assert.equal(accepted.accepted, true, JSON.stringify(accepted));
  assert.equal(accepted.acceptance.kind, 'review');
  // A review registration file whose fields do not spell its task name is not that reviewer's registration.
  const directory = join(root, '.artifacts/tools/codex-native', SESSION);
  for (const [taskName, registration] of [
    ['review_disp1_2', { ...reviewRegistration({ round: 2 }), reviewId: 'review-disp1-1' }],
    ['review_disp1_3', { ...reviewRegistration({ round: 3 }), round: 1 }],
  ]) {
    writeFileSync(join(directory, `${taskName}.json`), JSON.stringify(registration));
    assert.equal(
      acceptTask({
        root,
        sessionId: SESSION,
        taskName,
        expectedRole: 'knu_reviewer',
        expectedModel: ASTRA,
        observation: sealedObservation({ taskName, registration }),
      }).reason,
      'registration-invalid',
      taskName,
    );
  }
});

test('the registry command registers a dispatch file and accepts a task against the session hook records', async (t) => {
  const { runRegistryCommand } = await registry();
  const root = mkdtempSync(join(tmpdir(), 'knu-task-command-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const env = { CODEX_THREAD_ID: SESSION };
  const dispatchFile = join(root, 'dispatch.json');
  writeFileSync(dispatchFile, JSON.stringify({ dispatches: [laneDispatch()] }));
  const registered = runRegistryCommand(['register', '--dispatch', dispatchFile], { root, env });
  assert.equal(registered.exitCode, 0, registered.stdout);
  // The digest lets the Parent compare the seal and the acceptance with what it registered.
  const registeredText = readFileSync(
    join(root, '.artifacts/tools/codex-native', SESSION, 'lane_one_disp1.json'),
    'utf8',
  );
  assert.deepEqual(JSON.parse(registered.stdout), {
    sessionId: SESSION,
    registered: [
      {
        taskName: 'lane_one_disp1',
        digest: sha256(registeredText),
        spawnArguments: laneDispatch().spawnArguments,
      },
    ],
  });
  const hookDirectory = join(root, '.codex/state/knu-subagent-hooks');
  mkdirSync(hookDirectory, { recursive: true });
  const observation = sealedObservation();
  writeFileSync(
    join(hookDirectory, `${SESSION}.jsonl`),
    observation.records.map((record) => JSON.stringify(record)).join('\n') + '\n',
  );
  const args = ['accept', '--task', 'lane_one_disp1', '--role', 'knu_explorer', '--model'];
  const refused = runRegistryCommand([...args, ASTRA], { root, env });
  assert.equal(refused.exitCode, 1);
  assert.equal(JSON.parse(refused.stdout).reason, 'model-mismatch');
  const accepted = runRegistryCommand([...args, SOL], { root, env });
  assert.equal(accepted.exitCode, 0, accepted.stdout);
  assert.equal(JSON.parse(accepted.stdout).accepted, true);
  for (const bad of [[], ['register'], ['accept', '--task', 'lane_one_disp1'], ['other']])
    assert.throws(() => runRegistryCommand(bad, { root, env }), TypeError, JSON.stringify(bad));
  assert.throws(
    () => runRegistryCommand(['register', '--dispatch', dispatchFile], { root, env: {} }),
    /session id/u,
  );
});

// A root follow-up record that resumes the child: no SubagentStart follows, only the next stop (N2 live).
const followupRecord = (target = 'lane_one_disp1') => ({
  schema: 'knu-codex-subagent-hook/v1',
  sessionId: SESSION,
  event: 'PreToolUse',
  toolName: 'collaborationfollowup_task',
  caller: 'root',
  decision: 'record',
  input: { target, messageBytes: 5 },
});

test('a release records an ended child once without an acceptance', async (t) => {
  const { registerDispatch, releaseTask, readRelease, acceptTask } = await registry();
  assert.equal(typeof releaseTask, 'function', 'task-registry must export releaseTask');
  assert.equal(typeof readRelease, 'function', 'task-registry must export readRelease');
  const root = mkdtempSync(join(tmpdir(), 'knu-task-release-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const release = (observation, { taskName = 'lane_one_disp1', ended = true } = {}) =>
    releaseTask({
      root,
      sessionId: SESSION,
      taskName,
      ended,
      observation,
      now: '2026-10-10T00:00:00Z',
    });
  const reason = (...args) => {
    const verdict = release(...args);
    assert.equal(verdict.released, false, JSON.stringify(verdict));
    return verdict.reason;
  };
  assert.equal(reason(sealedObservation()), 'registration-missing');
  registerDispatch({ root, sessionId: SESSION, dispatch: laneDispatch() });
  const observation = sealedObservation();
  const [allow, start, stop] = observation.records;
  // The Parent states the child ended; the records must not show it running.
  assert.equal(reason(observation, { ended: false }), 'ended-required');
  assert.equal(reason({ ...observation, records: [start, stop] }), 'spawn-missing');
  assert.equal(reason({ ...observation, records: [allow, start] }), 'child-running');
  assert.equal(
    reason({ ...observation, records: [allow, start, stop, followupRecord()] }),
    'child-running',
  );
  assert.equal(
    reason({ ...observation, records: [allow, start, stop, followupRecord(CHILD)] }),
    'child-running',
  );
  assert.equal(reason({ ...observation, malformed: 1 }), 'observation-malformed');
  assert.equal(readRelease({ root, sessionId: SESSION, taskName: 'lane_one_disp1' }), null);

  // A follow-up from a child reopens the child too; a denied follow-up never ran.
  assert.equal(
    reason({
      ...observation,
      records: [allow, start, stop, { ...followupRecord(), caller: 'child', agentId: CHILD }],
    }),
    'child-running',
  );
  const denied = { ...followupRecord(), decision: 'deny', reason: 'settled-child' };
  const resumed = { ...observation, records: [allow, start, stop, followupRecord(), stop, denied] };
  const verdict = release(resumed);
  assert.deepEqual(verdict, {
    released: true,
    release: {
      schema: 'knu-codex-task-release/v1',
      sessionId: SESSION,
      taskName: 'lane_one_disp1',
      agentIds: [CHILD],
      releasedAt: '2026-10-10T00:00:00Z',
    },
  });
  assert.deepEqual(
    readRelease({ root, sessionId: SESSION, taskName: 'lane_one_disp1' }),
    verdict.release,
  );
  assert.throws(() => release(resumed), /already released/u);

  // A spawn whose tool failed after the allow has no child: the Parent's --ended is the only evidence.
  registerDispatch({
    root,
    sessionId: SESSION,
    dispatch: {
      ...laneDispatch(),
      dispatchToken: 'disp2',
      spawnArguments: { ...laneDispatch().spawnArguments, task_name: 'lane_one_disp2' },
    },
  });
  const lone = { ...allow, input: { ...allow.input, task_name: 'lane_one_disp2' } };
  assert.deepEqual(
    release({ ...observation, records: [lone] }, { taskName: 'lane_one_disp2' }).release.agentIds,
    [],
  );

  // An accepted task needs no release.
  registerDispatch({
    root,
    sessionId: SESSION,
    dispatch: {
      ...laneDispatch(),
      dispatchToken: 'disp3',
      spawnArguments: { ...laneDispatch().spawnArguments, task_name: 'lane_one_disp3' },
    },
  });
  const third = sealedObservation({
    taskName: 'lane_one_disp3',
    registration: laneRegistration({ taskName: 'lane_one_disp3' }),
  });
  third.records[0].registration.dispatchToken = 'disp3';
  const accepted = acceptTask({
    root,
    sessionId: SESSION,
    taskName: 'lane_one_disp3',
    expectedRole: 'knu_explorer',
    expectedModel: SOL,
    observation: third,
  });
  assert.equal(accepted.accepted, true, JSON.stringify(accepted));
  assert.equal(reason(third, { taskName: 'lane_one_disp3' }), 'task-accepted');
});

test('the registry command releases an ended task against the session hook records', async (t) => {
  const { runRegistryCommand } = await registry();
  const root = mkdtempSync(join(tmpdir(), 'knu-task-release-command-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const env = { CODEX_THREAD_ID: SESSION };
  const dispatchFile = join(root, 'dispatch.json');
  writeFileSync(dispatchFile, JSON.stringify({ dispatches: [laneDispatch()] }));
  assert.equal(
    runRegistryCommand(['register', '--dispatch', dispatchFile], { root, env }).exitCode,
    0,
  );
  const hookDirectory = join(root, '.codex/state/knu-subagent-hooks');
  mkdirSync(hookDirectory, { recursive: true });
  writeFileSync(
    join(hookDirectory, `${SESSION}.jsonl`),
    sealedObservation()
      .records.map((record) => JSON.stringify(record))
      .join('\n') + '\n',
  );
  let refused;
  assert.doesNotThrow(() => {
    refused = runRegistryCommand(['release', '--task', 'lane_one_disp1'], { root, env });
  }, 'the registry command must take release');
  assert.equal(refused.exitCode, 1);
  assert.equal(JSON.parse(refused.stdout).reason, 'ended-required');
  // pnpm passes `--` after the script's own argument.
  const released = runRegistryCommand(['release', '--', '--task', 'lane_one_disp1', '--ended'], {
    root,
    env,
  });
  assert.equal(released.exitCode, 0, released.stdout);
  assert.equal(JSON.parse(released.stdout).released, true);
  assert.ok(
    existsSync(
      join(root, '.artifacts/tools/codex-native', SESSION, 'lane_one_disp1.released.json'),
    ),
  );
  for (const bad of [
    ['release'],
    ['release', '--ended'],
    ['release', '--task', 'lane_one_disp1', '--ended', 'yes'],
    ['release', '--task', 'lane_one_disp1', '--role', 'knu_explorer'],
  ])
    assert.throws(() => runRegistryCommand(bad, { root, env }), TypeError, JSON.stringify(bad));
});
