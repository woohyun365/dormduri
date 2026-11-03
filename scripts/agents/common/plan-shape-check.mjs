// Plan shape warnings: a header longer than 4,000 characters, a Status line longer than 600 characters, bullets
// nested under the Status line and table rows whose date is followed by a change mark or a decision id. The warnings
// are advisory (exit 0); the plan staging and promote procedure runs this on changed plan files.
// Revision grades: `--revision` grades every changed line of a plan revision (P0 mechanical, P1 added record, P2
// contract change) and prints the minimum review grade of each document; P3 is only ever declared. A declared grade
// below the highest minimum is `grade-below-minimum` (exit 1). The Parent may declare higher, never lower.
// Procedure and grade rules: docs/development/agent-workflows/session-continuity.md
//
// Usage: node scripts/agents/common/plan-shape-check.mjs [--json] <plan md...>
//        node scripts/agents/common/plan-shape-check.mjs [--json] --revision <before.md|-> <after.md>
//          [--revision ...] --declared <P0|P1|P2|P3>
// Output: `<file>:<line>\t<kind>\t<value>` per warning and `files <n> warnings <n>`, or one JSON object with `--json`.
// Revision output: `<after>: minimum <grade> (...)`, then `<file>:<line>\t<grade>\t<kind>\t<heading>` for each line at
// that minimum (a deleted line names the before file), then `declared <grade> minimum <grade> ok|grade-below-minimum`;
// `--json` prints one object with every changed line. `-` as the before file is a new document.
// Exit 0 with or without warnings and for a declared grade at or above the minimum, 1 for `grade-below-minimum`; exit 2
// without output for input errors (no file, a missing path, a directory, an empty file, a file not ending in `.md`, an
// unknown option or grade, `--revision` without exactly one `--declared` or mixed with plain files).

import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { markdownHeadingLines, splitLines } from './plan-impact-blocks.mjs';

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

export const GRADES = ['P0', 'P1', 'P2', 'P3'];
const rank = (grade) => GRADES.indexOf(grade);
const highest = (grades) =>
  grades.reduce((top, grade) => (rank(grade) > rank(top) ? grade : top), 'P0');

const REVISION_HISTORY = /^## 개정 이력\s*$/u;
const EXPLORATION_ROUND = '탐색 회차';
// A line added under the nearest heading whose text holds one of these is a contract change (P2).
const CONTRACT_WORDS = [
  'contract',
  'Owned',
  'owned',
  'RED',
  'Acceptance',
  '결정',
  'Phase',
  '순서',
  '선행',
  '멈춤',
  '범위',
  '규칙',
  '목표',
  'Open Questions',
];
const HEADER_KEY = /^ {0,3}-\s*(?:Parent|선행|선후행):/u;
const ALIGNMENT_ROW = /^\s*\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)*\|?\s*$/u;
const LINK = /\[([^\]]*)\]\(([^()\s]*)\)/gu;
const UNCHECKED_ITEM = /^(\s*(?:[-*+]|\d+[.)])\s+)\[ \]/u;

function planModel(text) {
  const lines = splitLines(text);
  const prose = proseLines(lines);
  const headerEnd = prose.find((index) => HEADER_END.test(lines[index])) ?? lines.length;
  return {
    lines,
    headerEnd,
    status: prose.find((index) => index < headerEnd && STATUS.test(lines[index])),
    headings: markdownHeadingLines(lines).map((line) => line - 1),
  };
}

