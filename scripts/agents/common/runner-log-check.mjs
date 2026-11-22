// Runner log check: each record of a runner evidence file must point at outputs that exist, `.log`/`.txt` outputs must
// start with the review header and their last `exit=<n>` line, when present, must match the record's exit, and
// backtick fragments in `observedResult` must appear on a result line of those logs. A log with several whole-line
// `exit=<n>` lines where an earlier one is not 0 while the record has exit 0 is `repeated-step-exit-hidden`: the last
// exit would hide a failed run of a repeated step. A search exit carries its command name (`rg exit=1`) and is not
// such a line. A rejected fragment's message says why and, when the log holds one, the fragment shape that would match
// (`suggestion`). A zero-hit search fragment (`rg exit=1`) without a positive control fragment (`control rg exit=0`)
// in the same record is the warning `absence-without-control`; warnings never change the exit.
// Rules and usage: docs/development/agent-workflows/review-criteria/README.md
//
// Usage: node scripts/agents/common/runner-log-check.mjs --evidence <JSON> --header "<logHeader>" [--root <repo>] [--json]
// Exit 0 = no violation, 1 = violations, 2 = input error (missing option or file, positional argument, header without a
// trailing `sha256:<64 hex>`, evidence that is not JSON or has no records, missing root, unknown option). Input errors
// never count as a pass.
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
const USAGE =
  'usage: runner-log-check --evidence <JSON> --header "<logHeader>" [--root <repo>] [--json]';
// A zero-hit search exit claims an absence; its positive control is the same kind of search where it must hit, written
// with `control` in front of its exit line.
const ABSENCE = /^(?:rg|grep|git grep) exit=1$/u;
const CONTROL = /^control (?:rg|grep|git grep) exit=0$/u;
const EMPHASIS = /^(\*\*|\*|__|_)(?<inner>.+)\1$/u;

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
  if (parts.length % 2 === 0)
    return {
      error: `unpaired backtick: ${parts.length - 1} backticks cannot be split into fragments; each fragment is one pair of backticks around log text that holds no backtick`,
    };
  return { fragments: parts.filter((_, index) => index % 2 === 1) };
}

function readLog(root, path) {
  try {
    return splitLines(readFileSync(resolve(root, path), 'utf8'));
  } catch {
    return null;
  }
}

const isLabeled = (fragment) => fragment.trim() && !UNLABELED.test(fragment.replace(/\s/gu, ''));

// The whitespace-separated run of a line around [start, end): the token run a fragment should copy.
function tokenRun(line, start, end) {
  let from = start;
  let to = end;
  while (from > 0 && !/\s/u.test(line[from - 1])) from -= 1;
  while (to < line.length && !/\s/u.test(line[to])) to += 1;
  return line.slice(from, to);
}

// An unlabeled fragment that is a token on a result line: that token with its neighbor on the line (`pass 41` for
// `41` in `ℹ pass 41`, `bad=0 ok=3` for `bad=0`).
function labeledSuggestion(fragment, lines) {
  for (const line of lines) {
    if (!fragmentOnLine(fragment, line)) continue;
    const tokens = line.trim().split(/\s+/u);
    const at = tokens.findIndex((token) => token.includes(fragment));
    const candidates = [
      at > 0 ? tokens.slice(at - 1, at + 1).join(' ') : null,
      at >= 0 && at + 1 < tokens.length ? tokens.slice(at, at + 2).join(' ') : null,
    ];
    const found = candidates.find(
      (candidate) => candidate && isLabeled(candidate) && fragmentOnLine(candidate, line),
    );
    if (found) return found;
  }
  return undefined;
}

// Why a labeled fragment matched no result line, and the fragment a result line holds instead.
function mismatch(fragment, resultLines, otherLines) {
  const emphasis = EMPHASIS.exec(fragment)?.groups.inner;
  if (emphasis && resultLines.some((line) => fragmentOnLine(emphasis, line)))
    return {
      detail: 'Markdown emphasis is not in the log: copy the result line text as printed',
      suggestion: emphasis,
    };
  for (const line of resultLines) {
    const at = line.indexOf(fragment);
    if (at < 0) continue;
    const run = tokenRun(line, at, at + fragment.length);
    if (isLabeled(run) && fragmentOnLine(run, line))
      return {
        detail:
          'fragment starts or ends inside a token (a letter, digit, _, . or - next to it, as `concat` in `x.concat(`): copy the whole whitespace-separated token run',
        suggestion: run,
      };
  }
  if (otherLines.some((line) => line.includes(fragment)))
    return {
      detail:
        'fragment is only on the header or a digest line (a shasum line or a line with a sha256: digest), which are not result lines',
    };
  return {
    detail:
      'fragment is not a token on a result line of the record logs: copy one whitespace-separated token run of a result line as printed, and leave out counts that change between rounds',
  };
}

