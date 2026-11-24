import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';

// OSS-RL P5 RED 2: the read trace a runner record keeps beside its log. The wrapper runs one command with a preload in
// every node process it reaches through NODE_OPTIONS, writes the record log itself and lists the repository paths those
// processes read, the spawns that are not node and the calls it cannot observe.
const tool = resolve(import.meta.dirname, '../../../agents/common/runner-read-trace.mjs');
const HEADER = `KNU review snapshot sha256:${'a'.repeat(64)}`;
const temporary = [];
test.after(() => temporary.forEach((path) => rmSync(path, { recursive: true, force: true })));

const DATA = {
  'data/a.txt': 'a\n',
  'data/b.txt': 'b\n',
  'data/c.txt': 'c\n',
  'data/d.txt': 'd\n',
  'data/e.txt': 'e\n',
  'data/f.txt': 'f\n',
  'data/g.txt': 'g\n',
  'data/dir/inner.txt': 'inner\n',
  'lib/mod.mjs': 'export const value = 1;\n',
};

// A repository holding the data files and the probe script, and a temp directory outside it (OUTSIDE in the probe).
function fixture(probe, files = {}) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'runner-read-trace-')));
  const outside = realpathSync(mkdtempSync(join(tmpdir(), 'runner-read-trace-outside-')));
  temporary.push(root, outside);
  execFileSync('git', ['init', '-q'], { cwd: root });
  for (const [path, text] of Object.entries({ ...DATA, ...files, 'probe.mjs': probe })) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  mkdirSync(join(root, 'out'));
  return { root, outside };
}

function run({ root, outside }, argv = [process.execPath, 'probe.mjs']) {
  const result = spawnSync(
    process.execPath,
    [tool, '--header', HEADER, '--out', 'out/trace.json', '--log', 'out/run.log', '--', ...argv],
    { cwd: root, encoding: 'utf8', env: { ...process.env, OUTSIDE: outside } },
  );
  const read = (path, parse) => {
    try {
      const text = readFileSync(join(root, path), 'utf8');
      return parse ? JSON.parse(text) : text;
    } catch {
      return null;
    }
  };
  return { result, trace: read('out/trace.json', true), log: read('out/run.log', false) };
}

const kindsOf = (trace, path) => trace?.reads?.find((entry) => entry.path === path)?.kinds ?? [];
const traced = (outcome) => {
  assert.ok(
    outcome.trace,
    `trace written (exit ${outcome.result.status}): ${outcome.result.stderr}`,
  );
  assert.equal(outcome.trace.schema, 'runner-read-trace/v1');
  return outcome.trace;
};

test('a read of a repository path is in the trace with kind read (fs and fs/promises)', () => {
  const trace = traced(
    run(
      fixture(`
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
readFileSync('data/a.txt', 'utf8');
await readFile('data/b.txt', 'utf8');
`),
    ),
  );
  assert.deepEqual(kindsOf(trace, 'data/a.txt'), ['read']);
  assert.deepEqual(kindsOf(trace, 'data/b.txt'), ['read']);
});

test('a directory listing of a repository path is in the trace with kind list', () => {
  const trace = traced(
    run(fixture(`import { readdirSync } from 'node:fs';\nreaddirSync('data/dir');\n`)),
  );
  assert.deepEqual(kindsOf(trace, 'data/dir'), ['list']);
});

test('an existence check of a repository path is in the trace with kind exists', () => {
  const trace = traced(
    run(
      fixture(
        `import { existsSync, statSync } from 'node:fs';\nexistsSync('data/c.txt');\nstatSync('data/e.txt');\n`,
      ),
    ),
  );
  assert.deepEqual(kindsOf(trace, 'data/c.txt'), ['exists']);
  assert.deepEqual(kindsOf(trace, 'data/e.txt'), ['exists']);
});

test('the source of a copy is in the trace with kind copy', () => {
  const trace = traced(
    run(
      fixture(
        `import { copyFileSync } from 'node:fs';\ncopyFileSync('data/d.txt', process.env.OUTSIDE + '/copy.txt');\n`,
      ),
    ),
  );
  assert.deepEqual(kindsOf(trace, 'data/d.txt'), ['copy']);
});

test('a module load of a repository file is in the trace with kind module', () => {
  const trace = traced(run(fixture(`await import('./lib/mod.mjs');\n`)));
  assert.deepEqual(kindsOf(trace, 'lib/mod.mjs'), ['module']);
  assert.ok(kindsOf(trace, 'probe.mjs').includes('module'), 'the entry script is a module load');
});