// The nearest heading at or above a line (a heading line is in its own section); null before the first heading.
function sectionOf(model, index) {
  let section = null;
  for (const heading of model.headings) {
    if (heading > index) break;
    section = heading;
  }
  return section;
}
const headingText = (model, section) =>
  section === null ? '' : model.lines[section].replace(/^#+\s*/u, '').trim();
const headingLabel = (model, section) => (section === null ? '-' : model.lines[section].trim());
const inHistory = (model, index) => {
  const section = sectionOf(model, index);
  return section !== null && REVISION_HISTORY.test(model.lines[section]);
};

// Cells split on `|` not escaped as `\|`; the outer pipes are dropped.
function cells(row) {
  let text = row.trim();
  if (text.startsWith('|')) text = text.slice(1);
  if (text.endsWith('|') && !text.endsWith('\\|')) text = text.slice(0, -1);
  return text.split(/(?<!\\)\|/u).map((cell) => cell.trim());
}

// Header cells of the table whose body (below the alignment row) holds the line, or null.
function tableHeader(model, index) {
  const { lines } = model;
  const row = (at) => at >= 0 && TABLE_ROW.test(lines[at]);
  if (!row(index)) return null;
  let start = index;
  while (row(start - 1)) start -= 1;
  if (index < start + 2 || !ALIGNMENT_ROW.test(lines[start + 1])) return null;
  return cells(lines[start]);
}

// Both rows are body rows with the header's cell count, and every changed cell is under a header `column` accepts.
function onlyColumnChanged(before, removed, after, added, column) {
  const header = tableHeader(after, added);
  if (!header || !tableHeader(before, removed)) return false;
  const next = cells(after.lines[added]);
  const previous = cells(before.lines[removed]);
  if (next.length !== header.length || previous.length !== header.length) return false;
  const changed = next.flatMap((cell, at) => (cell === previous[at] ? [] : [at]));
  return changed.length > 0 && changed.every((index) => column(header[index]));
}

function linkParts(line) {
  const targets = [];
  const skeleton = line.replace(LINK, (link, text, target) => {
    targets.push(target);
    return `[${text}]()`;
  });
  return { skeleton, targets };
}

// Same text, same link texts, and at least one link target differs.
function onlyLinkTargetsChanged(previous, next) {
  const before = linkParts(previous);
  const after = linkParts(next);
  return (
    before.skeleton === after.skeleton &&
    before.targets.length === after.targets.length &&
    before.targets.some((target, index) => target !== after.targets[index])
  );
}

// A list item whose `[ ]` became `[x]`; the line may only grow at its end (date, PR, evidence).
function checkedOnly(previous, next) {
  const item = UNCHECKED_ITEM.exec(previous);
  return item !== null && next.startsWith(`${item[1]}[x]${previous.slice(item[0].length)}`);
}

// The new line is the old one with Markdown links added: the old links stay in order, and removing the added links
// leaves the old line, a run of whitespace counting as one space.
function onlyLinksInserted(previous, next) {
  const kept = [...previous.matchAll(LINK)].map(([link]) => link);
  let matched = 0;
  let inserted = 0;
  const stripped = next.replace(LINK, (link) => {
    if (matched < kept.length && link === kept[matched]) {
      matched += 1;
      return link;
    }
    inserted += 1;
    return '';
  });
  const collapse = (text) => text.replace(/\s+/gu, ' ');
  return inserted > 0 && matched === kept.length && collapse(stripped) === collapse(previous);
}

// Hunks of a longest-common-subsequence line diff: the removed before lines and added after lines between equal lines.
function lineHunks(before, after) {
  let start = 0;
  while (start < before.length && start < after.length && before[start] === after[start])
    start += 1;
  let beforeEnd = before.length;
  let afterEnd = after.length;
  while (beforeEnd > start && afterEnd > start && before[beforeEnd - 1] === after[afterEnd - 1]) {
    beforeEnd -= 1;
    afterEnd -= 1;
  }
  const rows = beforeEnd - start;
  const width = afterEnd - start + 1;
  const common = new Uint32Array((rows + 1) * width);
  for (let i = rows - 1; i >= 0; i -= 1) {
    for (let j = width - 2; j >= 0; j -= 1) {
      common[i * width + j] =
        before[start + i] === after[start + j]
          ? common[(i + 1) * width + j + 1] + 1
          : Math.max(common[(i + 1) * width + j], common[i * width + j + 1]);
    }
  }
  const hunks = [];
  let hunk = null;
  let i = 0;
  let j = 0;
  while (i < rows || j < width - 1) {
    if (i < rows && j < width - 1 && before[start + i] === after[start + j]) {
      if (hunk) hunks.push(hunk);
      hunk = null;
      i += 1;
      j += 1;
    } else if (
      j >= width - 1 ||
      (i < rows && common[(i + 1) * width + j] >= common[i * width + j + 1])
    ) {
      hunk ??= { removed: [], added: [] };
      hunk.removed.push(start + i);
      i += 1;
    } else {
      hunk ??= { removed: [], added: [] };
      hunk.added.push(start + j);
      j += 1;
    }
  }
  if (hunk) hunks.push(hunk);
  return hunks;
}

// A line added in a hunk without removed lines.
function addedGrade(after, index) {
  if (inHistory(after, index)) return ['P0', 'revision-history'];
  if (index < after.headerEnd && HEADER_KEY.test(after.lines[index])) return ['P2', 'header-key'];
  const text = headingText(after, sectionOf(after, index));
  if (text.includes(EXPLORATION_ROUND)) return ['P0', 'exploration-round'];
  return CONTRACT_WORDS.some((word) => text.includes(word)) ? ['P2', 'added'] : ['P1', 'added'];
}

// A removed line paired, in hunk order, with an added line.
function changedGrade(before, removed, after, added) {
  const previous = before.lines[removed];
  const next = after.lines[added];
  if (inHistory(before, removed) && inHistory(after, added)) return ['P0', 'revision-history'];
  if (removed === before.status && added === after.status) return ['P0', 'status-line'];
  if (onlyColumnChanged(before, removed, after, added, (head) => head === '상태'))
    return ['P0', 'status-cell'];
  if (onlyLinkTargetsChanged(previous, next)) return ['P0', 'link-target'];
  if (checkedOnly(previous, next)) return ['P0', 'checkbox'];
  if (onlyColumnChanged(before, removed, after, added, (head) => head.startsWith('근거')))
    return ['P1', 'evidence-cell'];
  if (onlyLinksInserted(previous, next)) return ['P1', 'link-insert'];
  return ['P2', 'modified'];
}

// Grades every changed line of a revision. `beforeText` null is a new document. A removed line's section is read in
// the before text; in a hunk with both sides, lines pair in order and the lines left over are removed or changed lines.
export function classifyRevision(beforeText, afterText) {
  const after = planModel(afterText);
  const entry = (side, model, index, [grade, kind]) => ({
    side,
    line: index + 1,
    grade,
    kind,
    heading: headingLabel(model, sectionOf(model, index)),
  });
  if (beforeText === null) {
    return { minimum: 'P1', lines: [entry('after', after, 0, ['P1', 'new-document'])] };
  }
  const before = planModel(beforeText);
  const lines = [];
  for (const { removed, added } of lineHunks(before.lines, after.lines)) {
    if (!removed.length) {
      for (const index of added) lines.push(entry('after', after, index, addedGrade(after, index)));
      continue;
    }
    const pairs = Math.min(removed.length, added.length);
    for (let k = 0; k < pairs; k += 1) {
      const grade = changedGrade(before, removed[k], after, added[k]);
      lines.push(entry('after', after, added[k], grade));
    }
    for (const index of removed.slice(pairs)) {
      const grade = inHistory(before, index) ? ['P0', 'revision-history'] : ['P2', 'deleted'];
      lines.push(entry('before', before, index, grade));
    }
    for (const index of added.slice(pairs)) {
      const grade = inHistory(after, index) ? ['P0', 'revision-history'] : ['P2', 'modified'];
      lines.push(entry('after', after, index, grade));
    }
  }
  return { minimum: highest(lines.map(({ grade }) => grade)), lines };
}

const USAGE =
  'usage: plan-shape-check [--json] <plan md...> | [--json] --revision <before.md|-> <after.md> [--revision ...] --declared <P0|P1|P2|P3>';

function parseArgs(argv) {
  const files = [];
  const revisions = [];
  const declared = [];
  let json = false;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--json') json = true;
    else if (arg === '--revision') {
      const pair = argv.slice(index + 1, index + 3);
      if (pair.length < 2 || pair.some((value) => value.startsWith('--')))
        throw new InputError(USAGE);
      revisions.push(pair);
      index += 2;
    } else if (arg === '--declared') {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith('--')) throw new InputError(USAGE);
      declared.push(value);
      index += 1;
    } else if (arg.startsWith('--')) throw new InputError(`unknown option: ${arg}`);
    else files.push(arg);
  }
  if (revisions.length || declared.length) {
    if (!revisions.length || declared.length !== 1 || files.length) throw new InputError(USAGE);
    if (!GRADES.includes(declared[0])) throw new InputError(`unknown grade: ${declared[0]}`);
    return { revisions, declared: declared[0], json };
  }
  if (!files.length) throw new InputError(USAGE);
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

