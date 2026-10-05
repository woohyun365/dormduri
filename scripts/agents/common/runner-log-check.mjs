// Runner log check: each record of a runner evidence file must point at outputs that exist, `.log`/`.txt` outputs must
// start with the review header and their last `exit=<n>` line, when present, must match the record's exit, and
// backtick fragments in `observedResult` must appear on a result line of those logs.
// Rules and usage: docs/development/agent-workflows/review-criteria/README.md
//
// Usage: node scripts/agents/common/runner-log-check.mjs --evidence <JSON> --header <first line> [--root <repo>] [--json]
// Exit 0 = no violation, 1 = violations, 2 = input error (missing option or file, header without a trailing
// `sha256:<64 hex>`, evidence that is not JSON or has no records, missing root, unknown option). Input errors never
// count as a pass.
// Only the common record fields are read (`exit`, `outputPaths`, `observedResult`, optional `sourceDigest`); the full
// field format stays with each host's runner helper.

import { execFileSync } from 'node:child_process';
import { readFileSync, realpathSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

import { splitLines } from './plan-impact-blocks.mjs';

class InputError extends Error {}

const HEADER = /^\S.* (?<digest>sha256:[0-9a-f]{64})$/u;
const EXIT_LINE = /^exit=(?<exit>-?\d+)$/u;
const TEXT_OUTPUT = /\.(?:log|txt)$/iu;
// `shasum -a 256` output lines and any line carrying a `sha256:` digest are not result lines.
const DIGEST_LINE = [/^[0-9a-f]{64} {2}\S/u, /sha256:[0-9a-f]{64}/u];
// Fragments must carry a label: digits, hex letters, punctuation and symbols alone (`41`, `208`, `57e3babd`) match
// too much by chance.
const UNLABELED = /^[0-9A-Fa-f\p{P}\p{S}]*$/u;
const TOKEN_CHAR = '[\\p{L}\\p{N}_.-]';

function isFile(path) {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

function escapeRegExp(text) {
  return text.replace(/[\\^$.*+?()[\]{}|/]/gu, '\\$&');
}

export function fragmentOnLine(fragment, line) {
  return new RegExp(
    `(?:^|(?!${TOKEN_CHAR}).)${escapeRegExp(fragment)}(?:$|(?!${TOKEN_CHAR}).)`,
    'u',
  ).test(line);
}

// Backtick fragments of a summary. An odd number of backticks cannot be split into fragments.
function fragments(summary) {
  const parts = summary.split('`');
  if (parts.length % 2 === 0) return { error: 'unpaired backtick' };
  return { fragments: parts.filter((_, index) => index % 2 === 1) };
}

function readLog(root, path) {
  try {
    return splitLines(readFileSync(resolve(root, path), 'utf8'));
  } catch {
    return null;
  }
}

function checkRecord(root, header, digest, record, index) {
  const violations = [];
  const add = (kind, detail, extra = {}) =>
    violations.push({ record: index, kind, ...extra, detail });
  const counts = { outputs: 0, fragments: 0, unverifiedSummaries: 0 };
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    add('invalid-record', 'record must be an object');
    return { violations, counts };
  }
  const exitValid = Number.isInteger(record.exit);
  if (!exitValid) add('invalid-record', 'exit must be an integer');
  if (record.observedResult !== undefined && typeof record.observedResult !== 'string')
    add('invalid-record', 'observedResult must be a string');
  if (record.sourceDigest !== undefined && record.sourceDigest !== digest)
    add(
      'digest-mismatch',
      `sourceDigest ${record.sourceDigest} is not the header digest ${digest}`,
    );

  const resultLines = [];
  const outputs = record.outputPaths;
  if (!Array.isArray(outputs) || outputs.length === 0)
    add('missing-output', 'outputPaths must be a non-empty array');
  else
    for (const path of outputs) {
      counts.outputs += 1;
      if (typeof path !== 'string' || !isFile(resolve(root, path))) {
        add('output-missing', 'no such file', { path });
        continue;
      }
      if (!TEXT_OUTPUT.test(path)) continue;
      const lines = readLog(root, path);
      if (!lines) {
        add('output-missing', 'not readable as text', { path });
        continue;
      }
      if (lines[0] !== header)
        add('header-mismatch', `first line is ${JSON.stringify(lines[0])}`, { path });
      const exitLine = lines.findLast((line) => EXIT_LINE.test(line.trim()));
      const logged =
        exitLine === undefined ? null : Number(EXIT_LINE.exec(exitLine.trim()).groups.exit);
      if (exitValid && logged !== null && logged !== record.exit)
        add('exit-mismatch', `log ends with exit=${logged}, record has exit ${record.exit}`, {
          path,
        });
      resultLines.push(
        ...lines.slice(1).filter((line) => !DIGEST_LINE.some((pattern) => pattern.test(line))),
      );
    }

  const summary = typeof record.observedResult === 'string' ? record.observedResult : '';
  if (!summary.includes('`')) {
    counts.unverifiedSummaries += 1;
    return { violations, counts };
  }
  const parsed = fragments(summary);
  if (parsed.error) {
    add('invalid-fragment', parsed.error);
    return { violations, counts };
  }
  for (const fragment of parsed.fragments) {
    if (!fragment.trim() || UNLABELED.test(fragment.replace(/\s/gu, ''))) {
      add('invalid-fragment', 'fragment needs the label printed in the log', { fragment });
      continue;
    }
    counts.fragments += 1;
    if (!resultLines.some((line) => fragmentOnLine(fragment, line)))
      add('summary-mismatch', 'fragment is not a token on a result line of the record logs', {
        fragment,
      });
  }
  return { violations, counts };
}

export function checkRunnerLog({ root, header, evidence }) {
  const digest = HEADER.exec(header).groups.digest;
  const summary = {
    records: evidence.records.length,
    outputs: 0,
    fragments: 0,
    unverifiedSummaries: 0,
    violations: 0,
  };
  const violations = [];
  evidence.records.forEach((record, index) => {
    const checked = checkRecord(root, header, digest, record, index);
    violations.push(...checked.violations);
    for (const [key, value] of Object.entries(checked.counts)) summary[key] += value;
  });
  summary.violations = violations.length;
  return { summary, violations };
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
        evidence: { type: 'string' },
        header: { type: 'string' },
        root: { type: 'string' },
        json: { type: 'boolean' },
      },
    }).values;
  } catch (error) {
    throw new InputError(error.message);
  }
}

