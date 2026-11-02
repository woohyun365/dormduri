import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import test from 'node:test';

import { runImpact } from '../../../agents/common/plan-impact.mjs';
import { lineMap, main, remapSpec } from '../../../agents/common/plan-impact-remap.mjs';

const repoRoot = resolve(import.meta.dirname, '../../../..');
const modulePath = resolve(repoRoot, 'scripts/agents/common/plan-impact-remap.mjs');
const temporary = [];
test.after(() => temporary.forEach((path) => rmSync(path, { recursive: true, force: true })));

// Fixture git runs without hook variables (GIT_DIR, GIT_INDEX_FILE, ...) that would point at another repository.
const env = Object.fromEntries(
  Object.entries(process.env).filter(([name]) => !name.startsWith('GIT_')),
);

function git(cwd, ...args) {
  return execFileSync(
    'git',
    [
      '-c',
      'user.email=t@example.invalid',
      '-c',
      'user.name=t',
      '-c',
      'commit.gpgsign=false',
      ...args,
    ],
    { cwd, env, encoding: 'utf8' },
  );
}

const numbered = (count, prefix = 'L') =>
  Array.from({ length: count }, (_, k) => `${prefix}${k + 1}`);
const text = (lines) => `${lines.join('\n')}\n`;
const read = (directory, path) => readFileSync(resolve(directory, path), 'utf8');

const IMPACT = `${JSON.stringify({
  classes: ['A', 'B', 'NONE'],
  passiveClasses: ['NONE'],
  otherOwnerClasses: [],
  universe: ['docs/**'],
  blockFiles: { extensions: ['md'], names: [] },
})}\n`;

function writeTree(root, files) {
  for (const [path, content] of Object.entries(files)) {
    const target = resolve(root, path);
    if (content === null) {
      rmSync(target, { force: true });
      continue;
    }
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content);
  }
}

// `base` is committed as `from`; `next` (if any) is committed on top as `to`; `worktree` stays uncommitted.
function fixture({ base, next, worktree, spec, config = {}, impact = IMPACT }) {
  const root = mkdtempSync(resolve(tmpdir(), 'plan-impact-remap-'));
  temporary.push(root);
  const repo = resolve(root, 'repo');
  mkdirSync(repo);
  git(repo, 'init', '-q');
  for (const [key, value] of Object.entries(config)) git(repo, 'config', key, value);
  writeTree(repo, base);
  git(repo, 'add', '-A');
  git(repo, 'commit', '-qm', 'base');
  const from = git(repo, 'rev-parse', 'HEAD').trim();
  let to;
  if (next) {
    writeTree(repo, next);
    git(repo, 'add', '-A');
    git(repo, 'commit', '-qm', 'next');
    to = git(repo, 'rev-parse', 'HEAD').trim();
  }
  if (worktree) writeTree(repo, worktree);
  const specDirectory = resolve(root, 'spec');
  writeTree(specDirectory, { 'impact.json': impact, ...spec });
  return { root, repo, specDirectory, from, to, out: resolve(root, 'out') };
}

const remap = (f, overrides = {}) =>
  remapSpec({
    root: f.repo,
    specDirectory: f.specDirectory,
    from: f.from,
    to: f.to,
    outDirectory: f.out,
    ...overrides,
  });
const listed = ({ entries }) =>
  entries.map(({ file, key, action, value }) => [file, key, action, value].join('\t'));

function capture(argv, cwd) {
  const out = [];
  const err = [];
  const code = main(argv, { cwd, log: (line) => out.push(line), error: (line) => err.push(line) });
  return { code, out, err };
}

// L1..L10 with L2 and L5 rewritten and two lines inserted after L8; docs/gone.md is deleted.
function rangeFixture(spec) {
  const lines = numbered(10);
  return fixture({
    base: { 'docs/a.md': text(lines), 'docs/gone.md': text(numbered(3)) },
    next: {
      'docs/a.md': text([
        'L1',
        'L2 바뀜',
        'L3',
        'L4',
        'L5 바뀜',
        ...lines.slice(5, 8),
        'X1',
        'X2',
        'L9',
        'L10',
      ]),
      'docs/gone.md': null,
    },
    spec,
  });
}

