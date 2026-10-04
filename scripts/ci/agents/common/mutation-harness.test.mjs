import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';

import { main } from '../../../agents/common/mutation-harness.mjs';

const tool = resolve(import.meta.dirname, '../../../agents/common/mutation-harness.mjs');
const temporary = [];
test.after(() => temporary.forEach((path) => rmSync(path, { recursive: true, force: true })));

const NODE_TEST = [process.execPath, '--test', 'test/sum.test.mjs'];
const FILES = {
  '.gitignore': 'ignored.txt\nnode_modules/\n',
  'src/sum.mjs':
    "export function sum(a, b) {\n  return a + b;\n}\nexport function label() {\n  return 'sum';\n}\n",
  'test/sum.test.mjs':
    "import assert from 'node:assert/strict';\nimport test from 'node:test';\nimport { sum } from '../src/sum.mjs';\n\ntest('sum adds', () => {\n  assert.equal(sum(1, 2), 3);\n});\n",
};

function writeTree(root, files) {
  for (const [path, text] of Object.entries(files)) {
    const target = resolve(root, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, text);
  }
}

const git = (cwd, ...args) =>
  execFileSync('git', ['-c', 'user.email=t@example.com', '-c', 'user.name=t', ...args], {
    cwd,
    encoding: 'utf8',
  });

// A committed repository with one uncommitted edit, one untracked file and one ignored file: the isolated copy must
// carry the edit and the untracked file but not the ignored one.
function fixture(extra = {}) {
  const root = mkdtempSync(resolve(tmpdir(), 'mutation-harness-'));
  temporary.push(root);
  writeTree(root, FILES);
  git(root, 'init', '-q');
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'fixture');
  writeTree(root, {
    'src/sum.mjs': FILES['src/sum.mjs'].replace("'sum'", "'sum (dirty)'"),
    'src/untracked.mjs': 'export const untracked = 1;\n',
    'ignored.txt': 'ignored target\n',
    ...extra,
  });
  return root;
}

// Every file under the root except .git with its content digest, plus the porcelain status and the worktree list.
function state(root) {
  const files = [];
  const walk = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      if (entry.name === '.git') continue;
      if (entry.isDirectory()) walk(path);
      else
        files.push([
          path.slice(root.length + 1),
          createHash('sha256').update(readFileSync(path)).digest('hex'),
        ]);
    }
  };
  walk(root);
  return {
    files: files.sort(),
    status: git(root, 'status', '--porcelain'),
    worktrees: git(root, 'worktree', 'list', '--porcelain'),
  };
}

async function run(root, spec, flags = []) {
  const directory = mkdtempSync(resolve(tmpdir(), 'mutation-spec-'));
  temporary.push(directory);
  const specPath = resolve(directory, 'spec.json');
  writeFileSync(specPath, JSON.stringify(spec));
  const out = [];
  const err = [];
  const code = await main(['--json', '--spec', specPath, ...flags], {
    cwd: root,
    log: (line) => out.push(line),
    error: (line) => err.push(line),
  });
  return { code, out: out.join('\n'), err: err.join('\n') };
}

