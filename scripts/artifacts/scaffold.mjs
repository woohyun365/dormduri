#!/usr/bin/env node

// Core scaffold: creates the directories of one work kind below a plan's phase directory, from the workspace layout
// manifest (core `workKinds` and `workNames`, binding root `artifact-plans`). Directories only, never a file.
// `consumer` writes the files of a consumer repository's workspace from the core default instead: the workspace
// .gitignore and the missing index READMEs of the product document directories. Field meanings:
// docs/development/agent-workflows/workspace-layout.md
//
// Usage: pnpm scaffold -- <kind> --umbrella <Plan ID> --plan <Plan ID> --phase <phase|YYYY-MM-DD> [--topic <topic>]
//          [--<work name> <value>...] [--root <repo>]
//        pnpm scaffold -- --check [--root <repo>]
//        pnpm scaffold -- consumer --mode <managed|vendored> [--plans tracked|ignored] --root <repo>
// Exit 0 = done, 1 = refused or --check found an ignored root that .gitignore does not ignore, 2 = usage error.
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import { dirname, posix, resolve, win32 } from 'node:path';
import { pathToFileURL } from 'node:url';

import { declaredPlanIds } from '../agents/common/plan-store.mjs';
import { findGitignoreIssues } from '../git/workspace-layout-check.mjs';
import {
  BINDING_FILE,
  CONSUMER_COMMAND,
  loadWorkspaceLayout,
  WORK_NAME_PLACEHOLDER,
  workspaceRoot,
} from './workspace-layout.mjs';

// Plan ID grammar of plan-store.
const PLAN_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const BASE_INPUTS = ['umbrella', 'plan', 'phase', 'topic'];
const PLANS_SETTINGS = ['tracked', 'ignored'];
const USAGE =
  'usage: scaffold <kind> --umbrella <Plan ID> --plan <Plan ID> --phase <phase> [--topic <topic>] ' +
  '[--<work name> <value>...] [--root <repo>] | scaffold --check [--root <repo>] | ' +
  `scaffold ${CONSUMER_COMMAND} --mode <mode> [--plans ${PLANS_SETTINGS.join('|')}] --root <repo>`;

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

// .gitignore of the consumer workspace, from the core default: everything is ignored, then each tracked root below the
// workspace (in manifest order, when the mode has it and setup did not ignore it) and each trackedFiles entry of an
// ignored root is let back in. A nested path opens its parent directories one level at a time.
export function workspaceGitignore(core, { mode, ignore = [] }) {
  if (!core.repositoryModes.includes(mode))
    throw new UsageError(`mode ${mode} is not one of ${core.repositoryModes.join(', ')}`);
  const workspace = core.roots.find((root) => root.id === core.trackedScope.workspace);
  const below = core.roots.filter((root) => root.path.startsWith(`${workspace.path}/`));
  for (const id of ignore)
    if (!below.some((root) => root.id === id && root.ignorable))
      throw new UsageError(
        `${id} cannot be ignored; ignorable: ${below
          .filter((root) => root.ignorable)
          .map((root) => root.id)
          .join(', ')}`,
      );
  const rules = ['/*'];
  const allow = (path, directory) => {
    const parts = path.split('/');
    for (let depth = 1; depth < parts.length; depth += 1) {
      const parent = parts.slice(0, depth).join('/');
      for (const rule of [`!/${parent}/`, `/${parent}/*`])
        if (!rules.includes(rule)) rules.push(rule);
    }
    rules.push(`!/${path}${directory ? '/' : ''}`);
  };
  for (const root of below) {
    const path = root.path.slice(workspace.path.length + 1);
    if (root.tracking === 'ignored')
      for (const file of root.trackedFiles ?? []) allow(`${path}/${file}`, false);
    else if (!ignore.includes(root.id) && (root.modes ?? [mode]).includes(mode))
      allow(path, root.kind === 'directory');
  }
  return `${rules.join('\n')}\n`;
}

// A checkout of this repository (this one, a clone or a linked worktree) maps the core roots to its own names through
// the binding file at its root and has no consumer workspace: the nearest directory at or above `path` holding it.
function bindingCheckout(path) {
  for (let directory = path; ; directory = dirname(directory)) {
    if (existsSync(resolve(directory, ...BINDING_FILE.split('/')))) return directory;
    if (dirname(directory) === directory) return undefined;
  }
}

