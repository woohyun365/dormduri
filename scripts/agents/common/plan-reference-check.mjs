// Plan reference check: section (`§N`), open question (`OQ-…`) and `Phase <ID>` references in a plan must resolve in
// the plan itself or, when a target stands right before the reference, in that document; relative links must resolve.
// Grammar: docs/development/agent-workflows/plan-authoring/references.md
//
// Usage: node scripts/agents/common/plan-reference-check.mjs [--root <repo>] [--report-only] [--json] <plan md...>
// Exit 0 = no violation (or --report-only), 1 = violations, 2 = input error (no file, missing, empty or non-Markdown
// file, unknown option, root that is not a directory or, without --root, not in a git repository).

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

import { codeSpans, existsWithCase } from './citation-check.mjs';
import { anchors, decodeTarget, links } from './markdown-links.mjs';
import { splitLines } from './plan-impact-blocks.mjs';

class InputError extends Error {}

const FENCE = /^\s*(?<fence>`{3,}|~{3,})/u;
const HEADING = /^#{1,6}\s+(?<first>\S+)(?:\s+(?<second>\S+))?/u;
const SECTION_NUMBER = /^(?<number>\d+(?:\.\d+)*[a-z]?)\.?$/u;
// A Phase ID has a letter and a digit (`V1c`, `P1`, `CI-4`); generic headings such as `Decision` are not phases, and
// `Phase evidence` or `Phase 1` is not a reference.
const PHASE_ID = /^(?=[^\s]*[A-Za-z])(?=[^\s]*\d)[A-Za-z0-9][A-Za-z0-9.-]*$/u;
const OQ_TOKEN = 'OQ-[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*';
// An OQ is defined at the head of a line: a list item, heading or first table cell, or an unindented line. An indented
// continuation line that starts with an OQ refers to it.
const OQ_DEFINITION = new RegExp(
  `^(?:\\s*(?:[-*+]|\\d+\\.)\\s+|#{1,6}\\s+|\\|\\s*)?(?:~~|\\*\\*)?(?<id>${OQ_TOKEN})`,
  'u',
);
const REFERENCE = new RegExp(
  `§\\s?(?<section>\\d+(?:\\.\\d+)*[a-z]?)|(?<![A-Za-z0-9])(?<oq>${OQ_TOKEN})|(?<![A-Za-z0-9])Phase\\s+(?<phase>(?=[A-Za-z0-9.-]*[A-Za-z])(?=[A-Za-z0-9.-]*\\d)[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?)`,
  'gu',
);
const LINK_BEFORE = /\[[^\]]*\]\((?<target>[^)\s]+)\)\s?$/u;
const CODE_BEFORE = /`(?<target>[^`]+\.md)`\s?$/u;
// A word that ends a sentence (`done. §3`) is not a target.
const WORD_BEFORE = /(?<![\w/.-])(?<word>[A-Za-z0-9](?:[\w.-]*[A-Za-z0-9])?)\s?$/u;

function isFile(path) {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

// Exists with the same case in every path segment, so a case-insensitive file system gives the Linux result.
const present = (root, path) => existsWithCase(root, relative(root, path));

// Lines outside fenced code, with 1-based numbers.
function proseLines(text) {
  let fence = null;
  const result = [];
  splitLines(text).forEach((line, index) => {
    const marker = FENCE.exec(line)?.groups.fence;
    if (fence) {
      if (marker && marker[0] === fence[0] && marker.length >= fence.length) fence = null;
      return;
    }
    if (marker) {
      fence = marker;
      return;
    }
    result.push({ line, number: index + 1 });
  });
  return result;
}

// Section numbers, OQ definitions and Phase IDs a document defines, with repeated section and OQ definitions.
export function definitions(text) {
  const sections = new Set();
  const oqs = new Set();
  const phases = new Set();
  const duplicates = [];
  for (const { line, number } of proseLines(text)) {
    const { first: heading, second } = HEADING.exec(line)?.groups ?? {};
    if (heading) {
      const section = SECTION_NUMBER.exec(heading)?.groups.number;
      if (section) {
        if (sections.has(section)) duplicates.push({ line: number, ref: `§${section}` });
        sections.add(section);
      }
      // `### V1c — title`, `### V1c: title`, `### V1c` or `### Phase V1c …`; `## V9 notes` is not a phase.
      const phase =
        heading === 'Phase' && second
          ? second
          : second === undefined || /^[—–-]$/u.test(second) || heading.endsWith(':')
            ? heading
            : '';
      const id = phase.replace(/[.:]$/u, '');
      if (PHASE_ID.test(id)) phases.add(id);
    }
    const oq = OQ_DEFINITION.exec(line)?.groups.id;
    if (oq) {
      if (oqs.has(oq)) duplicates.push({ line: number, ref: oq });
      oqs.add(oq);
    }
  }
  return { sections, oqs, phases, duplicates };
}