test('바뀌지 않은 줄의 rows·overrides 행은 새 줄 번호로 옮기고 바뀐 줄·지운 파일의 행은 dropped로 뺀다', () => {
  const lines = numbered(10);
  const f = fixture({
    base: { 'docs/a.md': text(lines), 'docs/gone.md': text(numbered(3)) },
    next: {
      'docs/a.md': text([
        ...lines.slice(0, 2),
        'N1',
        'N2',
        'L3',
        'L4',
        'L5 바뀜',
        ...lines.slice(5),
      ]),
      'docs/gone.md': null,
    },
    spec: {
      'rows/r.tsv':
        'docs/a.md:1\tA\t그대로\ndocs/a.md:3\tA\t밀림\ndocs/a.md:5\tA\t바뀜\ndocs/gone.md:2\tA\t지운 파일\n',
      'overrides.tsv': 'docs/a.md:9\tB\t판정\n',
    },
  });
  assert.deepEqual(listed(remap(f)), [
    'overrides.tsv\tdocs/a.md:9\tmoved\tdocs/a.md:11',
    'rows/r.tsv\tdocs/a.md:1\tkept\tdocs/a.md:1',
    'rows/r.tsv\tdocs/a.md:3\tmoved\tdocs/a.md:5',
    'rows/r.tsv\tdocs/a.md:5\tdropped\tchanged',
    'rows/r.tsv\tdocs/gone.md:2\tdropped\tdeleted',
  ]);
  assert.equal(read(f.out, 'rows/r.tsv'), 'docs/a.md:1\tA\t그대로\ndocs/a.md:5\tA\t밀림\n');
  assert.equal(read(f.out, 'overrides.tsv'), 'docs/a.md:11\tB\t판정\n');
  assert.equal(read(f.out, 'impact.json'), IMPACT);
});

test('additional 행은 모든 줄이 남을 때만 옮기고 범위 안에 끼운 줄이 있으면 목록을 나눈다', () => {
  const lines = numbered(10);
  const f = fixture({
    base: { 'docs/a.md': text(lines) },
    next: {
      'docs/a.md': text(['L1', 'L2', 'L3 바뀜', ...lines.slice(3, 7), 'X', ...lines.slice(7)]),
    },
    spec: {
      'additional/s.tsv': [
        'docs/a.md:6-9\tA\t끼운 줄',
        'docs/a.md:2,4\tA\t목록',
        'docs/a.md:8-10\tA\t밀린 범위',
        'docs/a.md:3-4\tA\t바뀐 줄 포함',
        'docs/a.md:5-5\tA\t한 줄 범위',
        '',
      ].join('\n'),
    },
  });
  assert.deepEqual(listed(remap(f)), [
    'additional/s.tsv\tdocs/a.md:6-9\tmoved\tdocs/a.md:6-7,9-10',
    'additional/s.tsv\tdocs/a.md:2,4\tkept\tdocs/a.md:2,4',
    'additional/s.tsv\tdocs/a.md:8-10\tmoved\tdocs/a.md:9-11',
    'additional/s.tsv\tdocs/a.md:3-4\tdropped\tchanged',
    'additional/s.tsv\tdocs/a.md:5-5\tkept\tdocs/a.md:5-5',
  ]);
  assert.equal(
    read(f.out, 'additional/s.tsv'),
    'docs/a.md:6-7,9-10\tA\t끼운 줄\ndocs/a.md:2,4\tA\t목록\ndocs/a.md:9-11\tA\t밀린 범위\ndocs/a.md:5-5\tA\t한 줄 범위\n',
  );
});

