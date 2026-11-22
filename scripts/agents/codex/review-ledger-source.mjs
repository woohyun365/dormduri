// Codex review ledger source: reads the review registrations of the Codex task registry
// (`<artifacts>/codex-native/<Parent session>/<task_name>.json`, kind `review`, with `<task_name>.accepted.json` once
// the Parent accepted the reviewer) and `*-adjudication.json` records (review-adjudication/v1) under the given
// directories, then hands the rows to the common ledger as host `codex`.
// Rules and usage: docs/development/agent-workflows/adapters/codex-same-host-review.md
//
// Usage: node scripts/agents/codex/review-ledger-source.mjs [--root <repo>] [--adjudications <dir>]...
//          [--until <ISO time>] [--json]
// Exit 0 = ledger built, 1 = an adjudication record is invalid (other than legacy) or a row was rejected, 2 = input
// error (missing registry or adjudication directory, invalid --until, unknown option, root outside a git repository).
//
// Codex keeps no reviewer result in its registry or hook records, so a row reads the result its disposition record
// names (`reviews[].resultPath`, saved by the Parent in the plan evidence). Status: no acceptance = completion-missing;
// accepted and a result that parses = parsed; accepted otherwise = parse-failed; a registration that cannot be read =
// task-unreadable. A registration has no issue time, so issuedAt is null and --until leaves the row out and counts it.
// subjectKey is the record's subject, else `dispatch:<dispatch token>`; subjectSize comes from
// `<reviewId>.criteria.json` beside the registration; snapshot is the digest of the result's reviewedSnapshot.

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

import { resolveArtifactPath } from '../../artifacts/paths.mjs';
import { readAdjudicationRecords, resultFindingIds } from '../common/review-adjudication.mjs';
import { buildLedger } from '../common/review-ledger.mjs';
import { REGISTRATION_SCHEMA } from './task-registry.mjs';

class InputError extends Error {}

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

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

