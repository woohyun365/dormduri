// Plan impact spec remap: moves the line numbers a plan-impact spec cites from the revision it was written against
// (`--from`) to a later commit (`--to`) or the working tree, using `git diff -U0` hunks. Rows whose lines changed or
// whose file is gone are dropped; contract line ranges and regression line lists shrink to the lines that remain
// (narrowed). Every row is listed in the output, so the Parent can put back what it still needs; scanned lines that
// changed come back as unclassified in the next plan:impact run. The spec format is readSpec() in plan-impact.mjs.
// Procedure: docs/development/troubleshooting/tooling/agent-plan-impact-inventory-misses.md
//
// Usage: node scripts/agents/common/plan-impact-remap.mjs --spec <dir> --from <rev> [--to <rev>] --out <dir>
//        [--root <repo>]
// Output: `<spec file>\t<old key>\t<moved|kept|narrowed|dropped>\t<new key or reason>` per row, then
// `moved <n> kept <n> narrowed <n> dropped <n>`. A narrowed row names its new key and the removed old lines. Exit 0
// even when rows are dropped or narrowed; exit 2 without creating `--out` for input errors (a missing or unknown
// option, a non-empty `--out`, a spec readSpec() rejects, a row plan:impact reads as malformed, an unknown revision,
// a path missing from `--from`, a line past the end of the `--from` file, a malformed hunk header).

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

import { splitLines } from './plan-impact-blocks.mjs';
import { expandLines, readSpec, toPosix } from './plan-impact.mjs';

class InputError extends Error {}

const HUNK = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/u;
// Every setting that could change the hunks is pinned on the command line. diff.autoRefreshIndex=false keeps a
// working-tree diff from rewriting the index stat cache, which --no-optional-locks alone does not prevent.
const DIFF = [
  '--no-optional-locks',
  '--literal-pathspecs',
  '-c',
  'diff.autoRefreshIndex=false',
  'diff',
  '-U0',
  '--inter-hunk-context=0',
  '--text',
  '--no-color',
  '--no-renames',
  '--no-relative',
  '--diff-algorithm=myers',
  '--no-ext-diff',
  '--no-textconv',
];
const USAGE =
  'usage: plan-impact-remap --spec <dir> --from <rev> [--to <rev>] --out <dir> [--root <repo>]';
const ACTIONS = ['moved', 'kept', 'narrowed', 'dropped'];

// Old line -> new line for one file's `-U0` diff; changed or removed old lines map to null. In `@@ -a,b +c,d @@` a
// missing count is 1. With b > 0 old lines a..a+b-1 are gone and later lines shift by d-b; with b = 0 the d new lines
// follow old line a (a = 0: the start of the file), so line a stays and later lines shift by d.
export function lineMap(diffText) {
  const hunks = [];
  for (const line of splitLines(diffText)) {
    if (!line.startsWith('@@')) continue;
    const match = HUNK.exec(line);
    if (!match) throw new InputError(`malformed hunk header: ${line}`);
    hunks.push({
      start: Number(match[1]),
      count: Number(match[2] ?? 1),
      added: Number(match[4] ?? 1),
    });
  }
  return (line) => {
    let shift = 0;
    for (const { start, count, added } of hunks) {
      if (count > 0) {
        const last = start + count - 1;
        if (line >= start && line <= last) return null;
        if (line > last) shift += added - count;
      } else if (line > start) shift += added;
    }
    return line + shift;
  };
}

