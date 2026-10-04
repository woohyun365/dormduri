// Mutation harness: checks that a command (usually a test run) fails for each planted defect. It runs in an isolated
// git worktree that carries the current uncommitted changes and untracked files; the original tree is only read.
// Rules and usage: docs/development/agent-workflows/review-criteria/README.md
//
// Usage: node scripts/agents/common/mutation-harness.mjs --spec <JSON> [--link-node-modules] [--root <repo>] [--json]
// Spec: { command: [argv], timeoutSeconds?: 300,
//         mutations: [{ id, file, find, replace, occurrence?: 1-based, expect?: [regex] }] }
// Exit 0 = baseline passed and every mutation was killed, 1 = baseline failed or a mutation was not killed,
// 2 = input error (missing or invalid spec, unknown option, root outside a git repository, a workspace package
// mutation together with --link-node-modules, a copy that cannot be built).
//
// Status per mutation: killed (non-zero exit and, with `expect`, output matching every pattern), survived (exit 0),
// target-missing (file or `find` absent, or `occurrence` past the last match), ambiguous (`find` matches more than once
// without `occurrence`), wrong-reason (non-zero exit, `expect` not matched), timeout. Everything but killed is a
// violation.

import { execFileSync, spawn } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, posix, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

class InputError extends Error {}

const SPEC_KEYS = ['command', 'timeoutSeconds', 'mutations'];
const MUTATION_KEYS = ['id', 'file', 'find', 'replace', 'occurrence', 'expect'];
const DEFAULT_TIMEOUT_SECONDS = 300;
// With linked node_modules every workspace package resolves to the original checkout, so a mutation inside one would
// survive for the wrong reason.
const WORKSPACE_PACKAGES = 'packages/';

const isText = (value) => typeof value === 'string' && value.length > 0;
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

