// Completion checks against the project hook records written by `.codex/hooks/knu-subagent-hooks.mjs`.
// A completed child lane is accepted only when, in the Parent's own session, the root PreToolUse allow record bound the
// lane's dispatch task name to a role and model, and SubagentStart and SubagentStop of one child match that bind, the
// lane contract (role, profile model) and the role's pinned effort, with no descendant start under that child. The
// records live under `.codex/`, which workspace-write children cannot write.
import { readFileSync, realpathSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ALLOWED_CHILD_MODELS, ALLOWED_ROLE_MODELS, ROLE_EFFORTS } from './model-profiles.mjs';

export const HOOK_RECORD_DIRECTORY = '.codex/state/knu-subagent-hooks';
export const COMPLETION_AUTHORITY = 'codex-subagent-hook';
const HOOK_RECORD_SCHEMA = 'knu-codex-subagent-hook/v1';
const SESSION_ID = /^[A-Za-z0-9-]{1,128}$/u;
// The Parent picks a fresh token per dispatch so a lane id reused in one session never matches an earlier child.
const DISPATCH_TOKEN = /^[a-z0-9]{4,12}$/u;
const ROOT_PATH = '/root/';

export function isDispatchToken(value) {
  return typeof value === 'string' && DISPATCH_TOKEN.test(value);
}

// V2 task names allow lowercase letters, digits and underscores; lane ids are lowercase kebab-case. A lane's recovery
// retry is its own child under the same dispatch token, named with a `_retry` suffix.
export function laneTaskName(laneId, dispatchToken, { retry = false } = {}) {
  const name = laneId.replaceAll('-', '_');
  if (dispatchToken === undefined && !retry) return name;
  if (!isDispatchToken(dispatchToken))
    throw new TypeError('dispatch token must be 4-12 lowercase letters or digits');
  return `${name}_${dispatchToken}${retry ? '_retry' : ''}`;
}

export function laneTaskPath(laneId, dispatchToken, { retry = false } = {}) {
  return `${ROOT_PATH}${laneTaskName(laneId, dispatchToken, { retry })}`;
}

