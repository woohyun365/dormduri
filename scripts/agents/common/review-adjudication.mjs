// Review adjudication record (`review-adjudication/v1`): the Parent's disposition of every finding of one review
// round, written next to the review results. The validator checks the record against the results it names.
// Rules and usage: docs/development/agent-workflows/review-criteria/README.md
//
// Usage: node scripts/agents/common/review-adjudication.mjs [--root <repo>] [--json] <adjudication.json...>
// Exit 0 = every record is valid, 1 = violations, 2 = input error (no file, missing file, not a JSON object, unknown
// option, root outside a git repository). `resultPath` is resolved from --root (default: the current git repository).
//
// Record: { schema: 'review-adjudication/v1', subject, round, reviews: [{ taskId, resultPath }],
//           findings: [{ id, severity, disposition, reason?, duplicateOf?, origin?, fixRef? }],
//           unjudged?: [{ id, disposition, reason }] }
// Finding ids: a result finding's own `id`, otherwise `<taskId>#<index in the result findings array, from 0>`.
// Unjudged ids: `<taskId>#u<index in the result unjudgedBehaviors array, from 0>`; every line needs one disposition.

import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

class InputError extends Error {}

export const SCHEMA = 'review-adjudication/v1';
// Same values as the finding severity of the cross-model-handoff/v1 result contract.
export const SEVERITIES = ['critical', 'high', 'medium', 'low'];
// `fixed` closes a finding during the review rounds; the other four are the QA dispositions after PASS.
export const DISPOSITIONS = ['fixed', 'fixed-mechanical', 'deferred', 'rejected', 'pre-existing'];
export const ORIGINS = ['fix-induced', 'previously-missed', 're-raised'];
// A behavior the reviewer left unjudged is outside this change, raised as a finding, or a follow-up.
export const UNJUDGED_DISPOSITIONS = ['out-of-scope', 'raised', 'follow-up'];
const RECORD_KEYS = ['schema', 'subject', 'round', 'reviews', 'findings', 'unjudged'];
const FINDING_KEYS = ['id', 'severity', 'disposition', 'reason', 'duplicateOf', 'origin', 'fixRef'];
const UNJUDGED_KEYS = ['id', 'disposition', 'reason'];
const NEEDS_REASON = ['deferred', 'rejected'];

const isText = (value) => typeof value === 'string' && value.trim().length > 0;
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

export function resultFindingIds(taskId, result) {
  return result.findings.map((finding, index) =>
    isText(finding?.id) ? finding.id : `${taskId}#${index}`,
  );
}

export function resultUnjudgedIds(taskId, result) {
  return Array.isArray(result.unjudgedBehaviors)
    ? result.unjudgedBehaviors.map((_, index) => `${taskId}#u${index}`)
    : [];
}