test('계약 줄 selector는 남은 줄의 처음~끝으로 줄면 narrowed와 뺀 줄을 내고 모두 바뀌면 빠지며, 경로·heading selector는 그대로이고 지운 파일이면 빠진다', () => {
  const f = rangeFixture({
    'contract-targets.tsv': [
      '# 계약',
      'docs/a.md:2-4\tB\tblocks\t앞 줄 바뀜',
      'docs/a.md:4-6\tB\tblocks\t가운데 바뀜',
      'docs/a.md:9-10\tB\tblocks\t밀림',
      'docs/a.md:5\tB\tblocks\t모두 바뀜',
      'docs/a.md:1-2\tB\tblocks\t끝 줄 바뀜',
      'docs/a.md#Section\tB\tblocks\theading',
      'docs/a.md\tB\tfile\t파일',
      'docs/gone.md\tB\tfile\t지운 파일',
      'docs/gone.md#H\tB\tblocks\t지운 heading',
      'docs/gone.md:1-2\tB\tblocks\t지운 범위',
      '',
    ].join('\n'),
  });
  assert.deepEqual(listed(remap(f)), [
    'contract-targets.tsv\tdocs/a.md:2-4\tnarrowed\tdocs/a.md:3-4 removed 2',
    'contract-targets.tsv\tdocs/a.md:4-6\tkept\tdocs/a.md:4-6',
    'contract-targets.tsv\tdocs/a.md:9-10\tmoved\tdocs/a.md:11-12',
    'contract-targets.tsv\tdocs/a.md:5\tdropped\tchanged',
    'contract-targets.tsv\tdocs/a.md:1-2\tnarrowed\tdocs/a.md:1 removed 2',
    'contract-targets.tsv\tdocs/a.md#Section\tkept\tdocs/a.md#Section',
    'contract-targets.tsv\tdocs/a.md\tkept\tdocs/a.md',
    'contract-targets.tsv\tdocs/gone.md\tdropped\tdeleted',
    'contract-targets.tsv\tdocs/gone.md#H\tdropped\tdeleted',
    'contract-targets.tsv\tdocs/gone.md:1-2\tdropped\tdeleted',
  ]);
  assert.equal(
    read(f.out, 'contract-targets.tsv'),
    [
      '# 계약',
      'docs/a.md:3-4\tB\tblocks\t앞 줄 바뀜',
      'docs/a.md:4-6\tB\tblocks\t가운데 바뀜',
      'docs/a.md:11-12\tB\tblocks\t밀림',
      'docs/a.md:1\tB\tblocks\t끝 줄 바뀜',
      'docs/a.md#Section\tB\tblocks\theading',
      'docs/a.md\tB\tfile\t파일',
      '',
    ].join('\n'),
  );
});

test('regression 행은 남은 줄만 두고 줄면 narrowed와 뺀 줄을 내며 남은 줄이 없으면 뺀다', () => {
  const f = rangeFixture({
    'regression.tsv': [
      '# 리뷰 지적',
      'docs/a.md\t1-3\tA\t앞 범위',
      'docs/a.md\t9\tA\t밀림',
      'docs/a.md\t5\tA\t바뀜',
      'docs/a.md\t1\tA\t그대로',
      'docs/a.md\t4-6\tA\t가운데',
      'docs/gone.md\t1\tA\t지운 파일',
      '',
    ].join('\n'),
  });
  assert.deepEqual(listed(remap(f)), [
    'regression.tsv\tdocs/a.md:1-3\tnarrowed\tdocs/a.md:1,3 removed 2',
    'regression.tsv\tdocs/a.md:9\tmoved\tdocs/a.md:11',
    'regression.tsv\tdocs/a.md:5\tdropped\tchanged',
    'regression.tsv\tdocs/a.md:1\tkept\tdocs/a.md:1',
    'regression.tsv\tdocs/a.md:4-6\tnarrowed\tdocs/a.md:4,6 removed 5',
    'regression.tsv\tdocs/gone.md:1\tdropped\tdeleted',
  ]);
  assert.equal(
    read(f.out, 'regression.tsv'),
    [
      '# 리뷰 지적',
      'docs/a.md\t1,3\tA\t앞 범위',
      'docs/a.md\t11\tA\t밀림',
      'docs/a.md\t1\tA\t그대로',
      'docs/a.md\t4,6\tA\t가운데',
      '',
    ].join('\n'),
  );
});

