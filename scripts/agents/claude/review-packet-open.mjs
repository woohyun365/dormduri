// Open review packet check: lists the review packets whose inputs manifest binds the given paths and whether each is
// still open by the same-host review rule, so a `.plans` promote or status correction does not rewrite a file an open
// review is bound to. Read-only: it reads the packet directory and the native registry and writes nothing.
// Rule: docs/development/agent-workflows/adapters/claude-same-host-review.md (정산 결과 파일과 packet 닫힘)
//
// A packet binds a path when a `files` key or a `copies[*].original` of `<reviewId>.inputs.json` is that path or lies
// under it. Its basis task is the latest-issued `knu_reviewer` task of this checkout (`record.root`) that points at the
// packet (a Parent reviewer by its prompt line `KNU_REVIEW_PACKET_FILE:`, a native subject reviewer by the packet id
// `review-<reviewId>`) and has no `observation-error.json`. States:
//   not-open                 no basis task
//   closed                   `<reviewId>.settled.json` names the basis task, or (without `<reviewId>.open.json`) the
//                            basis task has `completion.json`
//   open-expired-unlaunched  the basis task expired without `launch.json`/`attempt.json`: it can no longer be
//                            dispatched, so it is counted apart and does not block
//   open                     any other basis task
//   open-unreadable-inputs   an open packet whose manifest cannot be read, listed for every path since it may bind it
//
// Usage: node scripts/agents/claude/review-packet-open.mjs --paths <path>[,<path>...] [--paths ...] [--root <repo>]
//          [--now <ISO time>] [--json]
// Exit 0 = no open packet binds a path, 1 = an open packet binds one (open or open-unreadable-inputs), 2 = input error
// (missing or empty --paths, path outside the repository, invalid --now, missing root, unknown option, positional
// argument). Input errors never count as a pass.

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

import { resolveArtifactPath } from '../../artifacts/paths.mjs';

class InputError extends Error {}

const USAGE =
  'usage: review-packet-open --paths <path>[,<path>...] [--paths ...] [--root <repo>] [--now <ISO time>] [--json]';
// The same packet line and packet id shapes the review ledger source reads.
const PACKET_LINE = /^KNU_REVIEW_PACKET_FILE:\s*\S*?([a-z0-9]{8}-[a-f0-9]{8})\.json\s/gmu;
const PACKET_ID = /^review-([a-z0-9]{8}-[a-f0-9]{8})$/u;
const INPUTS = '.inputs.json';
const REVIEWER_ROLE = 'knu_reviewer';

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function isDirectory(path) {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

// Reviewer tasks of this checkout per review id: issue time, expiry and the marker files of each task directory.
function reviewerTasks(root, registry, now) {
  const byReview = new Map();
  const counts = { unreadableTasks: 0, foreignTasks: 0 };
  if (!isDirectory(registry)) return { byReview, counts };
  // Name order keeps the output and the counts independent of the file system's listing order.
  const entries = readdirSync(registry, { withFileTypes: true }).sort((left, right) =>
    left.name.localeCompare(right.name),
  );
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dir = join(registry, entry.name);
    if (!existsSync(join(dir, 'task.json'))) continue;
    let record;
    try {
      ({ record } = readJson(join(dir, 'task.json')));
      if (!record || typeof record !== 'object') throw new Error('no record');
    } catch {
      counts.unreadableTasks += 1;
      continue;
    }
    const request = record.input?.nativeRequest ?? {};
    if (request.task?.role !== REVIEWER_ROLE) continue;
    if (record.root !== root) {
      counts.foreignTasks += 1;
      continue;
    }
    const reviewIds = new Set(
      [...String(record.prompt ?? '').matchAll(PACKET_LINE)].map(([, reviewId]) => reviewId),
    );
    const packetId = PACKET_ID.exec(record.independentReview?.packet?.packetId ?? '')?.[1];
    if (packetId) reviewIds.add(packetId);
    const expiresAt = Date.parse(request.expiresAt ?? '');
    const task = {
      taskId: entry.name,
      issuedAt: request.issuedAt ?? null,
      invalid: existsSync(join(dir, 'observation-error.json')),
      completed: existsSync(join(dir, 'completion.json')),
      launched: existsSync(join(dir, 'launch.json')) || existsSync(join(dir, 'attempt.json')),
      expired: !Number.isNaN(expiresAt) && expiresAt < now,
    };
    for (const reviewId of reviewIds) {
      if (!byReview.has(reviewId)) byReview.set(reviewId, []);
      byReview.get(reviewId).push(task);
    }
  }
  return { byReview, counts };
}

function basisTask(tasks) {
  return (
    tasks
      .filter((task) => !task.invalid)
      .sort(
        (left, right) =>
          (left.issuedAt ?? '').localeCompare(right.issuedAt ?? '') ||
          left.taskId.localeCompare(right.taskId),
      )
      .at(-1) ?? null
  );
}

function packetState(packets, reviewId, basis) {
  if (!basis) return { state: 'not-open', openRecord: null, settledBy: null };
  const openRecord = existsSync(join(packets, `${reviewId}.open.json`));
  let settledBy = null;
  if (existsSync(join(packets, `${reviewId}.settled.json`)))
    try {
      settledBy = readJson(join(packets, `${reviewId}.settled.json`)).taskId ?? null;
    } catch {
      settledBy = null;
    }
  if (settledBy === basis.taskId || (!openRecord && basis.completed))
    return { state: 'closed', openRecord, settledBy };
  if (!basis.launched && basis.expired)
    return { state: 'open-expired-unlaunched', openRecord, settledBy };
  return { state: 'open', openRecord, settledBy };
}