export function readHookRecords({ root, sessionId }) {
  if (typeof sessionId !== 'string' || !SESSION_ID.test(sessionId))
    throw new TypeError('hook session id is invalid');
  let text;
  try {
    text = readFileSync(join(root, HOOK_RECORD_DIRECTORY, `${sessionId}.jsonl`), 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return { sessionId, records: [], malformed: 0 };
    throw error;
  }
  const records = [];
  let malformed = 0;
  for (const line of text.split(/\r?\n/u)) {
    if (!line.trim()) continue;
    try {
      const record = JSON.parse(line);
      if (record && typeof record === 'object' && !Array.isArray(record)) records.push(record);
      else malformed += 1;
    } catch {
      malformed += 1;
    }
  }
  return { sessionId, records, malformed };
}

// observation = { sessionId, records, malformed, allowedModels, roster, allowedRoleModels, roleEfforts }, where
// sessionId, records and malformed are the readHookRecords() result. Missing, partial, unbound
// or mismatched records refuse the completion; the first failing check names the reason.
export function evaluateHookCompletion({ observation, taskPath, expectedRole, expectedModel }) {
  const refused = (reason, record, effort = null) => ({
    accepted: false,
    reason,
    agentId: record?.agentId ?? null,
    agentType: record?.agentType ?? null,
    model: record?.model ?? null,
    effort,
  });
  if (!observation || !Array.isArray(observation.records)) return refused('observation-missing');
  // A skipped line may have been a descendant start, and its absence is a condition of acceptance.
  if (observation.malformed !== 0) return refused('observation-malformed');
  const own = ownRecords(observation);
  const stop = own.findLast(
    ({ event, agentPath }) => event === 'SubagentStop' && agentPath === taskPath,
  );
  const started = new Set(
    own
      .filter(({ event, agentPath }) => event === 'SubagentStart' && agentPath === taskPath)
      .map(({ agentId }) => agentId),
  );
  if (started.size > 1) return refused('observation-ambiguous', stop);
  if (!stop) {
    const start = own.find(
      ({ event, agentPath }) => event === 'SubagentStart' && agentPath === taskPath,
    );
    return refused(start ? 'observation-incomplete' : 'observation-missing', start);
  }
  const start = own.findLast(
    ({ event, agentId }) => event === 'SubagentStart' && agentId === stop.agentId,
  );
  if (!start) return refused('observation-incomplete', stop);
  if (!asList(observation.roster).includes(start.agentType))
    return refused('role-not-in-roster', start);
  if (!asList(observation.allowedModels).includes(start.model))
    return refused('model-not-allowed', start);
  if (
    start.agentType !== expectedRole ||
    stop.agentType !== start.agentType ||
    stop.parentThreadId !== observation.sessionId ||
    (start.parentThreadId != null && start.parentThreadId !== observation.sessionId)
  )
    return refused('observation-mismatch', start);
  // The guard writes the bind before the spawn runs; without it PreToolUse failed open or never saw the spawn.
  const binds = allowRecords(own, taskPath.slice(ROOT_PATH.length));
  if (binds.length === 0) return refused('observation-unbound', start);
  if (binds.some(({ input }) => input.agent_type !== start.agentType))
    return refused('observation-mismatch', start);
  if (binds.some(({ input }) => input.model !== start.model))
    return refused('model-mismatch', start);
  // A descendant (child-made spawn) means the lane's work left the bound child.
  if (
    own.some(
      ({ event, agentId, agentPath, parentThreadId }) =>
        event === 'SubagentStart' &&
        agentId !== start.agentId &&
        (parentThreadId === start.agentId ||
          (typeof agentPath === 'string' && agentPath.startsWith(`${taskPath}/`))),
    )
  )
    return refused('observation-foreign', start);
  const pairs = observation.allowedRoleModels;
  if (
    !allowedPair(pairs, expectedRole, expectedModel) ||
    !allowedPair(pairs, start.agentType, start.model)
  )
    return refused('pair-not-allowed', start);
  if (start.model !== expectedModel) return refused('model-mismatch', start);
  const turn = stop.ownTurn;
  if (typeof turn?.model !== 'string' || typeof turn.effort !== 'string')
    return refused('effort-unobserved', start);
  if (turn.model !== expectedModel) return refused('model-mismatch', start, turn.effort);
  const efforts = observation.roleEfforts;
  const pinned =
    efforts && typeof efforts === 'object' && Object.hasOwn(efforts, expectedRole)
      ? efforts[expectedRole]
      : undefined;
  if (turn.effort !== pinned) return refused('effort-mismatch', start, turn.effort);
  return {
    accepted: true,
    reason: null,
    agentId: start.agentId,
    agentType: start.agentType,
    model: start.model,
    effort: turn.effort,
  };
}

// Completion of one dispatched lane. The allowlist, roster, pairs and role efforts come from their owner
// (model-profiles.mjs), never from the caller's observation; a missing dispatch token refuses the lane. A recovery
// retry is checked on its own task path against its retry route's model.
export function checkLaneCompletion({
  observation,
  laneId,
  dispatchToken,
  expectedRole,
  expectedModel,
  retry = false,
}) {
  if (typeof expectedModel !== 'string' || expectedModel === '')
    throw new TypeError('expected model is required: pass the lane contract model');
  if (!isDispatchToken(dispatchToken))
    return {
      accepted: false,
      reason: 'dispatch-token-missing',
      agentId: null,
      agentType: null,
      model: null,
      effort: null,
    };
  return evaluateHookCompletion({
    observation: observation && {
      ...observation,
      allowedModels: ALLOWED_CHILD_MODELS,
      roster: Object.keys(ROLE_EFFORTS),
      allowedRoleModels: ALLOWED_ROLE_MODELS,
      roleEfforts: ROLE_EFFORTS,
    },
    taskPath: laneTaskPath(laneId, dispatchToken, { retry }),
    expectedRole,
    expectedModel,
  });
}

// Session starts that no root allow record bound: a failed-open guard, a child-made spawn or a foreign spawn. They
// refuse a lane only when they sit under it; the rest are reported.
export function countUnboundStarts(observation) {
  const own = ownRecords(observation);
  return own.filter(
    ({ event, agentPath }) =>
      event === 'SubagentStart' &&
      !(
        typeof agentPath === 'string' &&
        agentPath.startsWith(ROOT_PATH) &&
        allowRecords(own, agentPath.slice(ROOT_PATH.length)).length > 0
      ),
  ).length;
}

function ownRecords(observation) {
  return asList(observation?.records).filter(
    (record) => record?.schema === HOOK_RECORD_SCHEMA && record.sessionId === observation.sessionId,
  );
}

function allowRecords(own, taskName) {
  return own.filter(
    ({ event, caller, decision, input }) =>
      event === 'PreToolUse' &&
      caller === 'root' &&
      decision === 'allow' &&
      input?.task_name === taskName,
  );
}

function allowedPair(pairs, role, model) {
  return (
    pairs !== null &&
    typeof pairs === 'object' &&
    typeof role === 'string' &&
    Object.hasOwn(pairs, role) &&
    asList(pairs[role]).includes(model)
  );
}

function asList(value) {
  return Array.isArray(value) ? value : [];
}

// pnpm codex:completion -- --lane <laneId> --token <dispatch token> --role <agent_type> --model <contract model>
//   [--session <parent thread id>] [--retry]
// The role and model are the lane contract (route role, profile model); with --retry they are the recovery decision's
// retry route and the check reads the retry task path. The session defaults to CODEX_THREAD_ID, which Codex sets for the
// Parent's shell commands.
function main(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (key === '--') continue;
    if (key === '--retry') {
      options.retry = true;
      continue;
    }
    if (
      !['--lane', '--token', '--role', '--model', '--session'].includes(key) ||
      argv[index + 1] === undefined
    )
      throw new TypeError(
        'expected --lane LANE_ID --token DISPATCH_TOKEN --role AGENT_TYPE --model MODEL [--session THREAD_ID] [--retry]',
      );
    options[key.slice(2)] = argv[(index += 1)];
  }
  if (!options.lane || !options.role || !options.token || !options.model)
    throw new TypeError('--lane, --token, --role and --model are required');
  const root = resolve(import.meta.dirname, '../../..');
  const sessionId = options.session ?? process.env.CODEX_THREAD_ID;
  const { records, malformed } = readHookRecords({ root, sessionId });
  const retry = options.retry === true;
  const taskPath = laneTaskPath(options.lane, options.token, { retry });
  const verdict = checkLaneCompletion({
    observation: { sessionId, records, malformed },
    laneId: options.lane,
    dispatchToken: options.token,
    expectedRole: options.role,
    expectedModel: options.model,
    retry,
  });
  const report = {
    completionAuthority: COMPLETION_AUTHORITY,
    sessionId,
    laneId: options.lane,
    taskPath,
    expectedRole: options.role,
    expectedModel: options.model,
    ...verdict,
    unboundStarts: countUnboundStarts({ sessionId, records }),
    malformedRecords: malformed,
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  return verdict.accepted ? 0 : 1;
}

// Compare real paths: module URLs resolve symlinks, argv does not (a silent exit 0 would read as accepted).
if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 2;
  }
}
