// Runner log check: each record of a runner evidence file must point at outputs that exist, `.log`/`.txt` outputs must
// start with the review header and their last `exit=<n>` line, when present, must match the record's exit, and
// backtick fragments in `observedResult` must appear on a result line of those logs. A log with several whole-line
// `exit=<n>` lines where an earlier one is not 0 while the record has exit 0 is `repeated-step-exit-hidden`: the last
// exit would hide a failed run of a repeated step. A search exit carries its command name (`rg exit=1`) and is not
// such a line. A rejected fragment's message says why and, when the log holds one, the fragment shape that would match
// (`suggestion`). A zero-hit search fragment (`rg exit=1`) without a positive control fragment (`control rg exit=0`)
// in the same record is the warning `absence-without-control`; warnings never change the exit.
// A carried record (`carriedFrom`, the review id of the round that made its log) is taken only with a carry basis
// (`--carry-basis`, written by Claude review-run) that names that round (C1 `carry-basis-missing`), when that round's
// runner file holds the same record and its outputs are unchanged since (C2 `carried-record-mismatch`), its log starts
// with that round's header (C3 `carried-header-mismatch`), the round diff since that round is changed `.md` files only
// (C4 `carry-round-diff-not-docs`) and no tracked `scripts/` file names a changed document by path or file name (C5
// `carry-doc-referenced`). `--confirm <carry record>` compares the confirm runs of the carried records (`--evidence`)
// with them at the result unit: the same record name, this round's runner record rules, exit, the carried fragments and
// the test result lines (name lines with durations masked and the summary counts). Its reasons are
// `carry-confirm-missing: <record>` and `carry-confirm-mismatch: <record>`.
// Rules and usage: docs/development/agent-workflows/review-criteria/README.md
//
// Usage: node scripts/agents/common/runner-log-check.mjs --evidence <JSON> --header "<logHeader>" [--carry-basis <JSON>]
//          [--confirm <carry record JSON>] [--root <repo>] [--json]
// Exit 0 = no violation, 1 = violations, 2 = input error (missing option or file, positional argument, header without a
// trailing `sha256:<64 hex>`, evidence that is not JSON or has no records, a carry basis or carry record that is not
// one, missing root, unknown option). Input errors never count as a pass.
// Only the common record fields are read (`exit`, `outputPaths`, `observedResult`, optional `sourceDigest`, and for a
// carried record `command`, `label`, `environment`, `purpose`, `expectedExit`, `carriedFrom`); the full field format
// stays with each host's runner helper.

import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, realpathSync, statSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual, parseArgs } from 'node:util';

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
  'usage: runner-log-check --evidence <JSON> --header "<logHeader>" [--carry-basis <JSON>] [--confirm <carry record JSON>] [--root <repo>] [--json]';
const CARRY_BASIS_SCHEMA = 'claude-review-carry-basis/v1';
const CARRY_SCHEMA = 'claude-review-carry/v1';
const REVIEW_ID = /^[a-z0-9]{8}-[a-f0-9]{8}$/u;
const recordName = (record) =>
  record.label === undefined ? record.command : `${record.command} (${record.label})`;
// The runner file fields (commandsActuallyRun) a carried record keeps from the round that made it.
const CARRIED_FIELDS = [
  'exit',
  'purpose',
  'expectedExit',
  'observedResult',
  'environment',
  'outputPaths',
];
// Test result lines of `node --test` output: a spec name line (`✔`, `✖`, `﹣`) or a TAP line (`ok`, `not ok`), and an
// `ℹ` summary count. Durations are masked; `ℹ duration_ms` is no count.
const DURATION = / \(\d+(?:\.\d+)?ms\)/gu;
const NAME_LINE = /^\s*(?:(?:✔|✖|﹣) .*|(?:ok|not ok) \d+ - .*)$/u;
const SUMMARY_LINE = /^ℹ (?:tests|suites|pass|fail|cancelled|skipped|todo) \d+$/u;
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
      error: `unpaired backtick: backtick count ${parts.length - 1} is odd, so the summary cannot be split into fragments; each fragment is one pair of backticks around log text that holds no backtick`,
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

