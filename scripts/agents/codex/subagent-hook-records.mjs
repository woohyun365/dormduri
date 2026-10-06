// Completion checks against the project hook records written by `.codex/hooks/knu-subagent-hooks.mjs`.
// A completed child lane is accepted only when SubagentStart and SubagentStop of one child, in the Parent's own session,
// bind the lane's dispatch task path to its contract role, an allowed model and a roster role. Expected model/effort
// binding is not checked here. The records live under `.codex/`, which workspace-write children cannot write.
import { readFileSync, realpathSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ALLOWED_CHILD_MODELS, ROLE_EFFORTS } from './model-profiles.mjs';

export const HOOK_RECORD_DIRECTORY = '.codex/state/knu-subagent-hooks';
export const COMPLETION_AUTHORITY = 'codex-subagent-hook';
const HOOK_RECORD_SCHEMA = 'knu-codex-subagent-hook/v1';
const SESSION_ID = /^[A-Za-z0-9-]{1,128}$/u;
// The Parent picks a fresh token per dispatch so a lane id reused in one session never matches an earlier child.
const DISPATCH_TOKEN = /^[a-z0-9]{4,12}$/u;

export function isDispatchToken(value) {
  return typeof value === 'string' && DISPATCH_TOKEN.test(value);
}

// V2 task names allow lowercase letters, digits and underscores; lane ids are lowercase kebab-case.
export function laneTaskName(laneId, dispatchToken) {
  const name = laneId.replaceAll('-', '_');
  if (dispatchToken === undefined) return name;
  if (!isDispatchToken(dispatchToken))
    throw new TypeError('dispatch token must be 4-12 lowercase letters or digits');
  return `${name}_${dispatchToken}`;
}

export function laneTaskPath(laneId, dispatchToken) {
  return `/root/${laneTaskName(laneId, dispatchToken)}`;
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

// observation = { sessionId, records, allowedModels, roster }. Missing or partial records refuse the completion.
export function evaluateHookCompletion({ observation, taskPath, expectedRole }) {
  const refused = (reason, record) => ({
    accepted: false,
    reason,
    agentId: record?.agentId ?? null,
    agentType: record?.agentType ?? null,
    model: record?.model ?? null,
    effort: null,
  });
  if (!observation || !Array.isArray(observation.records)) return refused('observation-missing');
  const own = observation.records.filter(
    (record) => record?.schema === HOOK_RECORD_SCHEMA && record.sessionId === observation.sessionId,
  );
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
  return {
    accepted: true,
    reason: null,
    agentId: start.agentId,
    agentType: start.agentType,
    model: start.model,
    effort: stop.ownTurn?.effort ?? null,
  };
}

// Completion of one dispatched lane. The allowlist and roster come from their owner (model-profiles.mjs), never from
// the caller's observation; a missing dispatch token refuses the lane.
export function checkLaneCompletion({ observation, laneId, dispatchToken, expectedRole }) {
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
    },
    taskPath: laneTaskPath(laneId, dispatchToken),
    expectedRole,
  });
}

function asList(value) {
  return Array.isArray(value) ? value : [];
}

// pnpm codex:completion -- --lane <laneId> --token <dispatch token> --role <agent_type> [--session <parent thread id>]
// The session defaults to CODEX_THREAD_ID, which Codex sets for the Parent's shell commands.
function main(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (key === '--') continue;
    if (
      !['--lane', '--token', '--role', '--session'].includes(key) ||
      argv[index + 1] === undefined
    )
      throw new TypeError(
        'expected --lane LANE_ID --token DISPATCH_TOKEN --role AGENT_TYPE [--session THREAD_ID]',
      );
    options[key.slice(2)] = argv[(index += 1)];
  }
  if (!options.lane || !options.role || !options.token)
    throw new TypeError('--lane, --token and --role are required');
  const root = resolve(import.meta.dirname, '../../..');
  const sessionId = options.session ?? process.env.CODEX_THREAD_ID;
  const { records, malformed } = readHookRecords({ root, sessionId });
  const taskPath = laneTaskPath(options.lane, options.token);
  const verdict = checkLaneCompletion({
    observation: { sessionId, records },
    laneId: options.lane,
    dispatchToken: options.token,
    expectedRole: options.role,
  });
  const report = {
    completionAuthority: COMPLETION_AUTHORITY,
    sessionId,
    laneId: options.lane,
    taskPath,
    ...verdict,
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
