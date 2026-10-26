// Tracked scope guard: what a repository tracks inside its agent workspace roots (D-OSS-18). A forced-tracked file,
// a file over the size limits, a binary file, a secret-like value and a malformed checkpoint entry of a tracked plan
// are issues, and the tracked bytes are reported. It reads the index, so a pre-commit run judges what is committed.
// Field meanings: docs/development/agent-workflows/workspace-layout.md
import { execFileSync } from 'node:child_process';

// A small fixed list instead of an external scanner. An issue names the pattern and the line, never the value.
const SECRET_PATTERNS = [
  ['private key', /-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY-----/u],
  ['AWS access key', /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/u],
  ['GitHub token', /\b(?:gh[opsur]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{22,})/u],
  ['Slack token', /\bxox[abposr]-[A-Za-z0-9-]{10,}/u],
  ['Google API key', /\bAIza[0-9A-Za-z_-]{35}/u],
  ['API secret key', /\bsk-(?:ant-|proj-)?[A-Za-z0-9_-]{32,}/u],
  ['credential in a URL', /\b[a-z][a-z0-9+.-]*:\/\/[^\s/:@]+:[^\s/@]+@/iu],
];
const GITLINK = '160000';
const FENCE = /^ {0,3}(?:```|~~~)/u;
const ENTRY = /^- (.*)$/u;
const FIELD = /^ {2}- (.*)$/u;
const CONTINUATION = /^(?: {3,}|\t)\S/u;
const DATE = /^\d{4}-\d{2}-\d{2}$/u;

const git = (root, args, options = {}) =>
  execFileSync('git', args, { cwd: root, maxBuffer: 256 * 1024 * 1024, ...options });
const list = (root, args) => git(root, args, { encoding: 'utf8' }).split('\0').filter(Boolean);
const within = (path, root) => path === root.path || path.startsWith(`${root.path}/`);

// A real calendar date: Date rolls 2026-02-30 over to March, so the round trip must give the same day back.
function isDate(value) {
  if (!DATE.test(value)) return false;
  const time = new Date(`${value}T00:00:00Z`).getTime();
  return !Number.isNaN(time) && new Date(time).toISOString().startsWith(value);
}

// Rendered length of a Markdown line: link targets, `**` and backticks are not shown text.
const rendered = (line) =>
  [
    ...line
      .trim()
      .replace(/\]\([^)]*\)/gu, ']')
      .replaceAll('**', '')
      .replaceAll('`', ''),
  ].length;

// Checkpoint entries of one plan: in each `## <heading>` section outside fenced code, a `- YYYY-MM-DD` bullet and its
// `  - <field>: <content>` lines, a field running on over more-indented lines. Returns issues with 1-based lines.
export function checkpointIssues(text, rule) {
  const known = new Set([...rule.required, ...rule.optional]);
  const heading = `## ${rule.heading}`;
  const issues = [];
  const issue = (line, kind, hint) => issues.push({ line, kind, hint });
  let fenced = false;
  let section = false;
  let entry = null;
  let field = null;
  const close = () => {
    if (entry?.valid) {
      for (const [name, value] of entry.fields) {
        if (!known.has(name))
          issue(
            value.line,
            'checkpoint-unknown-field',
            `${name} is not a checkpoint field; use ${[...known].join(', ')}`,
          );
        const lines = value.lines.reduce(
          (sum, line) => sum + Math.ceil(rendered(line) / rule.lineWidth),
          0,
        );
        if (lines > rule.maxLines)
          issue(
            value.line,
            'checkpoint-field-too-long',
            `${name} takes ${lines} lines of ${rule.lineWidth} rendered characters, over ${rule.maxLines}; link the detail instead`,
          );
      }
      for (const name of rule.required)
        if (!entry.fields.has(name))
          issue(
            entry.line,
            'checkpoint-missing-field',
            `the ${entry.date} entry needs the ${name} field`,
          );
    }
    entry = null;
    field = null;
  };
  for (const [index, line] of text.split(/\r?\n/u).entries()) {
    const number = index + 1;
    if (!section) {
      if (FENCE.test(line)) fenced = !fenced;
      else if (!fenced && line.trimEnd() === heading) section = true;
      continue;
    }
    if (/^#{1,2}\s/u.test(line)) {
      close();
      section = line.trimEnd() === heading;
      continue;
    }
    if (!line.trim()) continue;
    const date = ENTRY.exec(line);
    if (date) {
      close();
      entry = {
        line: number,
        date: date[1].trim(),
        valid: isDate(date[1].trim()),
        fields: new Map(),
      };
      if (!entry.valid)
        issue(
          number,
          'checkpoint-malformed',
          'an entry is a `- YYYY-MM-DD` bullet that holds a real date only',
        );
      continue;
    }
    const fieldLine = FIELD.exec(line);
    if (fieldLine && entry) {
      const colon = fieldLine[1].indexOf(':');
      const name = fieldLine[1].slice(0, colon).trim();
      field = null;
      if (colon < 0 || !name)
        issue(number, 'checkpoint-malformed', 'a field line is `  - <field>: <content>`');
      else if (entry.fields.has(name))
        issue(number, 'checkpoint-malformed', `${name} repeats in this entry`);
      else {
        field = { line: number, lines: [line] };
        entry.fields.set(name, field);
      }
      continue;
    }
    if (field && CONTINUATION.test(line)) {
      field.lines.push(line);
      continue;
    }
    issue(
      number,
      'checkpoint-malformed',
      'a checkpoint section holds `- YYYY-MM-DD` entries and their `  - <field>: <content>` lines only',
    );
  }
  close();
  return issues.sort((left, right) => left.line - right.line);
}