function planIndex(root) {
  const index = new Map();
  const walk = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.name.endsWith('.md')) {
        const id = /^\s*[-*]?\s*Plan ID:\s*`?(?<id>[^\s`]+)`?/mu.exec(readFileSync(path, 'utf8'))
          ?.groups.id;
        if (id && !index.has(id)) index.set(id, path);
      }
    }
  };
  if (existsSync(resolve(root, '.plans'))) walk(resolve(root, '.plans'));
  return index;
}

function isIgnored(root, path) {
  return (
    spawnSync('git', ['check-ignore', '-q', '--no-index', relative(root, path)], { cwd: root })
      .status === 0
  );
}

// The target written right before a reference: a link, a backtick Markdown path or a Plan ID, or `{ planId }` for a
// hyphenated word that names no local plan. Null when unqualified.
function qualifier(before, { root, documentPath, plans }) {
  const link = LINK_BEFORE.exec(before)?.groups.target;
  if (link && !/^(?:[a-z]+:|\/\/|#)/iu.test(link))
    return resolve(dirname(documentPath), decodeTarget(link.split('#')[0]));
  const code = CODE_BEFORE.exec(before)?.groups.target;
  if (code) {
    // Found neither way, the path is judged at the root: a plan sits in an ignored directory, and judging the missing
    // path there would turn a mistyped path into an unavailable target. A root path inside an ignored directory (such as
    // the plan directory) still counts as unavailable.
    const fromRoot = resolve(root, code);
    const fromDocument = resolve(dirname(documentPath), code);
    return !present(root, fromRoot) && present(root, fromDocument) ? fromDocument : fromRoot;
  }
  const word = WORD_BEFORE.exec(before)?.groups.word;
  if (!word) return null;
  if (plans.has(word)) return plans.get(word);
  // A Plan ID has a hyphen (`verification-loop-architecture`); a mistyped one must not fall back to this document.
  return /[A-Za-z]/u.test(word) && word.includes('-') && !word.startsWith('OQ-')
    ? { planId: word }
    : null;
}

export function checkPlanReferences({ root, files }) {
  const plans = planIndex(root);
  const cache = new Map();
  const definitionsOf = (path) => {
    if (!cache.has(path)) cache.set(path, definitions(readFileSync(path, 'utf8')));
    return cache.get(path);
  };
  const summary = {
    files: files.length,
    references: 0,
    crossDocument: 0,
    links: 0,
    violations: 0,
    targetUnavailable: 0,
  };
  const violations = [];
  // Ignored targets that are absent here are not violations, but each is listed so the author can check it.
  const unavailable = [];
  for (const { path, display, text } of files) {
    const own = definitions(text);
    cache.set(path, own);
    const found = [];
    const missing = (line, kind, ref, target) =>
      unavailable.push({
        file: display,
        line,
        kind,
        ref,
        detail: `${relative(root, target)} is ignored and absent`,
      });
    for (const { line, number } of proseLines(text)) {
      let masked = line;
      for (const span of codeSpans(line))
        masked =
          masked.slice(0, span.start) + ' '.repeat(span.end - span.start) + masked.slice(span.end);
      const defined = OQ_DEFINITION.exec(line)?.groups.id;
      const definitionAt = defined ? line.indexOf(defined) : -1;
      const phaseDefinitionAt =
        HEADING.exec(line)?.groups.first === 'Phase' ? line.indexOf('Phase') : -1;
      for (const match of masked.matchAll(REFERENCE)) {
        if (match.groups.oq && match.index === definitionAt) continue;
        if (match.groups.phase && match.index === phaseDefinitionAt) continue;
        summary.references += 1;
        const ref = match[0].replace(/\s+/gu, ' ');
        const target = qualifier(line.slice(0, match.index), { root, documentPath: path, plans });
        let targetDefinitions = own;
        if (target?.planId) {
          summary.crossDocument += 1;
          found.push({
            line: number,
            kind: 'unresolved-target',
            ref,
            detail: `no plan under .plans has Plan ID ${target.planId}`,
          });
          continue;
        }
        if (target) {
          summary.crossDocument += 1;
          if (!present(root, target) || !isFile(target)) {
            if (isIgnored(root, target)) missing(number, 'unavailable-target', ref, target);
            else
              found.push({
                line: number,
                kind: 'unresolved-target',
                ref,
                detail: `${relative(root, target)} not found`,
              });
            continue;
          }
          targetDefinitions = definitionsOf(target);
        }
        const ok = match.groups.section
          ? targetDefinitions.sections.has(match.groups.section)
          : match.groups.oq
            ? targetDefinitions.oqs.has(match.groups.oq)
            : targetDefinitions.phases.has(match.groups.phase);
        if (!ok)
          found.push({
            line: number,
            kind: 'unresolved',
            ref,
            detail: target
              ? `not defined in ${relative(root, target)}`
              : 'not defined in this document',
          });
      }
      for (const link of links(root, relative(root, path), line)) {
        summary.links += 1;
        const absolute = resolve(root, link.path);
        const sameDocument = absolute === dirname(path) && link.fragment;
        const shown = sameDocument
          ? `#${link.fragment}`
          : `${link.path}${link.fragment ? `#${link.fragment}` : ''}`;
        if (sameDocument) {
          if (!anchors(text).has(link.fragment))
            found.push({ line: number, kind: 'broken-link', ref: shown, detail: 'no such anchor' });
        } else if (!present(root, absolute)) {
          if (isIgnored(root, absolute)) missing(number, 'unavailable-link', shown, absolute);
          else
            found.push({ line: number, kind: 'broken-link', ref: shown, detail: 'no such file' });
        } else if (
          link.fragment &&
          link.path.endsWith('.md') &&
          !anchors(readFileSync(absolute, 'utf8')).has(link.fragment)
        )
          found.push({ line: number, kind: 'broken-link', ref: shown, detail: 'no such anchor' });
      }
    }
    for (const duplicate of own.duplicates)
      found.push({ ...duplicate, kind: 'duplicate-definition', detail: 'defined more than once' });
    found.sort((left, right) => left.line - right.line);
    violations.push(...found.map((violation) => ({ file: display, ...violation })));
  }
  summary.violations = violations.length;
  summary.targetUnavailable = unavailable.length;
  return { summary, violations, unavailable };
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
      allowPositionals: true,
      options: {
        root: { type: 'string' },
        'report-only': { type: 'boolean' },
        json: { type: 'boolean' },
      },
    });
  } catch (error) {
    throw new InputError(error.message);
  }
}

