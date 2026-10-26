import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import test from 'node:test';

import { loadWorkspaceLayout, workspaceRoot } from '../artifacts/workspace-layout.mjs';

const repoRoot = resolve(import.meta.dirname, '../..');
// Loaded per test so that a missing module fails each test on its own reason.
const scopeModule = () => import('./tracked-scope.mjs');
const KIB = 1024;
// This repository's names of the binding roots the guard reads.
const PLANS = workspaceRoot('plans').path;
const ARTIFACTS = workspaceRoot('artifacts').path;
const HOST_STATE = workspaceRoot('codex-hook-state').path;
const CLAUDE = workspaceRoot('claude-local').path;
const OMC_MARKER = workspaceRoot('omc').marker;
const OMX_MARKER = workspaceRoot('omx').marker;
const OMX_WIKI = workspaceRoot('omx-wiki').path;

// P0 output 4, section 1 draft with `!/config.*` narrowed to `!/config.json` (OQ-SCAF-5).
const MANAGED_GITIGNORE = [
  '/*',
  '!/.gitignore',
  '!/config.json',
  '!/baselines/',
  '!/artifacts/',
  '/artifacts/*',
  '!/artifacts/README.md',
  '!/plans/',
];

// A consumer has no binding: the guard runs on the core roots.
const consumer = () => {
  const { core } = loadWorkspaceLayout();
  return { core, roots: core.roots };
};

function write(root, path, content) {
  mkdirSync(dirname(resolve(root, path)), { recursive: true });
  writeFileSync(resolve(root, path), content);
}

// A consumer repository whose .htc/.gitignore is the draft (plus `!/vendor/` when vendored). Files are staged; `force`
// stages an ignored file with `git add -f`.
function consumerRepository(t, files, { vendored = false, rules = [] } = {}) {
  const root = realpathSync(mkdtempSync(resolve(tmpdir(), 'htc-scope-')));
  t.after(() => rmSync(root, { force: true, recursive: true }));
  const git = (...args) => spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  git('init', '-q');
  write(
    root,
    '.htc/.gitignore',
    `${[...MANAGED_GITIGNORE, ...(vendored ? ['!/vendor/'] : []), ...rules].join('\n')}\n`,
  );
  assert.equal(git('add', '.htc/.gitignore').status, 0);
  for (const [path, content, { force = false } = {}] of files) {
    write(root, path, content);
    const added = git('add', ...(force ? ['-f'] : []), path);
    assert.equal(added.status, 0, `${path}: ${added.stderr}`);
  }
  return root;
}

const kinds = (issues) => issues.map((issue) => [issue.path, issue.kind]);

const plan = (checkpoint) =>
  `# Alpha\n\n- Plan ID: alpha-plan\n- Status: active — P1c. 다음: GREEN\n\n## Work\n\n- 메모: 본문 bullet은 checkpoint가 아니다\n\n## Checkpoint\n\n${checkpoint}\n## Next\n\n- 메모: 다음 절도 아니다\n`;

test('consumer files on the allowlist within the limits pass and the tracked capacity is reported', async (t) => {
  const { checkTrackedScope } = await scopeModule();
  const root = consumerRepository(t, [
    ['.htc/config.json', '{"schema":"htc-config/v1"}\n'],
    ['.htc/baselines/lint.json', '{}\n'],
    ['.htc/artifacts/README.md', '# Artifacts\n'],
    [
      '.htc/plans/alpha-plan.md',
      plan(
        '- 2026-10-26\n  - 상태: RED\n  - 다음 행동: GREEN\n  - 근거: [log](../artifacts/p1/red.log)\n',
      ),
    ],
    // Product documents are outside the workspace.
    ['docs/product/README.md', `${'x'.repeat(200 * KIB)}\n`],
  ]);
  const { issues, report } = checkTrackedScope(root, consumer());
  assert.deepEqual(issues, []);
  assert.deepEqual(
    report.files.map((file) => file.path),
    [
      '.htc/.gitignore',
      '.htc/artifacts/README.md',
      '.htc/baselines/lint.json',
      '.htc/config.json',
      '.htc/plans/alpha-plan.md',
    ],
  );
  assert.equal(
    report.bytes,
    report.files.reduce((sum, file) => sum + file.bytes, 0),
  );
});

