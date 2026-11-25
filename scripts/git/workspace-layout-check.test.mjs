import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import test from 'node:test';

import * as layoutCheck from './workspace-layout-check.mjs';

const { findWorkspaceLayoutIssues, listUntrackedEntries } = layoutCheck;
const repoRoot = resolve(import.meta.dirname, '../..');

function fixtureTree(files) {
  const root = mkdtempSync(resolve(tmpdir(), 'knu-layout-tree-'));
  for (const [path, content] of files) {
    mkdirSync(dirname(resolve(root, path)), { recursive: true });
    if (content !== null) writeFileSync(resolve(root, path), content);
  }
  return root;
}

function fixtureRepository(files) {
  const root = mkdtempSync(resolve(tmpdir(), 'knu-layout-'));
  const git = (cwd, ...args) => spawnSync('git', args, { cwd, encoding: 'utf8' });
  git(root, 'init', '-q');
  writeFileSync(resolve(root, '.gitignore'), readFileSync(resolve(repoRoot, '.gitignore')));
  git(root, 'add', '.gitignore');
  for (const [path, tracked] of files) {
    mkdirSync(dirname(resolve(root, path)), { recursive: true });
    writeFileSync(resolve(root, path), 'x\n');
    if (tracked) git(root, 'add', path);
  }
  return { root, git };
}

test('host runtime state below the root and retired root names are reported', () => {
  const issues = findWorkspaceLayoutIssues([
    'apps/web/.omx/',
    'docs/development/troubleshooting/.omc/',
    'artifacts/',
    'local-docs/',
    'references/',
  ]);

  assert.deepEqual(
    issues.map((issue) => [issue.path, issue.kind]),
    [
      ['apps/web/.omx/', 'nested-runtime-state'],
      ['docs/development/troubleshooting/.omc/', 'nested-runtime-state'],
      ['artifacts/', 'retired-root'],
      ['local-docs/', 'retired-root'],
      ['references/', 'retired-root'],
    ],
  );
});

test('root runtime state, tracked host configuration and local workspace roots are accepted', () => {
  assert.deepEqual(
    findWorkspaceLayoutIssues([
      '.omc/',
      '.omx/',
      'omx_wiki/session-log-2099-01-01.md',
      '.omx-config.json',
      '.artifacts/tools/',
      '.local-docs/',
      '.plans/root-plan.md',
      'node_modules/',
      'docs/references/',
      'apps/web/artifacts/',
    ]),
    [],
  );
});