function isFile(path) {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

// Sorted, de-duplicated lines as `N`, `N-M` and commas.
function lineList(lines) {
  const runs = [];
  for (const line of [...new Set(lines)].sort((a, b) => a - b)) {
    const run = runs.at(-1);
    if (run && line === run[1] + 1) run[1] = line;
    else runs.push([line, line]);
  }
  return runs.map(([a, b]) => (a === b ? `${a}` : `${a}-${b}`)).join(',');
}

// Git reads for the cited paths: line counts and contents come from `--from`, hunks from `--from` against `--to` or
// the working tree. Paths are relative to the root, as in plan:impact.
function revisionFiles(root, from, to) {
  const git = (args) =>
    execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 1 << 28,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  const commit = (rev, option) => {
    if (typeof rev !== 'string' || !rev || rev.startsWith('-')) {
      throw new InputError(`${option}: not a revision: ${rev}`);
    }
    try {
      return git(['rev-parse', '--verify', '--quiet', `${rev}^{commit}`]).trim();
    } catch {
      throw new InputError(`${option}: unknown revision: ${rev}`);
    }
  };
  const fromCommit = commit(from, '--from');
  const toCommit = to === undefined || to === null ? null : commit(to, '--to');
  const objectType = (rev, path) => {
    try {
      return git(['cat-file', '-t', `${rev}:./${path}`]).trim();
    } catch {
      return null;
    }
  };
  const gone = new Map();
  const deleted = (path) => {
    if (!gone.has(path)) {
      gone.set(
        path,
        toCommit ? objectType(toCommit, path) !== 'blob' : !isFile(resolve(root, path)),
      );
    }
    return gone.get(path);
  };
  const sources = new Map();
  const source = (path) => {
    if (!sources.has(path)) {
      if (objectType(fromCommit, path) !== 'blob') {
        throw new InputError(`path not in --from ${from}: ${path}`);
      }
      const count = splitLines(git(['cat-file', 'blob', `${fromCommit}:./${path}`])).length;
      const map = deleted(path)
        ? () => null
        : lineMap(git([...DIFF, fromCommit, ...(toCommit ? [toCommit] : []), '--', path]));
      sources.set(path, { count, map });
    }
    return sources.get(path);
  };
  // Old lines with their new line (null when changed or deleted).
  const mapLines = (path, lines, where) => {
    const { count, map } = source(path);
    const outside = lines.find((line) => line > count);
    if (outside !== undefined) {
      throw new InputError(`${where}: line ${outside} is past the end of ${path} in --from`);
    }
    return lines.map((line) => ({ old: line, next: map(line) }));
  };
  return { deleted, mapLines };
}

function malformed(where) {
  return new InputError(`${where} malformed`);
}

function lines(spec, where) {
  try {
    return expandLines(spec);
  } catch {
    throw malformed(where);
  }
}

function dropped(files, path) {
  return { action: 'dropped', value: files.deleted(path) ? 'deleted' : 'changed' };
}

// rows/*.tsv and overrides.tsv: `path:line<TAB>class<TAB>reason`.
function remapLineRow(files, cells, where) {
  const [key] = cells;
  if (cells.length !== 3 || !/^.+:[1-9]\d*$/u.test(toPosix(key))) throw malformed(where);
  const at = key.lastIndexOf(':');
  const path = toPosix(key.slice(0, at));
  const [{ old, next }] = files.mapLines(path, [Number(key.slice(at + 1))], where);
  if (next === null) return { key, ...dropped(files, path) };
  if (next === old) return { key, action: 'kept', value: key, cells };
  const moved = `${key.slice(0, at)}:${next}`;
  return { key, action: 'moved', value: moved, cells: [moved, ...cells.slice(1)] };
}

// additional/*.tsv: `path:lines<TAB>class<TAB>reason`; the row moves only when every line remains.
function remapAdditional(files, cells, where) {
  const [key] = cells;
  const match = cells.length === 3 ? /^(.+?):([\d,-]+)$/u.exec(key) : null;
  if (!match) throw malformed(where);
  const path = toPosix(match[1]);
  const mapped = files.mapLines(path, lines(match[2], where), where);
  if (mapped.some(({ next }) => next === null)) return { key, ...dropped(files, path) };
  if (mapped.every(({ old, next }) => old === next))
    return { key, action: 'kept', value: key, cells };
  const moved = `${match[1]}:${lineList(mapped.map(({ next }) => next))}`;
  return { key, action: 'moved', value: moved, cells: [moved, ...cells.slice(1)] };
}

// contract-targets.tsv: a `path:N` or `path:N-M` selector shrinks to the first..last remaining line. Path and
// `path#Heading` selectors carry no line numbers; they stay unless the file is gone. Selector parsing follows
// plan:impact: the path ends at the first `:` or `#`, and `#` makes a heading selector.
function remapContract(files, cells, where) {
  const [selector] = cells;
  const path = toPosix(selector.split(/[:#]/u, 1)[0]);
  if (selector.includes('#') || !selector.includes(':')) {
    if (files.deleted(path)) return { key: selector, action: 'dropped', value: 'deleted' };
    return { key: selector, action: 'kept', value: selector, cells };
  }
  const prefix = selector.slice(0, selector.indexOf(':'));
  const range = selector.slice(selector.indexOf(':') + 1);
  if (range.includes(',')) throw malformed(where);
  const mapped = files.mapLines(path, lines(range, where), where);
  const remaining = mapped.filter(({ next }) => next !== null);
  if (!remaining.length) return { key: selector, ...dropped(files, path) };
  const first = remaining[0];
  const last = remaining.at(-1);
  const removed = mapped
    .filter(({ old, next }) => next === null && (old < first.old || old > last.old))
    .map(({ old }) => old);
  const next = `${prefix}:${first.next === last.next ? first.next : `${first.next}-${last.next}`}`;
  const cellsNext = [next, ...cells.slice(1)];
  if (removed.length) {
    return {
      key: selector,
      action: 'narrowed',
      value: `${next} removed ${lineList(removed)}`,
      cells: cellsNext,
    };
  }
  if (first.next === mapped[0].old && last.next === mapped.at(-1).old) {
    return { key: selector, action: 'kept', value: selector, cells };
  }
  return { key: selector, action: 'moved', value: next, cells: cellsNext };
}

// regression.tsv: `path<TAB>lines<TAB>class<TAB>reason`; the line list keeps the lines that remain.
function remapRegression(files, cells, where) {
  if (cells.length < 2) throw malformed(where);
  const [pathText, spec] = cells;
  const key = `${pathText}:${spec}`;
  const path = toPosix(pathText);
  const mapped = files.mapLines(path, lines(spec, where), where);
  const remaining = mapped.filter(({ next }) => next !== null);
  if (!remaining.length) return { key, ...dropped(files, path) };
  const list = lineList(remaining.map(({ next }) => next));
  const cellsNext = [pathText, list, ...cells.slice(2)];
  if (remaining.length < mapped.length) {
    const removed = lineList(mapped.filter(({ next }) => next === null).map(({ old }) => old));
    return {
      key,
      action: 'narrowed',
      value: `${pathText}:${list} removed ${removed}`,
      cells: cellsNext,
    };
  }
  if (mapped.every(({ old, next }) => old === next))
    return { key, action: 'kept', value: key, cells };
  return { key, action: 'moved', value: `${pathText}:${list}`, cells: cellsNext };
}

// The five line-bound inputs; any other spec file is copied unchanged.
function handlerFor(file) {
  if (/^rows\/[^/]+\.tsv$/u.test(file) || file === 'overrides.tsv') return remapLineRow;
  if (/^additional\/[^/]+\.tsv$/u.test(file)) return remapAdditional;
  if (file === 'contract-targets.tsv') return remapContract;
  if (file === 'regression.tsv') return remapRegression;
  return null;
}

function specFiles(directory, base = directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = resolve(directory, name);
    if (statSync(path).isDirectory()) return specFiles(path, base);
    return [relative(base, path).split(sep).join('/')];
  });
}

// Lines with their terminators, so rows that stay are copied byte for byte. Blank lines, `#` comments and the `TOTAL`
// summary line are not rows, as in plan:impact.
function remapTable(files, file, text, handler) {
  const entries = [];
  let output = '';
  text
    .split(/(?<=\n)/u)
    .filter(Boolean)
    .forEach((piece, index) => {
      const body = piece.replace(/\r?\n$/u, '');
      const eol = piece.slice(body.length);
      if (!body.trim() || body.startsWith('#') || body.startsWith('TOTAL')) {
        output += piece;
        return;
      }
      const result = handler(files, body.split('\t'), `${file}:${index + 1}`);
      entries.push({ file, key: result.key, action: result.action, value: result.value });
      if (result.action !== 'dropped') output += `${result.cells.join('\t')}${eol}`;
    });
  return { entries, output };
}

function checkOut(outDirectory) {
  if (!existsSync(outDirectory)) return;
  if (!statSync(outDirectory).isDirectory() || readdirSync(outDirectory).length) {
    throw new InputError(`--out must be a new or empty directory: ${outDirectory}`);
  }
}

// Reads and remaps everything in memory first; `--out` is written only when no input error was found.
export function remapSpec({ root, specDirectory, from, to, outDirectory }) {
  checkOut(outDirectory);
  try {
    readSpec(specDirectory);
  } catch (caught) {
    throw new InputError(`spec ${specDirectory}: ${caught.message}`);
  }
  const files = revisionFiles(root, from, to);
  const entries = [];
  const writes = [];
  for (const file of specFiles(specDirectory).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))) {
    const source = resolve(specDirectory, file);
    const handler = handlerFor(file);
    if (!handler) {
      writes.push([file, readFileSync(source)]);
      continue;
    }
    const table = remapTable(files, file, readFileSync(source, 'utf8'), handler);
    entries.push(...table.entries);
    writes.push([file, table.output]);
  }
  mkdirSync(outDirectory, { recursive: true });
  for (const [file, content] of writes) {
    const target = resolve(outDirectory, file);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content);
  }
  return { entries };
}

function parseArgs(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === '--') continue;
    const name = flag.slice(2);
    if (
      !['--spec', '--from', '--to', '--out', '--root'].includes(flag) ||
      argv[i + 1] === undefined ||
      name in options
    ) {
      throw new InputError(`${USAGE} (got ${flag})`);
    }
    options[name] = argv[i + 1];
    i += 1;
  }
  if (!options.spec || !options.from || !options.out) throw new InputError(USAGE);
  return options;
}

export function main(argv, { cwd = process.cwd(), log = console.log, error = console.error } = {}) {
  let result;
  try {
    const options = parseArgs(argv);
    result = remapSpec({
      root: resolve(cwd, options.root ?? '.'),
      specDirectory: resolve(cwd, options.spec),
      from: options.from,
      to: options.to,
      outDirectory: resolve(cwd, options.out),
    });
  } catch (caught) {
    error(caught.message);
    return 2;
  }
  const counts = Object.fromEntries(ACTIONS.map((action) => [action, 0]));
  for (const { file, key, action, value } of result.entries) {
    counts[action] += 1;
    log(`${file}\t${key}\t${action}\t${value}`);
  }
  log(ACTIONS.map((action) => `${action} ${counts[action]}`).join(' '));
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