function boundKeys(manifest) {
  const keys = new Set(
    manifest.files && typeof manifest.files === 'object' ? Object.keys(manifest.files) : [],
  );
  for (const copy of Object.values(manifest.copies ?? {}))
    if (typeof copy?.original === 'string') keys.add(copy.original);
  return keys;
}

const binds = (key, path) => path === '' || key === path || key.startsWith(`${path}/`);

export function checkOpenPackets({ root, paths, now = Date.now() }) {
  const packets = resolveArtifactPath(root, ['claude-review-packets'], {});
  const registry = resolveArtifactPath(root, ['claude-native'], {});
  const { byReview, counts } = reviewerTasks(root, registry, now);
  const listed = [];
  let unreadableInputs = 0;
  const files = isDirectory(packets)
    ? readdirSync(packets)
        .filter((name) => name.endsWith(INPUTS))
        .sort()
    : [];
  for (const name of files) {
    const reviewId = name.slice(0, -INPUTS.length);
    const tasks = byReview.get(reviewId) ?? [];
    const basis = basisTask(tasks);
    const status = packetState(packets, reviewId, basis);
    let keys = null;
    try {
      keys = boundKeys(readJson(join(packets, name)));
    } catch {
      unreadableInputs += 1;
    }
    let boundPaths = null;
    if (keys) {
      boundPaths = paths.filter((path) => [...keys].some((key) => binds(key, path)));
      if (boundPaths.length === 0) continue;
    } else if (status.state !== 'open') continue;
    listed.push({
      reviewId,
      state: keys ? status.state : 'open-unreadable-inputs',
      boundPaths,
      openRecord: status.openRecord,
      settledBy: status.settledBy,
      basisTask: basis && {
        taskId: basis.taskId,
        issuedAt: basis.issuedAt,
        launched: basis.launched,
        completed: basis.completed,
        expired: basis.expired,
      },
      tasks: tasks.length,
      invalidTasks: tasks.filter((task) => task.invalid).length,
    });
  }
  const count = (...states) => listed.filter(({ state }) => states.includes(state)).length;
  return {
    summary: {
      packets: listed.length,
      open: count('open', 'open-unreadable-inputs'),
      expiredUnlaunched: count('open-expired-unlaunched'),
      closed: count('closed'),
      notOpen: count('not-open'),
      unreadableInputs,
      ...counts,
    },
    packets: listed,
  };
}

function gitRoot(cwd) {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    throw new InputError(`${cwd} is not in a git repository; pass --root <repo>`);
  }
}

function parseOptions(argv) {
  try {
    return parseArgs({
      args: argv,
      options: {
        paths: { type: 'string', multiple: true },
        root: { type: 'string' },
        now: { type: 'string' },
        json: { type: 'boolean' },
      },
    }).values;
  } catch (error) {
    throw new InputError(`${error.message}\n${USAGE}`);
  }
}

// Repository-relative paths with `/` separators; `.` is the whole repository.
function repositoryPaths(root, values) {
  const paths = values.flatMap((value) => value.split(',')).map((value) => value.trim());
  if (paths.length === 0 || paths.some((path) => path === '')) throw new InputError(USAGE);
  return paths.map((path) => {
    const inside = relative(root, resolve(root, path));
    if (inside === '..' || inside.startsWith(`..${sep}`) || isAbsolute(inside))
      throw new InputError(`${path}: outside the repository ${root}`);
    return inside.split(sep).join('/');
  });
}

function format(result) {
  const lines = result.packets.map(
    ({ reviewId, state, boundPaths, basisTask: basis }) =>
      `${reviewId}\t${state}\t${boundPaths?.join(',') ?? '(unreadable inputs)'}\tbasis ${basis?.taskId ?? 'none'}`,
  );
  lines.push(
    Object.entries(result.summary)
      .map(([key, value]) => `${key} ${value}`)
      .join(' '),
  );
  return lines.join('\n');
}

export function main(argv, { cwd = process.cwd(), log = console.log, error = console.error } = {}) {
  try {
    const values = parseOptions(argv);
    if (!values.paths?.length) throw new InputError(USAGE);
    const given = values.root ? resolve(cwd, values.root) : gitRoot(cwd);
    if (!isDirectory(given)) throw new InputError(`${given}: no such directory`);
    const root = realpathSync(given);
    const now = values.now === undefined ? Date.now() : Date.parse(values.now);
    if (Number.isNaN(now)) throw new InputError(`--now ${values.now}: not an ISO time`);
    const result = checkOpenPackets({ root, paths: repositoryPaths(root, values.paths), now });
    log(values.json ? JSON.stringify(result, null, 2) : format(result));
    return result.summary.open > 0 ? 1 : 0;
  } catch (caught) {
    if (!(caught instanceof InputError)) throw caught;
    error(caught.message);
    return 2;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (caught) {
    console.error(caught.stack ?? caught.message);
    process.exitCode = 2;
  }
}
