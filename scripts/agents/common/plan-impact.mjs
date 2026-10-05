// Plan impact inventory: scans tracked files, classifies every scanned line, maps the result onto review blocks
// and checks that nothing is left unclassified or outside the blocks a plan revision reviews.
// Procedure: docs/development/troubleshooting/tooling/agent-plan-impact-inventory-misses.md
//
// Usage: pnpm plan:impact -- --spec <dir> [--root <repo>] [--out <dir>]
// The spec directory holds the inputs described in readSpec(). Output goes to `--out` or
// `.artifacts/tools/plan-impact/<spec directory name>/`. Exit 1 when any check fails; exit 2 without output for
// usage errors and specs that cannot be read (invalid JSON or config, malformed line ranges).

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, posix, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { resolveArtifactPath } from '../../artifacts/paths.mjs';
import { blockMap, markdownHeadingLines, splitLines } from './plan-impact-blocks.mjs';

// ripgrep and Python `re` treat `\b` as a Unicode word boundary; JavaScript's `\b` is ASCII-only even with `u`.
const WORD = '[\\p{Alphabetic}\\p{M}\\p{Nd}\\p{Pc}\\p{Join_Control}]';
const WORD_BOUNDARY = `(?:(?<=${WORD})(?!${WORD})|(?<!${WORD})(?=${WORD}))`;

export function unicodeRegExp(source) {
  return new RegExp(source.replaceAll('\\b', WORD_BOUNDARY), 'u');
}

// Path fields are POSIX on every OS: `\` separators in inputs are read as `/`.
export function toPosix(path) {
  return path.replaceAll('\\', '/');
}

// `dir/**` matches by prefix; anything else follows Python fnmatch (`*` also crosses `/`).
export function globMatch(path, glob) {
  if (glob.endsWith('/**')) return path.startsWith(glob.slice(0, -2));
  let source = '';
  for (let i = 0; i < glob.length; i += 1) {
    const char = glob[i];
    if (char === '*') source += '.*';
    else if (char === '?') source += '.';
    else if (char === '[') {
      const end = glob.indexOf(']', i + 2);
      if (end < 0) source += '\\[';
      else {
        let body = glob.slice(i + 1, end).replaceAll('\\', '\\\\');
        if (body.startsWith('!')) body = `^${body.slice(1)}`;
        source += `[${body}]`;
        i = end;
      }
    } else source += char.replace(/[.*+?^${}()|[\]\\/]/gu, '\\$&');
  }
  return new RegExp(`^${source}$`, 'su').test(path);
}

// Line specs: `N`, `N-M` or comma lists of both, with 1 <= N <= M.
export function expandLines(spec) {
  return spec.split(',').flatMap((part) => {
    const match = /^(\d+)(?:-(\d+))?$/u.exec(part);
    const a = Number(match?.[1]);
    const b = Number(match?.[2] ?? match?.[1]);
    if (!match || a < 1 || b < a) throw new Error(`bad line spec: ${spec}`);
    return Array.from({ length: b - a + 1 }, (_, k) => a + k);
  });
}

// Blank lines, `#` comments and the `TOTAL` summary line that classification sheets end with are not rows.
function readTable(path) {
  if (!existsSync(path)) return [];
  return splitLines(readFileSync(path, 'utf8'))
    .map((line, index) => ({ line, number: index + 1 }))
    .filter(({ line }) => line.trim() && !line.startsWith('#') && !line.startsWith('TOTAL'));
}

function tableFiles(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory)
    .filter((name) => name.endsWith('.tsv'))
    .sort()
    .map((name) => resolve(directory, name));
}

// Class lists in impact.json: passive classes flag no block, other-owner classes are passive classes whose files
// leave the block universe, block classes are reported per PR. A typo must not silently widen or narrow them.
function validateConfig(config) {
  for (const name of ['classes', 'passiveClasses', 'otherOwnerClasses']) {
    if (!Array.isArray(config[name])) throw new Error(`impact.json: ${name} must be an array`);
  }
  const subset = (name, values, within, label) => {
    const outside = values.filter((c) => !within.includes(c));
    if (outside.length)
      throw new Error(`impact.json: ${name} not in ${label}: ${outside.join(', ')}`);
  };
  subset('passiveClasses', config.passiveClasses, config.classes, 'classes');
  subset('otherOwnerClasses', config.otherOwnerClasses, config.passiveClasses, 'passiveClasses');
  if (config.blockClasses !== undefined) {
    const active = config.classes.filter((c) => !config.passiveClasses.includes(c));
    subset('blockClasses', config.blockClasses, active, 'non-passive classes');
  }
}

