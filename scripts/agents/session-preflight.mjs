#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, relative, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { parsePriorityPointer } from './session-contract.mjs';

const repoRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const args = parseArgs(process.argv.slice(2));

if (args.fresh && args.resume) fail('Choose either --fresh or --resume.');
if (args.plan && !args.resume) fail('--plan requires --resume.');

const mode = args.resume ? 'resume' : 'fresh';
const branch = git(['branch', '--show-current']);
const head = git(['rev-parse', 'HEAD']);
const statusLines = git(['status', '--short', '--untracked-files=all']).split('\n').filter(Boolean);
const workingTree = classifyChanges(statusLines);
const changeLimit = 100;

const result = {
  schemaVersion: 1,
  readOnly: true,
  mode,
  repository: {
    root: repoRoot,
    branch,
    head,
    dirty: statusLines.length > 0,
    changes: statusLines.slice(0, changeLimit),
    omittedChangeCount: Math.max(0, statusLines.length - changeLimit),
    stagedPaths: workingTree.staged.slice(0, changeLimit),
    unstagedPaths: workingTree.unstaged.slice(0, changeLimit),
    untrackedPaths: workingTree.untracked.slice(0, changeLimit),
  },
  activePlans: listActivePlans(),
  omx: readOmxActiveModes(),
  canonicalVerification: [
    'pnpm test:repo-policy',
    'pnpm api:check',
    'pnpm web:check',
    'pnpm infra:check:static',
  ],
  sourcePriority: [
    'current-user-request',
    'branch-head-working-tree',
    'tracked-code-contract-test',
    'tracked-policy-architecture-runbook',
    'active-plan-checkpoint',
    'local-memory-history',
  ],
  resume: mode === 'resume' ? buildResumeSummary(args.plan) : null,
  next:
    mode === 'resume'
      ? 'Verify the selected checkpoint against code, tests, git history, and the latest user request.'
      : 'Inspect only files directly related to the current request; do not load local memory by default.',
};

if (args.json) {
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} else {
  printText(result);
}

function parseArgs(argv) {
  const parsed = { fresh: false, resume: false, json: false, plan: undefined };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--fresh') parsed.fresh = true;
    else if (argument === '--resume') parsed.resume = true;
    else if (argument === '--json') parsed.json = true;
    else if (argument === '--plan') {
      parsed.plan = argv[index + 1];
      index += 1;
      if (!parsed.plan) fail('--plan requires a repository-relative path.');
    } else {
      fail(`Unknown option: ${argument}`);
    }
  }

  return parsed;
}

function buildResumeSummary(planInput) {
  const plan = planInput ? resolveRepositoryPath(planInput) : null;
  const priority = readNotepadPriority();
  return {
    plan: plan
      ? {
          path: relative(repoRoot, plan),
          exists: existsSync(plan),
        }
      : null,
    notepadPriority: priority,
    contextSnapshots: listContextSnapshots(),
    warning:
      'Local pointers are hints only; current request and working-tree evidence have higher authority.',
  };
}

function classifyChanges(lines) {
  const result = { staged: [], unstaged: [], untracked: [] };
  for (const line of lines) {
    const status = line.slice(0, 2);
    const path = line.slice(3);
    if (status === '??') result.untracked.push(path);
    else {
      if (status[0] !== ' ') result.staged.push(path);
      if (status[1] !== ' ') result.unstaged.push(path);
    }
  }
  return result;
}

function listActivePlans() {
  const directory = resolve(repoRoot, '.omx/plans');
  if (!existsSync(directory)) return [];

  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => {
      const path = `.omx/plans/${entry.name}`;
      const source = readFileSync(resolve(repoRoot, path), 'utf8');
      const status = source.match(/^- 상태:\s*(.+)$/mu)?.[1]?.trim() ?? 'unspecified';
      return { path, status };
    })
    .sort((left, right) => left.path.localeCompare(right.path));
}

function readOmxActiveModes() {
  const result = spawnSync('omx', ['state', 'list-active', '--json'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  if (result.status !== 0) return { available: false, activeModes: [] };

  try {
    const value = JSON.parse(result.stdout);
    return { available: true, activeModes: value.active_modes ?? [] };
  } catch {
    return { available: false, activeModes: [] };
  }
}

function readNotepadPriority() {
  const result = spawnSync(
    'omx',
    ['notepad', 'notepad_read', '--input', '{"section":"priority"}', '--json'],
    { cwd: repoRoot, encoding: 'utf8' },
  );
  if (result.status !== 0)
    return { available: false, exists: false, valid: false, contextPath: null };

  try {
    const response = JSON.parse(result.stdout);
    const parsed = parsePriorityPointer(response.content);
    return {
      available: true,
      exists: parsed.exists,
      valid: parsed.valid,
      contextPath: parsed.value?.contextPath ?? null,
      errors: parsed.errors,
    };
  } catch {
    return { available: false, exists: false, valid: false, contextPath: null };
  }
}

function resolveRepositoryPath(input) {
  const absolutePath = resolve(repoRoot, input);
  const relativePath = relative(repoRoot, absolutePath);
  if (relativePath.startsWith(`..${sep}`) || relativePath === '..') {
    fail('--plan must stay inside the repository.');
  }
  if (!relativePath.startsWith(`.omx${sep}plans${sep}`)) {
    fail('--plan must point inside .omx/plans/.');
  }
  return absolutePath;
}

function listContextSnapshots() {
  const directory = resolve(repoRoot, '.omx/context');
  if (!existsSync(directory)) return [];

  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md') && entry.name !== 'README.md')
    .map((entry) => `.omx/context/${entry.name}`)
    .sort()
    .slice(-5);
}

function git(commandArgs) {
  const result = spawnSync('git', commandArgs, {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  if (result.status !== 0) fail(result.stderr.trim() || `git ${commandArgs.join(' ')} failed`);
  return result.stdout.trim();
}

function printText(summary) {
  process.stdout.write(
    [
      `mode: ${summary.mode}`,
      `branch: ${summary.repository.branch}`,
      `HEAD: ${summary.repository.head}`,
      `working tree: ${summary.repository.dirty ? `${summary.repository.changes.length} visible change(s)` : 'clean'}`,
      summary.next,
    ].join('\n') + '\n',
  );
}

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}