function isFile(path) {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

function git(cwd, args, options = {}) {
  return execFileSync('git', args, { cwd, stdio: ['pipe', 'pipe', 'pipe'], ...options });
}

export function validateSpec(spec, { linkNodeModules = false } = {}) {
  const fail = (message) => {
    throw new InputError(`spec: ${message}`);
  };
  if (!isObject(spec)) fail('must be a JSON object');
  for (const key of Object.keys(spec)) if (!SPEC_KEYS.includes(key)) fail(`unknown key ${key}`);
  if (!Array.isArray(spec.command) || !spec.command.length || !spec.command.every(isText))
    fail('command must be a non-empty array of strings');
  const timeoutSeconds = spec.timeoutSeconds ?? DEFAULT_TIMEOUT_SECONDS;
  if (typeof timeoutSeconds !== 'number' || !Number.isFinite(timeoutSeconds) || timeoutSeconds <= 0)
    fail('timeoutSeconds must be a positive number');
  if (!Array.isArray(spec.mutations) || !spec.mutations.length)
    fail('mutations must be a non-empty array');
  const ids = new Set();
  const mutations = spec.mutations.map((mutation, index) => {
    if (!isObject(mutation)) fail(`mutation ${index} must be an object`);
    for (const key of Object.keys(mutation))
      if (!MUTATION_KEYS.includes(key)) fail(`mutation ${index}: unknown key ${key}`);
    const { id, file, find, replace, occurrence, expect } = mutation;
    if (!isText(id) || ids.has(id)) fail(`mutation ${index}: id must be a unique non-empty string`);
    ids.add(id);
    const raw = isText(file) ? file.replaceAll('\\', '/') : '';
    const path = raw && posix.normalize(raw);
    if (!path || isAbsolute(raw) || path === '.' || path.split('/')[0] === '..')
      fail(`${id}: file must be a path inside the repository`);
    if (!isText(find)) fail(`${id}: find must be a non-empty string`);
    if (typeof replace !== 'string') fail(`${id}: replace must be a string`);
    if (occurrence !== undefined && !(Number.isInteger(occurrence) && occurrence >= 1))
      fail(`${id}: occurrence must be a positive integer`);
    if (expect !== undefined && (!Array.isArray(expect) || !expect.length || !expect.every(isText)))
      fail(`${id}: expect must be a non-empty array of patterns`);
    const patterns = (expect ?? []).map((source) => {
      try {
        return new RegExp(source, 'u');
      } catch (error) {
        fail(`${id}: expect ${source}: ${error.message}`);
      }
    });
    if (linkNodeModules && path.toLowerCase().startsWith(WORKSPACE_PACKAGES))
      fail(
        `${id}: ${path} is a workspace package; --link-node-modules would make it read the original checkout`,
      );
    return { id, file: path, find, replace, occurrence, patterns };
  });
  return { command: spec.command, timeoutMs: timeoutSeconds * 1000, mutations };
}

// A detached worktree at HEAD plus the current diff against HEAD and the untracked, non-ignored files.
function isolate(root) {
  const parent = mkdtempSync(resolve(tmpdir(), 'mutation-harness-'));
  const copy = resolve(parent, 'tree');
  let added = false;
  const cleanup = () => {
    if (added) {
      try {
        git(root, ['worktree', 'remove', '--force', copy]);
      } catch {}
      try {
        git(root, ['worktree', 'prune']);
      } catch {}
    }
    rmSync(parent, { recursive: true, force: true });
  };
  try {
    git(root, ['worktree', 'add', '--quiet', '--detach', copy, 'HEAD']);
    added = true;
    const diff = git(root, ['diff', 'HEAD', '--binary']);
    if (diff.length) git(copy, ['apply', '--binary', '--whitespace=nowarn', '-'], { input: diff });
    const untracked = git(root, ['ls-files', '--others', '--exclude-standard', '-z'], {
      encoding: 'utf8',
    })
      .split('\0')
      .filter(Boolean);
    for (const path of untracked) {
      mkdirSync(dirname(resolve(copy, path)), { recursive: true });
      cpSync(resolve(root, path), resolve(copy, path), { verbatimSymlinks: true });
    }
  } catch (error) {
    cleanup();
    throw new InputError(
      `cannot build the isolated copy: ${error.stderr?.toString().trim() || error.message}`,
    );
  }
  return { copy, cleanup };
}

// The root node_modules and the node_modules of every tracked package.json directory, linked into the copy.
function linkNodeModules(root, copy) {
  const directories = git(root, ['ls-files', '-z'], { encoding: 'utf8' })
    .split('\0')
    .filter((path) => path === 'package.json' || path.endsWith('/package.json'))
    .map((path) => dirname(path));
  for (const directory of new Set(['.', ...directories])) {
    const source = resolve(root, directory, 'node_modules');
    const target = resolve(copy, directory, 'node_modules');
    if (existsSync(source) && !existsSync(target)) symlinkSync(source, target, 'dir');
  }
}

// Commands that are running, so an interrupt can stop their process groups.
const running = new Set();

function stopGroup(child) {
  try {
    process.kill(-child.pid, 'SIGKILL');
  } catch {}
}

// Runs in its own process group so a timeout also stops the processes the command started. NODE_TEST_CONTEXT is left
// out: inherited from a surrounding `node --test`, it makes a child `node --test` run nothing and exit 0.
function runCommand(command, cwd, timeoutMs) {
  const { NODE_TEST_CONTEXT: _context, ...env } = process.env;
  return new Promise((resolvePromise) => {
    const started = Date.now();
    let output = '';
    let timedOut = false;
    let child;
    try {
      child = spawn(command[0], command.slice(1), {
        cwd,
        env,
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (error) {
      resolvePromise({ exit: null, timedOut, output: error.message, durationMs: 0 });
      return;
    }
    running.add(child);
    const timer = setTimeout(() => {
      timedOut = true;
      stopGroup(child);
    }, timeoutMs);
    child.stdout.on('data', (chunk) => (output += chunk));
    child.stderr.on('data', (chunk) => (output += chunk));
    child.on('error', (error) => (output += error.message));
    child.on('close', (code) => {
      clearTimeout(timer);
      running.delete(child);
      resolvePromise({ exit: code, timedOut, output, durationMs: Date.now() - started });
    });
  });
}

const tail = (output) => output.trim().split('\n').slice(-5).join('\n');

async function runMutation(copy, plan, mutation) {
  const base = { id: mutation.id, file: mutation.file };
  const path = resolve(copy, mutation.file);
  if (!isFile(path))
    return { ...base, status: 'target-missing', detail: 'no such file in the copy' };
  // A symlink (such as a linked node_modules) can lead back to the original checkout, which is never written.
  const inside = relative(realpathSync(copy), realpathSync(path));
  if (!inside || inside.startsWith(`..${sep}`) || isAbsolute(inside))
    return { ...base, status: 'target-missing', detail: 'file resolves outside the isolated copy' };
  const original = readFileSync(path, 'utf8');
  const parts = original.split(mutation.find);
  const count = parts.length - 1;
  if (count === 0) return { ...base, status: 'target-missing', detail: 'find not present' };
  if (count > 1 && mutation.occurrence === undefined)
    return { ...base, status: 'ambiguous', detail: `find matches ${count} times; set occurrence` };
  const occurrence = mutation.occurrence ?? 1;
  if (occurrence > count)
    return { ...base, status: 'target-missing', detail: `occurrence ${occurrence} of ${count}` };
  const mutated =
    parts.slice(0, occurrence).join(mutation.find) +
    mutation.replace +
    parts.slice(occurrence).join(mutation.find);
  writeFileSync(path, mutated);
  let run;
  try {
    run = await runCommand(plan.command, copy, plan.timeoutMs);
  } finally {
    writeFileSync(path, original);
  }
  const outcome = { ...base, exit: run.exit, durationMs: run.durationMs };
  if (run.timedOut)
    return { ...outcome, status: 'timeout', detail: `no exit within ${plan.timeoutMs} ms` };
  if (run.exit === 0)
    return { ...outcome, status: 'survived', detail: 'command passed with the mutation' };
  const missing = mutation.patterns.filter((pattern) => !pattern.test(run.output));
  if (missing.length)
    return {
      ...outcome,
      status: 'wrong-reason',
      detail: `output does not match ${missing.map(String).join(', ')}: ${tail(run.output)}`,
    };
  return { ...outcome, status: 'killed' };
}

// An interrupt (Ctrl-C or SIGTERM) stops the running command and removes the copy before the process exits.
function onInterrupt(cleanup) {
  const handlers = Object.entries({ SIGINT: 130, SIGTERM: 143 }).map(([signal, code]) => {
    const handler = () => {
      running.forEach(stopGroup);
      cleanup();
      process.exit(code);
    };
    process.once(signal, handler);
    return [signal, handler];
  });
  return () => handlers.forEach(([signal, handler]) => process.off(signal, handler));
}

export async function runHarness({ root, plan, linkNodeModules: link = false }) {
  const { copy, cleanup } = isolate(root);
  const release = onInterrupt(cleanup);
  try {
    if (link) linkNodeModules(root, copy);
    const baselineRun = await runCommand(plan.command, copy, plan.timeoutMs);
    const baseline = {
      status: baselineRun.exit === 0 && !baselineRun.timedOut ? 'passed' : 'baseline-failed',
      exit: baselineRun.exit,
      timedOut: baselineRun.timedOut,
      durationMs: baselineRun.durationMs,
    };
    const results = [];
    if (baseline.status === 'passed')
      for (const mutation of plan.mutations) results.push(await runMutation(copy, plan, mutation));
    else baseline.detail = tail(baselineRun.output);
    const killed = results.filter(({ status }) => status === 'killed').length;
    return {
      baseline,
      results,
      summary: {
        mutations: plan.mutations.length,
        killed,
        violations: baseline.status === 'passed' ? results.length - killed : 1,
      },
    };
  } finally {
    release();
    cleanup();
  }
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
      options: {
        spec: { type: 'string' },
        root: { type: 'string' },
        'link-node-modules': { type: 'boolean' },
        json: { type: 'boolean' },
      },
    }).values;
  } catch (error) {
    throw new InputError(error.message);
  }
}

function readSpec(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new InputError(`${path}: ${error.message}`);
  }
}