function json(text) {
  assert.match(text, /^\{/u, 'JSON output');
  return JSON.parse(text);
}

const statuses = (out) => Object.fromEntries(json(out).results.map((r) => [r.id, r.status]));

test('each mutation gets its own status and the original tree and worktree list stay unchanged', async () => {
  const root = fixture();
  const before = state(root);
  const { code, out } = await run(root, {
    command: NODE_TEST,
    timeoutSeconds: 30,
    mutations: [
      {
        id: 'killed',
        file: 'src/sum.mjs',
        find: 'a + b',
        replace: 'a - b',
        expect: ['AssertionError'],
      },
      { id: 'survived', file: 'src/sum.mjs', find: "'sum (dirty)'", replace: "'other'" },
      { id: 'missing', file: 'src/sum.mjs', find: 'a * b', replace: 'a / b' },
      { id: 'missing-file', file: 'src/absent.mjs', find: 'x', replace: 'y' },
      { id: 'ignored-not-copied', file: 'ignored.txt', find: 'ignored target', replace: 'x' },
      { id: 'ambiguous', file: 'src/sum.mjs', find: 'return', replace: 'return void 0 ||' },
      {
        id: 'occurrence',
        file: 'src/sum.mjs',
        find: 'return',
        replace: 'return -1 +',
        occurrence: 1,
        expect: ['AssertionError'],
      },
      { id: 'untracked-copied', file: 'src/untracked.mjs', find: '= 1', replace: '= 2' },
      {
        id: 'occurrence-past',
        file: 'src/sum.mjs',
        find: 'return',
        replace: 'return -1 +',
        occurrence: 3,
      },
      {
        id: 'wrong-reason',
        file: 'src/sum.mjs',
        find: 'return a + b;',
        replace: "throw new Error('boom');",
        expect: ['AssertionError'],
      },
    ],
  });
  assert.equal(code, 1);
  assert.deepEqual(statuses(out), {
    killed: 'killed',
    survived: 'survived',
    missing: 'target-missing',
    'missing-file': 'target-missing',
    'ignored-not-copied': 'target-missing',
    ambiguous: 'ambiguous',
    occurrence: 'killed',
    'untracked-copied': 'survived',
    'occurrence-past': 'target-missing',
    'wrong-reason': 'wrong-reason',
  });
  assert.deepEqual(json(out).baseline.status, 'passed');
  assert.deepEqual(state(root), before);
});

test('only killed mutations pass', async () => {
  const root = fixture();
  const { code, out } = await run(root, {
    command: NODE_TEST,
    mutations: [{ id: 'killed', file: 'src/sum.mjs', find: 'a + b', replace: 'a - b' }],
  });
  assert.equal(code, 0);
  assert.deepEqual(json(out).summary, { mutations: 1, killed: 1, violations: 0 });
});

test('a subdirectory root still copies the whole repository', async () => {
  const root = fixture();
  const { code, out } = await run(
    root,
    {
      command: NODE_TEST,
      mutations: [
        { id: 'untracked-copied', file: 'src/untracked.mjs', find: '= 1', replace: '= 2' },
      ],
    },
    ['--root', resolve(root, 'src')],
  );
  assert.equal(code, 1);
  assert.deepEqual(statuses(out), { 'untracked-copied': 'survived' });
});

test('a mutation that hangs the command times out and the copy is still removed', async () => {
  const root = fixture();
  const before = state(root);
  const { code, out } = await run(root, {
    command: NODE_TEST,
    timeoutSeconds: 3,
    mutations: [
      { id: 'hang', file: 'src/sum.mjs', find: 'return a + b;', replace: 'while (true) {}' },
    ],
  });
  assert.equal(code, 1);
  assert.deepEqual(statuses(out), { hang: 'timeout' });
  assert.deepEqual(state(root), before);
});

test('a failing baseline stops before any mutation', async () => {
  const root = fixture();
  const { code, out } = await run(root, {
    command: [process.execPath, '-e', 'process.exit(3)'],
    mutations: [{ id: 'never', file: 'src/sum.mjs', find: 'a + b', replace: 'a - b' }],
  });
  assert.equal(code, 1);
  assert.equal(json(out).baseline.status, 'baseline-failed');
  assert.deepEqual(json(out).results, []);
});

test('linked node_modules let the copy import installed packages', async () => {
  const root = fixture({
    'node_modules/fake-dep/package.json':
      '{ "name": "fake-dep", "type": "module", "main": "index.mjs" }\n',
    'node_modules/fake-dep/index.mjs': 'export const value = 3;\n',
    'test/dep.test.mjs':
      "import assert from 'node:assert/strict';\nimport test from 'node:test';\nimport { value } from 'fake-dep';\nimport { sum } from '../src/sum.mjs';\n\ntest('dep', () => {\n  assert.equal(sum(1, 2), value);\n});\n",
  });
  const spec = {
    command: [process.execPath, '--test', 'test/dep.test.mjs'],
    mutations: [{ id: 'killed', file: 'src/sum.mjs', find: 'a + b', replace: 'a - b' }],
  };
  const unlinked = await run(root, spec);
  assert.equal(json(unlinked.out).baseline.status, 'baseline-failed');
  const before = state(root);
  // A linked package resolves to the original checkout, so writing it would change the original tree.
  const linked = await run(
    root,
    {
      ...spec,
      mutations: [
        ...spec.mutations,
        {
          id: 'linked-dependency',
          file: 'node_modules/fake-dep/index.mjs',
          find: 'value = 3',
          replace: 'value = 4',
        },
      ],
    },
    ['--link-node-modules'],
  );
  assert.equal(linked.code, 1);
  assert.deepEqual(statuses(linked.out), {
    killed: 'killed',
    'linked-dependency': 'target-missing',
  });
  assert.deepEqual(state(root), before);
});

for (const [signal, code] of [
  ['SIGINT', 130],
  ['SIGTERM', 143],
]) {
  test(`an interrupt (${signal}) stops the command and removes the copy`, async () => {
    const root = fixture();
    const before = state(root);
    const directory = mkdtempSync(resolve(tmpdir(), 'mutation-signal-'));
    temporary.push(directory);
    const pidFile = resolve(directory, 'pid');
    const specPath = resolve(directory, 'spec.json');
    writeFileSync(
      specPath,
      JSON.stringify({
        command: [
          process.execPath,
          '-e',
          "require('node:fs').writeFileSync(process.env.HARNESS_PID_FILE, String(process.pid)); setInterval(() => {}, 1000);",
        ],
        timeoutSeconds: 60,
        mutations: [{ id: 'm', file: 'src/sum.mjs', find: 'a + b', replace: 'a - b' }],
      }),
    );
    const { NODE_TEST_CONTEXT: _context, ...env } = process.env;
    const harness = spawn(process.execPath, [tool, '--spec', specPath], {
      cwd: root,
      env: { ...env, HARNESS_PID_FILE: pidFile },
      stdio: 'ignore',
    });
    const exited = new Promise((done) =>
      harness.on('exit', (code, signal) => done({ code, signal })),
    );
    while (!existsSync(pidFile) || !readFileSync(pidFile, 'utf8')) await delay(50);
    const pid = Number(readFileSync(pidFile, 'utf8'));
    // The copy the harness made, so this test can clean up after itself even when the harness under test is broken.
    const copies = git(root, 'worktree', 'list', '--porcelain')
      .split('\n')
      .filter((line) => line.startsWith('worktree '))
      .map((line) => line.slice('worktree '.length))
      .slice(1);
    try {
      harness.kill(signal);
      assert.deepEqual(await exited, { code, signal: null });
      await delay(200);
      assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' });
      assert.deepEqual(state(root), before);
    } finally {
      try {
        process.kill(pid, 'SIGKILL');
      } catch {}
      copies.forEach((copy) => rmSync(dirname(copy), { recursive: true, force: true }));
    }
  });
}

test('input errors exit 2 instead of passing', async () => {
  const root = fixture();
  const mutation = { id: 'm', file: 'src/sum.mjs', find: 'a + b', replace: 'a - b' };
  for (const [spec, flags] of [
    [{ command: NODE_TEST, mutations: [] }, []],
    [{ command: [], mutations: [mutation] }, []],
    [{ command: NODE_TEST, mutations: [mutation, mutation] }, []],
    [{ command: NODE_TEST, mutations: [{ ...mutation, find: '' }] }, []],
    [{ command: NODE_TEST, mutations: [{ ...mutation, occurrence: 0 }] }, []],
    [{ command: NODE_TEST, mutations: [{ ...mutation, expect: ['('] }] }, []],
    [{ command: NODE_TEST, timeoutSeconds: 0, mutations: [mutation] }, []],
    [{ command: NODE_TEST, mutations: [mutation], extra: true }, []],
    [{ command: NODE_TEST, mutations: [{ ...mutation, file: '/tmp/x.mjs' }] }, []],
    [{ command: NODE_TEST, mutations: [{ ...mutation, file: '../x.mjs' }] }, []],
    [{ command: NODE_TEST, mutations: [{ ...mutation, file: 'src/../../x.mjs' }] }, []],
    ...[
      'packages/shared/x.mjs',
      './packages/shared/x.mjs',
      'src/../packages/x.mjs',
      'Packages/x.mjs',
    ].map((file) => [
      { command: NODE_TEST, mutations: [{ ...mutation, file }] },
      ['--link-node-modules'],
    ]),
    [{ command: NODE_TEST, mutations: [mutation] }, ['--bogus']],
  ]) {
    const { code, err } = await run(root, spec, flags);
    assert.equal(code, 2, JSON.stringify(spec));
    assert.ok(err.length > 0, JSON.stringify(spec));
  }
  const out = [];
  const err = [];
  assert.equal(
    await main([], { cwd: root, log: (l) => out.push(l), error: (l) => err.push(l) }),
    2,
  );
  writeFileSync(resolve(root, 'bad.json'), '{');
  assert.equal(
    await main(['--spec', 'bad.json'], {
      cwd: root,
      log: (l) => out.push(l),
      error: (l) => err.push(l),
    }),
    2,
  );
});