// Roots the guard reads: the core roots below the workspace root and, in a binding, the roots mapped to them and the
// repository's own roots (a root without core). Product document roots stay outside.
export function scopeRoots({ core, roots }) {
  const workspace = core.roots.find((root) => root.id === core.trackedScope.workspace);
  const inside = new Set(
    core.roots.filter((root) => within(root.path, workspace)).map((root) => root.id),
  );
  const coreIds = new Set(core.roots.map((root) => root.id));
  return roots.filter((root) =>
    root.core === undefined ? inside.has(root.id) || !coreIds.has(root.id) : inside.has(root.core),
  );
}

function catFile(root, mode, oids) {
  return oids.length
    ? git(root, ['cat-file', mode], { input: `${oids.join('\n')}\n` })
    : Buffer.alloc(0);
}

function blobSizes(root, oids) {
  const sizes = new Map();
  for (const line of catFile(root, '--batch-check', oids).toString('utf8').split('\n')) {
    if (!line) continue;
    const [oid, type, size] = line.split(' ');
    if (type !== 'blob') throw new Error(`tracked scope: ${oid} is ${type}, not a blob`);
    sizes.set(oid, Number(size));
  }
  return sizes;
}

function blobContents(root, oids) {
  const output = catFile(root, '--batch', oids);
  const contents = new Map();
  let offset = 0;
  for (const oid of oids) {
    const end = output.indexOf(0x0a, offset);
    const size = Number(output.subarray(offset, end).toString('utf8').split(' ')[2]);
    contents.set(oid, output.subarray(end + 1, end + 1 + size));
    offset = end + 1 + size + 1;
  }
  return contents;
}

const deepest = (path, roots) =>
  roots
    .filter((root) => within(path, root))
    .sort((left, right) => right.path.length - left.path.length);

function sortIssues(issues) {
  const key = (issue) => {
    const match = /^(.*):(\d+)$/u.exec(issue.path);
    return match ? [match[1], Number(match[2])] : [issue.path, 0];
  };
  return issues.sort((left, right) => {
    const [leftPath, leftLine] = key(left);
    const [rightPath, rightLine] = key(right);
    if (leftPath !== rightPath) return leftPath < rightPath ? -1 : 1;
    if (leftLine !== rightLine) return leftLine - rightLine;
    return left.kind < right.kind ? -1 : left.kind > right.kind ? 1 : 0;
  });
}