test('hunk count가 없으면 한 줄이고 0이면 빈 쪽이다', () => {
  const header = 'diff --git a/f b/f\nindex 1111111..2222222 100644\n--- a/f\n+++ b/f\n';
  // Insertion before the first line (a = 0).
  let map = lineMap(`${header}@@ -0,0 +1,2 @@\n+a\n+b\n`);
  assert.deepEqual(
    [1, 5].map((line) => map(line)),
    [3, 7],
  );
  // Insertion after line 3 (b = 0): line 3 itself stays.
  map = lineMap(`${header}@@ -3,0 +4,2 @@\n+a\n+b\n`);
  assert.deepEqual(
    [2, 3, 4].map((line) => map(line)),
    [2, 3, 6],
  );
  // Deletion at the end; the empty line after the final newline moves up.
  map = lineMap(`${header}@@ -9,2 +8,0 @@\n-a\n-b\n`);
  assert.deepEqual(
    [8, 9, 10, 11].map((line) => map(line)),
    [8, null, null, 9],
  );
  // Two hunks next to each other; a missing count is one line.
  map = lineMap(`${header}@@ -2 +2,3 @@\n-x\n+a\n+b\n+c\n@@ -4 +6 @@\n-y\n+d\n`);
  assert.deepEqual(
    [1, 2, 3, 4, 5].map((line) => map(line)),
    [1, null, 5, null, 7],
  );
  assert.equal(lineMap('')(7), 7);
  assert.throws(() => lineMap(`${header}@@ -a +1 @@\n`), /hunk/u);
  assert.throws(() => lineMap(`${header}@@@ -1 -1 +1 @@@\n`), /hunk/u);

  // The same through git: a file-start insertion, a mid-file insertion and a deletion at the end.
  const f = fixture({
    base: { 'docs/a.md': text(numbered(6)) },
    next: { 'docs/a.md': text(['T', 'L1', 'L2', 'L3', 'M', 'L4']) },
    spec: {
      'rows/r.tsv': 'docs/a.md:1\tA\tx\ndocs/a.md:3\tA\tx\ndocs/a.md:4\tA\tx\ndocs/a.md:6\tA\tx\n',
    },
  });
  assert.deepEqual(listed(remap(f)), [
    'rows/r.tsv\tdocs/a.md:1\tmoved\tdocs/a.md:2',
    'rows/r.tsv\tdocs/a.md:3\tmoved\tdocs/a.md:4',
    'rows/r.tsv\tdocs/a.md:4\tmoved\tdocs/a.md:6',
    'rows/r.tsv\tdocs/a.md:6\tdropped\tchanged',
  ]);
});

test('TOTAL 요약 줄·주석은 그대로 복사하고 malformed 행은 exit 2다', () => {
  const base = { 'docs/a.md': text(numbered(5)) };
  const next = { 'docs/a.md': text(['N', ...numbered(5)]) };
  const f = fixture({
    base,
    next,
    spec: {
      'rows/r.tsv': '# 분류 행\ndocs/a.md:3\tA\t행\r\n\nTOTAL 1\n',
      'regression.tsv': '# 절\ndocs/a.md\t2\tA\t행\n',
      'notes/readme.txt': '그대로 복사\n',
    },
  });
  remap(f);
  assert.equal(read(f.out, 'rows/r.tsv'), '# 분류 행\ndocs/a.md:4\tA\t행\r\n\nTOTAL 1\n');
  assert.equal(read(f.out, 'regression.tsv'), '# 절\ndocs/a.md\t3\tA\t행\n');
  assert.equal(read(f.out, 'notes/readme.txt'), '그대로 복사\n');
  for (const [spec, where] of [
    [{ 'rows/r.tsv': 'docs/a.md:3\tA\n' }, 'rows/r.tsv:1'],
    [{ 'rows/r.tsv': 'docs/a.md\tA\t줄 없음\n' }, 'rows/r.tsv:1'],
    [{ 'rows/r.tsv': 'docs/a.md:0\tA\t0번 줄\n' }, 'rows/r.tsv:1'],
    [{ 'overrides.tsv': 'docs/a.md:3\tA\t행\t넷째 칸\n' }, 'overrides.tsv:1'],
    [{ 'additional/s.tsv': 'docs/a.md:3-x\tA\t행\n' }, 'additional/s.tsv:1'],
    [{ 'additional/s.tsv': 'docs/a.md:4-2\tA\t행\n' }, 'additional/s.tsv:1'],
    [{ 'regression.tsv': 'docs/a.md\tx\tA\t행\n' }, 'regression.tsv:1'],
    [{ 'contract-targets.tsv': 'docs/a.md:1,3\tB\tblocks\t목록\n' }, 'contract-targets.tsv:1'],
  ]) {
    const bad = fixture({ base, next, spec });
    const result = capture(
      [
        '--spec',
        bad.specDirectory,
        '--from',
        bad.from,
        '--to',
        bad.to,
        '--out',
        bad.out,
        '--root',
        bad.repo,
      ],
      bad.root,
    );
    assert.equal(result.code, 2, JSON.stringify(spec));
    assert.deepEqual(result.err, [`${where} malformed`], JSON.stringify(spec));
    assert.equal(existsSync(bad.out), false, JSON.stringify(spec));
  }
});