test('an ignored workspace file tracked with git add -f is reported as forced tracking', async (t) => {
  const { checkTrackedScope } = await scopeModule();
  const root = consumerRepository(
    t,
    [
      ['.htc/state/session.json', '{}\n', { force: true }],
      ['.htc/artifacts/p1/red.log', 'x\n', { force: true }],
      // `!/config.json` admits no other config file.
      ['.htc/config.yaml', 'a: 1\n', { force: true }],
      // Managed mode: vendor/ is not on the allowlist.
      ['.htc/vendor/plugin.json', '{}\n', { force: true }],
      // A rule added by hand opens a path the manifest does not allow.
      ['.htc/notes/todo.md', 'x\n'],
    ],
    { rules: ['!/notes/'] },
  );
  assert.deepEqual(kinds(checkTrackedScope(root, consumer()).issues), [
    ['.htc/artifacts/p1/red.log', 'tracked-forced'],
    ['.htc/config.yaml', 'tracked-forced'],
    ['.htc/notes/todo.md', 'tracked-forced'],
    ['.htc/state/session.json', 'tracked-forced'],
    ['.htc/vendor/plugin.json', 'tracked-forced'],
  ]);
});

test('files over the size limits are reported: 128 KiB per file, 256 KiB per vendor file and 4 MiB in vendor', async (t) => {
  const { checkTrackedScope } = await scopeModule();
  const vendorFiles = Array.from({ length: 16 }, (_, index) => [
    `.htc/vendor/part-${String(index).padStart(2, '0')}.js`,
    'v'.repeat(256 * KIB),
  ]);
  const root = consumerRepository(
    t,
    [
      ['.htc/plans/edge-plan.md', 'x'.repeat(128 * KIB)],
      ['.htc/plans/big-plan.md', 'x'.repeat(128 * KIB + 1)],
      ['.htc/baselines/big.json', 'x'.repeat(128 * KIB + 1)],
      ...vendorFiles,
      ['.htc/vendor/big.js', 'v'.repeat(256 * KIB + 1)],
    ],
    { vendored: true },
  );
  const { issues, report } = checkTrackedScope(root, consumer());
  assert.deepEqual(kinds(issues), [
    ['.htc/baselines/big.json', 'tracked-too-large'],
    ['.htc/plans/big-plan.md', 'tracked-too-large'],
    ['.htc/vendor', 'tracked-total-too-large'],
    ['.htc/vendor/big.js', 'tracked-too-large'],
  ]);
  // Sixteen vendor files at the per-file limit fill the 4 MiB total exactly.
  assert.ok(report.files.some((file) => file.path === '.htc/vendor/part-15.js'));
});

test('a file with a NUL byte is reported as binary', async (t) => {
  const { checkTrackedScope } = await scopeModule();
  const root = consumerRepository(t, [
    ['.htc/baselines/data.bin', Buffer.from([0x50, 0x00, 0x51])],
    ['.htc/plans/odd-plan.md', '# Odd\n\0\n'],
    ['.htc/baselines/text.json', '{"a":"b"}\n'],
  ]);
  assert.deepEqual(kinds(checkTrackedScope(root, consumer()).issues), [
    ['.htc/baselines/data.bin', 'tracked-binary'],
    ['.htc/plans/odd-plan.md', 'tracked-binary'],
  ]);
});

test('secret-like values are reported by pattern name and line without the value', async (t) => {
  const { checkTrackedScope } = await scopeModule();
  // Built at run time so that the repository never holds a secret-shaped literal.
  const fakes = {
    key: ['-----BEGIN ', 'RSA PRIVATE', ' KEY-----'].join(''),
    github: ['gh', 'p_', 'A1b2'.repeat(9)].join(''),
    aws: ['AK', 'IA', 'Z'.repeat(16)].join(''),
    url: ['postgres://', 'app:', 'pass', 'word@db:5432/app'].join(''),
  };
  const root = consumerRepository(t, [
    ['.htc/baselines/key.json', `{\n"pem": "${fakes.key}"\n}\n`],
    ['.htc/config.json', `{"token":"${fakes.github}"}\n`],
    ['.htc/plans/aws-plan.md', `# Aws\n\n${fakes.aws}\n`],
    ['.htc/artifacts/README.md', `# Artifacts\n\n${fakes.url}\n`],
    ['.htc/baselines/clean.json', '{"note":"no secret here"}\n'],
  ]);
  const { issues } = checkTrackedScope(root, consumer());
  assert.deepEqual(kinds(issues), [
    ['.htc/artifacts/README.md:3', 'tracked-secret'],
    ['.htc/baselines/key.json:2', 'tracked-secret'],
    ['.htc/config.json:1', 'tracked-secret'],
    ['.htc/plans/aws-plan.md:3', 'tracked-secret'],
  ]);
  const text = JSON.stringify(issues);
  for (const value of Object.values(fakes)) assert.equal(text.includes(value), false, value);
  assert.match(issues[1].hint, /private key/u);
});