// Index entries below the scope roots and root markers. Forced: .gitignore ignores the file, or an ignored root holds
// it outside its trackedFiles (a root whose trackedFilesOwner is .gitignore has only the first rule and its other
// files are left to that owner). The rest is the allowlist: size limits (the nearest root `limits`, else the core
// default), NUL byte, secret patterns and, below a tracked plans root, the checkpoint rule.
export function checkTrackedScope(repository, layout) {
  const { core } = layout;
  const roots = scopeRoots(layout);
  const markers = new Set(roots.flatMap((root) => (root.marker ? [root.marker] : [])));
  // Only the tracked .gitignore files decide: a user exclude file or info/exclude would make the result local.
  const ignored = new Set(
    list(repository, [
      'ls-files',
      '-z',
      '--cached',
      '--ignored',
      '--exclude-per-directory=.gitignore',
    ]),
  );
  const guide = core.guide;
  const issues = [];
  const allowed = [];
  for (const line of list(repository, ['ls-files', '-z', '--stage'])) {
    const tab = line.indexOf('\t');
    const [mode, oid, stage] = line.slice(0, tab).split(' ');
    const path = line.slice(tab + 1);
    if (stage !== '0' || mode === GITLINK) continue;
    const containing = deepest(path, roots);
    const marker = markers.has(path);
    if (!containing.length && !marker) continue;
    const [root] = containing;
    const outside =
      root?.tracking === 'ignored' &&
      !root.trackedFilesOwner &&
      !(root.trackedFiles ?? []).some((file) => path === `${root.path}/${file}`);
    if (ignored.has(path) || (!marker && outside)) {
      issues.push({
        path,
        kind: 'tracked-forced',
        hint: `.gitignore ignores this file or the manifest allowlist does not hold it; untrack it (git rm --cached) or move it under a tracked root (${guide})`,
      });
      continue;
    }
    if (!marker && root.trackedFilesOwner) continue;
    allowed.push({ path, oid, containing });
  }
  const sizes = blobSizes(repository, [...new Set(allowed.map((entry) => entry.oid))]);
  // A binding root holds no limits and takes those of the core root it maps.
  const limitsOf = (root) =>
    root.limits ?? core.roots.find((candidate) => candidate.id === root.core)?.limits;
  const limitOf = (entry) =>
    entry.containing.map(limitsOf).find((limits) => limits?.fileBytes)?.fileBytes ??
    core.trackedScope.fileBytes;
  const readable = allowed.filter((entry) => sizes.get(entry.oid) <= limitOf(entry));
  const contents = blobContents(repository, [...new Set(readable.map((entry) => entry.oid))]);
  const isPlanRoot = (root) =>
    (root.core ?? root.id) === core.checkpoint.root && root.tracking === 'tracked';
  const files = [];
  for (const entry of allowed) {
    const bytes = sizes.get(entry.oid);
    files.push({ path: entry.path, bytes });
    const limit = limitOf(entry);
    if (bytes > limit) {
      issues.push({
        path: entry.path,
        kind: 'tracked-too-large',
        hint: `${bytes} bytes is over the ${limit}-byte file limit; keep large content out of the tracked scope or raise the limit in a manifest PR`,
      });
      continue;
    }
    const content = contents.get(entry.oid);
    if (content.includes(0)) {
      issues.push({
        path: entry.path,
        kind: 'tracked-binary',
        hint: 'a NUL byte marks binary content; keep binaries out of the tracked scope',
      });
      continue;
    }
    const text = content.toString('utf8');
    const lines = text.split(/\r?\n/u);
    for (const [name, pattern] of SECRET_PATTERNS) {
      const index = lines.findIndex((line) => pattern.test(line));
      if (index >= 0)
        issues.push({
          path: `${entry.path}:${index + 1}`,
          kind: 'tracked-secret',
          hint: `matches the ${name} pattern; remove the value (rotate it if it is real)`,
        });
    }
    if (entry.path.endsWith('.md') && entry.containing.some(isPlanRoot))
      for (const issue of checkpointIssues(text, core.checkpoint))
        issues.push({ path: `${entry.path}:${issue.line}`, kind: issue.kind, hint: issue.hint });
  }
  for (const root of roots) {
    const total = limitsOf(root)?.totalBytes;
    if (!total) continue;
    const bytes = files
      .filter((file) => within(file.path, root))
      .reduce((sum, file) => sum + file.bytes, 0);
    if (bytes > total)
      issues.push({
        path: root.path,
        kind: 'tracked-total-too-large',
        hint: `${bytes} bytes tracked below ${root.path} is over the ${total}-byte total`,
      });
  }
  return {
    issues: sortIssues(issues),
    report: { files, bytes: files.reduce((sum, file) => sum + file.bytes, 0) },
  };
}

export const formatCapacity = (report) =>
  `tracked scope: ${report.files.length} ${report.files.length === 1 ? 'file' : 'files'}, ${report.bytes} bytes`;
