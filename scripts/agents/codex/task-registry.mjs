// Registration and acceptance of the Codex children a Parent dispatches. Before a spawn the Parent registers the spawn
// arguments its dispatch computed (`createDispatchRecommendation`, `createRetryDispatch`, `createReviewDispatch`); the
// project hook allows the spawn only when its plain arguments equal that unused registration and seals it into the
// allow record. After the child stops, acceptance runs the completion check and records the accepted stop; the hook
// then denies follow-up and message calls to that child, and a lane's retry after its primary was accepted. Files live
// under `.artifacts/tools/codex-native/<Parent session>/`, which children can write: the seal and the completion check
// read the protected hook records, so an edited file refuses rather than accepts.
import { readFileSync, realpathSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveArtifactPath } from '../../artifacts/paths.mjs';
import { ALLOWED_ROLE_MODELS, getModelProfile, ROLE_EFFORTS } from './model-profiles.mjs';
import {
  ACCEPTANCE_SCHEMA,
  checkLaneCompletion,
  checkReviewCompletion,
  hookRecordDigest,
  isDispatchToken,
  laneTaskName,
  readHookRecords,
  reviewId,
  reviewTaskName,
} from './subagent-hook-records.mjs';

export const REGISTRY_SEGMENT = 'codex-native';
export const REGISTRATION_SCHEMA = 'knu-codex-task-registration/v1';
const SESSION_ID = /^[A-Za-z0-9-]{1,128}$/u;
const REVIEW_DISPATCH_INPUTS = new Set(['laneIds', 'dispatchToken', 'round']);
const LANE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

// The hook reads this directory from its own constant and cannot see the Parent's environment, so a configured
// artifact directory does not move it.
export function registryDirectory(root, sessionId) {
  if (typeof sessionId !== 'string' || !SESSION_ID.test(sessionId))
    throw new TypeError('registry session id is invalid');
  return resolveArtifactPath(root, [REGISTRY_SEGMENT, sessionId], {});
}

// The reviewer for one review round of a dispatch: the review role on its review profile model, at its pinned effort.
export function createReviewDispatch(input = {}) {
  for (const key of Object.keys(input ?? {}))
    if (!REVIEW_DISPATCH_INPUTS.has(key))
      throw new TypeError(`Unsupported review dispatch input: ${key}`);
  const { laneIds, dispatchToken, round = 1 } = input ?? {};
  if (!Array.isArray(laneIds) || laneIds.length === 0 || !laneIds.every((id) => LANE_ID.test(id)))
    throw new TypeError('A review dispatch names the lane ids it reviews.');
  const profile = getModelProfile('review');
  const [role] = profile.roles;
  return {
    kind: 'review',
    reviewId: reviewId(dispatchToken, round),
    dispatchToken,
    round,
    reviewOf: [...laneIds],
    dispatchOwner: 'leader',
    spawnArguments: {
      task_name: reviewTaskName(dispatchToken, round),
      agent_type: role,
      model: profile.model,
      reasoning_effort: ROLE_EFFORTS[role],
      fork_turns: 'none',
    },
  };
}

// Writes `<task name>.json` once (exclusive create). A lane descriptor is a dispatch or retry dispatch; a review
// descriptor comes from createReviewDispatch().
export function registerDispatch({ root, sessionId, dispatch }) {
  const directory = registryDirectory(root, sessionId);
  const registration = { schema: REGISTRATION_SCHEMA, sessionId, ...describe(dispatch) };
  if (
    registration.kind === 'lane' &&
    registration.retry &&
    readAcceptance({
      root,
      sessionId,
      taskName: laneTaskName(registration.laneId, registration.dispatchToken),
    })
  )
    throw new TypeError('lane-accepted: the primary child was accepted, so the lane has no retry.');
  mkdirSync(directory, { recursive: true });
  try {
    writeFileSync(join(directory, `${registration.taskName}.json`), JSON.stringify(registration), {
      flag: 'wx',
    });
  } catch (error) {
    if (error.code === 'EEXIST')
      throw new TypeError(`task already registered: ${registration.taskName}`);
    throw error;
  }
  return registration;
}