function format(result) {
  const lines = [`baseline\t${result.baseline.status}\texit ${result.baseline.exit}`];
  for (const { id, status, file, detail } of result.results)
    lines.push(`${id}\t${status}\t${file}\t${detail ?? ''}`);
  lines.push(
    Object.entries(result.summary)
      .map(([key, value]) => `${key} ${value}`)
      .join(' '),
  );
  return lines.join('\n');
}

export async function main(
  argv,
  { cwd = process.cwd(), log = console.log, error = console.error } = {},
) {
  try {
    const values = parseOptions(argv);
    if (!values.spec)
      throw new InputError(
        'usage: mutation-harness --spec <JSON> [--link-node-modules] [--root <repo>] [--json]',
      );
    const linkNodeModules = values['link-node-modules'] ?? false;
    const plan = validateSpec(readSpec(resolve(cwd, values.spec)), { linkNodeModules });
    // Git lists untracked paths relative to the directory it runs in, so a subdirectory root means its repository.
    const root = gitRoot(values.root ? resolve(cwd, values.root) : cwd);
    const result = await runHarness({ root, plan, linkNodeModules });
    log(values.json ? JSON.stringify({ root, ...result }, null, 2) : format(result));
    return result.summary.violations ? 1 : 0;
  } catch (caught) {
    if (!(caught instanceof InputError)) throw caught;
    error(caught.message);
    return 2;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code;
    },
    (error) => {
      console.error(error.stack ?? error.message);
      process.exitCode = 2;
    },
  );
}