test('checkpoint entries with an unknown field, a missing required field or a three-line field are reported', async (t) => {
  const { checkTrackedScope } = await scopeModule();
  const long = '가'.repeat(220);
  const checkpoint = [
    '- 2026-10-26',
    '  - 상태: P1c GREEN',
    '  - 다음 행동: 리뷰',
    '  - 결정: guard는 index를 읽는다',
    '  - blocker: 없음',
    '- 2026-10-25',
    '  - 상태: RED',
    '  - 다음 행동: GREEN',
    '  - 메모: 정해지지 않은 필드',
    '- 2026-10-24',
    '  - 상태: 착수',
    '- 2026-10-23',
    `  - 상태: ${long}`,
    '  - 다음 행동: 줄이기',
    '',
  ].join('\n');
  const root = consumerRepository(t, [['.htc/plans/alpha-plan.md', plan(checkpoint)]]);
  const issues = checkTrackedScope(root, consumer()).issues;
  // The plan header takes 11 lines before the first entry (line 12).
  assert.deepEqual(kinds(issues), [
    ['.htc/plans/alpha-plan.md:20', 'checkpoint-unknown-field'],
    ['.htc/plans/alpha-plan.md:21', 'checkpoint-missing-field'],
    ['.htc/plans/alpha-plan.md:24', 'checkpoint-field-too-long'],
  ]);
  assert.match(issues[1].hint, /다음 행동/u);
});

test('a checkpoint field counts 100 rendered characters per line without link targets, ** and backticks', async () => {
  const { checkpointIssues } = await scopeModule();
  const { core } = loadWorkspaceLayout();
  const section = (...fields) =>
    `## Checkpoint\n\n- 2026-10-26\n${fields.join('\n')}\n  - 다음 행동: 리뷰\n`;
  // `- 상태: ` is six rendered characters.
  const at = (length) => `  - 상태: ${'가'.repeat(length - 6)}`;
  assert.deepEqual(checkpointIssues(section(at(200)), core.checkpoint), []);
  assert.deepEqual(
    checkpointIssues(section(at(201)), core.checkpoint).map((issue) => issue.kind),
    ['checkpoint-field-too-long'],
  );
  // A link target, emphasis and code marks are not rendered text: 6 + 4 + 1 + 158 + 1 + 30 = 200 without them.
  const linked = `  - 근거: [r1](${'a/'.repeat(200)}r1.log) **${'가'.repeat(158)}** \`${'b'.repeat(30)}\``;
  assert.deepEqual(checkpointIssues(section('  - 상태: ok', linked), core.checkpoint), []);
  // Continuation lines belong to the field and each one rounds up.
  const continued = ['  - 상태: 한 줄', '    이어지는 줄', '    또 이어지는 줄'];
  assert.deepEqual(
    checkpointIssues(section(...continued), core.checkpoint).map((issue) => issue.kind),
    ['checkpoint-field-too-long'],
  );
  assert.deepEqual(checkpointIssues(section(...continued.slice(0, 2)), core.checkpoint), []);
});

test('a checkpoint section holds dated entries and their fields only', async () => {
  const { checkpointIssues } = await scopeModule();
  const { core } = loadWorkspaceLayout();
  const text = [
    '## Checkpoint',
    '',
    '- 2026-10-26',
    '  - 상태: ok',
    '  - 다음 행동: ok',
    '- 다음 묶음 시작',
    '  - 상태: 날짜 없는 항목',
    '  - 다음 행동: x',
    '자유 문단',
    '- 2026-02-30',
    '  - 상태: 없는 날짜',
    '  - 다음 행동: x',
    '- 2026-10-25',
    '  - 상태: a',
    '  - 상태: b',
    '  - 다음 행동: c',
    '  - 이름 없는 필드',
    '### 하위 절',
    '- 2026-10-24',
    '    필드 전 이어지는 줄',
    '  - 상태: a',
    '  - 다음 행동: b',
    '',
  ].join('\n');
  assert.deepEqual(
    checkpointIssues(text, core.checkpoint).map((issue) => [issue.line, issue.kind]),
    [
      [6, 'checkpoint-malformed'],
      [9, 'checkpoint-malformed'],
      [10, 'checkpoint-malformed'],
      [15, 'checkpoint-malformed'],
      [17, 'checkpoint-malformed'],
      [18, 'checkpoint-malformed'],
      [20, 'checkpoint-malformed'],
    ],
  );
});