function isFile(path) {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

// Number of lines a citation may use in a file, or null when the path is not a readable text file. It matches the
// block map's extent: after a final newline the map's last block ends on the empty line that follows, so a range
// copied from blocks.tsv up to the end of a file stays valid.
export function lineCount(root, path) {
  if (!isFile(resolve(root, path))) return null;
  const text = readText(root, path);
  return text === null ? null : splitLines(text).length;
}

// Spec directory:
//   impact.json         { classes: [ordered], passiveClasses, otherOwnerClasses, blockClasses?, universe: [globs],
//                         blockFiles: { extensions, names }, importTargets: [paths],
//                         importSourcesExclude: [globs], linkTargets: [file names] }
//   patterns.tsv        name<TAB>regex                     identifier patterns (Unicode \b)
//   file-rules.tsv      glob<TAB>class<TAB>reason          file-level classification, first match wins
//   rows/*.tsv          path:line<TAB>class<TAB>reason     classification of scanned lines
//   additional/*.tsv    path:lines<TAB>class<TAB>reason    semantic review rows, lines may be N, N-M, lists
//   overrides.tsv       path:line<TAB>class<TAB>reason     Parent adjudication, wins over rows and additional
//   contract-targets.tsv selector<TAB>class<TAB>blocks|file<TAB>reason   blocks: path | path:N | path:N-M |
//                       path#Heading; file: path only
//   consumers.tsv       regex<TAB>class<TAB>subjects<TAB>reason   `@exports:<class>[:<path prefix>]` = exports of
//                       the file targets in that class
//   regression.tsv      path<TAB>lines<TAB>class<TAB>reason   review-cited lines that must stay covered
// Classes may be joined with `+`.
export function readSpec(specDirectory) {
  const config = JSON.parse(readFileSync(resolve(specDirectory, 'impact.json'), 'utf8'));
  validateConfig(config);
  const rowsOf = (paths) =>
    paths.flatMap((path) =>
      readTable(path).map(({ line, number }) => ({
        file: basename(path),
        number,
        cells: line.split('\t'),
      })),
    );
  return {
    name: basename(resolve(specDirectory)),
    classes: config.classes,
    passive: new Set(config.passiveClasses),
    otherOwners: new Set(config.otherOwnerClasses),
    blockClasses:
      config.blockClasses ?? config.classes.filter((c) => !config.passiveClasses.includes(c)),
    universe: (config.universe ?? []).map(toPosix),
    blockExtensions: config.blockFiles?.extensions ?? [],
    blockNames: (config.blockFiles?.names ?? []).map(toPosix),
    importTargets: (config.importTargets ?? []).map(toPosix),
    importSourcesExclude: (config.importSourcesExclude ?? []).map(toPosix),
    linkTargets: config.linkTargets ?? [],
    patterns: readTable(resolve(specDirectory, 'patterns.tsv')).map(({ line }) => {
      const [name, source] = line.split('\t');
      return { name, source, regex: unicodeRegExp(source) };
    }),
    rules: readTable(resolve(specDirectory, 'file-rules.tsv')).map(({ line }) => {
      const [glob, cls, reason] = line.split('\t');
      return { glob: toPosix(glob), cls, reason };
    }),
    rows: rowsOf(tableFiles(resolve(specDirectory, 'rows'))),
    additional: rowsOf(tableFiles(resolve(specDirectory, 'additional'))),
    overrides: rowsOf([resolve(specDirectory, 'overrides.tsv')]),
    contracts: readTable(resolve(specDirectory, 'contract-targets.tsv')).map(({ line }) =>
      line.split('\t'),
    ),
    consumers: readTable(resolve(specDirectory, 'consumers.tsv')).map(({ line }) =>
      line.split('\t'),
    ),
    regression: readTable(resolve(specDirectory, 'regression.tsv')).map(({ line }) =>
      line.split('\t'),
    ),
    regressionSections: regressionSections(resolve(specDirectory, 'regression.tsv')),
  };
}

// Comment lines starting with `# ` that are followed by rows split the regression list into report sections.
function regressionSections(path) {
  if (!existsSync(path)) return [];
  const sections = [];
  for (const line of splitLines(readFileSync(path, 'utf8'))) {
    if (line.startsWith('# ')) sections.push({ title: line.slice(2), rows: [] });
    else if (line.trim() && !line.startsWith('#')) {
      if (!sections.length) sections.push({ title: '', rows: [] });
      sections.at(-1).rows.push(line.split('\t'));
    }
  }
  return sections.filter((section) => section.rows.length);
}

export function trackedFiles(root) {
  return execFileSync('git', ['ls-files', '-z'], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 1 << 28,
  })
    .split('\0')
    .filter(Boolean)
    .map(toPosix);
}