function describe(dispatch) {
  const spawn = dispatch?.spawnArguments;
  if (!spawn || typeof spawn !== 'object') throw new TypeError('A dispatch needs spawn arguments.');
  const { dispatchToken } = dispatch;
  if (!isDispatchToken(dispatchToken))
    throw new TypeError('A registration needs a dispatch token.');
  const base =
    dispatch.kind === 'review'
      ? {
          taskName: reviewTaskName(dispatchToken, dispatch.round),
          kind: 'review',
          reviewId: reviewId(dispatchToken, dispatch.round),
          dispatchToken,
          round: dispatch.round,
          reviewOf: [...dispatch.reviewOf],
        }
      : {
          taskName: laneTaskName(dispatch.laneId, dispatchToken, {
            retry: dispatch.retryOf !== undefined,
          }),
          kind: 'lane',
          laneId: dispatch.laneId,
          dispatchToken,
          retry: dispatch.retryOf !== undefined,
        };
  if (spawn.task_name !== base.taskName)
    throw new TypeError(`The spawn task name must be ${base.taskName}.`);
  if (
    !Object.hasOwn(ALLOWED_ROLE_MODELS, spawn.agent_type) ||
    !ALLOWED_ROLE_MODELS[spawn.agent_type].includes(spawn.model)
  )
    throw new TypeError('The spawn role and model are not an allowed profile pair.');
  if (spawn.reasoning_effort !== ROLE_EFFORTS[spawn.agent_type])
    throw new TypeError('The spawn effort must be the role pin.');
  if (spawn.fork_turns !== 'none')
    throw new TypeError('A registered spawn is a fresh fork (fork_turns none).');
  return {
    ...base,
    spawnArguments: {
      task_name: spawn.task_name,
      agent_type: spawn.agent_type,
      model: spawn.model,
      reasoning_effort: spawn.reasoning_effort,
      fork_turns: spawn.fork_turns,
    },
  };
}

export function readRegistration({ root, sessionId, taskName }) {
  const text = readTask(root, sessionId, `${taskName}.json`);
  return text === null ? null : { registration: JSON.parse(text), digest: digest(text) };
}

export function readAcceptance({ root, sessionId, taskName }) {
  const text = readTask(root, sessionId, `${taskName}.accepted.json`);
  return text === null ? null : JSON.parse(text);
}

// Accepts a stopped child once: its registration exists, its completion check passes against the caller's contract
// role and model, and (for a lane retry) the primary child was not accepted. The record names the accepted stop.
export function acceptTask({
  root,
  sessionId,
  taskName,
  expectedRole,
  expectedModel,
  observation,
  now,
}) {
  const found = readRegistration({ root, sessionId, taskName });
  const refused = (reason) => ({
    accepted: false,
    reason,
    agentId: null,
    agentType: null,
    model: null,
    effort: null,
  });
  if (found === null) return refused('registration-missing');
  const { registration } = found;
  if (registration?.taskName !== taskName || registration.sessionId !== sessionId)
    return refused('registration-invalid');
  let verdict;
  if (registration.kind === 'review') {
    verdict = checkReviewCompletion({
      observation,
      dispatchToken: registration.dispatchToken,
      round: registration.round,
    });
    if (verdict.accepted && (verdict.agentType !== expectedRole || verdict.model !== expectedModel))
      return refused('registration-mismatch');
  } else {
    const retry = registration.retry === true;
    if (laneTaskName(registration.laneId, registration.dispatchToken, { retry }) !== taskName)
      return refused('registration-invalid');
    if (
      retry &&
      readAcceptance({
        root,
        sessionId,
        taskName: laneTaskName(registration.laneId, registration.dispatchToken),
      })
    )
      return refused('lane-accepted');
    verdict = checkLaneCompletion({
      observation,
      laneId: registration.laneId,
      dispatchToken: registration.dispatchToken,
      expectedRole,
      expectedModel,
      retry,
    });
  }
  if (!verdict.accepted) return verdict;
  const own = observation.records.filter(
    (record) => record?.sessionId === sessionId && record.agentId === verdict.agentId,
  );
  const stop = own.findLast(({ event }) => event === 'SubagentStop');
  const allow = observation.records.findLast(
    (record) =>
      record?.sessionId === sessionId &&
      record.event === 'PreToolUse' &&
      record.decision === 'allow' &&
      record.input?.task_name === taskName,
  );
  const acceptance = {
    schema: ACCEPTANCE_SCHEMA,
    sessionId,
    taskName,
    kind: registration.kind,
    agentId: verdict.agentId,
    stopDigest: hookRecordDigest(stop),
    registrationDigest: allow.registration.digest,
    acceptedAt: now ?? new Date().toISOString(),
  };
  try {
    writeFileSync(
      join(registryDirectory(root, sessionId), `${taskName}.accepted.json`),
      JSON.stringify(acceptance),
      { flag: 'wx' },
    );
  } catch (error) {
    if (error.code === 'EEXIST') throw new TypeError(`task already accepted: ${taskName}`);
    throw error;
  }
  return { ...verdict, acceptance };
}

