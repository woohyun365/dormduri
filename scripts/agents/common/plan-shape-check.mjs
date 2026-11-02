// Plan shape warnings: a header longer than 4,000 characters, a Status line longer than 600 characters, bullets
// nested under the Status line and table rows whose date is followed by a change mark or a decision id. The warnings
// are advisory (exit 0); the plan staging and promote procedure runs this on changed plan files.
// Procedure: docs/development/agent-workflows/session-continuity.md
//
// Usage: node scripts/agents/common/plan-shape-check.mjs [--json] <plan md...>
// Output: `<file>:<line>\t<kind>\t<value>` per warning and `files <n> warnings <n>`, or one JSON object with `--json`.
// Exit 0 with or without warnings; exit 2 without output for input errors (no file, a missing path, a directory, an
// empty file, a file not ending in `.md`, an unknown option).

import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { splitLines } from './plan-impact-blocks.mjs';

export const HEADER_LIMIT = 4000;
export const STATUS_LIMIT = 600;

// Fences follow plan-store.mjs and plan-impact-blocks.mjs: a backtick fence's info string cannot hold a backtick.
const FENCE = /^ {0,3}(`{3,}|~{3,})(.*)$/u;
const HEADER_END = /^##\s/u;
const STATUS = /^ {0,3}-\s*(Status|상태):/u;
// Nested bullets are counted until a blank line, a top-level list item (indented by at most one space) or a `#` line.
const TOP_LEVEL_ITEM = /^ ?([-*+]|\d+\.)\s/u;
const SUB_BULLET = /^\s{2,}([-*+]|\d+\.)\s/u;
const TABLE_ROW = /^\s*\|/u;
const DATE_MARK = /\d{4}-\d{2}-\d{2} (주석|추가|개정|변경|보충|정정|갱신|D-[A-Z]+-?\d)/u;

class InputError extends Error {}

// Indexes of the lines outside fenced code.
function proseLines(lines) {
  const prose = [];
  let fence = null;
  lines.forEach((line, index) => {
    const marker = FENCE.exec(line);
    if (fence) {
      if (
        marker &&
        marker[1][0] === fence[0] &&
        marker[1].length >= fence.length &&
        !marker[2].trim()
      ) {
        fence = null;
      }
      return;
    }
    if (marker && !(marker[1][0] === '`' && marker[2].includes('`'))) {
      fence = marker[1];
      return;
    }
    prose.push(index);
  });
  return prose;
}

// The header is every line before the first `## ` line outside fences; lengths are JavaScript string lengths.
export function checkPlanShape(text) {
  const lines = splitLines(text);
  const prose = proseLines(lines);
  const end = prose.find((index) => HEADER_END.test(lines[index])) ?? lines.length;
  const warnings = [];
  const header = lines.slice(0, end).join('\n');
  if (header.length > HEADER_LIMIT) {
    warnings.push({ kind: 'header-length', line: 1, value: header.length });
  }
  const status = prose.find((index) => index < end && STATUS.test(lines[index]));
  if (status !== undefined) {
    if (lines[status].length > STATUS_LIMIT) {
      warnings.push({ kind: 'status-length', line: status + 1, value: lines[status].length });
    }
    for (let index = status + 1; index < end; index += 1) {
      const line = lines[index];
      if (!line.trim() || TOP_LEVEL_ITEM.test(line) || line.startsWith('#')) break;
      if (SUB_BULLET.test(line)) {
        warnings.push({ kind: 'status-sub-bullet', line: index + 1, value: '' });
      }
    }
  }
  for (const index of prose) {
    if (!TABLE_ROW.test(lines[index])) continue;
    const mark = DATE_MARK.exec(lines[index]);
    if (mark) warnings.push({ kind: 'table-date-mark', line: index + 1, value: mark[0] });
  }
  return { warnings };
}

function parseArgs(argv) {
  const files = [];
  let json = false;
  for (const arg of argv) {
    if (arg === '--json') json = true;
    else if (arg.startsWith('--')) throw new InputError(`unknown option: ${arg}`);
    else files.push(arg);
  }
  if (!files.length) throw new InputError('usage: plan-shape-check [--json] <plan md...>');
  return { files, json };
}

function readPlan(cwd, file) {
  if (!file.endsWith('.md')) throw new InputError(`not a Markdown file: ${file}`);
  let stat;
  try {
    stat = statSync(resolve(cwd, file));
  } catch {
    throw new InputError(`no such file: ${file}`);
  }
  if (!stat.isFile()) throw new InputError(`not a file: ${file}`);
  const text = readFileSync(resolve(cwd, file), 'utf8');
  if (!text) throw new InputError(`empty file: ${file}`);
  return text;
}

export function main(argv, { cwd = process.cwd(), log = console.log, error = console.error } = {}) {
  let results;
  let json;
  try {
    const options = parseArgs(argv);
    json = options.json;
    // Every input is read before anything is printed, so an input error leaves no partial output.
    results = options.files.map((file) => ({
      file,
      warnings: checkPlanShape(readPlan(cwd, file)).warnings,
    }));
  } catch (caught) {
    if (!(caught instanceof InputError)) throw caught;
    error(caught.message);
    return 2;
  }
  const count = results.reduce((sum, { warnings }) => sum + warnings.length, 0);
  if (json) {
    log(JSON.stringify({ files: results, summary: { files: results.length, warnings: count } }));
    return 0;
  }
  for (const { file, warnings } of results) {
    for (const { kind, line, value } of warnings) log(`${file}:${line}\t${kind}\t${value}`);
  }
  log(`files ${results.length} warnings ${count}`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (caught) {
    console.error(caught.message);
    process.exitCode = 2;
  }
}
