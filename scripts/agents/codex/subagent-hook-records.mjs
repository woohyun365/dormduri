// Completion checks against the project hook records written by `.codex/hooks/knu-subagent-hooks.mjs`.
// A completed child lane is accepted only when, in the Parent's own session, the root PreToolUse allow record bound the
// lane's dispatch task name to a role and model, and SubagentStart and SubagentStop of one child match that bind, the
// lane contract (role, profile model) and the role's pinned effort, with no descendant start under that child. The
// allow record must carry the registration the hook sealed at the spawn, and a fan-in also needs the acceptance record
// `codex:accept` wrote for that child's stop. The records live under `.codex/`, which workspace-write children cannot
// write.
import { createHash } from 'node:crypto';
import { readFileSync, realpathSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ALLOWED_CHILD_MODELS,
  ALLOWED_ROLE_MODELS,
  getModelProfile,
  ROLE_EFFORTS,
} from './model-profiles.mjs';

export const HOOK_RECORD_DIRECTORY = '.codex/state/knu-subagent-hooks';
export const COMPLETION_AUTHORITY = 'codex-subagent-hook';
export const ACCEPTANCE_SCHEMA = 'knu-codex-task-acceptance/v1';
const HOOK_RECORD_SCHEMA = 'knu-codex-subagent-hook/v1';
const SESSION_ID = /^[A-Za-z0-9-]{1,128}$/u;
// The Parent picks a fresh token per dispatch so a lane id reused in one session never matches an earlier child.
const DISPATCH_TOKEN = /^[a-z0-9]{4,12}$/u;
const ROOT_PATH = '/root/';

// `retry` is reserved: a lane id ending in a token plus the token `retry` would spell another lane's retry task name.
export function isDispatchToken(value) {
  return typeof value === 'string' && DISPATCH_TOKEN.test(value) && value !== 'retry';
}

// V2 task names allow lowercase letters, digits and underscores; lane ids are lowercase kebab-case. A lane's recovery
// retry is its own child under the same dispatch token, named with a `_retry` suffix.
export function laneTaskName(laneId, dispatchToken, { retry = false } = {}) {
  const name = laneId.replaceAll('-', '_');
  if (dispatchToken === undefined && !retry) return name;
  if (!isDispatchToken(dispatchToken))
    throw new TypeError('dispatch token must be 4-12 lowercase letters or digits other than retry');
  return `${name}_${dispatchToken}${retry ? '_retry' : ''}`;
}

export function laneTaskPath(laneId, dispatchToken, { retry = false } = {}) {
  return `${ROOT_PATH}${laneTaskName(laneId, dispatchToken, { retry })}`;
}

// A reviewer child per review round under the dispatch token. The id is the handoff dispatch id (no underscores); the
// task name spells it the way lane ids are spelled.
export function reviewId(dispatchToken, round) {
  if (!isDispatchToken(dispatchToken))
    throw new TypeError('dispatch token must be 4-12 lowercase letters or digits other than retry');
  if (!Number.isSafeInteger(round) || round < 1)
    throw new TypeError('review round must be a positive integer');
  return `review-${dispatchToken}-${round}`;
}

export function reviewTaskName(dispatchToken, round) {
  return reviewId(dispatchToken, round).replaceAll('-', '_');
}

