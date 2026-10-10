// Codex project hook for KNU subagents, registered in `.codex/hooks.json`.
// PreToolUse allows a spawn only for a repo `knu_*` role with an allowed explicit model that the role has a profile pair
// for, and a fresh fork (`fork_turns` "none"), whose plain arguments equal the unused registration `codex:register`
// wrote for that task name. It denies child spawns, every bare `spawn_agent` (V1 roots and V2 providers without tool
// namespaces) and the retry of a lane whose primary child was accepted. Follow-up and message calls are recorded, and
// denied when they target an accepted or released child. The allow record binds the task name to its role and model and
// seals the registration; SubagentStart/SubagentStop record the child identity, model, task path and own-turn effort
// that completion checks compare with that bind. While a writer lane the root spawned is neither accepted nor released,
// a root apply_patch that writes a tracked or unignored path is denied (Parent write guard); a guard that cannot decide
// lets the edit through and records the error. Records go to `.codex/state/knu-subagent-hooks/<parent session>.jsonl`,
// which workspace-write children cannot write; a child can edit a registration, but the fields the task name spells
// must spell it and the seal keeps what the guard compared. Imports stay inside `node:` so no child-editable module
// decides a result.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, mkdirSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const HOOK_RECORD_SCHEMA = 'knu-codex-subagent-hook/v1';
export const RECORD_DIRECTORY = '.codex/state/knu-subagent-hooks';
// task-registry.mjs writes `<task name>.json` and `<task name>.accepted.json` per Parent session here.
export const REGISTRY_DIRECTORY = '.artifacts/tools/codex-native';
const REGISTRATION_SCHEMA = 'knu-codex-task-registration/v1';
const ACCEPTANCE_SCHEMA = 'knu-codex-task-acceptance/v1';
const RELEASE_SCHEMA = 'knu-codex-task-release/v1';
const PATCH_TOOL = 'apply_patch';
// apply_patch file headers; a move writes its destination as well as its source.
const PATCH_TARGET = /^\*\*\* (?:(?:Add|Update|Delete) File|Move to): (.+?)\s*$/u;
const TASK_NAME = /^[a-z0-9_]{1,128}$/u;
const DISPATCH_TOKEN = /^[a-z0-9]{4,12}$/u;
const LANE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const ROOT_PATH = '/root/';
const SPAWN_FIELDS = ['task_name', 'agent_type', 'model', 'reasoning_effort', 'fork_turns'];
const POLICY_PATH = '.codex/hooks/knu-hook-policy.json';
const POLICY_SCHEMA = 'knu-codex-hook-policy/v3';
// Codex joins the V2 tool namespace to the name without a separator (`collaborationspawn_agent`).
const GUARDED_TOOL = /^(.*?)(spawn_agent|followup_task|send_message)$/u;
const SESSION_ID = /^[A-Za-z0-9-]{1,128}$/u;
const INPUT_FIELDS = [
  'task_name',
  'agent_type',
  'model',
  'reasoning_effort',
  'fork_turns',
  'target',
];