// Whitespace and backticks split a line into the tokens a suggestion copies: a fragment cannot hold a backtick.
const TOKEN_SEPARATOR = /[\s`]+/u;

// The run of a line around [start, end) up to whitespace or a backtick: the token run a fragment should copy.
const tokenRun = (line, start, end) =>
  `${/[^\s`]*$/u.exec(line.slice(0, start))[0]}${line.slice(start, end)}${/^[^\s`]*/u.exec(line.slice(end))[0]}`;

// An unlabeled fragment that is a token on a result line: the token it is a token of when that token carries a label
// (`timeout=1` for `1`), else that token with the token printed before or after it when the pair carries one
// (`pass 41` for `41` in `ℹ pass 41`, `bad=0 ok=3` for `bad=0`). A token holding the fragment only inside a longer
// number (`141` for `41`) is not that token.
function labeledSuggestion(fragment, lines) {
  for (const line of lines) {
    if (!fragmentOnLine(fragment, line)) continue;
    const tokens = line.split(TOKEN_SEPARATOR).filter(Boolean);
    // A fragment holding whitespace is a token of no single token (at -1), and then neither slice is a pair.
    const at = tokens.findIndex((token) => fragmentOnLine(fragment, token));
    if (at >= 0 && isLabeled(tokens[at])) return tokens[at];
    for (const pair of [tokens.slice(at - 1, at + 1), tokens.slice(at, at + 2)]) {
      const candidate = pair.join(' ');
      if (pair.length === 2 && isLabeled(candidate) && fragmentOnLine(candidate, line))
        return candidate;
    }
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
  // The whitespace-separated run around the fragment carries its label and is a token on that line.
  for (const line of resultLines) {
    const at = line.indexOf(fragment);
    if (at >= 0)
      return {
        detail:
          'fragment starts or ends inside a token (a letter, digit, _, . or - next to it, as `concat` in `x.concat(`): copy the whole whitespace-separated token run',
        suggestion: tokenRun(line, at, at + fragment.length),
      };
  }
  if (otherLines.some((line) => line.includes(fragment)))
    return {
      detail:
        'fragment is only on the header or a digest line (a shasum line or a line with a sha256: digest), which are not result lines',
    };
  return {
    detail:
      'fragment is not a token on a result line of the record logs: copy one whitespace-separated token run of a result line of this round as printed (a count copied from an earlier round no longer matches)',
  };
}

// The producing round of a carried record (C1) and its runner file record (C2), before its outputs are read.
function carriedRecordChecks(record, basis, add) {
  if (typeof record.carriedFrom !== 'string' || !REVIEW_ID.test(record.carriedFrom)) {
    add(
      'invalid-record',
      'carriedFrom must be the review id (8 base36, a dash, 8 hex) of the round that made the log',
    );
    return null;
  }
  const round = basis?.rounds?.[record.carriedFrom];
  if (!round || typeof round !== 'object') {
    add(
      'carry-basis-missing',
      basis
        ? `the carry basis has no round ${record.carriedFrom}`
        : 'a carried record needs --carry-basis (only Claude review-run writes one; Codex does not carry records)',
    );
    return null;
  }
  const name = typeof record.command === 'string' ? recordName(record) : undefined;
  const at = Array.isArray(round.commands) ? round.commands.indexOf(name) : -1;
  const produced = at >= 0 ? round.commandsActuallyRun?.[at] : undefined;
  if (!produced)
    add(
      'carried-record-mismatch',
      `the runner file of round ${record.carriedFrom} has no record ${JSON.stringify(name)}`,
    );
  else
    for (const field of CARRIED_FIELDS)
      if (!isDeepStrictEqual(record[field], produced[field]))
        add(
          'carried-record-mismatch',
          `${field} ${JSON.stringify(record[field])} is not ${JSON.stringify(produced[field])} in the runner file of round ${record.carriedFrom}`,
        );
  for (const path of Array.isArray(record.outputPaths) ? record.outputPaths : []) {
    const digests = round.outputDigests?.[path];
    if (!digests?.produced || digests.current !== digests.produced)
      add(
        'carried-record-mismatch',
        digests?.produced
          ? `the output changed after round ${record.carriedFrom}`
          : `round ${record.carriedFrom} bound no digest of this output`,
        { path },
      );
  }
  return round;
}

// C4 and C5 for one producing round: the round diff is changed `.md` files only, and no tracked `scripts/` file names
// one of them by path or file name. Checked once per round.
function roundDiffChecks(root, roundId, round) {
  const found = [];
  const diff = Array.isArray(round.roundDiff) ? round.roundDiff : null;
  const notDocs = diff
    ? diff.filter(
        (entry) =>
          typeof entry?.path !== 'string' ||
          !entry.path.endsWith('.md') ||
          entry.created !== false ||
          entry.deleted !== false,
      )
    : [];
  if (!diff || notDocs.length)
    found.push({
      kind: 'carry-round-diff-not-docs',
      detail: diff
        ? `the round diff since ${roundId} is not changed .md files only: ${notDocs
            .map(
              ({ path, created, deleted }) =>
                `${path}${created ? ' (new)' : deleted ? ' (removed)' : ''}`,
            )
            .join(', ')}`
        : `the carry basis has no round diff since ${roundId}`,
    });
  else
    for (const { path } of diff) {
      // The file name ends the path, so a line naming the path names the file name too: one search finds both.
      const search = spawnSync('git', ['grep', '-F', '-l', '-e', basename(path), '--', 'scripts'], {
        cwd: root,
        encoding: 'utf8',
      });
      if (search.status === 1) continue;
      found.push({
        kind: 'carry-doc-referenced',
        detail:
          search.status === 0
            ? `${path} is named by ${search.stdout.trim().split('\n').join(', ')}: a check reading it may change`
            : `${path}: git grep exit ${search.status ?? search.signal} while looking for scripts naming it`,
        path,
      });
    }
  return found;
}

function checkRecord(root, header, digest, record, index, basis) {
  const violations = [];
  const warnings = [];
  const add = (kind, detail, extra = {}) =>
    violations.push({ record: index, kind, ...extra, detail });
  const counts = { outputs: 0, fragments: 0, unverifiedSummaries: 0 };
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    add('invalid-record', 'record must be an object');
    return { violations, warnings, counts };
  }
  // A carried record keeps the log of its producing round: that round's header is its first line (C3).
  let expectedHeader = header;
  let headerKind = 'header-mismatch';
  let round = null;
  if (record.carriedFrom !== undefined) {
    round = carriedRecordChecks(record, basis, add);
    expectedHeader = typeof round?.header === 'string' ? round.header : null;
    headerKind = 'carried-header-mismatch';
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
      if (expectedHeader !== null && lines[0] !== expectedHeader)
        add(headerKind, `first line is ${JSON.stringify(lines[0])}`, { path });
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
    return { violations, warnings, counts, round };
  }
  const parsed = fragments(summary);
  if (parsed.error) {
    add('invalid-fragment', parsed.error);
    return { violations, warnings, counts, round };
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
  return { violations, warnings, counts, round };
}

export function checkRunnerLog({ root, header, evidence, basis }) {
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
  const rounds = new Map();
  evidence.records.forEach((record, index) => {
    const checked = checkRecord(root, header, digest, record, index, basis);
    violations.push(...checked.violations);
    warnings.push(...checked.warnings);
    for (const [key, value] of Object.entries(checked.counts)) summary[key] += value;
    if (checked.round) {
      if (!rounds.has(record.carriedFrom))
        rounds.set(record.carriedFrom, roundDiffChecks(root, record.carriedFrom, checked.round));
      for (const found of rounds.get(record.carriedFrom))
        violations.push({ record: index, ...found });
    }
  });
  summary.violations = violations.length;
  return { summary, violations, warnings };
}

// The result unit of a record's text outputs: its result lines, the test name lines with durations masked (a multiset,
// sorted) and the summary counts (sorted). Null when an output is missing or unreadable.
function resultUnit(root, outputPaths) {
  const lines = [];
  for (const path of Array.isArray(outputPaths) ? outputPaths : []) {
    if (typeof path !== 'string' || !TEXT_OUTPUT.test(path)) continue;
    const read = readLog(root, path);
    if (!read) return null;
    lines.push(
      ...read.slice(1).filter((line) => !DIGEST_LINE.some((pattern) => pattern.test(line))),
    );
  }
  const sorted = (values) => values.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return {
    lines,
    names: sorted(
      lines.filter((line) => NAME_LINE.test(line)).map((line) => line.replace(DURATION, '').trim()),
    ),
    summary: sorted(
      lines.filter((line) => SUMMARY_LINE.test(line.trim())).map((line) => line.trim()),
    ),
  };
}

// The confirm runs (this round's records) against the carried records of the carry record, at the result unit.
export function confirmCarry({ root, header, evidence, carry }) {
  const result = checkRunnerLog({ root, header, evidence });
  const reasons = new Set();
  const names = evidence.records.map((record) =>
    record && typeof record.command === 'string' ? recordName(record) : undefined,
  );
  for (const { record } of result.violations)
    reasons.add(`carry-confirm-mismatch: ${names[record] ?? `record ${record}`}`);
  for (const carried of carry.records) {
    const at = names.indexOf(carried.recordName);
    if (at < 0) {
      reasons.add(`carry-confirm-missing: ${carried.recordName}`);
      continue;
    }
    const confirm = evidence.records[at];
    const mismatch = () => reasons.add(`carry-confirm-mismatch: ${carried.recordName}`);
    if (confirm.exit !== carried.exit) mismatch();
    const before = resultUnit(root, carried.outputPaths);
    const after = resultUnit(root, confirm.outputPaths);
    if (!before || !after) {
      mismatch();
      continue;
    }
    const parsed = fragments(
      typeof carried.observedResult === 'string' ? carried.observedResult : '',
    );
    if (
      parsed.error ||
      !(parsed.fragments ?? []).every((fragment) =>
        after.lines.some((line) => fragmentOnLine(fragment, line)),
      )
    )
      mismatch();
    if (
      !isDeepStrictEqual(before.names, after.names) ||
      !isDeepStrictEqual(before.summary, after.summary)
    )
      mismatch();
  }
  return { ...result, reasons: [...reasons] };
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
        'carry-basis': { type: 'string' },
        confirm: { type: 'string' },
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

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new InputError(`${path}: ${error.message}`);
  }
}

function readCarryBasis(path) {
  const basis = readJson(path);
  if (basis?.schema !== CARRY_BASIS_SCHEMA || !basis.rounds || typeof basis.rounds !== 'object')
    throw new InputError(`${path}: a carry basis is { schema: ${CARRY_BASIS_SCHEMA}, rounds: {} }`);
  return basis;
}

function readCarry(path) {
  const carry = readJson(path);
  if (
    carry?.schema !== CARRY_SCHEMA ||
    !Array.isArray(carry.records) ||
    carry.records.length === 0 ||
    !carry.records.every((record) => typeof record?.recordName === 'string')
  )
    throw new InputError(
      `${path}: a carry record is { schema: ${CARRY_SCHEMA}, records: [{ recordName, ... }] }`,
    );
  return carry;
}

function format(result) {
  const lines = result.violations.map(
    ({ record, kind, path, fragment, detail, suggestion }) =>
      `record ${record}\t${kind}\t${path ?? (fragment === undefined ? '' : `\`${fragment}\``)}\t${detail}${suggestion === undefined ? '' : `; use \`${suggestion}\``}`,
  );
  for (const { record, kind, fragment, detail } of result.warnings)
    lines.push(`record ${record}\twarning ${kind}\t\`${fragment}\`\t${detail}`);
  for (const reason of result.reasons ?? []) lines.push(`reason\t${reason}`);
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
    if (values.confirm) {
      const carry = readCarry(resolve(cwd, values.confirm));
      const result = confirmCarry({ root, header: values.header, evidence, carry });
      log(values.json ? JSON.stringify({ root, ...result }, null, 2) : format(result));
      return result.reasons.length ? 1 : 0;
    }
    const basis = values['carry-basis']
      ? readCarryBasis(resolve(cwd, values['carry-basis']))
      : undefined;
    const result = checkRunnerLog({ root, header: values.header, evidence, basis });
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