// `readResult(resultPath)` returns the parsed result or throws. Returns violations `{ kind, id?, detail }`.
export function validateAdjudication(record, readResult) {
  const violations = [];
  const add = (kind, detail, id) => violations.push(id ? { kind, id, detail } : { kind, detail });
  for (const key of Object.keys(record))
    if (!RECORD_KEYS.includes(key)) add('unknown-key', `unknown record key ${key}`);
  if (record.schema !== SCHEMA) add('invalid-field', `schema must be ${SCHEMA}`);
  if (!isText(record.subject)) add('invalid-field', 'subject must be a non-empty string');
  if (!(Number.isInteger(record.round) && record.round >= 1))
    add('invalid-field', 'round must be a positive integer');

  const known = new Map();
  const knownUnjudged = new Set();
  const reviews = Array.isArray(record.reviews) ? record.reviews : [];
  if (reviews.length === 0) add('invalid-field', 'reviews must be a non-empty array');
  const taskIds = new Set();
  for (const review of reviews) {
    if (!isObject(review) || !isText(review.taskId) || !isText(review.resultPath)) {
      add('invalid-field', 'each review needs taskId and resultPath');
      continue;
    }
    if (taskIds.has(review.taskId)) {
      add('invalid-field', `review ${review.taskId} is listed twice`);
      continue;
    }
    taskIds.add(review.taskId);
    let result;
    try {
      result = readResult(review.resultPath);
    } catch (error) {
      add('result-unreadable', `${review.resultPath}: ${error.message}`);
      continue;
    }
    if (!isObject(result) || !Array.isArray(result.findings)) {
      add('result-unreadable', `${review.resultPath}: no findings array`);
      continue;
    }
    for (const [index, id] of resultFindingIds(review.taskId, result).entries()) {
      if (known.has(id)) add('duplicate-result-id', 'two reviewed findings carry this id', id);
      known.set(id, result.findings[index]);
    }
    for (const id of resultUnjudgedIds(review.taskId, result)) knownUnjudged.add(id);
  }

  const findings = Array.isArray(record.findings) ? record.findings : [];
  if (!Array.isArray(record.findings)) add('invalid-field', 'findings must be an array');
  const byId = new Map();
  for (const finding of findings) {
    if (!isObject(finding) || !isText(finding.id)) {
      add('invalid-field', 'each finding needs an id');
      continue;
    }
    if (byId.has(finding.id)) {
      add('duplicate-finding', 'finding is adjudicated more than once', finding.id);
      continue;
    }
    byId.set(finding.id, finding);
  }
  for (const [id, finding] of byId) {
    for (const key of Object.keys(finding))
      if (!FINDING_KEYS.includes(key)) add('unknown-key', `unknown finding key ${key}`, id);
    if (!known.has(id)) {
      add('unknown-finding', 'no reviewed result has this finding', id);
      continue;
    }
    if (!SEVERITIES.includes(finding.severity))
      add('invalid-field', `severity must be one of ${SEVERITIES.join(', ')}`, id);
    if (!DISPOSITIONS.includes(finding.disposition))
      add('invalid-field', `disposition must be one of ${DISPOSITIONS.join(', ')}`, id);
    if (NEEDS_REASON.includes(finding.disposition) && !isText(finding.reason))
      add('missing-reason', `${finding.disposition} needs a reason`, id);
    if (finding.reason !== undefined && typeof finding.reason !== 'string')
      add('invalid-field', 'reason must be a string', id);
    if (finding.fixRef !== undefined && !isText(finding.fixRef))
      add('invalid-field', 'fixRef must be a non-empty string', id);
    if (finding.origin !== undefined && !ORIGINS.includes(finding.origin))
      add('invalid-field', `origin must be one of ${ORIGINS.join(', ')}`, id);
    else if (finding.origin === undefined && record.round >= 2)
      add('missing-origin', 'round 2 and later findings need an origin', id);
    if (finding.duplicateOf !== undefined) {
      const target = byId.get(finding.duplicateOf);
      if (finding.duplicateOf === id || !target || target.duplicateOf !== undefined)
        add(
          'invalid-duplicate',
          'duplicateOf must name another, non-duplicate finding of this record',
          id,
        );
      else if (target.disposition !== finding.disposition)
        add('invalid-duplicate', `a duplicate follows ${target.id} (${target.disposition})`, id);
    }
  }
  for (const id of known.keys())
    if (!byId.has(id)) add('missing-finding', 'result finding has no disposition', id);

  if (record.unjudged !== undefined && !Array.isArray(record.unjudged))
    add('invalid-field', 'unjudged must be an array');
  const unjudged = new Map();
  for (const line of Array.isArray(record.unjudged) ? record.unjudged : []) {
    if (!isObject(line) || !isText(line.id)) {
      add('invalid-field', 'each unjudged line needs an id');
      continue;
    }
    if (unjudged.has(line.id)) {
      add('duplicate-unjudged', 'unjudged line is adjudicated more than once', line.id);
      continue;
    }
    unjudged.set(line.id, line);
    for (const key of Object.keys(line))
      if (!UNJUDGED_KEYS.includes(key)) add('unknown-key', `unknown unjudged key ${key}`, line.id);
    if (!knownUnjudged.has(line.id)) {
      add('unknown-unjudged', 'no reviewed result has this unjudged line', line.id);
      continue;
    }
    if (!UNJUDGED_DISPOSITIONS.includes(line.disposition))
      add(
        'invalid-field',
        `disposition must be one of ${UNJUDGED_DISPOSITIONS.join(', ')}`,
        line.id,
      );
    if (!isText(line.reason)) add('missing-reason', 'an unjudged line needs a reason', line.id);
  }
  for (const id of knownUnjudged)
    if (!unjudged.has(id)) add('missing-unjudged', 'unjudged line has no disposition', id);
  return violations;
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

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function readRecord(path) {
  let record;
  try {
    record = readJson(path);
  } catch (error) {
    throw new InputError(`${path}: ${error.message}`);
  }
  if (!isObject(record)) throw new InputError(`${path}: not a JSON object`);
  return record;
}

function parseOptions(argv) {
  try {
    return parseArgs({
      args: argv,
      allowPositionals: true,
      options: { root: { type: 'string' }, json: { type: 'boolean' } },
    });
  } catch (error) {
    throw new InputError(error.message);
  }
}

function format(result) {
  const lines = result.violations.map(
    ({ file, kind, id, detail }) => `${file}\t${kind}\t${id ?? ''}\t${detail}`,
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
    const { values, positionals } = parseOptions(argv);
    if (!positionals.length)
      throw new InputError(
        'usage: review-adjudication [--root <repo>] [--json] <adjudication.json...>',
      );
    const root = values.root ? resolve(cwd, values.root) : gitRoot(cwd);
    try {
      if (!statSync(root).isDirectory()) throw new Error();
    } catch {
      throw new InputError(`${root}: no such directory`);
    }
    const records = positionals.map((path) => ({ path, record: readRecord(resolve(cwd, path)) }));
    const violations = [];
    let findings = 0;
    for (const { path, record } of records) {
      if (Array.isArray(record.findings)) findings += record.findings.length;
      const file = relative(root, resolve(cwd, path)) || path;
      for (const violation of validateAdjudication(record, (resultPath) =>
        readJson(resolve(root, resultPath)),
      ))
        violations.push({ file, ...violation });
    }
    const result = {
      summary: { files: records.length, findings, violations: violations.length },
      violations,
    };
    log(values.json ? JSON.stringify(result, null, 2) : format(result));
    return violations.length ? 1 : 0;
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