function readInputs(cwd, root, paths) {
  if (!paths.length)
    throw new InputError(
      'usage: plan-reference-check [--root <repo>] [--report-only] [--json] <plan md...>',
    );
  return paths.map((path) => {
    if (!/\.md$/iu.test(path)) throw new InputError(`${path}: not a Markdown file`);
    if (!isFile(resolve(cwd, path))) throw new InputError(`${path}: no such file`);
    const absolute = realpathSync(resolve(cwd, path));
    const text = readFileSync(absolute, 'utf8');
    if (!text.trim()) throw new InputError(`${path}: empty file`);
    const inside = relative(root, absolute);
    const display = inside && !inside.startsWith('..') && !isAbsolute(inside) ? inside : absolute;
    return { path: absolute, display, text };
  });
}

function format(result) {
  const lines = [...result.violations, ...result.unavailable].map(
    ({ file, line, kind, ref, detail }) => `${file}:${line}\t${kind}\t${ref}\t${detail}`,
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
    let root;
    try {
      root = realpathSync(values.root ? resolve(cwd, values.root) : gitRoot(cwd));
      if (!statSync(root).isDirectory()) throw new Error();
    } catch (caught) {
      if (caught instanceof InputError) throw caught;
      throw new InputError(`${values.root}: no such directory`);
    }
    const result = checkPlanReferences({ root, files: readInputs(cwd, root, positionals) });
    log(values.json ? JSON.stringify({ root, ...result }, null, 2) : format(result));
    return result.violations.length && !values['report-only'] ? 1 : 0;
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