// registry = { read(taskName), used(taskName), settled(target), released(target), writers(roles) } over the Parent
// session's registration directory and hook records; workspace = { classify(targets, cwd) } for apply_patch targets.
export function decideToolUse(payload, policy, registry, workspace) {
  const name = typeof payload?.tool_name === 'string' ? payload.tool_name : '';
  if (name === PATCH_TOOL) return decideParentWrite(payload, policy, registry, workspace);
  const match = GUARDED_TOOL.exec(name);
  if (!match) return { action: 'ignore' };
  const [, namespace, tool] = match;
  // Codex adds agent_id and agent_type to tool hooks only when a child makes the call.
  const caller = typeof payload.agent_id === 'string' ? 'child' : 'root';
  const decided = (action, reason) => ({ action, tool, caller, ...(reason ? { reason } : {}) });
  if (tool !== 'spawn_agent') {
    // A target is a task name, an agent id or the task path the hook records (`/root/<task name>`).
    const target = payload.tool_input?.target;
    if (typeof target !== 'string') return decided('record');
    const child = target.startsWith(ROOT_PATH) ? target.slice(ROOT_PATH.length) : target;
    if (registry?.settled(child)) return decided('deny', 'settled-child');
    if (registry?.released?.(child)) return decided('deny', 'released-child');
    return decided('record');
  }
  if (caller === 'child') return decided('deny', 'child-spawn-denied');
  if (namespace === '') return decided('deny', 'unnamespaced-spawn-denied');
  const input = payload.tool_input;
  if (!input || typeof input !== 'object' || Array.isArray(input))
    return decided('deny', 'spawn-input-invalid');
  if (!policy.roster.includes(input.agent_type)) return decided('deny', 'role-not-in-roster');
  if (typeof input.model !== 'string' || input.model === '')
    return decided('deny', 'model-missing');
  if (!policy.allowedModels.includes(input.model)) return decided('deny', 'model-not-allowed');
  if (!allowedPair(policy.allowedRoleModels, input.agent_type, input.model))
    return decided('deny', 'pair-not-allowed');
  if (!boundedFork(input.fork_turns)) return decided('deny', 'full-history-fork');
  const found = TASK_NAME.test(input.task_name ?? '')
    ? (registry?.read(input.task_name) ?? null)
    : null;
  if (found === null) return decided('deny', 'registration-missing');
  if (found.invalid || !validRegistration(found.registration, payload.session_id, input.task_name))
    return decided('deny', 'registration-invalid');
  const { schema, sessionId, ...sealed } = found.registration;
  if (SPAWN_FIELDS.some((field) => sealed.spawnArguments[field] !== input[field]))
    return decided('deny', 'registration-mismatch');
  if (registry.used(input.task_name)) return decided('deny', 'registration-used');
  if (
    sealed.kind === 'lane' &&
    sealed.retry === true &&
    registry.settled(input.task_name.replace(/_retry$/u, ''))
  )
    return decided('deny', 'lane-accepted');
  return { ...decided('allow'), registration: { digest: found.digest, ...sealed } };
}

// A child writes its own lane, and with no writer open the Parent writes freely: neither is guarded or recorded.
function decideParentWrite(payload, policy, registry, workspace) {
  if (typeof payload.agent_id === 'string') return { action: 'ignore' };
  const writers = registry?.writers?.(policy.writerRoles) ?? [];
  if (writers.length === 0) return { action: 'ignore' };
  const decided = (action, reason, paths) => ({
    action,
    tool: PATCH_TOOL,
    caller: 'root',
    ...(reason ? { reason } : {}),
    write: { writers, paths },
  });
  const targets = patchTargets(payload.tool_input?.command);
  // apply_patch refuses a patch without a file header itself.
  if (targets.length === 0) return decided('record', 'write-target-unknown', []);
  const paths = workspace.classify(targets, payload.cwd);
  return paths.some(({ verdict }) => verdict === 'guarded')
    ? decided('deny', 'parent-write-during-writer', paths)
    : decided('record', null, paths);
}

function patchTargets(patch) {
  if (typeof patch !== 'string') return [];
  return patch.split(/\r?\n/u).flatMap((line) => PATCH_TARGET.exec(line)?.slice(1, 2) ?? []);
}

function validRegistration(registration, sessionId, taskName) {
  return (
    registration !== null &&
    typeof registration === 'object' &&
    !Array.isArray(registration) &&
    registration.schema === REGISTRATION_SCHEMA &&
    registration.sessionId === sessionId &&
    registration.taskName === taskName &&
    spellsTask(registration) &&
    registration.spawnArguments !== null &&
    typeof registration.spawnArguments === 'object'
  );
}

// Copy of registrationSpellsTask (scripts/agents/codex/subagent-hook-records.mjs): the lane, token and retry flag, or the
// review round, id and reviewed lanes, must spell the task name.
function spellsTask({
  taskName,
  kind,
  dispatchToken: token,
  laneId,
  retry,
  round,
  reviewId,
  reviewOf,
}) {
  if (typeof token !== 'string' || !DISPATCH_TOKEN.test(token) || token === 'retry') return false;
  if (kind === 'lane')
    return (
      typeof laneId === 'string' &&
      LANE_ID.test(laneId) &&
      typeof retry === 'boolean' &&
      taskName === `${laneId.replaceAll('-', '_')}_${token}${retry ? '_retry' : ''}`
    );
  return (
    kind === 'review' &&
    Number.isSafeInteger(round) &&
    round >= 1 &&
    taskName === `review_${token}_${round}` &&
    reviewId === `review-${token}-${round}` &&
    Array.isArray(reviewOf) &&
    reviewOf.length > 0 &&
    reviewOf.every((id) => typeof id === 'string' && LANE_ID.test(id))
  );
}

