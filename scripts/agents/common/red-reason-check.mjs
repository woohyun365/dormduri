// RED reason check: a RED log must fail, every failing test must fail for an expected reason, and no line may carry
// an unexpected failure signature (import, syntax or missing-file errors) unless an expected pattern covers it.
// Rules and usage: docs/development/agent-workflows/review-criteria/README.md
//
// Usage: node scripts/agents/common/red-reason-check.mjs --log <file> --expect <regex> [--expect <regex>...] [--json]
// Supported format: `node --test` spec reporter output. Exit 0 = no violation, 1 = violations, 2 = input error (missing
// option or file, empty log, invalid regex or one matching the empty string, log with neither a `✖` marker nor an
// `ℹ fail` summary, unknown option). Input errors never count as a pass.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

import { splitLines } from './plan-impact-blocks.mjs';

class InputError extends Error {}

const FAIL_SUMMARY = /^ℹ fail (?<count>\d+)$/u;
const FAILING_SECTION = /^✖ failing tests:$/u;
const FAILED = /^✖ (?<title>.*?)(?: \([^()]*\))?$/u;
// Result lines (test titles, suite starts, summary) and `test at <file>` locations end a failure block. Their text is a
// test title, not a failure reason, so neither the reason match nor the signature scan reads them.
const RESULT_LINE = /^(?:[✔✖﹣ℹ▶] |test at )/u;
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
function failureBlocks(lines) {
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

export function checkRedReason({ text, expect }) {
  const lines = splitLines(text);
  const failLine = lines.findLastIndex((line) => FAIL_SUMMARY.test(line.trim()));
  if (failLine < 0 && !lines.some((line) => line.trim().startsWith('✖ ')))
    throw new InputError(
      'unsupported log: neither a `✖` marker nor an `ℹ fail` summary (node --test spec reporter)',
    );
  const expected = (line) => expect.some((pattern) => pattern.test(line));
  const violations = [];
  const fail = failLine < 0 ? null : Number(FAIL_SUMMARY.exec(lines[failLine].trim()).groups.count);
  if (fail === null)
    violations.push({ line: 0, kind: 'missing-summary', detail: 'no `ℹ fail <n>` summary line' });
  else if (fail === 0)
    violations.push({ line: failLine + 1, kind: 'no-failure', detail: 'ℹ fail 0' });

  const blocks = failureBlocks(lines);
  if (fail > 0 && blocks.length === 0)
    violations.push({
      line: failLine + 1,
      kind: 'no-failure-blocks',
      detail: `ℹ fail ${fail} without ✖ blocks`,
    });
  for (const block of blocks)
    if (!block.body.some(expected))
      violations.push({
        line: block.line,
        kind: 'unexpected-reason',
        test: block.title,
        detail: 'no line of the error block matches --expect',
      });

  lines.forEach((line, index) => {
    if (RESULT_LINE.test(line.trim()) || expected(line)) return;
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
  return { summary: { fail, failures: blocks.length, violations: violations.length }, violations };
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
