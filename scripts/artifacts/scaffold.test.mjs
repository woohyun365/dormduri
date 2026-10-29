import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import test from 'node:test';

import {
  BINDING_FILE,
  loadWorkspaceLayout,
  validateWorkspaceLayout,
  workspaceRoot,
} from './workspace-layout.mjs';

const repoRoot = resolve(import.meta.dirname, '../..');
const SCRIPT = resolve(import.meta.dirname, 'scaffold.mjs');
// Loaded per test so that a missing module fails each test on its own reason.
const scaffoldModule = () => import('./scaffold.mjs');

const PLANS = workspaceRoot('plans').path;
const ARTIFACTS = workspaceRoot('artifacts').path;
const EVIDENCE = workspaceRoot('artifact-plans').path;
const BASE = { umbrella: 'umbrella', plan: 'bounded', phase: 'p1' };
const PHASE = `${EVIDENCE}/umbrella/bounded/p1`;
// The seven work kinds of the layout contract (P0 output 2), with the inputs their directories take.
const KINDS = [
  ['research', {}, [`${PHASE}/research`]],
  ['plan-drafts', {}, [`${PHASE}/plan-drafts`]],
  ['evidence', {}, [PHASE]],
  ['review', {}, [`${PHASE}/review`, `${PHASE}/review-results`]],
  ['live', { host: 'claude', at: '20261026T1530' }, [`${PHASE}/live/claude-20261026T1530`]],
  [
    'impact',
    { spec: 'n4-impact' },
    [`${PHASE}/impact/n4-impact/spec`, `${PHASE}/impact/n4-impact/out`],
  ],
  ['skill-outputs', { skill: 'design', run: 'r1' }, [`${PHASE}/outputs/design/r1`]],
];

function write(root, path, content) {
  mkdirSync(dirname(resolve(root, path)), { recursive: true });
  writeFileSync(resolve(root, path), content);
}

// A git repository with the tracked ignore files of this checkout and two declared plans. Without `ignored`, the
// artifacts root is not ignored.
function fixture({ ignored = true } = {}) {
  const root = realpathSync(mkdtempSync(resolve(tmpdir(), 'knu-scaffold-')));
  spawnSync('git', ['init', '-q'], { cwd: root });
  const ignore = readFileSync(resolve(repoRoot, '.gitignore'), 'utf8');
  write(root, '.gitignore', ignored ? ignore : ignore.replace(`${ARTIFACTS}/*\n`, ''));
  if (ignored)
    write(
      root,
      `${ARTIFACTS}/.gitignore`,
      readFileSync(resolve(repoRoot, ARTIFACTS, '.gitignore')),
    );
  write(
    root,
    `${PLANS}/umbrella-plan.md`,
    '# Umbrella\n\n- Plan ID: umbrella\n- Status: active\n\n## Work\n',
  );
  write(
    root,
    `${PLANS}/supporting/bounded-plan.md`,
    '# Bounded\n\n- Plan ID: bounded\n- Status: proposed\n\n## Work\n',
  );
  return root;
}

