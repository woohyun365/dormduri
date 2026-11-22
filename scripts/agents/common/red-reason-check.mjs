// RED reason check: a RED log must fail, every failing test must fail for an expected reason, and no line may carry
// an unexpected failure signature (import, syntax or missing-file errors) unless an expected pattern covers it.
// Rules and usage: docs/development/agent-workflows/review-criteria/README.md
//
// Usage: node scripts/agents/common/red-reason-check.mjs --log <file> --expect <regex> [--expect <regex>...] [--json]
// Supported formats: `node --test` spec reporter output and Vitest default reporter output (read after removing ANSI
// color codes; the JSON result names the format it read). Exit 0 = no violation, 1 = violations, 2 = input error
// (missing option or file, empty log, invalid regex or one matching the empty string, log with neither format's
// markers, unknown option). Input errors never count as a pass.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

import { splitLines } from './plan-impact-blocks.mjs';

class InputError extends Error {}

const ANSI = /\u001b\[[0-9;]*[A-Za-z]/gu;
const FAIL_SUMMARY = /^ℹ fail (?<count>\d+)$/u;
const FAILING_SECTION = /^✖ failing tests:$/u;
const FAILED = /^✖ (?<title>.*?)(?: \([^()]*\))?$/u;
// Result lines (test titles, suite starts, summary) and `test at <file>` locations end a failure block. Their text is a
// test title, not a failure reason, so neither the reason match nor the signature scan reads them.
const RESULT_LINE = /^(?:[✔✖﹣ℹ▶] |test at )/u;
// In the default test isolation a module-level error is printed outside the failure blocks, which then only say
// 'test failed' (or are missing when the output was cut).
const ISOLATION_HINT =
  'in the default test isolation a module-level error is printed outside the failure blocks: keep the whole output and rerun with --test-isolation=none, which puts the error in the block';
const PLACEHOLDER_BODY = /^'test failed'$/u;

// Vitest default reporter: `Test Files`/`Tests` summary, ` FAIL  <file> > <title>` failure headers inside the
// `⎯ Failed Tests n ⎯`/`⎯ Failed Suites n ⎯` sections, and `⎯⎯[i/n]⎯` separators between error bodies.
const VITEST_SUMMARY = /^Tests {2}(?<result>.+)$/u;
const VITEST_FAILED = /^FAIL {2}(?<title>.+)$/u;
const VITEST_MARKER = /^(?:Test Files {2}|Tests {2}|FAIL {2})/u;
const VITEST_BLOCK_END = /^(?:⎯|FAIL {2}|Test Files {2}|Tests {2})/u;
// Tree lines (`❯ file`, `× title`, `✓ title`, `↓ title`), the error location and code frame (`❯ file:line`,
// `1| source`, `| ^`), separators and summary lines are titles, source or counts, not failure reasons.
const VITEST_RESULT_LINE =
  /^(?:[❯×✓↓→] |⎯|\d+\||\||FAIL {2}|PASS {2}|RUN {2}|Test Files {2}|Tests {2}|Start at {2}|Duration {2})/u;

export const UNEXPECTED_SIGNATURES = [
  ['SyntaxError', /SyntaxError/u],
  ['ERR_MODULE_NOT_FOUND', /ERR_MODULE_NOT_FOUND/u],
  ['Cannot find module or package', /Cannot find (?:module|package)/u],
  ['ReferenceError', /ReferenceError/u],
  ['does not provide an export', /does not provide an export/u],
  ['ENOENT', /ENOENT/u],
];

// Failure blocks: in the spec reporter only the `✖ failing tests:` section carries error bodies, so blocks are read
// there; a log without that section has blocks from every `✖` line, whose bodies are then empty and fail the check.
function nodeBlocks(lines) {
  const section = lines.findIndex((line) => FAILING_SECTION.test(line.trim()));
  const blocks = [];
  for (let index = section + 1; index < lines.length; index += 1) {
    const match = FAILED.exec(lines[index].trim());
    if (!match || FAILING_SECTION.test(lines[index].trim())) continue;
    const body = [];
    let next = index + 1;
    while (next < lines.length && !RESULT_LINE.test(lines[next].trim())) body.push(lines[next++]);
    blocks.push({ line: index + 1, title: match.groups.title, body });
    index = next - 1;
  }
  return blocks;
}

// Vitest failure blocks: each ` FAIL ` header with the error body after it; consecutive headers share one body (the
// same error for several tests). Location and code frame lines are left out of the body.
function vitestBlocks(lines) {
  const blocks = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (!VITEST_FAILED.test(lines[index].trim())) continue;
    const headers = [];
    while (index < lines.length && VITEST_FAILED.test(lines[index].trim())) {
      headers.push({
        line: index + 1,
        title: VITEST_FAILED.exec(lines[index].trim()).groups.title,
      });
      index += 1;
    }
    const body = [];
    while (index < lines.length && !VITEST_BLOCK_END.test(lines[index].trim())) {
      if (!VITEST_RESULT_LINE.test(lines[index].trim())) body.push(lines[index]);
      index += 1;
    }
    for (const header of headers) blocks.push({ ...header, body });
    index -= 1;
  }
  return blocks;
}

