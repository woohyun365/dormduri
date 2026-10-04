// Claude review ledger source: reads knu_reviewer records of the native registry
// (`<artifacts>/claude-native/<taskId>/{task,completion}.json`) and `*-adjudication.json` records
// (review-adjudication/v1) under the given directories, then hands the rows to the common ledger.
// Rules and usage: docs/development/agent-workflows/review-criteria/README.md
//
// Usage: node scripts/agents/claude/review-ledger-source.mjs [--root <repo>] [--adjudications <dir>]...
//          [--until <ISO time>] [--json]
// Exit 0 = ledger built, 1 = an adjudication record is invalid or a row was rejected, 2 = input error (missing
// registry or adjudication directory, invalid --until, unknown option, root outside a git repository).
//
// Row fields: round comes from the reviewer prompt (`Review round N`, absent before round inputs existed), subjectKey
// from the adjudication record's subject, else the native subject task (`task:<id>`), else the selection basis
// (`basis:<ref>`, the grouping the first hand-made ledger used).

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

import { resolveArtifactPath } from '../../artifacts/paths.mjs';
import { resultFindingIds, validateAdjudication } from '../common/review-adjudication.mjs';
import { buildLedger } from '../common/review-ledger.mjs';

class InputError extends Error {}

const ROUND = /Review round (\d+)/u;

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

function adjudicationFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return adjudicationFiles(path);
    return entry.isFile() && entry.name.endsWith('-adjudication.json') ? [path] : [];
  });
}

// taskId -> { record, valid } for every review a record names, plus the violations of every record.
function readAdjudications(root, directories) {
  const byTask = new Map();
  const violations = [];
  for (const path of directories.flatMap(adjudicationFiles).sort()) {
    const file = relative(root, path);
    let record;
    try {
      record = readJson(path);
    } catch (error) {
      violations.push({ file, kind: 'record-unreadable', detail: error.message });
      continue;
    }
    const found =
      record && typeof record === 'object' && !Array.isArray(record)
        ? validateAdjudication(record, (resultPath) => readJson(resolve(root, resultPath)))
        : [{ kind: 'record-unreadable', detail: 'not a JSON object' }];
    violations.push(...found.map((violation) => ({ file, ...violation })));
    for (const review of Array.isArray(record?.reviews) ? record.reviews : []) {
      if (typeof review?.taskId !== 'string') continue;
      if (byTask.has(review.taskId)) {
        violations.push({
          file,
          kind: 'duplicate-review',
          id: review.taskId,
          detail: `already adjudicated in ${byTask.get(review.taskId).file}`,
        });
        continue;
      }
      byTask.set(review.taskId, { file, record, valid: found.length === 0 });
    }
  }
  return { byTask, violations };
}

function reviewerRow(directory, taskId, adjudications) {
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
  const round = ROUND.exec(task.prompt ?? '')?.[1];
  row.round = round ? Number(round) : null;
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
  const adjudications = readAdjudications(root, adjudicationDirectories);
  const all = readdirSync(registry, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => reviewerRow(resolve(registry, entry.name), entry.name, adjudications.byTask))
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
  return { rows, excludedWithoutIssuedAt, adjudicationViolations: adjudications.violations };
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
    const { rows, excludedWithoutIssuedAt, adjudicationViolations } = readClaudeReviewRows({
      root,
      registry,
      adjudicationDirectories: directories,
      until,
    });
    const ledger = buildLedger(rows);
    log(
      values.json
        ? JSON.stringify(
            { root, ...ledger, excludedWithoutIssuedAt, adjudicationViolations },
            null,
            2,
          )
        : `${format(ledger)}\nexcludedWithoutIssuedAt ${excludedWithoutIssuedAt}`,
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