function checkRecord(root, header, digest, record, index) {
  const violations = [];
  const warnings = [];
  const add = (kind, detail, extra = {}) =>
    violations.push({ record: index, kind, ...extra, detail });
  const counts = { outputs: 0, fragments: 0, unverifiedSummaries: 0 };
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    add('invalid-record', 'record must be an object');
    return { violations, warnings, counts };
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
  const otherLines = [];
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
      const exits = lines.flatMap((line, at) => {
        const exit = EXIT_LINE.exec(line.trim())?.groups.exit;
        return exit === undefined ? [] : [{ line: at + 1, exit: Number(exit) }];
      });
      const logged = exits.length ? exits.at(-1).exit : null;
      if (exitValid && logged !== null && logged !== record.exit)
        add('exit-mismatch', `log ends with exit=${logged}, record has exit ${record.exit}`, {
          path,
        });
      const hidden = exits.slice(0, -1).find(({ exit }) => exit !== 0);
      if (record.exit === 0 && hidden)
        add(
          'repeated-step-exit-hidden',
          `line ${hidden.line} is exit=${hidden.exit} but the record has exit 0: a whole-line exit= line is the end exit of one bundle; write a search exit with its command name (rg exit=1) or give each run its own record`,
          { path },
        );
      for (const [at, line] of lines.entries()) {
        if (at > 0 && !DIGEST_LINE.some((pattern) => pattern.test(line))) resultLines.push(line);
        else otherLines.push(line);
      }
    }

  const summary = typeof record.observedResult === 'string' ? record.observedResult : '';
  if (!summary.includes('`')) {
    counts.unverifiedSummaries += 1;
    return { violations, warnings, counts };
  }
  const parsed = fragments(summary);
  if (parsed.error) {
    add('invalid-fragment', parsed.error);
    return { violations, warnings, counts };
  }
  for (const fragment of parsed.fragments) {
    if (!fragment.trim()) {
      add('invalid-fragment', 'empty fragment', { fragment });
      continue;
    }
    if (!isLabeled(fragment)) {
      const suggestion = labeledSuggestion(fragment, resultLines);
      add(
        'invalid-fragment',
        'digits, hex letters and punctuation alone (`41`, `#961`, `bad=0`) match by chance: copy the fragment with the label printed beside it on the log line',
        { fragment, ...(suggestion === undefined ? {} : { suggestion }) },
      );
      continue;
    }
    counts.fragments += 1;
    if (!resultLines.some((line) => fragmentOnLine(fragment, line))) {
      const { detail, suggestion } = mismatch(fragment, resultLines, otherLines);
      add('summary-mismatch', detail, {
        fragment,
        ...(suggestion === undefined ? {} : { suggestion }),
      });
    }
  }
  if (
    parsed.fragments.some((fragment) => ABSENCE.test(fragment)) &&
    !parsed.fragments.some((fragment) => CONTROL.test(fragment))
  )
    warnings.push({
      record: index,
      kind: 'absence-without-control',
      fragment: parsed.fragments.find((fragment) => ABSENCE.test(fragment)),
      detail:
        'a zero-hit search exit claims an absence: run the same search where it must hit (the revision before the change) in this record and quote its exit line as `control rg exit=0`',
    });
  return { violations, warnings, counts };
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
  const warnings = [];
  evidence.records.forEach((record, index) => {
    const checked = checkRecord(root, header, digest, record, index);
    violations.push(...checked.violations);
    warnings.push(...checked.warnings);
    for (const [key, value] of Object.entries(checked.counts)) summary[key] += value;
  });
  summary.violations = violations.length;
  return { summary, violations, warnings };
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
    throw new InputError(`${error.message}\n${USAGE}`);
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
    ({ record, kind, path, fragment, detail, suggestion }) =>
      `record ${record}\t${kind}\t${path ?? (fragment === undefined ? '' : `\`${fragment}\``)}\t${detail}${suggestion === undefined ? '' : `; use \`${suggestion}\``}`,
  );
  for (const { record, kind, fragment, detail } of result.warnings)
    lines.push(`record ${record}\twarning ${kind}\t\`${fragment}\`\t${detail}`);
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
    if (!values.evidence || !values.header) throw new InputError(USAGE);
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