function readTask(root, sessionId, name) {
  try {
    return readFileSync(join(registryDirectory(root, sessionId), name), 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

function digest(text) {
  return `sha256:${createHash('sha256').update(text).digest('hex')}`;
}

// pnpm codex:register -- --dispatch <descriptor or {dispatches} JSON file> [--session <parent thread id>]
// pnpm codex:accept -- --task <task name> --role <agent_type> --model <contract model> [--session <parent thread id>]
// The session defaults to CODEX_THREAD_ID, which Codex sets for the Parent's shell commands.
export function runRegistryCommand(argv, { root, env = process.env }) {
  const [command, ...rest] = argv.filter((arg, index) => !(arg === '--' && index <= 1));
  const keys = {
    register: ['--dispatch', '--session'],
    accept: ['--task', '--role', '--model', '--session'],
  };
  if (!Object.hasOwn(keys, command)) throw new TypeError('expected register or accept');
  const options = {};
  for (let index = 0; index < rest.length; index += 1) {
    const key = rest[index];
    if (!keys[command].includes(key) || rest[index + 1] === undefined)
      throw new TypeError(`unexpected ${command} argument: ${key}`);
    options[key.slice(2)] = rest[(index += 1)];
  }
  // registryDirectory() refuses a missing or unsafe session id before any file is read or written.
  const sessionId = options.session ?? env.CODEX_THREAD_ID;
  if (command === 'register') {
    if (!options.dispatch) throw new TypeError('--dispatch is required');
    const file = JSON.parse(readFileSync(options.dispatch, 'utf8'));
    const dispatches = Array.isArray(file?.dispatches) ? file.dispatches : [file];
    const registered = dispatches.map((dispatch) => {
      const { taskName, spawnArguments } = registerDispatch({ root, sessionId, dispatch });
      return { taskName, spawnArguments };
    });
    return { exitCode: 0, stdout: `${JSON.stringify({ sessionId, registered }, null, 2)}\n` };
  }
  if (!options.task || !options.role || !options.model)
    throw new TypeError('--task, --role and --model are required');
  const { records, malformed } = readHookRecords({ root, sessionId });
  const verdict = acceptTask({
    root,
    sessionId,
    taskName: options.task,
    expectedRole: options.role,
    expectedModel: options.model,
    observation: { sessionId, records, malformed },
  });
  return {
    exitCode: verdict.accepted ? 0 : 1,
    stdout: `${JSON.stringify({ sessionId, taskName: options.task, ...verdict }, null, 2)}\n`,
  };
}

// Compare real paths: module URLs resolve symlinks, argv does not (a silent exit 0 would read as accepted).
if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { exitCode, stdout } = runRegistryCommand(process.argv.slice(2), {
      root: resolve(import.meta.dirname, '../../..'),
    });
    process.stdout.write(stdout);
    process.exitCode = exitCode;
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 2;
  }
}
