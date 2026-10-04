// Citation check: backtick `path:line[-line]` citations in Markdown must name a file and a line range that exist now,
// and an optional `~ "text"` right after a citation must appear in the cited lines.
// Rules and usage: docs/development/agent-workflows/review-criteria/README.md
//
// Usage: node scripts/agents/common/citation-check.mjs [--root <repo>] [--json] <md file...>
// Exit 0 = no violation, 1 = violations, 2 = input error (no file, missing, unreadable, empty or non-Markdown file,
// unknown option, root outside a git repository). Input errors never count as a pass.

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { isAbsolute, posix, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

import { splitLines } from './plan-impact-blocks.mjs';
import { lineCount, toPosix, trackedFiles } from './plan-impact.mjs';

class InputError extends Error {}

const CANDIDATE = /^(?<target>[^\s:]+):(?<start>\d+)(?:-(?<end>\d+))?$/u;
const EXPECTATION = /^\s*~\s*"/u;
// Any indentation: fences inside nested list items are indented past the CommonMark 3-space limit.
const FENCE = /^\s*(?<fence>`{3,}|~{3,})/u;
// `path.ext:N` outside code spans or inside a span of another shape (`path.ext:3:5`, `see path.ext:3`): counted only.
const BARE = /(?<![\w./@-])(?<target>[\w./@-]*[\w@-]\.[A-Za-z0-9]+):\d+(?:-\d+)?(?![\w-])/gu;

function isFile(path) {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

// Case-insensitive file systems would accept `SRC/Tool.mjs`; compare every segment with the directory listing so the
// result does not depend on the OS. Paths outside the root get the plain existence check only.
function existsWithCase(root, path) {
  const absolute = resolve(root, path);
  if (!existsSync(absolute)) return false;
  const inside = relative(root, absolute);
  if (!inside || isAbsolute(inside) || inside.split(/[\\/]/u)[0] === '..') return true;
  let directory = root;
  for (const segment of inside.split(/[\\/]/u)) {
    if (!readdirSync(directory).includes(segment)) return false;
    directory = resolve(directory, segment);
  }
  return true;
}

// CommonMark code spans on one line: a backtick run closes at the next run of the same length.
export function codeSpans(line) {
  const spans = [];
  let index = 0;
  while (index < line.length) {
    const open = line.indexOf('`', index);
    if (open < 0) break;
    let width = 1;
    while (line[open + width] === '`') width += 1;
    let search = open + width;
    let close = -1;
    while (search < line.length) {
      const next = line.indexOf('`', search);
      if (next < 0) break;
      let run = 1;
      while (line[next + run] === '`') run += 1;
      if (run === width) {
        close = next;
        break;
      }
      search = next + run;
    }
    if (close < 0) {
      index = open + width;
      continue;
    }
    let content = line.slice(open + width, close);
    if (content.length > 2 && content.startsWith(' ') && content.endsWith(' ') && content.trim())
      content = content.slice(1, -1);
    spans.push({ start: open, end: close + width, content });
    index = close + width;
  }
  return spans;
}

// `~ "text"` after a citation: backslash escapes `"` and `\`. Returns null when there is no expectation.
function expectation(rest) {
  const match = EXPECTATION.exec(rest);
  if (!match) return null;
  let text = '';
  for (let i = match[0].length; i < rest.length; i += 1) {
    const char = rest[i];
    if (char === '\\' && i + 1 < rest.length) {
      text += rest[i + 1];
      i += 1;
    } else if (char === '"') return text ? { text } : { error: 'empty expectation' };
    else text += char;
  }
  return { error: 'unterminated expectation' };
}

function resolveTarget(root, target, tracked) {
  if (existsWithCase(root, target) && isFile(resolve(root, target)))
    return { method: 'exact', path: toPosix(target) };
  const hits = tracked.filter((path) => path === target || path.endsWith(`/${target}`));
  if (hits.length === 1) return { method: 'suffix', path: hits[0] };
  return { error: hits.length ? 'ambiguous' : 'unresolved', hits };
}