test('paths outside the repository are not listed and each repository path is listed once', () => {
  const trace = traced(
    run(
      fixture(`
import { readFileSync, writeFileSync } from 'node:fs';
writeFileSync(process.env.OUTSIDE + '/x.txt', 'x');
readFileSync(process.env.OUTSIDE + '/x.txt');
readFileSync('data/a.txt');
readFileSync('data/a.txt');
`),
    ),
  );
  assert.ok(
    trace.reads.every((entry) => !entry.path.startsWith('..') && !entry.path.startsWith('/')),
    JSON.stringify(trace.reads),
  );
  assert.equal(trace.reads.filter((entry) => entry.path === 'data/a.txt').length, 1);
});

test('a read through a symlink outside the repository names the repository file it resolves to', () => {
  const f = fixture(
    `import { readFileSync } from 'node:fs';\nreadFileSync(process.env.OUTSIDE + '/link.txt');\n`,
  );
  symlinkSync(join(f.root, 'data/f.txt'), join(f.outside, 'link.txt'));
  const trace = traced(run(f));
  assert.deepEqual(kindsOf(trace, 'data/f.txt'), ['read']);
});

test('the reads of a child node process (execFileSync) are in the trace', () => {
  const trace = traced(
    run(
      fixture(
        `import { execFileSync } from 'node:child_process';\nexecFileSync(process.execPath, ['child.mjs'], { stdio: 'inherit' });\n`,
        { 'child.mjs': `import { readFileSync } from 'node:fs';\nreadFileSync('data/g.txt');\n` },
      ),
    ),
  );
  assert.deepEqual(kindsOf(trace, 'data/g.txt'), ['read']);
  assert.equal(trace.nonNodeSpawns, 0);
});

test('bash and python3 children count as spawns that are not node', () => {
  const trace = traced(
    run(
      fixture(`
import { spawnSync } from 'node:child_process';
spawnSync('bash', ['-c', 'true']);
spawnSync('python3', ['-c', 'pass']);
`),
    ),
  );
  assert.equal(trace.nonNodeSpawns, 2);
});

test('globSync on a repository path and a worker thread are unobserved calls', () => {
  const trace = traced(
    run(
      fixture(`
import { globSync } from 'node:fs';
import { Worker } from 'node:worker_threads';
globSync('data/*.txt');
await new Promise((done) => new Worker('1', { eval: true }).on('exit', done));
`),
    ),
  );
  const calls = trace.unobserved.map((entry) => entry.call);
  assert.ok(calls.includes('globSync'), JSON.stringify(trace.unobserved));
  assert.ok(calls.includes('Worker'), JSON.stringify(trace.unobserved));
});

test('the wrapper exits with the command exit, writes the record log and binds argv and the log digest', () => {
  const f = fixture(`console.log('probe output line');\nprocess.exitCode = 3;\n`);
  const { result, trace, log } = run(f);
  assert.equal(result.status, 3, result.stderr);
  assert.ok(log, 'the wrapper writes the log');
  const lines = log.split('\n');
  assert.equal(lines[0], HEADER);
  assert.equal(lines[1], process.version);
  assert.ok(lines.includes('probe output line'), log);
  assert.equal(lines.filter(Boolean).at(-1), 'exit=3');
  assert.ok(trace, 'trace written');
  assert.equal(trace.header, HEADER);
  assert.deepEqual(trace.argv, [process.execPath, 'probe.mjs']);
  assert.equal(trace.log.path, 'out/run.log');
  assert.equal(
    trace.log.sha256,
    `sha256:${createHash('sha256')
      .update(readFileSync(join(f.root, 'out/run.log')))
      .digest('hex')}`,
  );
});

test('input errors exit 2 without running a command', () => {
  const f = fixture(`process.exitCode = 0;\n`);
  for (const args of [
    ['--out', 'out/t.json', '--log', 'out/l.log', '--', process.execPath, 'probe.mjs'],
    ['--header', HEADER, '--log', 'out/l.log', '--', process.execPath, 'probe.mjs'],
    ['--header', HEADER, '--out', 'out/t.json', '--', process.execPath, 'probe.mjs'],
    ['--header', HEADER, '--out', 'out/t.json', '--log', 'out/l.log', '--'],
    ['--header', 'no digest', '--out', 'out/t.json', '--log', 'out/l.log', '--', 'true'],
  ]) {
    const result = spawnSync(process.execPath, [tool, ...args], { cwd: f.root, encoding: 'utf8' });
    assert.equal(result.status, 2, `${args.join(' ')}: ${result.stderr}`);
  }
});