function tree(root, path = EVIDENCE) {
  let entries;
  try {
    entries = readdirSync(resolve(root, path), { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
  return entries
    .sort((left, right) => left.name.localeCompare(right.name))
    .flatMap((entry) => {
      const child = `${path}/${entry.name}`;
      return entry.isDirectory() ? [`${child}/`, ...tree(root, child)] : [child];
    });
}

const cli = (...args) =>
  spawnSync(process.execPath, [SCRIPT, ...args], { cwd: repoRoot, encoding: 'utf8' });

test('the core manifest holds the seven work kinds and the plans evidence root names the scaffold', () => {
  const layout = loadWorkspaceLayout();
  assert.deepEqual(
    layout.core.workKinds?.map((kind) => [kind.id, kind.directories]),
    [
      ['research', ['research']],
      ['plan-drafts', ['plan-drafts']],
      ['evidence', []],
      ['review', ['review', 'review-results']],
      ['live', ['live/{host}-{at}']],
      ['impact', ['impact/{spec}/spec', 'impact/{spec}/out']],
      ['skill-outputs', ['outputs/{skill}/{run}']],
    ],
  );
  // Phase and topic grammar of the layout contract; the other inputs are kebab-case and live time is minute-precise.
  assert.deepEqual(layout.core.workNames, {
    phase: '^(p[0-9]+[a-z]?|[a-z]{1,3}[0-9]+[a-z]?|[0-9]{4}-[0-9]{2}-[0-9]{2})$',
    topic: '^[a-z0-9]+(-[a-z0-9]+)*$',
    host: '^[a-z0-9]+(-[a-z0-9]+)*$',
    at: '^[0-9]{8}T[0-9]{4}$',
    spec: '^[a-z0-9]+(-[a-z0-9]+)*$',
    skill: '^[a-z0-9]+(-[a-z0-9]+)*$',
    run: '^[a-z0-9]+(-[a-z0-9]+)*$',
  });
  assert.ok(workspaceRoot('artifact-plans', layout).creator.includes('core-scaffold'));
});

test('manifest validation rejects work kinds with escaping templates or inputs without a name rule', () => {
  const read = () => ({
    core: JSON.parse(
      readFileSync(resolve(repoRoot, 'scripts/artifacts/workspace-layout.core.json'), 'utf8'),
    ),
    binding: JSON.parse(
      readFileSync(resolve(repoRoot, 'scripts/artifacts/workspace-layout.knu.json'), 'utf8'),
    ),
  });
  const kind = (core, id) => core.workKinds?.find((entry) => entry.id === id) ?? {};
  const mutations = [
    ['unknown work kind field', ({ core }) => (kind(core, 'research').color = 'blue')],
    ['template escape', ({ core }) => (kind(core, 'research').directories = ['../research'])],
    ['absolute template', ({ core }) => (kind(core, 'research').directories = ['/research'])],
    ['backslash template', ({ core }) => (kind(core, 'review').directories = ['review\\r1'])],
    [
      'input without a name rule',
      ({ core }) => (kind(core, 'impact').directories = ['impact/{name}']),
    ],
    ['duplicate kind', ({ core }) => (kind(core, 'review').id = 'research')],
    ['name rule that is not a pattern', ({ core }) => core.workNames && (core.workNames.run = '(')],
    ['missing phase rule', ({ core }) => core.workNames && delete core.workNames.phase],
  ];
  for (const [name, mutate] of mutations) {
    const manifests = read();
    mutate(manifests);
    assert.throws(
      () => validateWorkspaceLayout(manifests),
      /workspace layout manifest is invalid/u,
      name,
    );
  }
});

test('each work kind gets its directories under the phase directory of a declared plan', async () => {
  const { scaffold } = await scaffoldModule();
  const root = fixture();
  try {
    const research = scaffold(root, 'research', BASE);
    assert.deepEqual(research.created, [
      EVIDENCE,
      `${EVIDENCE}/umbrella`,
      `${EVIDENCE}/umbrella/bounded`,
      PHASE,
      `${PHASE}/research`,
    ]);
    for (const [kind, inputs, directories] of KINDS) {
      const result = scaffold(root, kind, { ...BASE, ...inputs });
      assert.deepEqual(result.directories, directories, kind);
      for (const directory of directories)
        assert.ok(tree(root).includes(`${directory}/`), directory);
    }
    // A topic adds one level below the phase.
    assert.deepEqual(scaffold(root, 'review', { ...BASE, topic: 'p1b' }).directories, [
      `${PHASE}/p1b/review`,
      `${PHASE}/p1b/review-results`,
    ]);
    // Directories only: no README or other file is written.
    assert.deepEqual(
      tree(root).filter((path) => !path.endsWith('/')),
      [],
    );
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});

test('a second run creates nothing; only created differs from the first output and later runs repeat it', async () => {
  const { scaffold } = await scaffoldModule();
  const root = fixture();
  try {
    const run = () => KINDS.map(([kind, inputs]) => scaffold(root, kind, { ...BASE, ...inputs }));
    const first = run();
    const before = tree(root);
    const second = run();
    assert.deepEqual(tree(root), before);
    for (const result of second) assert.deepEqual(result.created, [], result.kind);
    assert.deepEqual(
      second,
      first.map((result) => ({ ...result, created: [] })),
    );
    assert.equal(JSON.stringify(run()), JSON.stringify(second));
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});

test('existing files are kept and a file in place of a directory stops the run before it creates anything', async () => {
  const { scaffold } = await scaffoldModule();
  const root = fixture();
  try {
    write(root, `${PHASE}/research/snapshot-2026-10-26.md`, 'keep\n');
    assert.deepEqual(scaffold(root, 'research', BASE).created, []);
    assert.equal(
      readFileSync(resolve(root, PHASE, 'research/snapshot-2026-10-26.md'), 'utf8'),
      'keep\n',
    );
    write(root, `${PHASE}/review`, 'a file\n');
    assert.throws(() => scaffold(root, 'review', BASE), /exists and is not a directory/u);
    assert.equal(readFileSync(resolve(root, PHASE, 'review'), 'utf8'), 'a file\n');
    assert.equal(tree(root).includes(`${PHASE}/review-results/`), false);
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});

test('dot segments, absolute paths and symlinks out of the evidence root are refused', async () => {
  const { scaffold } = await scaffoldModule();
  const root = fixture();
  const outside = realpathSync(mkdtempSync(resolve(tmpdir(), 'knu-scaffold-outside-')));
  try {
    for (const [inputs, reason] of [
      [{ phase: '..' }, /is a dot segment/u],
      [{ topic: '..' }, /is a dot segment/u],
      [{ phase: '.' }, /is a dot segment/u],
      [{ phase: '../../../outside' }, /contains a path separator/u],
      [{ phase: resolve(outside, 'p1') }, /is an absolute path/u],
      [{ topic: 'C:\\outside' }, /is an absolute path/u],
    ])
      assert.throws(
        () => scaffold(root, 'research', { ...BASE, ...inputs }),
        reason,
        JSON.stringify(inputs),
      );
    assert.throws(
      () => scaffold(root, 'impact', { ...BASE, spec: '/etc' }),
      /is an absolute path/u,
    );
    // A symlink below the evidence root, and the evidence root itself as a symlink.
    mkdirSync(resolve(root, EVIDENCE, 'umbrella'), { recursive: true });
    symlinkSync(outside, resolve(root, EVIDENCE, 'umbrella/bounded'));
    assert.throws(() => scaffold(root, 'research', BASE), /resolves through a symlink/u);
    rmSync(resolve(root, EVIDENCE), { force: true, recursive: true });
    symlinkSync(outside, resolve(root, EVIDENCE));
    assert.throws(() => scaffold(root, 'research', BASE), /resolves through a symlink/u);
    assert.deepEqual(readdirSync(outside), []);
    assert.deepEqual(
      readdirSync(dirname(outside)).filter((name) => name === 'outside'),
      [],
    );
  } finally {
    rmSync(root, { force: true, recursive: true });
    rmSync(outside, { force: true, recursive: true });
  }
});

test('a Windows separator or drive is refused in every input, even when a directory of that name exists', async () => {
  const { scaffold } = await scaffoldModule();
  const root = fixture();
  try {
    for (const inputs of [
      { phase: 'p1\\..\\..\\outside' },
      { topic: 'a\\b' },
      { umbrella: 'umbrella\\x' },
      { plan: '..\\bounded' },
      // Drive-relative: Windows resolves `C:x` against the current directory of drive C.
      { phase: 'C:x' },
    ])
      assert.throws(
        () => scaffold(root, 'research', { ...BASE, ...inputs }),
        /contains a path separator/u,
        JSON.stringify(inputs),
      );
    assert.throws(
      () => scaffold(root, 'impact', { ...BASE, spec: 'a\\b' }),
      /contains a path separator/u,
    );
    // On POSIX a backslash and a colon are name characters; an existing directory does not make them safe names.
    if (process.platform !== 'win32')
      for (const phase of ['p1\\x', 'C:x']) {
        mkdirSync(resolve(root, EVIDENCE, 'umbrella/bounded', phase), { recursive: true });
        assert.throws(
          () => scaffold(root, 'research', { ...BASE, phase }),
          /contains a path separator/u,
          phase,
        );
      }
    assert.equal(
      tree(root).some((path) => path.includes('outside')),
      false,
    );
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});

test('an ignored root that .gitignore does not ignore fails --check and stops scaffold', async () => {
  const { checkIgnore, scaffold } = await scaffoldModule();
  assert.deepEqual(checkIgnore(repoRoot), []);
  const ignoredRoot = fixture();
  const exposed = fixture({ ignored: false });
  try {
    assert.deepEqual(checkIgnore(ignoredRoot), []);
    const underArtifacts = loadWorkspaceLayout()
      .roots.filter(
        (entry) =>
          entry.tracking === 'ignored' &&
          (entry.path === ARTIFACTS || entry.path.startsWith(`${ARTIFACTS}/`)),
      )
      .map((entry) => [entry.path, 'gitignore-mismatch'])
      .sort();
    assert.deepEqual(
      checkIgnore(exposed)
        .map((issue) => [issue.path, issue.kind])
        .sort(),
      underArtifacts,
    );
    assert.throws(() => scaffold(exposed, 'research', BASE), /is not ignored/u);
    assert.deepEqual(tree(exposed), []);
    const failed = cli('--check', '--root', exposed);
    assert.equal(failed.status, 1, failed.stderr);
    assert.match(failed.stderr, /gitignore-mismatch/u);
    assert.equal(cli('--', '--check', '--root', ignoredRoot).status, 0);
  } finally {
    rmSync(ignoredRoot, { force: true, recursive: true });
    rmSync(exposed, { force: true, recursive: true });
  }
});

test('the umbrella is a declared Plan ID and name rules apply only to directories scaffold creates', async () => {
  const { scaffold } = await scaffoldModule();
  const root = fixture();
  try {
    for (const [kind, inputs, reason] of [
      ['research', { umbrella: 'undeclared' }, /is not a Plan ID declared under/u],
      ['research', { plan: 'Bounded_Plan' }, /does not match/u],
      ['research', { phase: 'phase-0.1' }, /does not match/u],
      ['research', { topic: 'My Topic' }, /does not match/u],
      ['live', { host: 'Claude', at: '20261026T1530' }, /does not match/u],
      ['live', { host: 'claude', at: '2026-10-26' }, /does not match/u],
      ['impact', {}, /needs --spec/u],
      ['research', { spec: 'n4' }, /does not take --spec/u],
      ['nothing', {}, /unknown work kind/u],
    ])
      assert.throws(
        () => scaffold(root, kind, { ...BASE, ...inputs }),
        reason,
        `${kind} ${JSON.stringify(inputs)}`,
      );
    // Historical names stay usable once their directory exists.
    mkdirSync(resolve(root, EVIDENCE, 'umbrella/bounded/readiness/Old Topic'), { recursive: true });
    assert.deepEqual(
      scaffold(root, 'review', { ...BASE, phase: 'readiness', topic: 'Old Topic' }).directories,
      [
        `${EVIDENCE}/umbrella/bounded/readiness/Old Topic/review`,
        `${EVIDENCE}/umbrella/bounded/readiness/Old Topic/review-results`,
      ],
    );
    // A bounded plan staged before promote is not declared yet.
    assert.deepEqual(scaffold(root, 'plan-drafts', { ...BASE, plan: 'new-plan' }).directories, [
      `${EVIDENCE}/umbrella/new-plan/p1/plan-drafts`,
    ]);
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});

test('the command prints the same JSON for the same input and separates usage errors from refusals', async () => {
  await scaffoldModule();
  const root = fixture();
  try {
    const args = [
      '--',
      'impact',
      '--umbrella',
      'umbrella',
      '--plan',
      'bounded',
      '--phase',
      'p1',
      '--spec',
      'n4-impact',
      '--root',
      root,
    ];
    const first = cli(...args);
    assert.equal(first.status, 0, first.stderr);
    assert.deepEqual(JSON.parse(first.stdout).directories, [
      `${PHASE}/impact/n4-impact/spec`,
      `${PHASE}/impact/n4-impact/out`,
    ]);
    const second = cli(...args);
    assert.equal(second.status, 0, second.stderr);
    assert.deepEqual(JSON.parse(second.stdout).created, []);
    assert.equal(cli(...args).stdout, second.stdout);
    assert.equal(cli().status, 2);
    assert.equal(
      cli('research', '--umbrella', 'umbrella', '--color', 'blue', '--root', root).status,
      2,
    );
    const refused = cli(
      'research',
      '--umbrella',
      'umbrella',
      '--plan',
      'bounded',
      '--phase',
      '..',
      '--root',
      root,
    );
    assert.equal(refused.status, 1);
    assert.match(refused.stderr, /is a dot segment/u);
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});

// P0 output 4, section 1 draft with `!/config.*` narrowed to `!/config.json` (OQ-SCAF-5). The draft's comment lines
// explain the mode and plans choices; the generated file holds the rules of the chosen ones.
const MANAGED_GITIGNORE =
  '/*\n!/.gitignore\n!/config.json\n!/baselines/\n!/artifacts/\n/artifacts/*\n!/artifacts/README.md\n!/plans/\n';

function consumerRoot(t) {
  const root = realpathSync(mkdtempSync(resolve(tmpdir(), 'htc-consumer-')));
  t.after(() => rmSync(root, { force: true, recursive: true }));
  spawnSync('git', ['init', '-q'], { cwd: root });
  return root;
}

const ignoredBy = (root, path) =>
  spawnSync('git', ['check-ignore', '-q', '--no-index', path], { cwd: root }).status === 0;

test('managed and vendored workspaces get different .gitignore rules from the manifest', async () => {
  const { workspaceGitignore } = await scaffoldModule();
  const { core } = loadWorkspaceLayout();
  assert.equal(workspaceGitignore(core, { mode: 'managed' }), MANAGED_GITIGNORE);
  assert.equal(workspaceGitignore(core, { mode: 'vendored' }), `${MANAGED_GITIGNORE}!/vendor/\n`);
  assert.equal(
    workspaceGitignore(core, { mode: 'managed', ignore: ['plans'] }),
    MANAGED_GITIGNORE.replace('!/plans/\n', ''),
  );
  assert.throws(() => workspaceGitignore(core, { mode: 'hosted' }), /mode hosted/u);
  assert.throws(
    () => workspaceGitignore(core, { mode: 'managed', ignore: ['config'] }),
    /config cannot be ignored/u,
  );
});

test('git applies the generated rules: only the allowlist stays visible below .htc', async (t) => {
  const { workspaceGitignore } = await scaffoldModule();
  const { core } = loadWorkspaceLayout();
  for (const mode of ['managed', 'vendored']) {
    const root = consumerRoot(t);
    write(root, '.htc/.gitignore', workspaceGitignore(core, { mode }));
    for (const path of [
      '.htc/.gitignore',
      '.htc/config.json',
      '.htc/baselines/lint.json',
      '.htc/artifacts/README.md',
      '.htc/plans/alpha-plan.md',
    ])
      assert.equal(ignoredBy(root, path), false, `${mode} ${path}`);
    for (const path of [
      '.htc/config.yaml',
      '.htc/state/session.json',
      '.htc/artifacts/p1/red.log',
      '.htc/notes.md',
    ])
      assert.equal(ignoredBy(root, path), true, `${mode} ${path}`);
    assert.equal(ignoredBy(root, '.htc/vendor/plugin.json'), mode === 'managed', mode);
  }
});

test('consumer scaffold writes .htc/.gitignore and the missing product READMEs and keeps existing files', async (t) => {
  const { scaffoldConsumer } = await scaffoldModule();
  const root = consumerRoot(t);
  write(root, 'docs/product/README.md', '# Our PRD\n');
  const first = scaffoldConsumer(root, { mode: 'vendored' });
  assert.deepEqual(first.created, [
    '.htc/.gitignore',
    'docs/policies/README.md',
    'docs/architecture/README.md',
  ]);
  assert.deepEqual(first.kept, ['docs/product/README.md']);
  assert.equal(
    readFileSync(resolve(root, '.htc/.gitignore'), 'utf8'),
    `${MANAGED_GITIGNORE}!/vendor/\n`,
  );
  assert.equal(readFileSync(resolve(root, 'docs/product/README.md'), 'utf8'), '# Our PRD\n');
  const policies = readFileSync(resolve(root, 'docs/policies/README.md'), 'utf8');
  assert.match(policies, /^# 제품·보안·운영 불변 정책\n/u);
  assert.match(policies, /같은 규칙은 한 문서만 소유한다/u);
  assert.match(policies, /^\| 문서 +\| 상태 +\| 소유 규칙 +\|$/mu);
  // A second run creates nothing; only created and kept differ from the first output and later runs repeat it.
  const second = scaffoldConsumer(root, { mode: 'vendored' });
  assert.deepEqual(second.created, []);
  assert.deepEqual(second.kept, [
    '.htc/.gitignore',
    'docs/product/README.md',
    'docs/policies/README.md',
    'docs/architecture/README.md',
  ]);
  assert.deepEqual({ ...second, created: [], kept: [] }, { ...first, created: [], kept: [] });
  assert.equal(
    JSON.stringify(scaffoldConsumer(root, { mode: 'vendored' })),
    JSON.stringify(second),
  );
});

test('other .gitignore rules, a symlink on the way and this repository are refused before anything is written', async (t) => {
  const { scaffoldConsumer } = await scaffoldModule();
  const changed = consumerRoot(t);
  write(changed, '.htc/.gitignore', '/*\n!/notes/\n');
  assert.throws(
    () => scaffoldConsumer(changed, { mode: 'managed' }),
    /\.htc\/\.gitignore exists with other rules/u,
  );
  assert.equal(readFileSync(resolve(changed, '.htc/.gitignore'), 'utf8'), '/*\n!/notes/\n');
  assert.deepEqual(readdirSync(changed).sort(), ['.git', '.htc']);
  // The managed rules in a vendored run are other rules too.
  write(changed, '.htc/.gitignore', MANAGED_GITIGNORE);
  assert.throws(() => scaffoldConsumer(changed, { mode: 'vendored' }), /exists with other rules/u);
  const outside = realpathSync(mkdtempSync(resolve(tmpdir(), 'htc-consumer-outside-')));
  t.after(() => rmSync(outside, { force: true, recursive: true }));
  const linkedWorkspace = consumerRoot(t);
  symlinkSync(outside, resolve(linkedWorkspace, '.htc'));
  assert.throws(
    () => scaffoldConsumer(linkedWorkspace, { mode: 'managed' }),
    /resolves through a symlink/u,
  );
  const linkedDocs = consumerRoot(t);
  mkdirSync(resolve(linkedDocs, 'docs'));
  symlinkSync(outside, resolve(linkedDocs, 'docs/policies'));
  assert.throws(
    () => scaffoldConsumer(linkedDocs, { mode: 'managed' }),
    /resolves through a symlink/u,
  );
  assert.deepEqual(readdirSync(outside), []);
  assert.deepEqual(readdirSync(linkedDocs).sort(), ['.git', 'docs']);
  // This repository maps the core roots through its binding and has no .htc.
  assert.throws(
    () => scaffoldConsumer(repoRoot, { mode: 'managed' }),
    /maps the core roots through/u,
  );
  assert.equal(readdirSync(repoRoot).includes('.htc'), false);
});

test('another checkout of this repository, a directory inside one and another letter case of its path are refused', async (t) => {
  const { scaffoldConsumer } = await scaffoldModule();
  // A clone or linked worktree of this repository holds the binding file at its root.
  const checkout = consumerRoot(t);
  write(checkout, BINDING_FILE, readFileSync(resolve(repoRoot, BINDING_FILE), 'utf8'));
  mkdirSync(resolve(checkout, 'apps/web'), { recursive: true });
  const targets = [checkout, resolve(checkout, 'apps/web')];
  // On a case-insensitive file system another letter case of the path names the same checkout.
  const upper = checkout.toUpperCase();
  if (upper !== checkout && existsSync(upper)) targets.push(upper);
  for (const target of targets)
    assert.throws(
      () => scaffoldConsumer(target, { mode: 'managed' }),
      /maps the core roots through/u,
      target,
    );
  assert.deepEqual(readdirSync(resolve(checkout, 'apps/web')), []);
  assert.equal(existsSync(resolve(checkout, '.htc')), false);
});

test('a .gitignore that holds the same rules with CRLF line endings is kept', async (t) => {
  const { scaffoldConsumer } = await scaffoldModule();
  const root = consumerRoot(t);
  scaffoldConsumer(root, { mode: 'managed' });
  const crlf = MANAGED_GITIGNORE.replaceAll('\n', '\r\n');
  write(root, '.htc/.gitignore', crlf);
  const again = scaffoldConsumer(root, { mode: 'managed' });
  assert.deepEqual(again.created, []);
  assert.equal(readFileSync(resolve(root, '.htc/.gitignore'), 'utf8'), crlf);
});

test('the consumer command prints the same JSON for the same input and needs a mode and a root', async (t) => {
  await scaffoldModule();
  const root = consumerRoot(t);
  const args = ['consumer', '--mode', 'managed', '--plans', 'ignored', '--root', root];
  const first = cli('--', ...args);
  assert.equal(first.status, 0, first.stderr);
  assert.deepEqual(JSON.parse(first.stdout).created, [
    '.htc/.gitignore',
    'docs/product/README.md',
    'docs/policies/README.md',
    'docs/architecture/README.md',
  ]);
  assert.equal(
    readFileSync(resolve(root, '.htc/.gitignore'), 'utf8'),
    MANAGED_GITIGNORE.replace('!/plans/\n', ''),
  );
  const second = cli(...args);
  assert.equal(second.status, 0, second.stderr);
  assert.deepEqual(JSON.parse(second.stdout).created, []);
  assert.equal(cli(...args).stdout, second.stdout);
  for (const usage of [
    ['consumer', '--root', root],
    ['consumer', '--mode', 'managed'],
    ['consumer', '--mode', 'hosted', '--root', root],
    ['consumer', '--mode', 'managed', '--plans', 'maybe', '--root', root],
    ['consumer', '--mode', 'managed', '--umbrella', 'umbrella', '--root', root],
  ])
    assert.equal(cli(...usage).status, 2, usage.join(' '));
  const refused = cli('consumer', '--mode', 'managed', '--root', repoRoot);
  assert.equal(refused.status, 1, refused.stderr);
  assert.match(refused.stderr, /maps the core roots through/u);
});