function allowedPair(pairs, role, model) {
  return (
    pairs !== null &&
    typeof pairs === 'object' &&
    Object.hasOwn(pairs, role) &&
    Array.isArray(pairs[role]) &&
    pairs[role].includes(model)
  );
}

// Full-history forks (`fork_turns` omitted, "all" or, since codex-cli 0.162.0, a positive integer) inherit the parent
// model and ignore overrides; a registration takes only "none".
function boundedFork(value) {
  return value === 'none';
}

export function buildHookRecord(payload, { policy, registry, workspace, now, ...provenance } = {}) {
  const event = payload?.hook_event_name;
  const base = {
    schema: HOOK_RECORD_SCHEMA,
    event,
    at: now ?? new Date().toISOString(),
    sessionId: payload?.session_id ?? null,
    turnId: payload?.turn_id ?? null,
    ...provenance,
  };
  if (event === 'PreToolUse') {
    const decision = decideToolUse(payload, policy, registry, workspace);
    if (decision.action === 'ignore') return null;
    return {
      ...base,
      toolName: payload.tool_name,
      toolUseId: payload.tool_use_id ?? null,
      caller: decision.caller,
      ...(decision.caller === 'child' ? { agentId: payload.agent_id } : {}),
      decision: decision.action,
      ...(decision.reason ? { reason: decision.reason } : {}),
      // A write record keeps repository paths and the open writers, never the patch text.
      ...(decision.write
        ? { write: decision.write }
        : { input: summarizeInput(payload.tool_input) }),
      ...(decision.registration ? { registration: decision.registration } : {}),
    };
  }
  if (event === 'SubagentStart' || event === 'SubagentStop') {
    // SubagentStart reports the child rollout as transcript_path; SubagentStop adds agent_transcript_path.
    const rollout = readRollout(
      event === 'SubagentStart' ? payload.transcript_path : payload.agent_transcript_path,
    );
    return {
      ...base,
      agentId: payload.agent_id ?? null,
      agentType: payload.agent_type ?? null,
      model: payload.model ?? null,
      agentPath: rollout.agentPath,
      parentThreadId: rollout.parentThreadId,
      ...(event === 'SubagentStop'
        ? { ownTurn: rollout.ownTurn, lastMessageBytes: byteLength(payload.last_assistant_message) }
        : {}),
    };
  }
  return null;
}

// Keep identities and sizes only: V1 messages are plain text and may hold the task prompt.
function summarizeInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    return { inputType: typeof input };
  const summary = {};
  for (const field of INPUT_FIELDS) if (input[field] !== undefined) summary[field] = input[field];
  if (typeof input.message === 'string') summary.messageBytes = byteLength(input.message);
  return summary;
}

function byteLength(value) {
  return typeof value === 'string' ? Buffer.byteLength(value) : null;
}

function readRollout(path) {
  const empty = { agentPath: null, parentThreadId: null, ownTurn: null };
  if (typeof path !== 'string' || path === '') return empty;
  let lines;
  try {
    lines = readFileSync(path, 'utf8').split(/\r?\n/u).filter(Boolean);
  } catch {
    return empty;
  }
  const items = lines.flatMap((line) => {
    try {
      return [JSON.parse(line)];
    } catch {
      return [];
    }
  });
  const spawn = items.find(({ type }) => type === 'session_meta')?.payload?.source?.subagent
    ?.thread_spawn;
  // A forked child copies parent turns first, so its own effort is the last turn context.
  const turn = items.findLast(({ type }) => type === 'turn_context')?.payload;
  return {
    agentPath: typeof spawn?.agent_path === 'string' ? spawn.agent_path : null,
    parentThreadId: typeof spawn?.parent_thread_id === 'string' ? spawn.parent_thread_id : null,
    ownTurn: turn ? { model: turn.model ?? null, effort: turn.effort ?? null } : null,
  };
}

export function runHook({ payload, root, now }) {
  const policyText = readFileSync(join(root, POLICY_PATH), 'utf8');
  const policy = parsePolicy(policyText);
  const record = buildHookRecord(payload, {
    policy,
    registry: fileRegistry(root, payload?.session_id),
    workspace: gitWorkspace(root),
    now,
    policyDigest: digest(policyText),
    scriptDigest: digest(readFileSync(fileURLToPath(import.meta.url))),
    pid: process.pid,
  });
  if (record) appendRecord(root, record);
  return { stdout: hookOutput(payload.hook_event_name, record), record };
}

