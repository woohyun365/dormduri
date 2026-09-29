#!/usr/bin/env node

// Commit-time detector for scattered host runtime state and retired local workspace roots.
// Detection, not prevention: hosts should start at the repository root and write evidence to .artifacts/.
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const RUNTIME_STATE_DIRECTORIES = new Set(['.omc', '.omx']);
const RETIRED_ROOTS = new Map([
  ['artifacts', '.artifacts'],
  ['local-docs', '.local-docs'],
  ['references', '.artifacts/references'],
]);

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

export function findWorkspaceLayoutIssues(entries) {
  const issues = [];
  for (const path of entries) {
    const segments = path.split('/').filter(Boolean);
    // Root .omc/.omx are the anchored host state roots; any deeper one came from a subdirectory cwd.
    if (segments.slice(1).some((segment) => RUNTIME_STATE_DIRECTORIES.has(segment))) {
      issues.push({
        path,
        kind: 'nested-runtime-state',
        hint: 'start the host at the repository root',
      });
      continue;
    }
    if (RETIRED_ROOTS.has(segments[0]))
      issues.push({ path, kind: 'retired-root', hint: `use ${RETIRED_ROOTS.get(segments[0])}/` });
  }
  return issues;
}

function main() {
  const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
  const issues = findWorkspaceLayoutIssues(listUntrackedEntries(resolve(root)));
  if (issues.length === 0) return;
  console.error('workspace layout check failed:');
  for (const issue of issues) console.error(`- ${issue.path} (${issue.kind}): ${issue.hint}`);
  console.error(
    'See .artifacts/README.md and the host adapter guide; move the content instead of deleting it.',
  );
  process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