function readEvidence(path) {
  let evidence;
  try {
    evidence = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new InputError(`${path}: ${error.message}`);
  }
  if (!Array.isArray(evidence?.records) || evidence.records.length === 0)
    throw new InputError(`${path}: records must be a non-empty array`);
  return evidence;
}

function format(result) {
  const lines = result.violations.map(
    ({ record, kind, path, fragment, detail }) =>
      `record ${record}\t${kind}\t${path ?? (fragment === undefined ? '' : `\`${fragment}\``)}\t${detail}`,
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
    if (!values.evidence || !values.header)
      throw new InputError(
        'usage: runner-log-check --evidence <JSON> --header <first line> [--root <repo>] [--json]',
      );
    if (!HEADER.test(values.header))
      throw new InputError(
        '--header must be `<text> sha256:<64 lowercase hex>` (the digest is the last token)',
      );
    let root;
    try {
      root = realpathSync(values.root ? resolve(cwd, values.root) : gitRoot(cwd));
    } catch (caught) {
      if (caught instanceof InputError) throw caught;
      throw new InputError(`${values.root}: no such directory`);
    }
    const evidence = readEvidence(resolve(cwd, values.evidence));
    const result = checkRunnerLog({ root, header: values.header, evidence });
    log(values.json ? JSON.stringify({ root, ...result }, null, 2) : format(result));
    return result.violations.length ? 1 : 0;
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
