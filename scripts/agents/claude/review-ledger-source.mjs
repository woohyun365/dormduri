// Claude review ledger source: reads knu_reviewer records of the native registry
// (`<artifacts>/claude-native/<taskId>/{task,completion}.json`) and `*-adjudication.json` records
// (review-adjudication/v1) under the given directories, then hands the rows to the common ledger.
// Rules and usage: docs/development/agent-workflows/review-criteria/README.md
//
// Usage: node scripts/agents/claude/review-ledger-source.mjs [--root <repo>] [--adjudications <dir>]...
//          [--until <ISO time>] [--json]
// Exit 0 = ledger built, 1 = an adjudication record is invalid (other than legacy) or a row was rejected, 2 = input
// error (missing registry or adjudication directory, invalid --until, unknown option, root outside a git repository).
// A record whose violations are all old-record kinds (LEGACY_VIOLATION_KINDS of review-adjudication.mjs) is counted as
// legacy and does not fail the run.
//
// Row fields: round comes from the reviewer prompt (`Review round N`, absent before round inputs existed), subjectKey
// from the adjudication record's subject, else the native subject task (`task:<id>`), else the selection basis
// (`basis:<ref>`, the grouping the first hand-made ledger used). snapshot is the digest on the first prompt line
// (`KNU review snapshot sha256:…`) and subjectSize the subject paths and criteria documents of the review's criteria
// record (`<reviewId>.criteria.json` beside its packet; the review id comes from the packet file line of a Parent
// reviewer prompt or the packet id of a native subject reviewer); either is null when the reader cannot find it.

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

import { resolveArtifactPath } from '../../artifacts/paths.mjs';
import { readAdjudicationRecords, resultFindingIds } from '../common/review-adjudication.mjs';
import { buildLedger } from '../common/review-ledger.mjs';

class InputError extends Error {}

const ROUND = /Review round (\d+)/u;
const SNAPSHOT_LINE = /^KNU review snapshot (sha256:[a-f0-9]{64})$/u;
const PACKET_LINE = /^KNU_REVIEW_PACKET_FILE:\s*\S*?([a-z0-9]{8}-[a-f0-9]{8})\.json\s/mu;
const PACKET_ID = /^review-([a-z0-9]{8}-[a-f0-9]{8})$/u;

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

// The reviewer's final message holds one JSON object; text around it is ignored.
function parseResult(completion) {
  const content = completion?.response?.content ?? [];
  const text = (Array.isArray(content) ? content : [content])
    .map((part) => (typeof part === 'string' ? part : (part?.text ?? '')))
    .join('\n');
  try {
    const result = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
    return typeof result?.verdict === 'string' && Array.isArray(result.findings) ? result : null;
  } catch {
    return null;
  }
}

// The subject size of a review from its criteria record, or null when the record is missing or malformed.
function subjectSize(packets, reviewId) {
  if (reviewId === undefined) return null;
  try {
    const criteria = readJson(resolve(packets, `${reviewId}.criteria.json`));
    return Array.isArray(criteria.paths) && Number.isInteger(criteria.documentCount)
      ? { paths: criteria.paths.length, documents: criteria.documentCount }
      : null;
  } catch {
    return null;
  }
}

function reviewerRow(directory, taskId, adjudications, packets) {
  const row = {
    host: 'claude',
    taskId,
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
  let task;
  try {
    task = readJson(resolve(directory, 'task.json')).record;
  } catch {
    return row;
  }
  if (task?.input?.nativeRequest?.task?.role !== 'knu_reviewer') return null;
  const request = task.input.nativeRequest;
  row.issuedAt = request.issuedAt ?? null;
  const prompt = typeof task.prompt === 'string' ? task.prompt : '';
  const round = ROUND.exec(prompt)?.[1];
  row.round = round ? Number(round) : null;
  row.snapshot = SNAPSHOT_LINE.exec(prompt.split('\n')[0])?.[1] ?? null;
  row.subjectSize = subjectSize(
    packets,
    PACKET_LINE.exec(prompt)?.[1] ?? PACKET_ID.exec(task.independentReview?.packet?.packetId)?.[1],
  );
  const subjectTask = task.independentReview?.subjectTaskId;
  row.subjectKey = subjectTask
    ? `task:${subjectTask}`
    : request.selectionBasisRef
      ? `basis:${request.selectionBasisRef}`
      : null;
  const adjudication = adjudications.get(taskId);
  if (adjudication && typeof adjudication.record.subject === 'string')
    row.subjectKey = adjudication.record.subject;

  const completionPath = resolve(directory, 'completion.json');
  if (!existsSync(completionPath)) row.status = 'completion-missing';
  else {
    let result = null;
    try {
      result = parseResult(readJson(completionPath));
    } catch {}
    if (!result) row.status = 'parse-failed';
    else {
      row.status = 'parsed';
      row.verdict = result.verdict;
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

export function readClaudeReviewRows({
  root,
  registry,
  adjudicationDirectories = [],
  until = null,
}) {
  const adjudications = readAdjudicationRecords(root, adjudicationDirectories);
  const packets = resolve(registry, '..', 'claude-review-packets');
  const all = readdirSync(registry, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) =>
      reviewerRow(resolve(registry, entry.name), entry.name, adjudications.byTask, packets),
    )
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
    const registry = resolveArtifactPath(root, ['claude-native'], env);
    if (!isDirectory(registry)) throw new InputError(`${registry}: no native registry directory`);
    const directories = (values.adjudications ?? []).map((path) => resolve(cwd, path));
    for (const directory of directories)
      if (!isDirectory(directory)) throw new InputError(`${directory}: no such directory`);
    const until = values.until === undefined ? null : Date.parse(values.until);
    if (Number.isNaN(until)) throw new InputError(`--until ${values.until}: not an ISO time`);
    const { rows, excludedWithoutIssuedAt, adjudicationViolations, legacyAdjudications } =
      readClaudeReviewRows({
        root,
        registry,
        adjudicationDirectories: directories,
        until,
      });
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
