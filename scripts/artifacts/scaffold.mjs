#!/usr/bin/env node

// Core scaffold: creates the directories of one work kind below a plan's phase directory, from the workspace layout
// manifest (core `workKinds` and `workNames`, binding root `artifact-plans`). Directories only, never a file. Field
// meanings: docs/development/agent-workflows/workspace-layout.md
//
// Usage: pnpm scaffold -- <kind> --umbrella <Plan ID> --plan <Plan ID> --phase <phase|YYYY-MM-DD> [--topic <topic>]
//          [--<work name> <value>...] [--root <repo>]
//        pnpm scaffold -- --check [--root <repo>]
// Exit 0 = done, 1 = refused or --check found an ignored root that .gitignore does not ignore, 2 = usage error.
import { lstatSync, mkdirSync, realpathSync } from 'node:fs';
import { posix, resolve, win32 } from 'node:path';
import { pathToFileURL } from 'node:url';

import { declaredPlanIds } from '../agents/common/plan-store.mjs';
import { findGitignoreIssues } from '../git/workspace-layout-check.mjs';
import { loadWorkspaceLayout, WORK_NAME_PLACEHOLDER, workspaceRoot } from './workspace-layout.mjs';

// Plan ID grammar of plan-store.
const PLAN_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const BASE_INPUTS = ['umbrella', 'plan', 'phase', 'topic'];
const USAGE =
  'usage: scaffold <kind> --umbrella <Plan ID> --plan <Plan ID> --phase <phase> [--topic <topic>] ' +
  '[--<work name> <value>...] [--root <repo>] | scaffold --check [--root <repo>]';

class UsageError extends Error {}

function refuse(message) {
  throw new Error(`scaffold refused: ${message}`);
}

// One directory name, whatever exists on disk: absolute paths, separators of either OS (with the Windows drive colon,
// since `C:x` resolves against drive C) and dot segments are refused.
function checkName(name, value) {
  if (typeof value !== 'string' || value === '' || value.includes('\0'))
    refuse(`${name} must be a non-empty name`);
  if (posix.isAbsolute(value) || win32.isAbsolute(value))
    refuse(`${name} ${value} is an absolute path`);
  if (/[/\\:]/u.test(value)) refuse(`${name} ${value} contains a path separator`);
  if (value === '.' || value === '..') refuse(`${name} ${value} is a dot segment`);
}

const placeholders = (template) =>
  [...template.matchAll(WORK_NAME_PLACEHOLDER)].map((match) => match[1]);

// Manifest ignored roots whose ignore rules .gitignore must hold. The check reuses the layout guard's judgement.
export function checkIgnore(root, layout = loadWorkspaceLayout()) {
  return findGitignoreIssues(root, {
    ...layout,
    roots: layout.roots.filter((entry) => entry.tracking === 'ignored'),
  });
}