// A missing registration file is no registration; an unreadable directory fails the guard (a spawn denies).
function fileRegistry(root, sessionId) {
  const directory = SESSION_ID.test(sessionId ?? '')
    ? join(root, REGISTRY_DIRECTORY, sessionId)
    : null;
  const readText = (path) => {
    try {
      return readFileSync(path, 'utf8');
    } catch (error) {
      if (error.code === 'ENOENT') return null;
      throw error;
    }
  };
  const parse = (text) => {
    try {
      return JSON.parse(text);
    } catch {
      return undefined;
    }
  };
  const records = () =>
    (readText(join(root, RECORD_DIRECTORY, `${sessionId}.jsonl`)) ?? '').split(/\r?\n/u).map(parse);
  const rootAllows = () =>
    records().filter(
      (record) =>
        record?.event === 'PreToolUse' && record.caller === 'root' && record.decision === 'allow',
    );
  // Acceptance and release records of this session that name the target by task name or agent id.
  const recorded = (suffix, schema, names) => (target) => {
    if (!directory) return false;
    let files;
    try {
      files = readdirSync(directory);
    } catch (error) {
      if (error.code === 'ENOENT') return false;
      throw error;
    }
    return files
      .filter((file) => file.endsWith(suffix))
      .map((file) => parse(readText(join(directory, file)) ?? ''))
      .some(
        (entry) =>
          entry?.schema === schema &&
          entry.sessionId === sessionId &&
          names(entry).includes(target),
      );
  };
  const settled = recorded('.accepted.json', ACCEPTANCE_SCHEMA, (entry) => [
    entry.taskName,
    entry.agentId,
  ]);
  const released = recorded('.released.json', RELEASE_SCHEMA, (entry) => [
    entry.taskName,
    ...(Array.isArray(entry.agentIds) ? entry.agentIds : []),
  ]);
  return {
    read(taskName) {
      const text = directory && readText(join(directory, `${taskName}.json`));
      if (text === null || text === undefined) return null;
      const registration = parse(text);
      return registration === undefined
        ? { invalid: true }
        : { registration, digest: digest(text) };
    },
    used(taskName) {
      return rootAllows().some((record) => record.input?.task_name === taskName);
    },
    settled,
    released,
    // Writer tasks the root spawned (the sealed role is a writer role) that are neither accepted nor released.
    writers(roles) {
      const names = rootAllows()
        .filter((record) => roles.includes(record.registration?.spawnArguments?.agent_type))
        .map((record) => record.input.task_name);
      return [...new Set(names)].filter((name) => !settled(name) && !released(name));
    },
  };
}

// Classifies apply_patch targets against the checkout: outside the repository, ignored by git (`git check-ignore`
// treats tracked files as not ignored), or guarded. Real paths follow links, so a link in an ignored directory to a
// tracked file is guarded; a git failure throws and the guard lets the edit through.
function gitWorkspace(root) {
  return {
    classify(targets, cwd) {
      const top = realpathSync.native(root);
      const located = targets.map((target) => {
        const path = relative(
          top,
          realTarget(resolve(typeof cwd === 'string' ? cwd : root, target)),
        );
        return path === '..' || path.startsWith(`..${sep}`) || isAbsolute(path)
          ? { path: null, verdict: 'outside' }
          : { path: path.split(sep).join('/'), verdict: 'guarded' };
      });
      const inside = located.filter(({ verdict }) => verdict === 'guarded').map(({ path }) => path);
      if (inside.length === 0) return located;
      const result = spawnSync('git', ['-C', top, 'check-ignore', '-z', '--stdin'], {
        input: `${inside.join('\0')}\0`,
        encoding: 'utf8',
      });
      // Exit 0 lists ignored paths, 1 means none is ignored; anything else is a failure.
      if (result.status !== 0 && result.status !== 1)
        throw new Error(`git check-ignore failed (${result.status ?? result.error?.code})`);
      const ignored = new Set(result.stdout.split('\0').filter(Boolean));
      return located.map((entry) =>
        entry.verdict === 'guarded' && ignored.has(entry.path)
          ? { ...entry, verdict: 'ignored' }
          : entry,
      );
    },
  };
}