// Index README of a product document directory: its purpose, the one-owner rule and the index table its documents fill.
const indexReadme = (root) =>
  `# ${root.purpose}\n\n같은 규칙은 한 문서만 소유한다. 이 디렉터리에 문서를 더하면 아래 색인 표에 행을 더한다.\n\n` +
  '| 문서 | 상태 | 소유 규칙 |\n| ---- | ---- | --------- |\n';

// Writes the consumer workspace files that are missing: the workspace .gitignore and the index README of each product
// document directory. A README that exists is kept; a .gitignore that exists must hold the same rules. Every check runs
// before the first write, and no path may pass through a symlink.
export function scaffoldConsumer(
  root,
  { mode, ignore = [] },
  { layout = loadWorkspaceLayout() } = {},
) {
  const { core } = layout;
  const workspace = core.roots.find((entry) => entry.id === core.trackedScope.workspace);
  const files = [
    { path: `${workspace.path}/.gitignore`, content: workspaceGitignore(core, { mode, ignore }) },
    ...core.roots
      .filter((entry) => entry.indexReadme)
      .map((entry) => ({
        path: `${entry.path}/README.md`,
        content: indexReadme(entry),
        keep: true,
      })),
  ];
  // The native realpath gives the stored letter case, so another case of a path names the same directory.
  const repository = realpathSync.native(root);
  const checkout = bindingCheckout(repository);
  if (checkout)
    refuse(
      `${checkout} maps the core roots through ${BINDING_FILE} and ${repository} is inside it; run ${CONSUMER_COMMAND} on another repository`,
    );
  const at = (path) => resolve(repository, ...path.split('/'));
  for (const file of files) {
    const parts = file.path.split('/');
    let stat;
    for (let depth = 1; depth <= parts.length; depth += 1) {
      const path = parts.slice(0, depth).join('/');
      try {
        stat = lstatSync(at(path));
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        stat = undefined;
        break;
      }
      if (stat.isSymbolicLink()) refuse(`${path} resolves through a symlink`);
      if (depth < parts.length && !stat.isDirectory())
        refuse(`${path} exists and is not a directory`);
    }
    file.exists = Boolean(stat);
    if (!stat) continue;
    if (!stat.isFile()) refuse(`${file.path} exists and is not a file`);
    // Line endings are not rules: a checkout with CRLF line endings holds the same rules.
    if (!file.keep && readFileSync(at(file.path), 'utf8').replaceAll('\r\n', '\n') !== file.content)
      refuse(`${file.path} exists with other rules; scaffold does not overwrite it`);
  }
  for (const file of files.filter((entry) => !entry.exists)) {
    mkdirSync(dirname(at(file.path)), { recursive: true });
    writeFileSync(at(file.path), file.content, { flag: 'wx' });
  }
  return {
    command: CONSUMER_COMMAND,
    mode,
    ignore,
    files: files.map((file) => file.path),
    created: files.filter((file) => !file.exists).map((file) => file.path),
    kept: files.filter((file) => file.exists).map((file) => file.path),
  };
}

function parseArgs(argv, layout) {
  const known = new Set([
    'umbrella',
    'plan',
    'root',
    'mode',
    'plans',
    ...Object.keys(layout.core.workNames),
  ]);
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
    throw new UsageError(`give a work kind, ${CONSUMER_COMMAND} or --check`);
  return { kind, check, options };
}

export function main(argv, { cwd = process.cwd(), log = console.log, error = console.error } = {}) {
  try {
    const { kind, check, options } = parseArgs(argv, loadWorkspaceLayout());
    const { root = '.', ...inputs } = options;
    const repository = resolve(cwd, root);
    if (kind === CONSUMER_COMMAND) {
      const { mode, plans = 'tracked', ...rest } = inputs;
      if (options.root === undefined || mode === undefined || Object.keys(rest).length)
        throw new UsageError(
          `${CONSUMER_COMMAND} takes --mode, --plans and --root only, and needs --mode and --root`,
        );
      if (!PLANS_SETTINGS.includes(plans))
        throw new UsageError(`--plans is ${PLANS_SETTINGS.join(' or ')}`);
      const ignore = plans === 'ignored' ? ['plans'] : [];
      log(JSON.stringify(scaffoldConsumer(repository, { mode, ignore }), null, 2));
      return 0;
    }
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