function reportRevisions(results, declared, json, log) {
  const minimum = highest(results.map((result) => result.minimum));
  const below = rank(declared) < rank(minimum);
  const result = below ? 'grade-below-minimum' : 'ok';
  if (json) {
    log(JSON.stringify({ revisions: results, declared, minimum, result }));
    return below ? 1 : 0;
  }
  for (const revision of results) {
    const source = revision.before === '-' ? 'new document' : `before ${revision.before}`;
    log(
      `${revision.after}: minimum ${revision.minimum} (${source}, changed lines ${revision.lines.length})`,
    );
    for (const { side, line, grade, kind, heading } of revision.lines) {
      if (grade !== revision.minimum) continue;
      log(
        `${side === 'before' ? revision.before : revision.after}:${line}\t${grade}\t${kind}\t${heading}`,
      );
    }
  }
  log(`declared ${declared} minimum ${minimum} ${result}`);
  return below ? 1 : 0;
}

export function main(argv, { cwd = process.cwd(), log = console.log, error = console.error } = {}) {
  let options;
  let results;
  try {
    options = parseArgs(argv);
    // Every input is read before anything is printed, so an input error leaves no partial output.
    results = options.revisions
      ? options.revisions.map(([before, after]) => ({
          before,
          after,
          ...classifyRevision(before === '-' ? null : readPlan(cwd, before), readPlan(cwd, after)),
        }))
      : options.files.map((file) => ({
          file,
          warnings: checkPlanShape(readPlan(cwd, file)).warnings,
        }));
  } catch (caught) {
    if (!(caught instanceof InputError)) throw caught;
    error(caught.message);
    return 2;
  }
  if (options.revisions) return reportRevisions(results, options.declared, options.json, log);
  const { json } = options;
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