function readText(root, path) {
  try {
    const text = readFileSync(resolve(root, path), 'utf8');
    return text.includes('\0') ? null : text;
  } catch {
    return null;
  }
}

// Line layer, step 1: pattern hits, import lines into the target modules and anchor links into the target
// documents. A key is `path:line`; when several sources hit one line the first source is kept.
export function scan(root, spec, tracked = trackedFiles(root)) {
  const keys = new Map();
  const counts = { patterns: 0, imports: 0, links: 0 };
  const perPattern = Object.fromEntries(spec.patterns.map((p) => [p.name, 0]));
  const add = (source, path, number, text) => {
    counts[source] += 1;
    const key = `${path}:${number}`;
    if (!keys.has(key)) keys.set(key, { source, text });
  };
  const targets = new Set(spec.importTargets);
  const linkPattern = spec.linkTargets.length
    ? new RegExp(
        `(?<![\\w-])(?:${spec.linkTargets.map((t) => t.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')).join('|')})#[a-z0-9-]+`,
        'gu',
      )
    : null;
  const texts = new Map();
  for (const path of tracked) {
    const text = readText(root, path);
    if (text === null) continue;
    texts.set(path, text);
  }
  for (const [path, text] of texts) {
    splitLines(text).forEach((line, index) => {
      let hit = false;
      for (const pattern of spec.patterns) {
        if (pattern.regex.test(line)) {
          perPattern[pattern.name] += 1;
          hit = true;
        }
      }
      if (hit) add('patterns', path, index + 1, line);
    });
  }
  if (targets.size) {
    for (const [path, text] of texts) {
      if (!/\.(?:[cm]?js|[cm]?ts)$/u.test(path)) continue;
      if (spec.importSourcesExclude.some((glob) => globMatch(path, glob))) continue;
      splitLines(text).forEach((line, index) => {
        for (const match of line.matchAll(
          /(?:\bfrom\s+|\bimport\s*\(\s*)['"](\.{1,2}\/[^'"]+)['"]/gu,
        )) {
          const target = posix.normalize(posix.join(posix.dirname(path), match[1]));
          if (targets.has(target)) {
            add('imports', path, index + 1, line);
            break;
          }
        }
      });
    }
  }
  if (linkPattern) {
    for (const [path, text] of texts) {
      if (!path.endsWith('.md')) continue;
      splitLines(text).forEach((line, index) => {
        for (const match of line.matchAll(linkPattern)) add('links', path, index + 1, match[0]);
      });
    }
  }
  return { keys, counts, perPattern, texts };
}

function classSet(cls) {
  return new Set(cls.split('+'));
}

function sameClasses(a, b) {
  const x = classSet(a);
  const y = classSet(b);
  return x.size === y.size && [...x].every((c) => y.has(c));
}

function orderClasses(set, order) {
  return order.filter((c) => set.has(c)).join('+');
}

function ruleFor(path, rules) {
  return rules.find((rule) => globMatch(path, rule.glob)) ?? null;
}

// Line layer, step 2: every scanned line needs a row, a file rule or an override. Rows for lines the scan no
// longer finds are stale; additional rows that disagree with a scanned line's class need an override.
export function lineInventory(root, spec, scanned) {
  const errors = [];
  const known = new Set(spec.classes);
  const parseRows = (rows, allowRanges) => {
    const result = new Map();
    for (const { file, number, cells } of rows) {
      if (cells.length !== 3) {
        errors.push(`${file}:${number} malformed`);
        continue;
      }
      const [rawKey, cls, rawReason] = cells;
      const reason = rawReason.trim();
      const key = toPosix(rawKey);
      if (!cls.split('+').every((c) => known.has(c)) || !reason) {
        errors.push(
          `${file}:${number} bad class or empty reason: ${cells.join('\t').slice(0, 120)}`,
        );
      }
      if (!allowRanges) {
        // Classified rows and overrides name one line; any other key would match nothing and stay silent.
        if (!/^.+:[1-9]\d*$/u.test(key)) errors.push(`${file}:${number} malformed`);
        else result.set(key, { cls, reason, file });
        continue;
      }
      const match = /^(.+?):([\d,-]+)$/u.exec(key);
      if (!match) {
        errors.push(`${file}:${number} malformed`);
        continue;
      }
      for (const line of expandLines(match[2])) {
        const lineKey = `${match[1]}:${line}`;
        const entry = result.get(lineKey) ?? { classes: new Set(), reasons: [] };
        cls.split('+').forEach((c) => entry.classes.add(c));
        entry.reasons.push(`${file.replace(/\.tsv$/u, '')}: ${rawReason}`);
        result.set(lineKey, entry);
      }
    }
    return result;
  };
  for (const rule of spec.rules) {
    if (!rule.cls?.split('+').every((c) => known.has(c)) || !rule.reason?.trim()) {
      errors.push(`file rule ${rule.glob}: bad class or empty reason`);
    }
  }
  const rows = parseRows(spec.rows, false);
  const additional = new Map(
    [...parseRows(spec.additional, true)].map(([key, { classes, reasons }]) => [
      key,
      {
        cls: orderClasses(classes, spec.classes),
        reason: [...new Set(reasons)].join(' | ').trim(),
      },
    ]),
  );
  const overrides = parseRows(spec.overrides, false);
  const out = [];
  const unclassified = [];
  for (const key of scanned.keys.keys()) {
    const path = key.slice(0, key.lastIndexOf(':'));
    if (overrides.has(key)) {
      out.push({ key, ...pick(overrides.get(key)), source: 'parent' });
      continue;
    }
    const row = rows.get(key);
    const rule = row ? null : ruleFor(path, spec.rules);
    if (!row && !rule) {
      unclassified.push(key);
      continue;
    }
    out.push(
      row
        ? { key, ...pick(row), source: 'scan' }
        : { key, cls: rule.cls, reason: `rule ${rule.glob}: ${rule.reason}`, source: 'scan' },
    );
  }
  const stale = [...rows.keys()].filter((key) => !scanned.keys.has(key));
  const lineExists = (key) => {
    const at = key.lastIndexOf(':');
    const line = Number(key.slice(at + 1));
    return line >= 1 && line <= (lineCount(root, key.slice(0, at)) ?? 0);
  };
  for (const [key, value] of overrides) {
    if (!scanned.keys.has(key) && !additional.has(key))
      out.push({ key, ...pick(value), source: 'parent' });
    if (!lineExists(key)) errors.push(`override points to no line: ${key}`);
  }
  const final = new Map(out.map((row) => [row.key, row.cls]));
  for (const [key, value] of additional) {
    if (!scanned.keys.has(key)) {
      if (!lineExists(key)) errors.push(`additional row points to no line: ${key}`);
      out.push(
        overrides.has(key)
          ? { key, ...pick(overrides.get(key)), source: 'parent' }
          : { key, ...value, source: 'semantic' },
      );
    } else if (final.has(key) && !overrides.has(key) && !sameClasses(value.cls, final.get(key))) {
      // A scanned line without its own row is already reported as unclassified; additional rows never classify it.
      errors.push(
        `unadjudicated conflict ${key}: scan ${final.get(key)} vs additional ${value.cls}`,
      );
    }
  }
  out.sort((a, b) => compareRows(a, b));
  return { rows: out, unclassified, stale, errors };
}

function pick({ cls, reason }) {
  return { cls, reason };
}

// Inventory rows sort by key, class, reason and source in code point order, so regenerated files compare
// byte for byte.
function compareRows(a, b) {
  for (const field of ['key', 'cls', 'reason', 'source']) {
    if (a[field] !== b[field]) return a[field] < b[field] ? -1 : 1;
  }
  return 0;
}

function selectorPath(selector) {
  return toPosix(selector.split(/[:#]/u, 1)[0]);
}

function headingRange(lines, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  const headings = markdownHeadingLines(lines).map((line) => line - 1);
  const start = headings.find((index) =>
    new RegExp(`^#{1,6} ${escaped}\\s*$`, 'u').test(lines[index]),
  );
  if (start === undefined) return null;
  const level = lines[start].length - lines[start].replace(/^#+/u, '').length;
  const next = headings.find(
    (index) => index > start && new RegExp(`^#{1,${level}} `, 'u').test(lines[index]),
  );
  return [start + 1, next === undefined ? lines.length : next];
}

// Block layer: the universe is the configured globs, contract target files and files with rows in a class
// other than `otherOwnerClasses`, minus files whose file rule names another owner (`otherOwnerClasses`). A file
// whose rule class is passive joins only through the globs or a contract target. Each block gets the union of
// non-passive classes from the rows inside it, the contract targets that overlap it and the consumer patterns it
// contains.
export function blockInventory(root, spec, lines, tracked = trackedFiles(root)) {
  const errors = [];
  const passive = spec.passive;
  const ownedOnlyRules = spec.otherOwners;
  const ruleClass = (path) => ruleFor(path, spec.rules)?.cls ?? null;
  const targetFiles = new Set(spec.contracts.map(([selector]) => selectorPath(selector)));
  const rowFiles = new Set(
    lines.rows
      .filter((row) => ![...classSet(row.cls)].every((c) => ownedOnlyRules.has(c)))
      .map((row) => row.key.slice(0, row.key.lastIndexOf(':'))),
  );
  const extension = new RegExp(`\\.(?:${spec.blockExtensions.join('|')})$`, 'u');
  const files = tracked
    .filter((path) => {
      const cls = ruleClass(path);
      if (cls !== null && ownedOnlyRules.has(cls)) return false;
      const inScope =
        targetFiles.has(path) ||
        spec.universe.some((glob) => globMatch(path, glob)) ||
        (rowFiles.has(path) && !passive.has(cls));
      return inScope && (extension.test(path) || spec.blockNames.includes(path));
    })
    .sort();
  const blocks = new Map();
  const texts = new Map();
  for (const path of files) {
    const text = readFileSync(resolve(root, path), 'utf8');
    texts.set(path, text);
    const map = blockMap(path, text);
    if (map.length) blocks.set(path, map);
  }
  const flags = new Map();
  const flag = (path, [a, b], classes, source) => {
    const key = `${path}\t${a}\t${b}`;
    const entry = flags.get(key) ?? {
      path,
      start: a,
      end: b,
      classes: new Set(),
      sources: new Set(),
    };
    classes.forEach((c) => entry.classes.add(c));
    entry.sources.add(source);
    flags.set(key, entry);
  };
  const blockOf = (path, line) =>
    blocks.get(path)?.find(([a, b]) => a <= line && line <= b) ?? null;
  for (const row of lines.rows) {
    const at = row.key.lastIndexOf(':');
    const path = row.key.slice(0, at);
    const line = Number(row.key.slice(at + 1));
    const active = [...classSet(row.cls)].filter((c) => !passive.has(c));
    if (!blocks.has(path)) {
      if (active.length) errors.push(`active row outside universe: ${row.key}`);
      continue;
    }
    const block = blockOf(path, line);
    if (!block) {
      if (splitLines(texts.get(path))[line - 1]?.trim())
        errors.push(`row outside blocks: ${row.key}`);
      continue;
    }
    if (active.length) flag(path, block, active, 'rows');
  }
  const fileTargets = [];
  const known = new Set(spec.classes);
  // An unknown class would flag blocks that the inventory then drops, so the scope narrows silently.
  const knownClasses = (cls) => Boolean(cls) && cls.split('+').every((c) => known.has(c));
  for (const [selector, cls, scope, reason] of spec.contracts) {
    if (!knownClasses(cls) || !reason?.trim()) {
      errors.push(`contract ${selector}: bad class or empty reason`);
      continue;
    }
    const path = selectorPath(selector);
    if (!isFile(resolve(root, path))) {
      errors.push(`contract path missing: ${selector}`);
      continue;
    }
    if (scope !== 'blocks' && scope !== 'file') {
      errors.push(`contract scope must be blocks or file: ${selector}`);
      continue;
    }
    if (scope === 'file') {
      // A file target covers the whole file, so a line or heading selector would be silently ignored.
      if (toPosix(selector) !== path) errors.push(`file target must be a bare path: ${selector}`);
      else fileTargets.push({ path, cls, reason });
      continue;
    }
    const fileLines = splitLines(readFileSync(resolve(root, path), 'utf8'));
    let range;
    if (selector.includes('#')) {
      range = headingRange(fileLines, selector.slice(selector.indexOf('#') + 1));
      if (!range) {
        errors.push(`heading not found: ${selector}`);
        continue;
      }
    } else if (selector.includes(':')) {
      // One `N` or `N-M` range; a comma list would hide every line between its ends.
      const spec_ = selector.slice(selector.indexOf(':') + 1);
      if (spec_.includes(',')) throw new Error(`bad line spec: ${spec_}`);
      const cited = expandLines(spec_);
      range = [cited[0], cited.at(-1)];
      if (range[1] > lineCount(root, path)) {
        errors.push(`selector points to no line: ${selector}`);
        continue;
      }
    } else range = [1, fileLines.length];
    const hit = (blocks.get(path) ?? []).filter(([a, b]) => a <= range[1] && range[0] <= b);
    if (!hit.length) errors.push(`selector matches no block: ${selector}`);
    for (const block of hit) flag(path, block, classSet(cls), 'contract');
  }
  for (const [rawPattern, cls, rawSubjects = '', reason] of spec.consumers) {
    if (!knownClasses(cls) || !reason?.trim()) {
      errors.push(`consumer ${rawPattern}: bad class or empty reason`);
      continue;
    }
    let pattern = rawPattern;
    let subjects = rawSubjects.split(',').filter(Boolean).map(toPosix);
    if (pattern.startsWith('@exports:')) {
      // `@exports:<class>[:<path prefix>]`: export names of the file targets in that class (under the prefix).
      const [target, prefix = ''] = pattern.slice('@exports:'.length).split(':');
      const modules = fileTargets
        .filter((t) => classSet(t.cls).has(target) && t.path.startsWith(toPosix(prefix)))
        .map((t) => t.path);
      const names = new Set();
      for (const module of modules) {
        const source = readFileSync(resolve(root, module), 'utf8');
        for (const match of source.matchAll(
          /^export (?:async )?(?:function|const|let|class) (\w+)/gmu,
        )) {
          names.add(match[1]);
        }
      }
      if (!names.size) {
        errors.push(`consumer ${rawPattern} found no exported names`);
        continue;
      }
      pattern = `\\b(${[...names].sort().join('|')})\\b`;
      subjects = modules;
    }
    const regex = unicodeRegExp(pattern);
    for (const path of files) {
      if (subjects.some((s) => path === s || (s.endsWith('/') && path.startsWith(s)))) continue;
      const fileLines = splitLines(texts.get(path));
      for (const block of blocks.get(path) ?? []) {
        if (fileLines.slice(block[0] - 1, block[1]).some((line) => regex.test(line))) {
          flag(path, block, classSet(cls), 'consumer');
        }
      }
    }
  }
  const flagged = [...flags.values()].sort((a, b) =>
    a.path !== b.path ? (a.path < b.path ? -1 : 1) : a.start - b.start || a.end - b.end,
  );
  return { files, blocks, flagged, fileTargets, errors };
}

// Regression list: every review-cited line must sit in a block flagged with at least one expected class.
export function regressionCheck(root, spec, blockResult, lines) {
  const byPath = new Map();
  for (const entry of blockResult.flagged) {
    (byPath.get(entry.path) ?? byPath.set(entry.path, []).get(entry.path)).push(entry);
  }
  const misses = [];
  const errors = [];
  let covered = 0;
  for (const [rawPath, spec_, expected] of spec.regression) {
    const path = toPosix(rawPath);
    const count = lineCount(root, path) ?? 0;
    for (const line of expandLines(spec_)) {
      if (line > count) {
        errors.push(`regression row points to no line: ${path}:${line}`);
        continue;
      }
      const block = (byPath.get(path) ?? []).find((b) => b.start <= line && line <= b.end);
      if (block && expected.split('+').some((c) => block.classes.has(c))) covered += 1;
      else misses.push(`${path}:${line} expected ${expected}`);
    }
  }
  // Per section: cited lines whose block is flagged with an expected class by line rows alone.
  const rowsByPath = new Map();
  for (const row of lines.rows) {
    const at = row.key.lastIndexOf(':');
    const path = row.key.slice(0, at);
    const active = new Set([...classSet(row.cls)].filter((c) => !spec.passive.has(c)));
    (rowsByPath.get(path) ?? rowsByPath.set(path, []).get(path)).push([
      Number(row.key.slice(at + 1)),
      active,
    ]);
  }
  const sections = spec.regressionSections.map(({ title, rows }) => {
    let total = 0;
    let byRows = 0;
    for (const [rawPath, lineSpec, expected] of rows) {
      const path = toPosix(rawPath);
      for (const line of expandLines(lineSpec)) {
        total += 1;
        const map =
          blockResult.blocks.get(path) ??
          (isFile(resolve(root, path))
            ? blockMap(path, readFileSync(resolve(root, path), 'utf8'))
            : []);
        const block = map.find(([a, b]) => a <= line && line <= b);
        const classes = new Set(
          block
            ? (rowsByPath.get(path) ?? [])
                .filter(([n]) => block[0] <= n && n <= block[1])
                .flatMap(([, set]) => [...set])
            : [],
        );
        if (expected.split('+').some((c) => classes.has(c))) byRows += 1;
      }
    }
    return { title, lines: total, coveredByRowsAlone: byRows };
  });
  return { covered, misses, errors, sections };
}

export function runImpact({ root, specDirectory }) {
  const spec = readSpec(specDirectory);
  const tracked = trackedFiles(root);
  const scanned = scan(root, spec, tracked);
  const lines = lineInventory(root, spec, scanned);
  const blocks = blockInventory(root, spec, lines, tracked);
  const regression = regressionCheck(root, spec, blocks, lines);
  const deadPatterns = Object.entries(scanned.perPattern)
    .filter(([, n]) => n === 0)
    .map(([name]) => name);
  const sources = { scan: 0, semantic: 0, parent: 0 };
  for (const row of lines.rows) sources[row.source] += 1;
  const perPr = Object.fromEntries(
    spec.blockClasses.map((cls) => {
      const hit = blocks.flagged.filter((b) => b.classes.has(cls));
      return [cls, { blocks: hit.length, files: new Set(hit.map((b) => b.path)).size }];
    }),
  );
  const summary = {
    spec: spec.name,
    scan: {
      keys: scanned.keys.size,
      ...scanned.counts,
      perPattern: scanned.perPattern,
      deadPatterns,
    },
    lines: {
      rows: lines.rows.length,
      sources,
      unclassified: lines.unclassified.length,
      stale: lines.stale.length,
      errors: lines.errors.length,
    },
    blocks: {
      files: blocks.blocks.size,
      blocks: [...blocks.blocks.values()].reduce((n, list) => n + list.length, 0),
      flagged: blocks.flagged.length,
      contractOnly: blocks.flagged.filter((b) => b.sources.size === 1 && b.sources.has('contract'))
        .length,
      fileTargets: blocks.fileTargets.length,
      errors: blocks.errors.length,
      perPr,
    },
    regression: {
      covered: regression.covered,
      notCovered: regression.misses.length,
      errors: regression.errors.length,
      sections: regression.sections,
    },
  };
  const problems = [
    ...lines.unclassified.map((k) => `UNCLASSIFIED ${k}`),
    ...lines.stale.map((k) => `STALE ${k}`),
    ...lines.errors.map((e) => `ERROR ${e}`),
    ...deadPatterns.map((p) => `DEAD PATTERN ${p}`),
    ...blocks.errors.map((e) => `ERROR ${e}`),
    ...regression.errors.map((e) => `ERROR ${e}`),
    ...regression.misses.map((m) => `NOT COVERED ${m}`),
  ];
  return { spec, scanned, lines, blocks, regression, summary, problems };
}

export function writeOutputs(result, outDirectory) {
  mkdirSync(outDirectory, { recursive: true });
  const order = result.spec.blockClasses;
  const write = (name, text) => writeFileSync(resolve(outDirectory, name), text);
  write(
    'scan.tsv',
    'key\tsource\ttext\n' +
      [...result.scanned.keys]
        .map(([key, { source, text }]) => `${key}\t${source}\t${text}\n`)
        .join(''),
  );
  write(
    'unclassified.tsv',
    '# Fill class and reason, then move the rows into the spec rows/ directory.\n' +
      result.lines.unclassified.map((key) => `${key}\t\t\n`).join(''),
  );
  write(
    'inventory.tsv',
    'key\tclass\treason\tsource\n' +
      result.lines.rows.map((r) => `${r.key}\t${r.cls}\t${r.reason}\t${r.source}\n`).join(''),
  );
  // Every universe block, so the semantic review can walk the blocks the tool did not flag.
  const flagged = new Set(result.blocks.flagged.map((b) => `${b.path}\t${b.start}\t${b.end}`));
  write(
    'blocks.tsv',
    'path\tstart\tend\tflagged\n' +
      [...result.blocks.blocks]
        .flatMap(([path, list]) => list.map(([a, b]) => `${path}\t${a}\t${b}`))
        .map((key) => `${key}\t${flagged.has(key) ? 'yes' : 'no'}\n`)
        .join(''),
  );
  write(
    'blocks-inventory.tsv',
    'path\tstart\tend\tclasses\tsource\n' +
      result.blocks.flagged
        .map(
          (b) =>
            `${b.path}\t${b.start}\t${b.end}\t${orderClasses(b.classes, order)}\t${[...b.sources].sort().join('+')}\n`,
        )
        .join(''),
  );
  write(
    'files-inventory.tsv',
    'path\tclasses\treason\n' +
      result.blocks.fileTargets.map((t) => `${t.path}\t${t.cls}\t${t.reason}\n`).join(''),
  );
  write(
    'summary.json',
    `${JSON.stringify({ ...result.summary, problems: result.problems }, null, 2)}\n`,
  );
}

function parseArgs(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === '--') continue;
    if (!['--spec', '--root', '--out'].includes(flag) || argv[i + 1] === undefined) {
      throw new Error(
        `usage: plan-impact --spec <dir> [--root <repo>] [--out <dir>] (got ${flag})`,
      );
    }
    options[flag.slice(2)] = argv[i + 1];
    i += 1;
  }
  if (!options.spec)
    throw new Error('usage: plan-impact --spec <dir> [--root <repo>] [--out <dir>]');
  return options;
}

export function main(argv, { cwd = process.cwd(), log = console.log } = {}) {
  const options = parseArgs(argv);
  const root = resolve(cwd, options.root ?? '.');
  const specDirectory = resolve(cwd, options.spec);
  const result = runImpact({ root, specDirectory });
  const outDirectory = options.out
    ? resolve(cwd, options.out)
    : resolveArtifactPath(cwd, ['plan-impact', basename(specDirectory)]);
  writeOutputs(result, outDirectory);
  log(JSON.stringify(result.summary));
  for (const problem of result.problems.slice(0, 50)) log(problem);
  log(`output: ${outDirectory}`);
  return result.problems.length ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
  }
}