test('저장소 설정 color.ui=always·diff.interHunkContext·diff.algorithm·diff.relative·textconv와 binary attribute에도 hunk를 같게 읽는다', () => {
  const tools = mkdtempSync(resolve(tmpdir(), 'plan-impact-remap-textconv-'));
  temporary.push(tools);
  const textconv = resolve(tools, 'prefix.mjs');
  writeFileSync(
    textconv,
    "import { readFileSync } from 'node:fs';\nprocess.stdout.write(`PREFIX\\n${readFileSync(process.argv[2], 'utf8')}`);\n",
  );
  const lines = numbered(8);
  const f = fixture({
    config: {
      'color.ui': 'always',
      'diff.interHunkContext': '5',
      'diff.algorithm': 'histogram',
      'diff.relative': 'true',
      'diff.prefix.textconv': `"${process.execPath}" "${textconv}"`,
    },
    base: {
      '.gitattributes': 'docs/*.md diff=prefix\ndocs/*.txt binary\n',
      'docs/a.md': text(lines),
      'docs/b.txt': text(numbered(3)),
      'docs/alg.md': text(['}', 'b', 'c', 'a', '}', 'a', '}', 'a']),
    },
    next: {
      'docs/a.md': text(['L1', 'L2', 'L3 바뀜', 'L4', 'L5', 'L6 바뀜', 'L7', 'L8']),
      'docs/b.txt': text(['T', ...numbered(3)]),
      // myers: 5 changed, 7 deleted, one line added after 8; histogram: 5 becomes two lines, 8 deleted.
      'docs/alg.md': text(['}', 'b', 'c', 'a', 'c', 'a', 'a', '}']),
    },
    spec: {
      'rows/r.tsv': [
        'docs/a.md:3\tA\t바뀜',
        'docs/a.md:4\tA\t사이',
        'docs/a.md:5\tA\t사이',
        'docs/a.md:7\tA\t뒤',
        'docs/b.txt:2\tA\tbinary',
        'docs/alg.md:6\tA\tmyers',
        'docs/alg.md:8\tA\tmyers',
        '',
      ].join('\n'),
    },
  });
  assert.deepEqual(listed(remap(f)), [
    'rows/r.tsv\tdocs/a.md:3\tdropped\tchanged',
    'rows/r.tsv\tdocs/a.md:4\tkept\tdocs/a.md:4',
    'rows/r.tsv\tdocs/a.md:5\tkept\tdocs/a.md:5',
    'rows/r.tsv\tdocs/a.md:7\tkept\tdocs/a.md:7',
    'rows/r.tsv\tdocs/b.txt:2\tmoved\tdocs/b.txt:3',
    'rows/r.tsv\tdocs/alg.md:6\tkept\tdocs/alg.md:6',
    'rows/r.tsv\tdocs/alg.md:8\tmoved\tdocs/alg.md:7',
  ]);
});

