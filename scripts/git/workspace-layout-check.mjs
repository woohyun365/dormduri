#!/usr/bin/env node

// Commit-time detector for the workspace layout manifest (scripts/artifacts/workspace-layout.*.json): scattered host
// runtime state, retired and unknown top-level roots, the plans and artifacts child rules, and manifest roots whose
// tracking disagrees with .gitignore. Detection, not prevention: hosts should start at the repository root and write
// evidence under the manifest roots.
import { execFileSync, spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { declaredPlanIds } from '../agents/common/plan-store.mjs';
import {
  BINDING_FILE,
  loadWorkspaceLayout,
  workspaceRoot,
} from '../artifacts/workspace-layout.mjs';

const PROBE = 'htc-layout-probe.md';

// Untracked and ignored entries. --directory collapses wholly ignored trees (node_modules, .artifacts/tools)
// and nested repositories; the ignored listing still finds .omc/.omx inside otherwise untracked directories.
export function listUntrackedEntries(root) {
  const list = (...args) =>
    execFileSync(
      'git',
      ['ls-files', '--others', '--directory', '--exclude-standard', '-z', ...args],
      {
        cwd: root,
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
      },
    )
      .split('\0')
      .filter(Boolean);
  return [...new Set([...list(), ...list('--ignored')])];
}

export function listTrackedTopLevel(root) {
  return new Set(
    execFileSync('git', ['ls-files', '-z'], {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    })
      .split('\0')
      .filter(Boolean)
      .map((path) => path.split('/')[0]),
  );
}

// A guard exclusion is a .gitignore pattern without a slash inside, so it is matched against one name.
function matchesPattern(pattern, name) {
  const body = pattern.replace(/^\/|\/$/gu, '');
  const source = body
    .replace(/[.+^${}()|[\]\\]/gu, '\\$&')
    .replaceAll('*', '[^/]*')
    .replaceAll('?', '[^/]');
  return new RegExp(`^${source}$`, 'u').test(name);
}

const isExcluded = (layout, name) =>
  layout.guardExclusions.some((pattern) => matchesPattern(pattern, name));

// Top-level names are checked only when the tracked top-level names are given; an entry under a tracked top-level
// directory is nested and only the runtime state rule sees it.
export function findWorkspaceLayoutIssues(
  entries,
  { trackedTopLevel, layout = loadWorkspaceLayout() } = {},
) {
  const runtimeState = new Set(
    layout.roots.filter((root) => root.nestedState).map((root) => root.path),
  );
  const retired = new Map(
    layout.retiredRoots.map((entry) => [entry.name, workspaceRoot(entry.use, layout).path]),
  );
  const manifestTop = new Set(
    layout.roots.flatMap((root) => [
      root.path.split('/')[0],
      ...(root.marker ? [root.marker] : []),
    ]),
  );
  const issues = [];
  for (const path of entries) {
    const segments = path.split('/').filter(Boolean);
    // Root .omc/.omx are the anchored host state roots; any deeper one came from a subdirectory cwd.
    if (segments.slice(1).some((segment) => runtimeState.has(segment))) {
      issues.push({
        path,
        kind: 'nested-runtime-state',
        hint: 'start the host at the repository root',
      });
      continue;
    }
    if (retired.has(segments[0])) {
      issues.push({ path, kind: 'retired-root', hint: `use ${retired.get(segments[0])}/` });
      continue;
    }
    if (
      trackedTopLevel &&
      !trackedTopLevel.has(segments[0]) &&
      !manifestTop.has(segments[0]) &&
      !isExcluded(layout, segments[0])
    )
      issues.push({
        path,
        kind: 'outside-manifest-root',
        hint: `add the root to ${BINDING_FILE} (fields: ${layout.binding.guide}) or move the content under a manifest root`,
      });
  }
  return issues;
}

function readEntries(root, path) {
  try {
    return readdirSync(resolve(root, path), { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

// Child rules of ignored manifest roots, read from the working tree: Markdown-only roots, named first-level children
// and first-level names that must be a Plan ID declared under the plans root. The top-level guard exclusions do not
// apply below a manifest root.
export function findWorkspaceStructureIssues(root, layout = loadWorkspaceLayout()) {
  const issues = [];
  let declared;
  for (const entry of layout.roots) {
    if (entry.tracking !== 'ignored' || entry.kind !== 'directory') continue;
    const children = readEntries(root, entry.path);
    if (entry.children === 'markdown-only') {
      const visit = (path, list) => {
        for (const child of list) {
          const childPath = `${path}/${child.name}`;
          if (child.isDirectory()) visit(childPath, readEntries(root, childPath));
          else if (!child.name.endsWith('.md'))
            issues.push({
              path: childPath,
              kind: 'plans-non-markdown',
              hint: `${entry.path} holds Markdown plans only`,
            });
        }
      };
      visit(entry.path, children);
    } else if (entry.children?.names) {
      const allowed = new Set([...entry.children.names, ...(entry.trackedFiles ?? [])]);
      for (const child of children)
        if (!allowed.has(child.name))
          issues.push({
            path: `${entry.path}/${child.name}`,
            kind: 'artifacts-unknown-child',
            hint: `use ${[...entry.children.names].map((name) => `${entry.path}/${name}/`).join(', ')}`,
          });
    } else if (entry.children === 'declared-plan-id') {
      declared ??= declaredPlanIds(root).ids;
      for (const child of children)
        if (!declared.has(child.name))
          issues.push({
            path: `${entry.path}/${child.name}`,
            kind: 'undeclared-plan-id',
            hint: `name the directory after a Plan ID declared under ${workspaceRoot('plans', layout).path}/`,
          });
    }
  }
  return issues;
}

const ignored = (root, path) =>
  spawnSync('git', ['check-ignore', '-q', '--no-index', path], { cwd: root }).status === 0;

// Ignored roots must be ignored and their tracked files and markers not; tracked roots must not be ignored.
// A directory root is probed with a file name inside it.
export function findGitignoreIssues(root, layout = loadWorkspaceLayout()) {
  const issues = [];
  for (const entry of layout.roots) {
    const probe = entry.kind === 'directory' ? `${entry.path}/${PROBE}` : entry.path;
    const keep = [
      ...(entry.trackedFiles ?? []).map((file) => `${entry.path}/${file}`),
      ...(entry.marker ? [entry.marker] : []),
    ];
    const wrong =
      ignored(root, probe) !== (entry.tracking === 'ignored') ||
      keep.some((path) => ignored(root, path));
    if (wrong)
      issues.push({
        path: entry.path,
        kind: 'gitignore-mismatch',
        hint: `${entry.path} is ${entry.tracking} in the manifest; .gitignore must agree`,
      });
  }
  return issues;
}

export function checkWorkspaceLayout(root) {
  const layout = loadWorkspaceLayout();
  return [
    ...findWorkspaceLayoutIssues(listUntrackedEntries(root), {
      trackedTopLevel: listTrackedTopLevel(root),
      layout,
    }),
    ...findWorkspaceStructureIssues(root, layout),
    ...findGitignoreIssues(root, layout),
  ];
}

function main() {
  const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
  const issues = checkWorkspaceLayout(resolve(root));
  if (issues.length === 0) return;
  console.error('workspace layout check failed:');
  for (const issue of issues) console.error(`- ${issue.path} (${issue.kind}): ${issue.hint}`);
  console.error(
    'See .artifacts/README.md and the host adapter guide; move the content instead of deleting it.',
  );
  process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