test('untracked listing collapses ignored trees and nested repositories', () => {
  const { root, git } = fixtureRepository([
    ['apps/web/package.json', true],
    ['apps/web/.omx/logs/next-dev.log', false],
    ['docs/guide.md', true],
    ['docs/x/.omc/state.json', false],
    ['.artifacts/README.md', true],
    ['.artifacts/tools/claude-native/.omx/state.json', false],
    ['node_modules/pkg/.omc/state.json', false],
    ['artifacts/local/result.json', false],
    ['.omc/state.json', false],
    ['.omx/state.json', false],
  ]);
  try {
    mkdirSync(resolve(root, 'worktrees/nested'), { recursive: true });
    git(resolve(root, 'worktrees/nested'), 'init', '-q');
    mkdirSync(resolve(root, 'worktrees/nested/.omc'));
    writeFileSync(resolve(root, 'worktrees/nested/.omc/state.json'), 'x\n');
    // A linked worktree has a .git file instead of a directory.
    git(
      root,
      '-c',
      'user.name=fixture',
      '-c',
      'user.email=fixture@example.com',
      'commit',
      '-qm',
      'init',
    );
    assert.equal(git(root, 'worktree', 'add', '-q', 'linked-worktree').status, 0);
    mkdirSync(resolve(root, 'linked-worktree/.omc'));
    writeFileSync(resolve(root, 'linked-worktree/.omc/state.json'), 'x\n');

    const issues = findWorkspaceLayoutIssues(listUntrackedEntries(root));
    assert.deepEqual(issues.map((issue) => issue.path).sort(), [
      'apps/web/.omx/',
      'artifacts/',
      'docs/x/.omc/',
    ]);
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});

test('top-level entries outside the manifest are reported; exclusions and tracked directories pass', () => {
  const trackedTopLevel = new Set(['apps', 'docs', 'scripts', '.claude', '.codex']);
  const issues = findWorkspaceLayoutIssues(
    [
      'tmp-not-a-root/',
      'notes.txt',
      'build/',
      'node_modules/',
      '.DS_Store',
      'next-env.d.ts',
      '.env.local',
      'pnpm-debug.log.1',
      'x.tsbuildinfo',
      'apps/web/.next/',
      'apps/web/tmp/',
      'docs/scratch/',
      '.local-docs/',
      '.plans/root-plan.md',
      '.artifacts/tools/',
      'omx_wiki/log.md',
      '.omc/',
      '.omx/',
      '.claude/settings.local.json',
      '.codex/state/',
    ],
    { trackedTopLevel },
  );
  assert.deepEqual(
    issues.map((issue) => [issue.path, issue.kind]),
    [
      ['tmp-not-a-root/', 'outside-manifest-root'],
      ['notes.txt', 'outside-manifest-root'],
    ],
  );
});

test('.plans holds Markdown only and .artifacts children follow the manifest', () => {
  const root = fixtureTree([
    ['.plans/alpha-plan.md', '# Alpha\n\n- Plan ID: alpha-plan\n- Status: active\n\n## Work\n'],
    ['.plans/supporting/beta.md', '# Beta\n\n- Plan ID: beta-plan\n- Status: proposed\n'],
    ['.plans/run.sh', 'echo\n'],
    ['.plans/supporting/notes.log', 'x\n'],
    ['.plans/.DS_Store', 'x'],
    // Names on the top-level guard exclusion list are not exempt below a manifest root.
    ['.plans/build/run.sh', 'x\n'],
    ['.plans/.env', 'x\n'],
    ['.artifacts/README.md', 'x\n'],
    ['.artifacts/.gitignore', '*\n'],
    ['.artifacts/.DS_Store', 'x'],
    ['.artifacts/build/a.json', '{}\n'],
    ['.artifacts/plans/alpha-plan/beta-plan/p1/log.txt', 'x\n'],
    ['.artifacts/plans/beta-plan/beta-plan/x.json', '{}\n'],
    ['.artifacts/plans/not-a-plan-id/x/y.txt', 'x\n'],
    ['.artifacts/plans/dist/x.txt', 'x\n'],
    ['.artifacts/tools/infra/a.json', '{}\n'],
    ['.artifacts/scratch/a.txt', 'x\n'],
  ]);
  try {
    assert.deepEqual(
      layoutCheck
        .findWorkspaceStructureIssues(root)
        .map((issue) => [issue.path, issue.kind])
        .sort(),
      [
        ['.artifacts/.DS_Store', 'artifacts-unknown-child'],
        ['.artifacts/build', 'artifacts-unknown-child'],
        ['.artifacts/plans/dist', 'undeclared-plan-id'],
        ['.artifacts/plans/not-a-plan-id', 'undeclared-plan-id'],
        ['.artifacts/scratch', 'artifacts-unknown-child'],
        ['.plans/.DS_Store', 'plans-non-markdown'],
        ['.plans/.env', 'plans-non-markdown'],
        ['.plans/build/run.sh', 'plans-non-markdown'],
        ['.plans/run.sh', 'plans-non-markdown'],
        ['.plans/supporting/notes.log', 'plans-non-markdown'],
      ],
    );
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});

test('manifest roots and the tracked .gitignore files agree on what is ignored', () => {
  assert.deepEqual(layoutCheck.findGitignoreIssues(repoRoot), []);
  const { root } = fixtureRepository([]);
  try {
    for (const path of ['.artifacts/.gitignore', 'omx_wiki/.gitignore']) {
      mkdirSync(dirname(resolve(root, path)), { recursive: true });
      writeFileSync(resolve(root, path), readFileSync(resolve(repoRoot, path)));
    }
    assert.deepEqual(layoutCheck.findGitignoreIssues(root), []);
    const ignore = readFileSync(resolve(repoRoot, '.gitignore'), 'utf8');
    writeFileSync(resolve(root, '.gitignore'), ignore.replace(/^\.local-docs\/\n/mu, ''));
    assert.deepEqual(
      layoutCheck.findGitignoreIssues(root).map((issue) => [issue.path, issue.kind]),
      [['.local-docs', 'gitignore-mismatch']],
    );
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});

test('the pre-commit fast check runs the layout detector after lint-staged', () => {
  const manifest = JSON.parse(readFileSync(resolve(repoRoot, 'package.json'), 'utf8'));
  assert.equal(
    manifest.scripts['check:fast'],
    'pnpm lint-staged && node scripts/git/workspace-layout-check.mjs',
  );
});

test('host adapters anchor runtime state at the repository root', () => {
  const claude = readFileSync(
    resolve(repoRoot, 'docs/development/agent-workflows/adapters/claude-code.md'),
    'utf8',
  );
  const codex = readFileSync(
    resolve(repoRoot, 'docs/development/agent-workflows/adapters/codex.md'),
    'utf8',
  );
  for (const guide of [claude, codex]) {
    assert.match(guide, /### 저장소 root와 runtime state 위치/u);
    assert.match(guide, /workspace-layout-check\.mjs/u);
    assert.match(guide, /\.artifacts\//u);
  }
  assert.match(codex, /OMX_ROOT/u);
});

test('the layout check reports forced tracking in an agent root and prints the tracked capacity', () => {
  const { root, git } = fixtureRepository([
    ['.omx-config.json', true],
    ['.local-docs/handoff.md', false],
  ]);
  try {
    assert.equal(git(root, 'add', '-f', '.local-docs/handoff.md').status, 0);
    assert.deepEqual(
      layoutCheck
        .checkWorkspaceLayout(root)
        .filter((issue) => issue.kind.startsWith('tracked-'))
        .map((issue) => [issue.path, issue.kind]),
      [['.local-docs/handoff.md', 'tracked-forced']],
    );
    const run = spawnSync(
      process.execPath,
      [resolve(repoRoot, 'scripts/git/workspace-layout-check.mjs')],
      { cwd: root, encoding: 'utf8' },
    );
    assert.equal(run.status, 1, run.stderr);
    assert.match(run.stderr, /^- \.local-docs\/handoff\.md \(tracked-forced\): /mu);
    assert.match(run.stdout, /^tracked scope: 1 file, 2 bytes$/mu);
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});

// Ignore source of top-level candidates. Each case is a fresh repository whose git reads no user or system
// configuration: the check runs in a child process with HOME and XDG_CONFIG_HOME inside the fixture,
// GIT_CONFIG_NOSYSTEM set and inherited GIT_ variables dropped. A core.excludesFile case sets the fixture's local
// config; the default global ignore is the fixture's XDG_CONFIG_HOME/git/ignore.
const OUTSIDE = 'outside-manifest-root';
const TOP_LEVEL_KINDS = [OUTSIDE, 'retired-root', 'nested-runtime-state'];
const REPORT = [
  `import { checkWorkspaceLayout } from ${JSON.stringify(import.meta.resolve('./workspace-layout-check.mjs'))};`,
  `const kinds = new Set(${JSON.stringify(TOP_LEVEL_KINDS)});`,
  'const issues = checkWorkspaceLayout(process.argv[1]).filter((issue) => kinds.has(issue.kind));',
  'console.log(JSON.stringify(issues.map((issue) => [issue.path, issue.kind]).sort()));',
].join('\n');

function ignoreFixture(t, { exclude = '', gitignore, tracked = [], files = [] } = {}) {
  const base = mkdtempSync(resolve(tmpdir(), 'knu-layout-ignore-'));
  t.after(() => rmSync(base, { force: true, recursive: true }));
  const home = resolve(base, 'home');
  const root = resolve(base, 'repo');
  mkdirSync(resolve(home, '.config'), { recursive: true });
  mkdirSync(root);
  const env = {
    ...Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith('GIT_'))),
    HOME: home,
    XDG_CONFIG_HOME: resolve(home, '.config'),
    GIT_CONFIG_NOSYSTEM: '1',
  };
  const git = (...args) => {
    const run = spawnSync('git', args, { cwd: root, encoding: 'utf8', env });
    assert.equal(run.status, 0, run.stderr);
    return run.stdout;
  };
  const write = (path, content = 'x\n') => {
    mkdirSync(dirname(resolve(root, path)), { recursive: true });
    writeFileSync(resolve(root, path), content);
  };
  git('init', '-q');
  for (const path of ['README.md', ...tracked]) {
    write(path);
    git('add', path);
  }
  if (gitignore !== undefined) {
    write('.gitignore', gitignore);
    git('add', '.gitignore');
  }
  writeFileSync(resolve(root, '.git/info/exclude'), exclude);
  for (const file of files) write(...[file].flat());
  const report = () => {
    const run = spawnSync(process.execPath, ['--input-type=module', '-e', REPORT, root], {
      cwd: root,
      encoding: 'utf8',
      env,
    });
    assert.equal(run.status, 0, run.stderr);
    return JSON.parse(run.stdout);
  };
  // The rule git applies to a top-level name: [source, pattern], or [] when no rule matches it.
  const rule = (name) => {
    const run = spawnSync('git', ['check-ignore', '-v', '-n', '--no-index', '--', `./${name}`], {
      cwd: root,
      encoding: 'utf8',
      env,
    });
    const [source, , pattern] = run.stdout.split('\t')[0].split(':');
    return source ? [source, pattern] : [];
  };
  const globalIgnore = (content) => {
    writeFileSync(resolve(home, 'global-ignore'), content);
    git('config', 'core.excludesFile', resolve(home, 'global-ignore'));
  };
  return { root, home, git, report, rule, globalIgnore };
}

const DIRECTORY_AND_FILE = ['.fooplugin/a', 'notes.local'];
const BOTH_OUTSIDE = [
  ['.fooplugin/', OUTSIDE],
  ['notes.local', OUTSIDE],
];

test('a top-level directory or file ignored only by .git/info/exclude is not an outside-manifest-root', (t) => {
  const fixture = ignoreFixture(t, {
    exclude: '.fooplugin/\nnotes.local\n',
    files: DIRECTORY_AND_FILE,
  });
  assert.deepEqual(fixture.report(), []);
});

test('every info/exclude pattern that excludes the root itself passes, whatever its form', (t) => {
  const patterns = ['/.fooplugin', '.fooplugin', '.foo*', '/.fooplugin/'];
  const reported = patterns.map((pattern) => [
    pattern,
    ignoreFixture(t, { exclude: `${pattern}\n`, files: ['.fooplugin/a'] }).report(),
  ]);
  assert.deepEqual(
    reported,
    patterns.map((pattern) => [pattern, []]),
  );
});

test('a root matched by both info/exclude and core.excludesFile takes the info/exclude rule and passes', (t) => {
  const fixture = ignoreFixture(t, { exclude: '.fooplugin/\n', files: ['.fooplugin/a'] });
  fixture.globalIgnore('.fooplugin/\n');
  assert.deepEqual(fixture.rule('.fooplugin'), ['.git/info/exclude', '.fooplugin/']);
  assert.deepEqual(fixture.report(), []);
});

test('a root excluded by info/exclude passes and its children are not opened again below it', (t) => {
  const reopened = [
    ignoreFixture(t, {
      exclude: '.fooplugin/\n!.fooplugin/keep\n',
      files: ['.fooplugin/a', '.fooplugin/keep'],
    }),
    ignoreFixture(t, {
      exclude: '.fooplugin/\n',
      files: ['.fooplugin/a', '.fooplugin/keep', ['.fooplugin/.gitignore', '!keep\n']],
    }),
  ];
  for (const fixture of reopened)
    assert.equal(
      fixture.git('ls-files', '--others', '--exclude-standard', '--', '.fooplugin/'),
      '',
    );
  assert.deepEqual(
    reopened.map((fixture) => fixture.report()),
    [[], []],
  );
});

test('a name starting with a colon is asked literally and passes on its own root pattern', (t) => {
  const fixture = ignoreFixture(t, { exclude: '/:foo/\n', files: [':foo/a'] });
  assert.deepEqual(fixture.report(), []);
});

test('a U+FFFD name is not asked and stays an issue while the other candidates are judged', (t) => {
  const fixture = ignoreFixture(t, {
    exclude: '/.foo�/\n.fooplugin/\n',
    files: ['.foo�/a', '.fooplugin/a'],
  });
  assert.deepEqual(fixture.rule('.foo�'), ['.git/info/exclude', '/.foo�/']);
  assert.deepEqual(fixture.report(), [['.foo�/', OUTSIDE]]);
});

test('the outside-manifest-root hint first asks about .git/info/exclude and keeps the manifest guidance', () => {
  const [issue] = findWorkspaceLayoutIssues(['tmp-not-a-root/'], {
    trackedTopLevel: new Set(['docs']),
  });
  assert.equal(issue.kind, OUTSIDE);
  assert.match(
    issue.hint,
    /^if it is local state of a tool the user enabled, ask the user whether to add the root to \.git\/info\/exclude \(untracked, applies to this clone only\)\. /u,
  );
  assert.match(
    issue.hint,
    / add the root to scripts\/artifacts\/workspace-layout\.knu\.json \(fields: docs\/development\/agent-workflows\/workspace-layout\.md\) or move the content under a manifest root$/u,
  );
});

test('roots not ignored or ignored only by the tracked .gitignore stay outside-manifest-root', (t) => {
  assert.deepEqual(ignoreFixture(t, { files: DIRECTORY_AND_FILE }).report(), BOTH_OUTSIDE);
  const tracked = ignoreFixture(t, {
    gitignore: '.fooplugin/\nnotes.local\n',
    files: DIRECTORY_AND_FILE,
  });
  assert.deepEqual(tracked.rule('.fooplugin'), ['.gitignore', '.fooplugin/']);
  assert.deepEqual(tracked.report(), BOTH_OUTSIDE);
});

test('roots ignored only by core.excludesFile or the default global ignore stay outside-manifest-root', (t) => {
  const configured = ignoreFixture(t, { files: DIRECTORY_AND_FILE });
  configured.globalIgnore('.fooplugin/\nnotes.local\n');
  assert.deepEqual(configured.rule('notes.local'), [
    resolve(configured.home, 'global-ignore'),
    'notes.local',
  ]);
  assert.deepEqual(configured.report(), BOTH_OUTSIDE);
  const xdg = ignoreFixture(t, { files: DIRECTORY_AND_FILE });
  mkdirSync(resolve(xdg.home, '.config/git'));
  writeFileSync(resolve(xdg.home, '.config/git/ignore'), '.fooplugin/\nnotes.local\n');
  assert.deepEqual(xdg.rule('.fooplugin'), [
    resolve(xdg.home, '.config/git/ignore'),
    '.fooplugin/',
  ]);
  assert.deepEqual(xdg.report(), BOTH_OUTSIDE);
});

test('the tracked .gitignore rule or an info/exclude negation keeps a root outside-manifest-root', (t) => {
  const both = ignoreFixture(t, {
    gitignore: '.fooplugin/\nnotes.local\n',
    exclude: '.fooplugin/\nnotes.local\n',
    files: DIRECTORY_AND_FILE,
  });
  assert.deepEqual(both.rule('notes.local'), ['.gitignore', 'notes.local']);
  const negated = ignoreFixture(t, {
    exclude: '!.fooplugin/\n!notes.local\n',
    files: DIRECTORY_AND_FILE,
  });
  assert.deepEqual(negated.rule('notes.local'), ['.git/info/exclude', '!notes.local']);
  const globalNegated = ignoreFixture(t, {
    exclude: '!.fooplugin/\n!notes.local\n',
    files: DIRECTORY_AND_FILE,
  });
  globalNegated.globalIgnore('.fooplugin/\nnotes.local\n');
  assert.deepEqual(globalNegated.rule('.fooplugin'), ['.git/info/exclude', '!.fooplugin/']);
  const trackedNegated = ignoreFixture(t, {
    gitignore: '.fooplugin/\nnotes.local\n',
    exclude: '!.fooplugin/\n!notes.local\n',
    files: DIRECTORY_AND_FILE,
  });
  assert.deepEqual(trackedNegated.rule('.fooplugin'), ['.gitignore', '.fooplugin/']);
  assert.deepEqual(
    [both, negated, globalNegated, trackedNegated].map((fixture) => fixture.report()),
    [BOTH_OUTSIDE, BOTH_OUTSIDE, BOTH_OUTSIDE, BOTH_OUTSIDE],
  );
});

test('a U+FFFD name stays an issue even when an info/exclude line matches it', (t) => {
  const fixture = ignoreFixture(t, { exclude: '/.foo�/\n', files: ['.foo�/a'] });
  assert.deepEqual(fixture.rule('.foo�'), ['.git/info/exclude', '/.foo�/']);
  assert.deepEqual(fixture.report(), [['.foo�/', OUTSIDE]]);
});

test('info/exclude does not change a retired root or nested runtime state', (t) => {
  const retired = ignoreFixture(t, { exclude: 'artifacts/\n', files: ['artifacts/a'] });
  const nested = ignoreFixture(t, {
    exclude: '.omx/\n',
    tracked: ['apps/package.json'],
    files: ['apps/.omx/state.json'],
  });
  assert.deepEqual(retired.report(), [['artifacts/', 'retired-root']]);
  assert.deepEqual(nested.report(), [['apps/.omx/', 'nested-runtime-state']]);
});

test('a directory with only some files excluded by info/exclude stays outside-manifest-root', (t) => {
  const fixture = ignoreFixture(t, {
    exclude: '.fooplugin/a\n',
    files: ['.fooplugin/a', '.fooplugin/b'],
  });
  assert.deepEqual(fixture.rule('.fooplugin'), []);
  assert.deepEqual(fixture.report(), [
    ['.fooplugin/', OUTSIDE],
    ['.fooplugin/a', OUTSIDE],
  ]);
});

test('content-only info/exclude patterns keep the root outside-manifest-root with or without re-inclusion', (t) => {
  const cases = [
    { exclude: '.fooplugin/*\n', files: ['.fooplugin/a'] },
    { exclude: '.fooplugin/**\n', files: ['.fooplugin/s/a'] },
    { exclude: '.fooplugin/*\n!.fooplugin/keep\n', files: ['.fooplugin/a', '.fooplugin/keep'] },
    {
      exclude: '.fooplugin/*\n',
      files: ['.fooplugin/a', '.fooplugin/keep', ['.fooplugin/.gitignore', '!keep\n']],
    },
  ];
  const fixtures = cases.map((options) => ignoreFixture(t, options));
  assert.deepEqual(
    fixtures.map((fixture) => fixture.rule('.fooplugin')),
    [[], [], [], []],
  );
  assert.deepEqual(
    fixtures.map((fixture) => fixture.report()),
    [
      [
        ['.fooplugin/', OUTSIDE],
        ['.fooplugin/a', OUTSIDE],
      ],
      [
        ['.fooplugin/', OUTSIDE],
        ['.fooplugin/s/', OUTSIDE],
      ],
      [
        ['.fooplugin/', OUTSIDE],
        ['.fooplugin/a', OUTSIDE],
      ],
      [
        ['.fooplugin/', OUTSIDE],
        ['.fooplugin/.gitignore', OUTSIDE],
        ['.fooplugin/a', OUTSIDE],
      ],
    ],
  );
});

test('a colon name is not read as pathspec magic and stays an issue when only another name is excluded', (t) => {
  const fixture = ignoreFixture(t, {
    exclude: '/plain/\n',
    files: [':(top)plain/a', ':plain/a'],
  });
  assert.deepEqual(fixture.report(), [
    [':(top)plain/', OUTSIDE],
    [':plain/', OUTSIDE],
  ]);
});