function checkCitation(root, tracked, cited) {
  const { target, start, end, rest } = cited;
  const resolved = resolveTarget(root, target, tracked);
  if (resolved.error)
    return {
      kind: resolved.error,
      detail: resolved.hits.length ? `matches ${resolved.hits.join(', ')}` : 'no such file',
    };
  const result = { method: resolved.method, path: resolved.path };
  if (start < 1 || end < start)
    return { ...result, kind: 'invalid-range', detail: 'lines start at 1 and end >= start' };
  const count = lineCount(root, resolved.path);
  if (count === null)
    return { ...result, kind: 'unreadable', detail: `${resolved.path} is not a text file` };
  if (end > count)
    return { ...result, kind: 'out-of-range', detail: `${resolved.path} has ${count} lines` };
  const expected = expectation(rest);
  if (!expected) return result;
  if (expected.error) return { ...result, kind: 'invalid-expectation', detail: expected.error };
  const lines = splitLines(readFileSync(resolve(root, resolved.path), 'utf8')).slice(
    start - 1,
    end,
  );
  if (lines.join('\n').includes(expected.text)) return { ...result, contentChecked: true };
  return {
    ...result,
    contentChecked: true,
    kind: 'content-mismatch',
    detail: `"${expected.text}" not in ${resolved.path}:${start}${end === start ? '' : `-${end}`}`,
  };
}

export function checkCitations({ root, files, tracked = trackedFiles(root) }) {
  const extensions = new Set(tracked.map((path) => posix.extname(path).slice(1)).filter(Boolean));
  const summary = {
    files: files.length,
    citations: 0,
    exact: 0,
    suffix: 0,
    contentChecks: 0,
    violations: 0,
    notCitations: 0,
    unchecked: 0,
  };
  const violations = [];
  for (const { display, text } of files) {
    let fence = null;
    splitLines(text).forEach((line, index) => {
      const marker = FENCE.exec(line)?.groups.fence;
      if (fence) {
        if (
          marker &&
          marker[0] === fence[0] &&
          marker.length >= fence.length &&
          !line.slice(line.indexOf(marker) + marker.length).trim()
        )
          fence = null;
        return;
      }
      if (marker) {
        fence = marker;
        return;
      }
      const spans = codeSpans(line);
      let outside = line;
      for (const span of spans) {
        const match = CANDIDATE.exec(span.content);
        if (!match) continue;
        outside =
          outside.slice(0, span.start) +
          ' '.repeat(span.end - span.start) +
          outside.slice(span.end);
        const { target } = match.groups;
        const extension = posix.extname(target).slice(1);
        if (!extension || !(existsWithCase(root, target) || extensions.has(extension))) {
          summary.notCitations += 1;
          continue;
        }
        summary.citations += 1;
        const start = Number(match.groups.start);
        const end = Number(match.groups.end ?? match.groups.start);
        const checked = checkCitation(root, tracked, {
          target,
          start,
          end,
          rest: line.slice(span.end),
        });
        if (checked.method) summary[checked.method] += 1;
        if (checked.contentChecked) summary.contentChecks += 1;
        if (checked.kind)
          violations.push({
            file: display,
            line: index + 1,
            citation: span.content,
            kind: checked.kind,
            detail: checked.detail,
          });
      }
      for (const bare of outside.matchAll(BARE)) {
        const extension = posix.extname(bare.groups.target).slice(1);
        if (extensions.has(extension) || existsWithCase(root, bare.groups.target))
          summary.unchecked += 1;
      }
    });
  }
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

function realRoot(path) {
  try {
    return realpathSync(path);
  } catch {
    throw new InputError(`${path}: no such directory`);
  }
}

function readInputs(cwd, root, paths) {
  if (!paths.length)
    throw new InputError('usage: citation-check [--root <repo>] [--json] <md file...>');
  return paths.map((path) => {
    if (!/\.md$/iu.test(path)) throw new InputError(`${path}: not a Markdown file`);
    if (!isFile(resolve(cwd, path))) throw new InputError(`${path}: no such file`);
    const absolute = realpathSync(resolve(cwd, path));
    let text;
    try {
      text = readFileSync(absolute, 'utf8');
    } catch (error) {
      throw new InputError(`${path}: ${error.message}`);
    }
    if (!text.trim()) throw new InputError(`${path}: empty file`);
    const inside = relative(root, absolute);
    const display =
      inside && !inside.startsWith('..') && !isAbsolute(inside)
        ? toPosix(inside)
        : toPosix(absolute);
    return { display, text };
  });
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
    ({ file, line, kind, citation, detail }) => `${file}:${line}\t${kind}\t${citation}\t${detail}`,
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
    // Real paths on both sides: git prints resolved paths (macOS `/var` is `/private/var`).
    const root = realRoot(values.root ? resolve(cwd, values.root) : gitRoot(cwd));
    let tracked;
    try {
      tracked = trackedFiles(root);
    } catch {
      throw new InputError(`${root}: git ls-files failed; --root must be inside a git repository`);
    }
    const files = readInputs(cwd, root, positionals);
    const result = checkCitations({ root, files, tracked });
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