// A stable digest of a snapshot object: keys in sorted order at every level.
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (isObject(value))
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
      .join(',')}}`;
  return JSON.stringify(value);
}
const snapshotDigest = (snapshot) =>
  isObject(snapshot)
    ? `sha256:${createHash('sha256').update(canonical(snapshot)).digest('hex')}`
    : null;

function subjectSize(directory, reviewId) {
  if (typeof reviewId !== 'string') return null;
  try {
    const criteria = readJson(resolve(directory, `${reviewId}.criteria.json`));
    return Array.isArray(criteria.paths) && Number.isInteger(criteria.documentCount)
      ? { paths: criteria.paths.length, documents: criteria.documentCount }
      : null;
  } catch {
    return null;
  }
}

function readResult(root, adjudication, taskId) {
  const review = adjudication.record.reviews.find((entry) => entry?.taskId === taskId);
  try {
    const result = readJson(resolve(root, review.resultPath));
    return typeof result?.verdict === 'string' && Array.isArray(result.findings) ? result : null;
  } catch {
    return null;
  }
}

function reviewRow(root, directory, name, adjudications) {
  const row = {
    host: 'codex',
    taskId: name,
    issuedAt: null,
    subjectKey: null,
    round: null,
    status: 'task-unreadable',
    verdict: null,
    findings: [],
    adjudication: { status: 'missing', dispositions: [], origins: [] },
    subjectSize: null,
    snapshot: null,
  };
  let registration;
  try {
    registration = readJson(resolve(directory, `${name}.json`));
  } catch {
    return row;
  }
  if (!isObject(registration) || registration.schema !== REGISTRATION_SCHEMA) return row;
  if (registration.kind !== 'review') return null;
  const taskId = typeof registration.taskName === 'string' ? registration.taskName : name;
  row.taskId = taskId;
  row.round =
    Number.isInteger(registration.round) && registration.round >= 1 ? registration.round : null;
  row.subjectKey =
    typeof registration.dispatchToken === 'string'
      ? `dispatch:${registration.dispatchToken}`
      : null;
  row.subjectSize = subjectSize(directory, registration.reviewId);
  const adjudication = adjudications.get(taskId);
  if (adjudication && typeof adjudication.record.subject === 'string')
    row.subjectKey = adjudication.record.subject;

  if (!existsSync(resolve(directory, `${taskId}.accepted.json`))) row.status = 'completion-missing';
  else {
    const result = adjudication ? readResult(root, adjudication, taskId) : null;
    if (!result) row.status = 'parse-failed';
    else {
      row.status = 'parsed';
      row.verdict = result.verdict;
      row.snapshot = snapshotDigest(result.reviewedSnapshot);
      const ids = resultFindingIds(taskId, result);
      row.findings = result.findings.map((finding, index) => ({
        id: ids[index],
        severity:
          typeof finding?.severity === 'string' && finding.severity
            ? finding.severity
            : 'unspecified',
        criteriaItem: typeof finding?.criteriaItem === 'string' ? finding.criteriaItem : null,
        location: typeof finding?.location === 'string' ? finding.location : null,
      }));
    }
  }
  if (adjudication) {
    row.adjudication.status = adjudication.valid ? 'recorded' : 'invalid';
    if (adjudication.valid) {
      const ids = new Set(row.findings.map(({ id }) => id));
      for (const finding of adjudication.record.findings.filter(({ id }) => ids.has(id))) {
        row.adjudication.dispositions.push(finding.disposition);
        if (finding.origin) row.adjudication.origins.push(finding.origin);
      }
    }
  }
  return row;
}

export function readCodexReviewRows({
  root,
  registry,
  adjudicationDirectories = [],
  until = null,
}) {
  const adjudications = readAdjudicationRecords(root, adjudicationDirectories);
  const all = readdirSync(registry, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((session) => {
      const directory = resolve(registry, session.name);
      return (
        readdirSync(directory, { withFileTypes: true })
          // A registration is `<task_name>.json`; task names have no dot, while acceptance, release and review-run
          // records (`.accepted.json`, `.released.json`, `<reviewId>.criteria.json`, …) do.
          .filter(
            (entry) =>
              entry.isFile() &&
              entry.name.endsWith('.json') &&
              !entry.name.slice(0, -'.json'.length).includes('.'),
          )
          .map((entry) =>
            reviewRow(root, directory, entry.name.slice(0, -'.json'.length), adjudications.byTask),
          )
      );
    })
    .filter(Boolean);
  // A row without an issue time cannot be placed against the cutoff; it is left out and counted.
  const excludedWithoutIssuedAt =
    until === null ? 0 : all.filter((row) => row.issuedAt === null).length;
  const rows = all
    .filter((row) => until === null || (row.issuedAt !== null && Date.parse(row.issuedAt) <= until))
    .sort(
      (left, right) =>
        (left.issuedAt ?? '￿').localeCompare(right.issuedAt ?? '￿') ||
        left.taskId.localeCompare(right.taskId),
    );
  return {
    rows,
    excludedWithoutIssuedAt,
    adjudicationViolations: adjudications.violations,
    legacyAdjudications: adjudications.legacy,
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
        root: { type: 'string' },
        adjudications: { type: 'string', multiple: true },
        until: { type: 'string' },
        json: { type: 'boolean' },
      },
    }).values;
  } catch (error) {
    throw new InputError(error.message);
  }
}

function format(ledger) {
  return Object.entries(ledger.summary)
    .map(
      ([key, value]) =>
        `${key} ${typeof value === 'object' && value !== null ? JSON.stringify(value) : value}`,
    )
    .join('\n');
}

export function main(
  argv,
  { cwd = process.cwd(), env = process.env, log = console.log, error = console.error } = {},
) {
  try {
    const values = parseOptions(argv);
    const root = values.root ? resolve(cwd, values.root) : gitRoot(cwd);
    const registry = resolveArtifactPath(root, ['codex-native'], env);
    if (!isDirectory(registry))
      throw new InputError(`${registry}: no Codex task registry directory`);
    const directories = (values.adjudications ?? []).map((path) => resolve(cwd, path));
    for (const directory of directories)
      if (!isDirectory(directory)) throw new InputError(`${directory}: no such directory`);
    const until = values.until === undefined ? null : Date.parse(values.until);
    if (Number.isNaN(until)) throw new InputError(`--until ${values.until}: not an ISO time`);
    const { rows, excludedWithoutIssuedAt, adjudicationViolations, legacyAdjudications } =
      readCodexReviewRows({ root, registry, adjudicationDirectories: directories, until });
    const ledger = buildLedger(rows);
    log(
      values.json
        ? JSON.stringify(
            {
              root,
              ...ledger,
              excludedWithoutIssuedAt,
              adjudicationViolations,
              legacyAdjudications,
            },
            null,
            2,
          )
        : [
            format(ledger),
            `excludedWithoutIssuedAt ${excludedWithoutIssuedAt}`,
            `adjudicationViolations ${adjudicationViolations.length}`,
            `legacyAdjudications ${JSON.stringify(legacyAdjudications)}`,
          ].join('\n'),
    );
    return adjudicationViolations.length || ledger.rejected.length ? 1 : 0;
  } catch (caught) {
    if (!(caught instanceof InputError)) throw caught;
    error(caught.message);
    return 2;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    console.error(error.stack ?? error.message);
    process.exitCode = 2;
  }
}