// The hook appends each record as JSON.stringify(record); an acceptance names the stop it accepted by this digest.
export function hookRecordDigest(record) {
  return `sha256:${createHash('sha256').update(JSON.stringify(record)).digest('hex')}`;
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
// or mismatched records refuse the completion; the first failing check names the reason. Without an acceptance
// (undefined) this is the check before acceptance; null means the fan-in has no acceptance for this child.
export function evaluateHookCompletion({
  observation,
  taskPath,
  expectedRole,
  expectedModel,
  expectedKind = 'lane',
  acceptance,
}) {
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
  // The seal is the registration the guard compared the plain arguments with; it must be the expected one.
  if (binds.some(({ registration }) => typeof registration?.digest !== 'string'))
    return refused('registration-unsealed', start, turn.effort);
  if (
    binds.some(
      ({ registration: { kind, spawnArguments } }) =>
        kind !== expectedKind ||
        spawnArguments?.agent_type !== expectedRole ||
        spawnArguments.model !== expectedModel ||
        spawnArguments.reasoning_effort !== pinned,
    )
  )
    return refused('registration-mismatch', start, turn.effort);
  if (acceptance === null) return refused('acceptance-missing', start, turn.effort);
  if (acceptance !== undefined) {
    // A later stop of the accepted child means it ran again after acceptance (a resumed turn).
    const stops = own.filter(
      ({ event, agentId }) => event === 'SubagentStop' && agentId === start.agentId,
    );
    const acceptedAt = stops.findIndex(
      (record) => hookRecordDigest(record) === acceptance.stopDigest,
    );
    if (acceptance.agentId !== start.agentId || acceptedAt === -1)
      return refused('acceptance-mismatch', start, turn.effort);
    if (acceptedAt !== stops.length - 1)
      return refused('resumed-after-acceptance', start, turn.effort);
  }
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
// retry is checked on its own task path against its retry route's model; a primary check refuses the lane while the
// session holds the lane's retry child, which only its recovery decision can complete. With acceptances (the fan-in)
// the child needs its acceptance record, and a retry is refused once the primary child was accepted.
export function checkLaneCompletion({
  observation,
  laneId,
  dispatchToken,
  expectedRole,
  expectedModel,
  retry = false,
  acceptances,
}) {
  if (typeof expectedModel !== 'string' || expectedModel === '')
    throw new TypeError('expected model is required: pass the lane contract model');
  if (acceptances !== undefined && !Array.isArray(acceptances))
    throw new TypeError('acceptances must be an array.');
  if (!isDispatchToken(dispatchToken)) return unchecked('dispatch-token-missing');
  const retryPath = laneTaskPath(laneId, dispatchToken, { retry: true });
  if (
    !retry &&
    ownRecords(observation).some(
      ({ event, agentPath }) => event === 'SubagentStart' && agentPath === retryPath,
    )
  )
    return unchecked('retry-unreported');
  if (retry && findAcceptance(acceptances, observation, laneTaskName(laneId, dispatchToken)))
    return unchecked('lane-accepted');
  return evaluateHookCompletion({
    observation: withOwnerPolicy(observation),
    taskPath: laneTaskPath(laneId, dispatchToken, { retry }),
    expectedRole,
    expectedModel,
    ...acceptanceFor(acceptances, observation, laneTaskName(laneId, dispatchToken, { retry })),
  });
}

// Completion of one reviewer child: the review role on its review profile model, under the dispatch token's round.
export function checkReviewCompletion({ observation, dispatchToken, round, acceptances }) {
  if (acceptances !== undefined && !Array.isArray(acceptances))
    throw new TypeError('acceptances must be an array.');
  if (!isDispatchToken(dispatchToken)) return unchecked('dispatch-token-missing');
  const taskName = reviewTaskName(dispatchToken, round);
  return evaluateHookCompletion({
    observation: withOwnerPolicy(observation),
    taskPath: `${ROOT_PATH}${taskName}`,
    expectedRole: 'knu_reviewer',
    expectedModel: getModelProfile('review').model,
    expectedKind: 'review',
    ...acceptanceFor(acceptances, observation, taskName),
  });
}

// The registrations the guard sealed for reviewer spawns under a dispatch token, one per task name.
export function sealedReviews(observation, dispatchToken) {
  const byTask = new Map();
  for (const { registration } of ownRecords(observation).filter(
    ({ event, caller, decision }) =>
      event === 'PreToolUse' && caller === 'root' && decision === 'allow',
  ))
    if (
      registration?.kind === 'review' &&
      registration.dispatchToken === dispatchToken &&
      typeof registration.taskName === 'string'
    )
      byTask.set(registration.taskName, registration);
  return [...byTask.values()];
}

function unchecked(reason) {
  return { accepted: false, reason, agentId: null, agentType: null, model: null, effort: null };
}

function withOwnerPolicy(observation) {
  return (
    observation && {
      ...observation,
      allowedModels: ALLOWED_CHILD_MODELS,
      roster: Object.keys(ROLE_EFFORTS),
      allowedRoleModels: ALLOWED_ROLE_MODELS,
      roleEfforts: ROLE_EFFORTS,
    }
  );
}

function acceptanceFor(acceptances, observation, taskName) {
  return acceptances === undefined
    ? {}
    : { acceptance: findAcceptance(acceptances, observation, taskName) };
}

function findAcceptance(acceptances, observation, taskName) {
  return (
    asList(acceptances).find(
      (acceptance) =>
        acceptance?.schema === ACCEPTANCE_SCHEMA &&
        acceptance.sessionId === observation?.sessionId &&
        acceptance.taskName === taskName,
    ) ?? null
  );
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