test('저장소 설정 diff.indentHeuristic·diff.external·core.fsmonitor와 ambient GIT_INDEX_FILE·GIT_DIR에도 hunk를 같게 읽고 그 프로그램을 실행하지 않는다', () => {
  const tools = mkdtempSync(resolve(tmpdir(), 'plan-impact-remap-probe-'));
  temporary.push(tools);
  const marker = resolve(tools, 'called');
  const probe = resolve(tools, 'probe.sh');
  writeFileSync(probe, `#!/bin/sh\nprintf '%s\\n' "$0" >> '${marker}'\nexit 0\n`, { mode: 0o755 });
  const f = fixture({
    base: { 'docs/ind.md': text(['x', '', 'f:', '}', '}', '']), 'docs/same.md': text(['S']) },
    // With the indent heuristic the block follows line 3; without it, line 4.
    worktree: { 'docs/ind.md': text(['x', '', 'f:', '}', '    z', '}', '}', '}', '']) },
    spec: { 'rows/r.tsv': 'docs/ind.md:4\tA\t블록 뒤\ndocs/same.md:1\tA\t그대로\n' },
  });
  // Set after the fixture commits, so only the remap's own git calls could run the probe.
  for (const [key, value] of Object.entries({
    'diff.indentHeuristic': 'false',
    'diff.external': probe,
    'core.fsmonitor': probe,
  }))
    git(f.repo, 'config', key, value);
  // A stat-only change makes git consult the fsmonitor and the worktree file.
  const old = new Date('2020-01-01T00:00:00Z');
  utimesSync(resolve(f.repo, 'docs/same.md'), old, old);
  const expected = [
    'rows/r.tsv\tdocs/ind.md:4\tmoved\tdocs/ind.md:7',
    'rows/r.tsv\tdocs/same.md:1\tkept\tdocs/same.md:1',
  ];
  assert.deepEqual(
    listed(remap(f, { to: undefined, outDirectory: resolve(f.root, 'plain') })),
    expected,
  );
  assert.equal(existsSync(marker), false);
  // A hook environment that names another repository or index is not inherited: the repository is the root.
  const other = fixture({ base: { 'docs/ind.md': text(['zzz']) }, spec: {} });
  const ambient = { GIT_INDEX_FILE: process.env.GIT_INDEX_FILE, GIT_DIR: process.env.GIT_DIR };
  try {
    process.env.GIT_INDEX_FILE = resolve(other.repo, '.git/index');
    process.env.GIT_DIR = resolve(other.repo, '.git');
    assert.deepEqual(
      listed(remap(f, { to: undefined, outDirectory: resolve(f.root, 'hook') })),
      expected,
    );
  } finally {
    for (const [name, value] of Object.entries(ambient)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
  assert.equal(existsSync(marker), false);
});

test('pathspec glob 문자가 든 경로도 그 파일 하나의 hunk만 읽는다', () => {
  const f = fixture({
    base: {
      'docs/[id]/route.md': text(numbered(3)),
      'docs/i/route.md': text(numbered(3)),
    },
    next: { 'docs/i/route.md': text(['T', ...numbered(3)]) },
    spec: { 'rows/r.tsv': 'docs/[id]/route.md:2\tA\tliteral\ndocs/i/route.md:2\tA\tglob 대상\n' },
  });
  assert.deepEqual(listed(remap(f)), [
    'rows/r.tsv\tdocs/[id]/route.md:2\tkept\tdocs/[id]/route.md:2',
    'rows/r.tsv\tdocs/i/route.md:2\tmoved\tdocs/i/route.md:3',
  ]);
});

test('--to가 없으면 working tree, 있으면 그 commit과 비교하고 HEAD·index·working tree를 바꾸지 않는다', () => {
  const f = fixture({
    base: { 'docs/a.md': text(numbered(5)), 'docs/same.md': text(['S1', 'S2']) },
    next: { 'docs/a.md': text(['C', ...numbered(5)]) },
    worktree: { 'docs/a.md': text(['W', 'C', ...numbered(5)]) },
    spec: { 'rows/r.tsv': 'docs/a.md:3\tA\t행\ndocs/same.md:1\tA\t그대로\n' },
  });
  // A stat-only change: a diff that refreshes the index would rewrite it.
  const old = new Date('2020-01-01T00:00:00Z');
  utimesSync(resolve(f.repo, 'docs/same.md'), old, old);
  const head = git(f.repo, 'rev-parse', 'HEAD');
  const index = readFileSync(resolve(f.repo, '.git/index'));
  const files = ['docs/a.md', 'docs/same.md'].map((path) => read(f.repo, path));
  const committed = remap(f, { outDirectory: resolve(f.root, 'to') });
  const working = remap(f, { to: undefined, outDirectory: resolve(f.root, 'worktree') });
  assert.deepEqual(listed(committed), [
    'rows/r.tsv\tdocs/a.md:3\tmoved\tdocs/a.md:4',
    'rows/r.tsv\tdocs/same.md:1\tkept\tdocs/same.md:1',
  ]);
  assert.deepEqual(listed(working), [
    'rows/r.tsv\tdocs/a.md:3\tmoved\tdocs/a.md:5',
    'rows/r.tsv\tdocs/same.md:1\tkept\tdocs/same.md:1',
  ]);
  assert.deepEqual(readFileSync(resolve(f.repo, '.git/index')), index);
  assert.equal(git(f.repo, 'rev-parse', 'HEAD'), head);
  assert.deepEqual(
    ['docs/a.md', 'docs/same.md'].map((path) => read(f.repo, path)),
    files,
  );
  assert.deepEqual(readdirSync(resolve(f.repo, 'docs')).sort(), ['a.md', 'same.md']);
});

test('옮긴 spec의 runImpact는 STALE이 없고 미분류는 새로 생기거나 바뀐 줄의 scan 줄뿐이다', () => {
  const impact = `${JSON.stringify({
    classes: ['A', 'B', 'NONE'],
    passiveClasses: ['NONE'],
    otherOwnerClasses: [],
    universe: ['docs/**'],
    blockFiles: { extensions: ['md'], names: [] },
  })}\n`;
  const f = fixture({
    impact,
    base: {
      'docs/guide.md': text([
        '# Guide',
        '',
        'Use the Sol model here.',
        '',
        '## Details',
        '',
        'Sol again.',
        'Nothing else.',
      ]),
    },
    worktree: {
      'docs/guide.md': text([
        '# Guide',
        '',
        'Intro line.',
        'New Sol line.',
        '',
        'Use the Sol model now.',
        '',
        '## Details',
        '',
        'Sol again.',
        'Nothing else.',
      ]),
    },
    spec: {
      'patterns.tsv': 'model\t\\bSol\\b\n',
      'rows/L1.tsv': 'docs/guide.md:3\tA\t모델 이름\ndocs/guide.md:7\tA\t다시 나옴\n',
      'contract-targets.tsv':
        'docs/guide.md#Details\tB\tblocks\t세부 절\ndocs/guide.md:7-8\tB\tblocks\t범위\n',
      'regression.tsv': '# Review\ndocs/guide.md\t7\tA\t지적한 줄\n',
    },
  });
  const before = runImpact({ root: f.repo, specDirectory: f.specDirectory }).problems;
  assert.ok(
    before.some((problem) => problem.startsWith('STALE ')),
    before.join('\n'),
  );
  remap(f, { to: undefined });
  assert.deepEqual(runImpact({ root: f.repo, specDirectory: f.out }).problems, [
    'UNCLASSIFIED docs/guide.md:4',
    'UNCLASSIFIED docs/guide.md:6',
  ]);
});

test('CLI 입력 오류는 exit 2이고 --out을 만들지 않는다', () => {
  const f = fixture({
    base: { 'docs/a.md': text(numbered(5)) },
    next: { 'docs/a.md': text(['N', ...numbered(5)]) },
    spec: { 'rows/r.tsv': 'docs/a.md:3\tA\t행\n' },
  });
  const args = (overrides = {}) => {
    const options = {
      '--spec': f.specDirectory,
      '--from': f.from,
      '--to': f.to,
      '--out': f.out,
      '--root': f.repo,
      ...overrides,
    };
    return Object.entries(options).flatMap(([flag, value]) =>
      value === null ? [] : [flag, value],
    );
  };
  // Every case must fail for its own reason, not because an earlier check already failed.
  const failsWith = (argv, reason, label = JSON.stringify(argv)) => {
    const result = capture(argv, f.root);
    assert.equal(result.code, 2, label);
    assert.equal(result.err.length, 1, label);
    assert.match(result.err[0], reason, label);
  };
  const usage = /^usage: plan-impact-remap /u;
  for (const [argv, reason] of [
    [args({ '--spec': null }), usage],
    [args({ '--from': null }), usage],
    [args({ '--out': null }), usage],
    [[...args(), '--bogus', 'x'], usage],
    [[...args({ '--to': null }), '--to'], usage],
    [[...args(), '--to', f.to], usage],
    [args({ '--from': 'no-such-revision' }), /^--from: unknown revision: no-such-revision$/u],
    [args({ '--from': '-p' }), /^--from: not a revision: -p$/u],
    [args({ '--to': 'no-such-revision' }), /^--to: unknown revision: no-such-revision$/u],
    [args({ '--root': f.root }), /^--from: unknown revision: /u],
    [args({ '--spec': resolve(f.root, 'missing-spec') }), /^spec .*missing-spec: ENOENT/u],
  ]) {
    failsWith(argv, reason);
    assert.equal(existsSync(f.out), false, JSON.stringify(argv));
  }
  for (const [spec, reason] of [
    [{ 'impact.json': '{"classes": "A"}\n' }, /impact\.json: classes must be an array/u],
    [
      { 'rows/r.tsv': 'docs/new.md:1\tA\tfrom에 없는 경로\n' },
      /^path not in --from [0-9a-f]+: docs\/new\.md$/u,
    ],
    [
      { 'rows/r.tsv': 'docs/a.md:8\tA\t줄 수 밖\n' },
      /^rows\/r\.tsv:1: line 8 is past the end of docs\/a\.md in --from$/u,
    ],
  ]) {
    writeTree(f.specDirectory, {
      'impact.json': IMPACT,
      'rows/r.tsv': 'docs/a.md:3\tA\t행\n',
      ...spec,
    });
    failsWith(args(), reason, JSON.stringify(spec));
    assert.equal(existsSync(f.out), false, JSON.stringify(spec));
  }
  writeTree(f.specDirectory, { 'impact.json': IMPACT, 'rows/r.tsv': 'docs/a.md:3\tA\t행\n' });
  const notEmpty = /^--out must be a new or empty directory: /u;
  writeTree(f.out, { 'keep.txt': 'x\n' });
  failsWith(args(), notEmpty);
  assert.deepEqual(readdirSync(f.out), ['keep.txt']);
  rmSync(f.out, { recursive: true });
  writeFileSync(f.out, 'file\n');
  failsWith(args(), notEmpty);
  assert.equal(read(f.root, 'out'), 'file\n');
  rmSync(f.out);
  // The same spec and revisions succeed, so each failure above came from the one input it changed.
  assert.equal(capture(args(), f.root).code, 0);
  rmSync(f.out, { recursive: true });
  const cli = spawnSync(process.execPath, [modulePath, ...args({ '--from': 'no-such-revision' })], {
    cwd: f.root,
    encoding: 'utf8',
  });
  assert.equal(cli.status, 2);
  assert.match(cli.stderr, /--from: unknown revision: no-such-revision/u);
  assert.equal(existsSync(f.out), false);
});

test('빈 --out 디렉터리는 받는다', () => {
  const f = fixture({
    base: { 'docs/a.md': text(numbered(5)) },
    next: { 'docs/a.md': text(['N', 'L1', 'L2 바뀜', ...numbered(5).slice(2)]) },
    spec: { 'rows/r.tsv': 'docs/a.md:1\tA\t밀림\ndocs/a.md:2\tA\t바뀜\n' },
  });
  mkdirSync(f.out);
  const result = capture(
    ['--spec', f.specDirectory, '--from', f.from, '--to', f.to, '--out', f.out, '--root', f.repo],
    f.root,
  );
  assert.equal(result.code, 0);
  assert.deepEqual(result.out, [
    'rows/r.tsv\tdocs/a.md:1\tmoved\tdocs/a.md:2',
    'rows/r.tsv\tdocs/a.md:2\tdropped\tchanged',
    'moved 1 kept 0 narrowed 0 dropped 1',
  ]);
  assert.equal(read(f.out, 'rows/r.tsv'), 'docs/a.md:2\tA\t밀림\n');
  const out = resolve(f.root, 'cli-out');
  const cli = spawnSync(
    process.execPath,
    [modulePath, '--spec', f.specDirectory, '--from', f.from, '--to', f.to, '--out', out],
    { cwd: f.repo, encoding: 'utf8' },
  );
  assert.equal(cli.status, 0, cli.stderr);
  assert.match(cli.stdout, /^moved 1 kept 0 narrowed 0 dropped 1$/mu);
});

test('child process는 git execFileSync뿐이다', () => {
  const source = readFileSync(modulePath, 'utf8');
  const childProcess = [...source.matchAll(/import \{([^}]*)\} from 'node:child_process'/gu)];
  assert.equal(childProcess.length, 1);
  assert.equal(childProcess[0][1].trim(), 'execFileSync');
  assert.doesNotMatch(source, /shell\s*:/u);
  assert.doesNotMatch(source, /['"]rg['"]/u);
  const calls = [...source.matchAll(/execFileSync\(\s*([^,]+),/gu)];
  assert.ok(calls.length > 0);
  for (const match of calls) assert.equal(match[1].trim(), "'git'");
  for (const name of [
    'add',
    'commit',
    'checkout',
    'switch',
    'reset',
    'restore',
    'stash',
    'update-index',
    'apply',
    'worktree',
    'rm',
    'mv',
  ]) {
    assert.doesNotMatch(source, new RegExp(`'${name}'`, 'u'), name);
  }
  const imports = [...source.matchAll(/^import [^;]*? from '([^']+)';$/gmu)].map((m) => m[1]);
  for (const name of imports) {
    assert.ok(
      name.startsWith('node:') || ['./plan-impact.mjs', './plan-impact-blocks.mjs'].includes(name),
      name,
    );
  }
  assert.doesNotMatch(source, /\.artifacts\b|\.plans\b|resolveArtifactPath/u);
});