const FORMATS = {
  'node-test': {
    summary(lines) {
      const at = lines.findLastIndex((line) => FAIL_SUMMARY.test(line.trim()));
      if (at < 0) return { at, fail: null };
      return { at, fail: Number(FAIL_SUMMARY.exec(lines[at].trim()).groups.count) };
    },
    missing: 'no `ℹ fail <n>` summary line',
    noBlocks: (fail) => `ℹ fail ${fail} without ✖ blocks; ${ISOLATION_HINT}`,
    blocks: nodeBlocks,
    resultLine: RESULT_LINE,
  },
  vitest: {
    summary(lines) {
      const at = lines.findLastIndex((line) => VITEST_SUMMARY.test(line.trim()));
      if (at < 0) return { at, fail: null };
      const failed = /(?<count>\d+) failed/u.exec(
        VITEST_SUMMARY.exec(lines[at].trim()).groups.result,
      );
      return { at, fail: failed ? Number(failed.groups.count) : 0 };
    },
    missing: 'no `Tests` summary line',
    noBlocks: (fail) => `Tests ${fail} failed without FAIL blocks`,
    blocks: vitestBlocks,
    resultLine: VITEST_RESULT_LINE,
  },
};

function detectFormat(lines) {
  if (lines.some((line) => FAIL_SUMMARY.test(line.trim()) || line.trim().startsWith('✖ ')))
    return 'node-test';
  if (lines.some((line) => VITEST_MARKER.test(line.trim()))) return 'vitest';
  throw new InputError(
    'unsupported log: neither node --test spec reporter markers (`✖`, `ℹ fail`) nor Vitest default reporter markers (`FAIL `, `Tests `, `Test Files `)',
  );
}

export function checkRedReason({ text, expect }) {
  const lines = splitLines(text.replace(ANSI, ''));
  const format = detectFormat(lines);
  const reporter = FORMATS[format];
  const { at: failLine, fail } = reporter.summary(lines);
  const expected = (line) => expect.some((pattern) => pattern.test(line));
  const violations = [];
  if (fail === null)
    violations.push({ line: 0, kind: 'missing-summary', detail: reporter.missing });
  else if (fail === 0)
    violations.push({ line: failLine + 1, kind: 'no-failure', detail: lines[failLine].trim() });

  const blocks = reporter.blocks(lines);
  if (fail > 0 && blocks.length === 0)
    violations.push({
      line: failLine + 1,
      kind: 'no-failure-blocks',
      detail: reporter.noBlocks(fail),
    });
  for (const block of blocks)
    if (!block.body.some(expected)) {
      const said = block.body.map((line) => line.trim()).filter(Boolean);
      const placeholder = said.length > 0 && said.every((line) => PLACEHOLDER_BODY.test(line));
      violations.push({
        line: block.line,
        kind: 'unexpected-reason',
        test: block.title,
        detail: `no line of the error block matches --expect${placeholder ? `; the block only says 'test failed': ${ISOLATION_HINT}` : ''}`,
      });
    }

  lines.forEach((line, index) => {
    if (reporter.resultLine.test(line.trim()) || expected(line)) return;
    const signature = UNEXPECTED_SIGNATURES.find(([, pattern]) => pattern.test(line));
    if (signature)
      violations.push({
        line: index + 1,
        kind: 'unexpected-signature',
        signature: signature[0],
        detail: line.trim(),
      });
  });
  violations.sort((left, right) => left.line - right.line);
  return {
    format,
    summary: { fail, failures: blocks.length, violations: violations.length },
    violations,
  };
}

function parseOptions(argv) {
  try {
    return parseArgs({
      args: argv,
      options: {
        log: { type: 'string' },
        expect: { type: 'string', multiple: true },
        json: { type: 'boolean' },
      },
    }).values;
  } catch (error) {
    throw new InputError(error.message);
  }
}

function readLog(path) {
  let text;
  try {
    text = readFileSync(path, 'utf8');
  } catch (error) {
    throw new InputError(`${path}: ${error.message}`);
  }
  if (!text.trim()) throw new InputError(`${path}: empty log`);
  return text;
}

function format(result) {
  const lines = result.violations.map(
    ({ line, kind, test, signature, detail }) =>
      `${line}\t${kind}\t${test ?? signature ?? ''}\t${detail}`,
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
    if (!values.log || !values.expect?.length)
      throw new InputError(
        'usage: red-reason-check --log <file> --expect <regex> [--expect <regex>...] [--json]',
      );
    const expect = values.expect.map((source) => {
      let pattern;
      try {
        pattern = new RegExp(source, 'u');
      } catch (caught) {
        throw new InputError(`--expect ${source}: ${caught.message}`);
      }
      // A pattern matching the empty string matches every line and would expect any failure.
      if (pattern.test(''))
        throw new InputError(`--expect ${JSON.stringify(source)} matches the empty string`);
      return pattern;
    });
    const result = checkRedReason({ text: readLog(resolve(cwd, values.log)), expect });
    log(values.json ? JSON.stringify(result, null, 2) : format(result));
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
