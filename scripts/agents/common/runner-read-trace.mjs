// Runner read trace: runs one runner record command, writes the record log itself and keeps beside it the repository
// paths the command's node processes read. A preload (this module, loaded with `--import` through NODE_OPTIONS so every
// node child inherits it) wraps the read, list, exists and copy-source functions of `fs` and `fs/promises` and a module
// load hook. Spawns that are not node and calls it cannot observe (worker threads, `glob`, `watch`) are counted and
// listed, not followed. The trace is input of an advisory warning (evidence-source-outside-read-paths), so a read it
// cannot see makes the warning say less; it never makes a check pass.
// Rules and usage: docs/development/agent-workflows/review-criteria/README.md
//
// Usage: node scripts/agents/common/runner-read-trace.mjs --header "<logHeader>" --out <trace.json> --log <log>
//          [--root <repo>] -- <command> [args...]
// The log is the header, the `node --version` value, the command's stdout and stderr and `exit=<n>`. The exit is the
// command's (128 + signal number for a signal); 2 is an input error (missing option or command, header without a
// trailing `sha256:<64 hex>`, missing root), and no command runs then.

import { execFileSync, spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import { constants, tmpdir } from 'node:os';
import { basename, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

export const TRACE_SCHEMA = 'runner-read-trace/v1';
const SINK = 'KNU_RUNNER_READ_TRACE_DIR';
const ROOT = 'KNU_RUNNER_READ_TRACE_ROOT';
const HEADER = /^\S.* sha256:[0-9a-f]{64}$/u;
const USAGE =
  'usage: runner-read-trace --header "<logHeader>" --out <trace.json> --log <log> [--root <repo>] -- <command> [args...]';
const selfPath = fileURLToPath(import.meta.url);

class InputError extends Error {}

// Node executables: the running one, and a bare or absolute `node`.
const isNode = (file) =>
  typeof file === 'string' &&
  (file === process.execPath || basename(file) === 'node' || basename(file) === 'node.exe');

// ---------------------------------------------------------------------------------------------------------------
// Preload: installed when this module is loaded in a traced process (the sink variable is set and it is not the CLI).
function installPreload(rootDir) {
  const original = {
    realpathSync: fs.realpathSync.native ?? fs.realpathSync,
    writeFileSync: fs.writeFileSync,
  };
  const reads = new Map();
  const unobserved = new Map();
  let nonNodeSpawns = 0;
  const known = new Map();
  // The repository-relative path of an argument, or null outside the repository or for a descriptor.
  const repositoryPath = (value, base = process.cwd()) => {
    let text;
    if (typeof value === 'string') text = value;
    else if (value instanceof URL) text = value.protocol === 'file:' ? fileURLToPath(value) : null;
    else if (Buffer.isBuffer(value)) text = value.toString();
    else return null;
    if (text === null) return null;
    const absolute = resolve(base, text);
    if (known.has(absolute)) return known.get(absolute);
    let real = absolute;
    try {
      real = original.realpathSync(absolute);
    } catch {
      real = absolute;
    }
    const inside = relative(rootDir, real);
    const path = inside && !inside.startsWith('..') && !isAbsolute(inside) ? inside : null;
    known.set(absolute, path);
    return path;
  };
  // The module loader reads a module's source through fs; inside the load hook that read is the module load itself.
  let loading = 0;
  const loadingModule = (load) => {
    loading += 1;
    try {
      return load();
    } finally {
      loading -= 1;
    }
  };
  const record = (kind, value, base) => {
    if (loading > 0 && kind !== 'module') return;
    const path = repositoryPath(value, base);
    if (path === null || path === relative(rootDir, selfPath)) return;
    if (!reads.has(path)) reads.set(path, new Set());
    reads.get(path).add(kind);
  };
  const unobservedCall = (call, value, base) => {
    const path = value === undefined ? undefined : repositoryPath(value, base);
    if (value !== undefined && path === null) return;
    unobserved.set(`${call}\0${path ?? ''}`, path === undefined ? { call } : { call, path });
  };
  const wrap = (target, name, before) => {
    const fn = target[name];
    if (typeof fn !== 'function') return;
    target[name] = function traced(...args) {
      try {
        before(...args);
      } catch {
        // A trace failure never changes the traced call.
      }
      return fn.apply(this, args);
    };
  };
  const readFlags = (flags) =>
    flags === undefined ||
    (typeof flags === 'string' && flags.startsWith('r')) ||
    (typeof flags === 'number' && (flags & 3) !== 1);
  for (const target of [fs, fs.promises]) {
    for (const name of ['readFile', 'readFileSync', 'createReadStream'])
      wrap(target, name, (path) => record('read', path));
    for (const name of ['open', 'openSync'])
      wrap(target, name, (path, flags) => {
        if (readFlags(flags)) record('read', path);
      });
    for (const name of ['readdir', 'readdirSync', 'opendir', 'opendirSync'])
      wrap(target, name, (path) => record('list', path));
    for (const name of [
      'exists',
      'existsSync',
      'stat',
      'statSync',
      'lstat',
      'lstatSync',
      'access',
      'accessSync',
    ])
      wrap(target, name, (path) => record('exists', path));
    for (const name of ['copyFile', 'copyFileSync', 'cp', 'cpSync'])
      wrap(target, name, (path) => record('copy', path));
    for (const name of ['glob', 'globSync'])
      wrap(target, name, (pattern, options) => {
        const base = typeof options?.cwd === 'string' ? options.cwd : process.cwd();
        for (const one of Array.isArray(pattern) ? pattern : [pattern])
          unobservedCall(name, one, base);
      });
    for (const name of ['watch', 'watchFile'])
      wrap(target, name, (path) => unobservedCall(name, path));
  }
  return {
    record,
    loadingModule,
    unobservedCall,
    reads,
    unobserved,
    original,
    count: () => (nonNodeSpawns += 1),
    state: () => nonNodeSpawns,
  };
}

async function preload() {
  const sinkDir = process.env[SINK];
  const rootDir = process.env[ROOT];
  if (!sinkDir || !rootDir) return;
  const trace = installPreload(rootDir);
  const { default: childProcess } = await import('node:child_process');
  const { default: workerThreads } = await import('node:worker_threads');
  const moduleApi = await import('node:module');
  // A node child without this preload in its NODE_OPTIONS is not traced: it is an unobserved call. Node refuses options
  // that are no object, so the env of any other value is no environment.
  const childEnvironment = (options) => options?.env;
  const nodeChild = (env) => {
    if (
      env !== undefined &&
      !String(env?.NODE_OPTIONS ?? '').includes(pathToFileURL(selfPath).href)
    )
      trace.unobservedCall('node-without-trace');
  };
  const spawnOf = (file, args, options) => {
    const opts = Array.isArray(args) ? options : args;
    if (opts?.shell) return trace.count();
    if (isNode(file)) return nodeChild(childEnvironment(opts));
    trace.count();
  };
  const wrapChild = (name, before) => {
    const fn = childProcess[name];
    childProcess[name] = function traced(...args) {
      try {
        before(...args);
      } catch {
        // A trace failure never changes the spawn.
      }
      return fn.apply(this, args);
    };
  };
  for (const name of ['spawn', 'spawnSync', 'execFile', 'execFileSync']) wrapChild(name, spawnOf);
  for (const name of ['exec', 'execSync']) wrapChild(name, () => trace.count());
  wrapChild('fork', (path, args, options) =>
    nodeChild(childEnvironment(Array.isArray(args) ? options : args)),
  );
  const OriginalWorker = workerThreads.Worker;
  workerThreads.Worker = class TracedWorker extends OriginalWorker {
    constructor(...args) {
      trace.unobservedCall('Worker');
      super(...args);
    }
  };
  if (typeof moduleApi.registerHooks === 'function')
    moduleApi.registerHooks({
      load(url, context, nextLoad) {
        if (url.startsWith('file:')) trace.record('module', new URL(url));
        return trace.loadingModule(() => nextLoad(url, context));
      },
    });
  else trace.unobservedCall('module-load-hook');
  moduleApi.syncBuiltinESMExports();
  process.on('exit', () => {
    const value = {
      reads: Object.fromEntries([...trace.reads].map(([path, kinds]) => [path, [...kinds]])),
      unobserved: [...trace.unobserved.values()],
      nonNodeSpawns: trace.state(),
    };
    try {
      trace.original.writeFileSync(
        join(sinkDir, `${process.pid}-${randomUUID()}.json`),
        JSON.stringify(value),
      );
    } catch {
      // A process that cannot write its part leaves its reads out of the trace.
    }
  });
}

// ---------------------------------------------------------------------------------------------------------------
// CLI.
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
  const at = argv.indexOf('--');
  const own = at < 0 ? argv : argv.slice(0, at);
  const command = at < 0 ? [] : argv.slice(at + 1);
  let values;
  try {
    ({ values } = parseArgs({
      args: own,
      options: {
        header: { type: 'string' },
        out: { type: 'string' },
        log: { type: 'string' },
        root: { type: 'string' },
      },
    }));
  } catch (error) {
    throw new InputError(`${error.message}\n${USAGE}`);
  }
  if (!values.header || !values.out || !values.log || command.length === 0)
    throw new InputError(USAGE);
  if (!HEADER.test(values.header))
    throw new InputError(
      '--header must be `<text> sha256:<64 lowercase hex>` (the digest is the last token)',
    );
  return { ...values, command };
}

function merge(sinkDir) {
  const reads = new Map();
  const unobserved = new Map();
  let nonNodeSpawns = 0;
  // In name order, so the merge reads the parts the same way on every file system.
  for (const name of fs.readdirSync(sinkDir).sort()) {
    let part;
    try {
      part = JSON.parse(fs.readFileSync(join(sinkDir, name), 'utf8'));
    } catch {
      continue;
    }
    for (const [path, kinds] of Object.entries(part.reads ?? {})) {
      if (!reads.has(path)) reads.set(path, new Set());
      for (const kind of kinds) reads.get(path).add(kind);
    }
    for (const entry of part.unobserved ?? [])
      unobserved.set(`${entry.call}\0${entry.path ?? ''}`, entry);
    nonNodeSpawns += Number.isInteger(part.nonNodeSpawns) ? part.nonNodeSpawns : 0;
  }
  return {
    reads: [...reads.keys()].sort().map((path) => ({ path, kinds: [...reads.get(path)].sort() })),
    unobserved: [...unobserved.keys()].sort().map((key) => unobserved.get(key)),
    nonNodeSpawns,
  };
}

export function main(argv, { cwd = process.cwd(), error = console.error } = {}) {
  let options;
  let root;
  try {
    options = parseOptions(argv);
    try {
      root = fs.realpathSync(options.root ? resolve(cwd, options.root) : gitRoot(cwd));
    } catch (caught) {
      if (caught instanceof InputError) throw caught;
      throw new InputError(`${options.root}: no such directory`);
    }
  } catch (caught) {
    if (!(caught instanceof InputError)) throw caught;
    error(caught.message);
    return 2;
  }
  const logPath = resolve(cwd, options.log);
  const outPath = resolve(cwd, options.out);
  const sinkDir = fs.mkdtempSync(join(tmpdir(), 'runner-read-trace-sink-'));
  const [file, ...args] = options.command;
  // The command itself is a spawn of this wrapper: one that is not node reads outside the trace.
  const topNonNode = isNode(file) ? 0 : 1;
  fs.writeFileSync(logPath, `${options.header}\n${process.version}\n`);
  const fd = fs.openSync(logPath, 'a');
  let exit;
  try {
    const preloadOption = `--import=${pathToFileURL(selfPath).href}`;
    const run = spawnSync(file, args, {
      cwd,
      stdio: ['ignore', fd, fd],
      env: {
        ...process.env,
        NODE_OPTIONS: [process.env.NODE_OPTIONS, preloadOption].filter(Boolean).join(' '),
        [SINK]: sinkDir,
        [ROOT]: root,
      },
    });
    if (run.error) {
      fs.writeSync(fd, `runner-read-trace: ${run.error.message}\n`);
      exit = 127;
    } else exit = run.status ?? 128 + (constants.signals[run.signal] ?? 0);
  } finally {
    fs.closeSync(fd);
  }
  const text = fs.readFileSync(logPath, 'utf8');
  fs.writeFileSync(logPath, `${text.endsWith('\n') ? text : `${text}\n`}exit=${exit}\n`);
  const merged = merge(sinkDir);
  fs.rmSync(sinkDir, { recursive: true, force: true });
  const bytes = fs.readFileSync(logPath);
  const trace = {
    schema: TRACE_SCHEMA,
    header: options.header,
    argv: options.command,
    log: {
      path: relative(root, fs.realpathSync(logPath)),
      sha256: `sha256:${createHash('sha256').update(bytes).digest('hex')}`,
    },
    reads: merged.reads,
    nonNodeSpawns: merged.nonNodeSpawns + topNonNode,
    unobserved: merged.unobserved,
  };
  fs.writeFileSync(outPath, `${JSON.stringify(trace, null, 2)}\n`);
  return exit;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    console.error(error.stack ?? error.message);
    process.exitCode = 2;
  }
} else if (process.env[SINK]) await preload();