test('only the Checkpoint section is read, outside fenced code', async () => {
  const { checkpointIssues } = await scopeModule();
  const { core } = loadWorkspaceLayout();
  const text = [
    '# Plan',
    '',
    '- Status: active',
    '- 메모: 머리 bullet',
    '',
    '```md',
    '## Checkpoint',
    '',
    '- 2026-10-26',
    '  - 메모: code 안의 예시',
    '```',
    '',
    '## Checkpoint',
    '',
    '- 2026-10-26',
    '  - 상태: ok',
    '  - 다음 행동: ok',
    '',
    '## 다음 절',
    '',
    '- 2026-10-26',
    '  - 메모: 다른 절',
    '',
  ].join('\n');
  assert.deepEqual(checkpointIssues(text, core.checkpoint), []);
  assert.deepEqual(checkpointIssues('# Plan\n\n- Status: active\n', core.checkpoint), []);
});

test('the guard reads the staged content, not the working tree', async (t) => {
  const { checkTrackedScope } = await scopeModule();
  const root = consumerRepository(t, [['.htc/baselines/lint.json', '{}\n']]);
  writeFileSync(resolve(root, '.htc/baselines/lint.json'), Buffer.from([0x00]));
  assert.deepEqual(checkTrackedScope(root, consumer()).issues, []);
  spawnSync('git', ['add', '.htc/baselines/lint.json'], { cwd: root });
  assert.deepEqual(kinds(checkTrackedScope(root, consumer()).issues), [
    ['.htc/baselines/lint.json', 'tracked-binary'],
  ]);
});

test('this repository: the binding allowlist passes and .claude files are left to .gitignore', async () => {
  const { checkTrackedScope } = await scopeModule();
  const { issues, report } = checkTrackedScope(repoRoot, loadWorkspaceLayout());
  assert.deepEqual(issues, []);
  // Ignored roots' tracked files, root markers and the tracked files of tracked agent roots (Owner 2026-10-26 P1c 1.1).
  assert.deepEqual(
    report.files.map((file) => file.path).sort(),
    [
      `${ARTIFACTS}/.gitignore`,
      `${ARTIFACTS}/README.md`,
      OMC_MARKER,
      OMX_MARKER,
      ...['cancelled', 'finished', 'pending', 'supporting'].map(
        (stage) => `${PLANS}/${stage}/README.md`,
      ),
      `${OMX_WIKI}/.gitignore`,
    ].sort(),
  );
});

test('in a binding repository a forced file in an agent root is reported, product documents are not read', async (t) => {
  const { checkTrackedScope } = await scopeModule();
  const root = realpathSync(mkdtempSync(resolve(tmpdir(), 'htc-scope-binding-')));
  t.after(() => rmSync(root, { force: true, recursive: true }));
  const git = (...args) => spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  git('init', '-q');
  write(root, '.gitignore', `${HOST_STATE}/\n${CLAUDE}/*\n!${CLAUDE}/settings.json\n${PLANS}/*\n`);
  write(root, `${HOST_STATE}/session.json`, 'x\n');
  write(root, `${CLAUDE}/settings.json`, `${'x'.repeat(200 * KIB)}\n`);
  write(root, `${CLAUDE}/settings.local.json`, '{}\n');
  write(root, `${PLANS}/active-plan.md`, '# Plan\n');
  write(root, 'docs/policies/README.md', `${'x'.repeat(200 * KIB)}\n`);
  git('add', '.gitignore', `${CLAUDE}/settings.json`, 'docs/policies/README.md');
  git(
    'add',
    '-f',
    `${HOST_STATE}/session.json`,
    `${CLAUDE}/settings.local.json`,
    `${PLANS}/active-plan.md`,
  );
  assert.deepEqual(kinds(checkTrackedScope(root, loadWorkspaceLayout()).issues), [
    [`${CLAUDE}/settings.local.json`, 'tracked-forced'],
    [`${HOST_STATE}/session.json`, 'tracked-forced'],
    [`${PLANS}/active-plan.md`, 'tracked-forced'],
  ]);
});

test('a binding root mapped to a core root takes the core root limits', async (t) => {
  const { checkTrackedScope } = await scopeModule();
  const root = realpathSync(mkdtempSync(resolve(tmpdir(), 'htc-scope-mapped-')));
  t.after(() => rmSync(root, { force: true, recursive: true }));
  const git = (...args) => spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  git('init', '-q');
  write(root, 'agent/vendor/fits.js', `${'x'.repeat(200 * KIB)}\n`);
  write(root, 'agent/vendor/big.js', `${'x'.repeat(300 * KIB)}\n`);
  git('add', 'agent/vendor');
  const { core } = loadWorkspaceLayout();
  const roots = [
    {
      id: 'agent-vendor',
      path: 'agent/vendor',
      kind: 'directory',
      tracking: 'tracked',
      core: 'vendor',
    },
  ];
  assert.deepEqual(kinds(checkTrackedScope(root, { core, roots }).issues), [
    ['agent/vendor/big.js', 'tracked-too-large'],
  ]);
});