// The real path of the nearest existing ancestor, joined with the part that does not exist yet.
function realTarget(path) {
  try {
    return realpathSync.native(path);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const parent = dirname(path);
    return parent === path ? path : join(realTarget(parent), basename(path));
  }
}

function parsePolicy(text) {
  const policy = JSON.parse(text);
  const strings = (value) =>
    Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === 'string');
  const pairs = policy?.allowedRoleModels;
  if (
    policy?.schema !== POLICY_SCHEMA ||
    !strings(policy.allowedModels) ||
    !strings(policy.roster) ||
    !strings(policy.writerRoles) ||
    !policy.writerRoles.every((role) => policy.roster.includes(role)) ||
    pairs === null ||
    typeof pairs !== 'object' ||
    Array.isArray(pairs) ||
    !Object.values(pairs).every(strings)
  )
    throw new TypeError('hook policy is invalid');
  return policy;
}

function digest(content) {
  return `sha256:${createHash('sha256').update(content).digest('hex')}`;
}

function appendRecord(root, record) {
  if (!SESSION_ID.test(record.sessionId ?? '')) throw new TypeError('hook session id is invalid');
  const directory = join(root, RECORD_DIRECTORY);
  mkdirSync(directory, { recursive: true });
  appendFileSync(join(directory, `${record.sessionId}.jsonl`), `${JSON.stringify(record)}\n`);
}

function hookOutput(event, record) {
  if (event === 'PreToolUse' && record?.decision === 'deny')
    return record.toolName === PATCH_TOOL
      ? writeDenyOutput(record.write)
      : denyOutput(record.reason);
  // SubagentStop requires JSON on stdout after exit 0; other events print nothing.
  return event === 'SubagentStop' ? '{}' : '';
}

function denyOutput(reason) {
  return decisionOutput(
    `KNU subagent guard: ${reason}. Spawn only a registered (codex:register) repo knu_* role with an allowed ` +
      'explicit model that the role has a profile pair for, and fork_turns "none"; children may not spawn, and an ' +
      'accepted or released child is not resumed or retried.',
  );
}

function writeDenyOutput({ writers, paths }) {
  const guarded = paths.filter(({ verdict }) => verdict === 'guarded').map(({ path }) => path);
  return decisionOutput(
    `KNU parent write guard: parent-write-during-writer. Writer task ${writers.join(', ')} is open, so the Parent ` +
      `may not apply_patch tracked or unignored paths (${guarded.join(', ')}). Settle it first (codex:completion, ` +
      `independent QA, codex:accept), or after the child ended run codex:release --task ${writers[0]} --ended. ` +
      'Ignored paths (.artifacts/, .plans/) and paths outside the repository stay writable.',
  );
}

function decisionOutput(permissionDecisionReason) {
  return JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason,
    },
  });
}

function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
  let payload = null;
  let stdout;
  try {
    payload = JSON.parse(readFileSync(0, 'utf8'));
    stdout = runHook({ payload, root }).stdout;
  } catch (error) {
    const event = payload?.hook_event_name;
    if (event === 'PreToolUse' && payload?.tool_name === PATCH_TOOL) {
      // A Parent write guard that cannot decide lets the edit through and records why, if it can.
      stdout = '';
      try {
        appendRecord(root, {
          schema: HOOK_RECORD_SCHEMA,
          event,
          at: new Date().toISOString(),
          sessionId: payload.session_id ?? null,
          turnId: payload.turn_id ?? null,
          toolName: PATCH_TOOL,
          toolUseId: payload.tool_use_id ?? null,
          caller: typeof payload.agent_id === 'string' ? 'child' : 'root',
          decision: 'record',
          reason: 'guard-error',
          error: error.message,
          pid: process.pid,
        });
      } catch {
        // The record directory itself failed; the edit still goes through.
      }
    } else if (
      // A spawn guard that cannot decide denies the spawn rather than failing open.
      event === 'PreToolUse' &&
      decideToolUse(payload, { roster: [], allowedModels: [], allowedRoleModels: {} }).tool ===
        'spawn_agent'
    )
      stdout = denyOutput(`guard-error (${error.message})`);
    else stdout = event === 'SubagentStop' ? '{}' : '';
  }
  if (stdout) process.stdout.write(stdout);
}

// Compare real paths: module URLs resolve symlinks (macOS /var → /private/var), argv does not.
if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) main();
