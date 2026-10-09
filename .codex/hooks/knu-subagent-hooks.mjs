// Codex project hook for KNU subagents, registered in `.codex/hooks.json`.
// PreToolUse allows a spawn only for a repo `knu_*` role with an allowed explicit model that the role has a profile pair
// for, and a bounded fork, whose plain arguments equal the unused registration `codex:register` wrote for that task
// name. It denies child spawns, every bare `spawn_agent` (V1 roots and V2 providers without tool namespaces) and the
// retry of a lane whose primary child was accepted. Follow-up and message calls are recorded, and denied when they
// target an accepted child. The allow record binds the task name to its role and model and seals the registration;
// SubagentStart/SubagentStop record the child identity, model, task path and own-turn effort that completion checks
// compare with that bind. Records go to `.codex/state/knu-subagent-hooks/<parent session>.jsonl`, which workspace-write
// children cannot write; a child can edit a registration, but the seal keeps what the guard compared. Imports stay
// inside `node:` so no child-editable module decides a result.
import { createHash } from 'node:crypto';
import { appendFileSync, mkdirSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const HOOK_RECORD_SCHEMA = 'knu-codex-subagent-hook/v1';
export const RECORD_DIRECTORY = '.codex/state/knu-subagent-hooks';
// task-registry.mjs writes `<task name>.json` and `<task name>.accepted.json` per Parent session here.
export const REGISTRY_DIRECTORY = '.artifacts/tools/codex-native';
const REGISTRATION_SCHEMA = 'knu-codex-task-registration/v1';
const ACCEPTANCE_SCHEMA = 'knu-codex-task-acceptance/v1';
const TASK_NAME = /^[a-z0-9_]{1,128}$/u;
const SPAWN_FIELDS = ['task_name', 'agent_type', 'model', 'reasoning_effort', 'fork_turns'];
const POLICY_PATH = '.codex/hooks/knu-hook-policy.json';
const POLICY_SCHEMA = 'knu-codex-hook-policy/v2';
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

// registry = { read(taskName), used(taskName), settled(target) } over the Parent session's registration directory.
export function decideToolUse(payload, policy, registry) {
  const name = typeof payload?.tool_name === 'string' ? payload.tool_name : '';
  const match = GUARDED_TOOL.exec(name);
  if (!match) return { action: 'ignore' };
  const [, namespace, tool] = match;
  // Codex adds agent_id and agent_type to tool hooks only when a child makes the call.
  const caller = typeof payload.agent_id === 'string' ? 'child' : 'root';
  const decided = (action, reason) => ({ action, tool, caller, ...(reason ? { reason } : {}) });
  if (tool !== 'spawn_agent') {
    const target = payload.tool_input?.target;
    return typeof target === 'string' && registry?.settled(target)
      ? decided('deny', 'settled-child')
      : decided('record');
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

function validRegistration(registration, sessionId, taskName) {
  return (
    registration !== null &&
    typeof registration === 'object' &&
    !Array.isArray(registration) &&
    registration.schema === REGISTRATION_SCHEMA &&
    registration.sessionId === sessionId &&
    registration.taskName === taskName &&
    ['lane', 'review'].includes(registration.kind) &&
    registration.spawnArguments !== null &&
    typeof registration.spawnArguments === 'object'
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

// Full-history forks (`fork_turns` omitted or "all") inherit the parent model and ignore overrides.
function boundedFork(value) {
  if (value === 'none') return true;
  if (typeof value === 'string') return /^[1-9]\d*$/u.test(value);
  return Number.isInteger(value) && value > 0;
}

export function buildHookRecord(payload, { policy, registry, now, ...provenance } = {}) {
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
    const decision = decideToolUse(payload, policy, registry);
    if (decision.action === 'ignore') return null;
    return {
      ...base,
      toolName: payload.tool_name,
      toolUseId: payload.tool_use_id ?? null,
      caller: decision.caller,
      ...(decision.caller === 'child' ? { agentId: payload.agent_id } : {}),
      decision: decision.action,
      ...(decision.reason ? { reason: decision.reason } : {}),
      input: summarizeInput(payload.tool_input),
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
      const text = readText(join(root, RECORD_DIRECTORY, `${sessionId}.jsonl`)) ?? '';
      return text
        .split(/\r?\n/u)
        .map(parse)
        .some(
          (record) =>
            record?.event === 'PreToolUse' &&
            record.caller === 'root' &&
            record.decision === 'allow' &&
            record.input?.task_name === taskName,
        );
    },
    settled(target) {
      if (!directory) return false;
      let names;
      try {
        names = readdirSync(directory);
      } catch (error) {
        if (error.code === 'ENOENT') return false;
        throw error;
      }
      return names
        .filter((name) => name.endsWith('.accepted.json'))
        .map((name) => parse(readText(join(directory, name)) ?? ''))
        .some(
          (acceptance) =>
            acceptance?.schema === ACCEPTANCE_SCHEMA &&
            acceptance.sessionId === sessionId &&
            (acceptance.taskName === target || acceptance.agentId === target),
        );
    },
  };
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
  if (event === 'PreToolUse' && record?.decision === 'deny') return denyOutput(record.reason);
  // SubagentStop requires JSON on stdout after exit 0; other events print nothing.
  return event === 'SubagentStop' ? '{}' : '';
}

function denyOutput(reason) {
  return JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason:
        `KNU subagent guard: ${reason}. Spawn only a registered (codex:register) repo knu_* role with an allowed ` +
        'explicit model that the role has a profile pair for, and fork_turns "none" or a positive integer; ' +
        'children may not spawn, and an accepted child is not resumed or retried.',
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
    // A guard that cannot decide denies the spawn rather than failing open.
    const event = payload?.hook_event_name;
    if (
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