// Creates `<artifact-plans>/<umbrella>/<plan>/<phase>/[<topic>/]` and the kind's directories below it, only what is
// missing. Every check runs before the first directory is made. A work name rule applies to a directory scaffold
// creates; an existing directory keeps its historical name.
export function scaffold(root, kind, inputs, { layout = loadWorkspaceLayout() } = {}) {
  const entry = layout.core.workKinds.find((candidate) => candidate.id === kind);
  if (!entry)
    throw new UsageError(
      `unknown work kind ${kind}; use ${layout.core.workKinds.map((candidate) => candidate.id).join(', ')}`,
    );
  const takes = new Set(entry.directories.flatMap(placeholders));
  const given = Object.entries(inputs).filter(([, value]) => value !== undefined);
  for (const [name] of given)
    if (!BASE_INPUTS.includes(name) && !takes.has(name))
      throw new UsageError(`${kind} does not take --${name}`);
  for (const name of ['umbrella', 'plan', 'phase', ...takes])
    if (inputs[name] === undefined) throw new UsageError(`${kind} needs --${name}`);
  for (const [name, value] of given) checkName(name, value);
  if (!PLAN_ID.test(inputs.plan)) refuse(`plan ${inputs.plan} does not match ${PLAN_ID.source}`);
  if (!declaredPlanIds(root).ids.has(inputs.umbrella))
    refuse(
      `umbrella ${inputs.umbrella} is not a Plan ID declared under ${workspaceRoot('plans', layout).path}/`,
    );

  const evidence = workspaceRoot('artifact-plans', layout).path;
  const base = [
    ...evidence.split('/').map((value) => ({ value, names: [] })),
    { value: inputs.umbrella, names: [] },
    { value: inputs.plan, names: [] },
    { value: inputs.phase, names: ['phase'] },
    ...(inputs.topic === undefined ? [] : [{ value: inputs.topic, names: ['topic'] }]),
  ];
  // Repository-relative directory -> work names its last segment is made of, parents first.
  const wanted = new Map();
  const directories = (entry.directories.length ? entry.directories : ['']).map((template) => {
    const segments = [
      ...base,
      ...template
        .split('/')
        .filter(Boolean)
        .map((part) => ({
          value: part.replace(WORK_NAME_PLACEHOLDER, (_, name) => inputs[name]),
          names: placeholders(part),
        })),
    ];
    let path = '';
    for (const { value, names } of segments) {
      path = path ? `${path}/${value}` : value;
      if (!wanted.has(path)) wanted.set(path, names);
    }
    return path;
  });

  const repository = realpathSync(root);
  const at = (path) => resolve(repository, ...path.split('/'));
  const missing = [];
  for (const [path, names] of wanted) {
    let stat;
    try {
      stat = lstatSync(at(path));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    if (stat?.isSymbolicLink()) refuse(`${path} resolves through a symlink`);
    if (stat && !stat.isDirectory()) refuse(`${path} exists and is not a directory`);
    if (stat) continue;
    for (const name of names)
      if (!new RegExp(layout.core.workNames[name], 'u').test(inputs[name]))
        refuse(`${name} ${inputs[name]} does not match ${layout.core.workNames[name]}`);
    missing.push(path);
  }
  const containing = layout.roots.filter(
    (candidate) =>
      candidate.tracking === 'ignored' &&
      (candidate.path === evidence || evidence.startsWith(`${candidate.path}/`)),
  );
  const issues = findGitignoreIssues(repository, { ...layout, roots: containing });
  if (issues.length)
    refuse(
      `${evidence} is not ignored as the manifest says (${issues.map((issue) => issue.path).join(', ')}); ` +
        '.gitignore must agree',
    );
  for (const path of missing) mkdirSync(at(path));
  return { kind, directories, created: missing };
}

function parseArgs(argv, layout) {
  const known = new Set(['umbrella', 'plan', 'root', ...Object.keys(layout.core.workNames)]);
  const options = {};
  let kind;
  let check = false;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--') continue;
    if (argument === '--check') check = true;
    else if (argument.startsWith('--')) {
      const name = argument.slice(2);
      if (!known.has(name) || Object.hasOwn(options, name) || argv[index + 1] === undefined)
        throw new UsageError(`unknown, repeated or empty option ${argument}`);
      options[name] = argv[++index];
    } else if (kind === undefined) kind = argument;
    else throw new UsageError(`unexpected argument ${argument}`);
  }
  if (
    check === (kind !== undefined) ||
    (check && Object.keys(options).some((name) => name !== 'root'))
  )
    throw new UsageError('give a work kind or --check');
  return { kind, check, options };
}

export function main(argv, { cwd = process.cwd(), log = console.log, error = console.error } = {}) {
  try {
    const { kind, check, options } = parseArgs(argv, loadWorkspaceLayout());
    const { root = '.', ...inputs } = options;
    const repository = resolve(cwd, root);
    if (check) {
      const issues = checkIgnore(repository);
      if (issues.length) error('workspace ignore check failed:');
      for (const issue of issues) error(`- ${issue.path} (${issue.kind}): ${issue.hint}`);
      return issues.length ? 1 : 0;
    }
    log(JSON.stringify(scaffold(repository, kind, inputs), null, 2));
    return 0;
  } catch (failure) {
    error(failure.message);
    if (!(failure instanceof UsageError)) return 1;
    error(USAGE);
    return 2;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  process.exitCode = main(process.argv.slice(2));
