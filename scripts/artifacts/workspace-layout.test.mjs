import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  appendFileSync,
  cpSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';

const repoRoot = resolve(import.meta.dirname, '../..');
const MANIFEST_FILES = [
  'scripts/artifacts/workspace-layout.core.json',
  'scripts/artifacts/workspace-layout.knu.json',
];
// Loaded per test so that one missing module fails each test on its own reason.
const layoutModule = () => import('./workspace-layout.mjs');
const readManifests = () =>
  Object.fromEntries(
    ['core', 'binding'].map((key, index) => [
      key,
      JSON.parse(readFileSync(resolve(repoRoot, MANIFEST_FILES[index]), 'utf8')),
    ]),
  );
const rootPath = (layout, id) => layout.roots.find((root) => root.id === id).path;
const tracked = () =>
  execFileSync('git', ['ls-files', '-z'], { cwd: repoRoot, encoding: 'utf8' })
    .split('\0')
    .filter(Boolean);

const HOST_RUNTIME_KINDS = ['claude-native', 'claude-review-packets', 'codex-native'];
const CODE_KINDS = [
  'build',
  'ci-performance',
  ...HOST_RUNTIME_KINDS,
  'dependency-automation',
  'github',
  'infra',
  'plan-impact',
  'security',
  'stress',
  'test',
].sort();

test('the core manifest and the KNU binding validate with the retention vocabulary', async () => {
  const { loadWorkspaceLayout } = await layoutModule();
  const layout = loadWorkspaceLayout();
  assert.equal(layout.core.schema, 'htc-workspace-layout-core/v1');
  assert.equal(layout.binding.schema, 'htc-workspace-layout-binding/v1');
  // The core default names no KNU root.
  assert.doesNotMatch(
    readFileSync(resolve(repoRoot, MANIFEST_FILES[0]), 'utf8'),
    /\.(?:plans|artifacts|local-docs|omc|omx)\b|knu/iu,
  );
  assert.deepEqual(layout.core.retentionClasses, [
    'current-input',
    'regenerable-output',
    'historical-observation',
    'sensitive-or-undetermined',
  ]);
  assert.deepEqual([...layout.toolKinds.keys()].sort(), CODE_KINDS);
  for (const kind of HOST_RUNTIME_KINDS) {
    assert.equal(layout.toolKinds.get(kind).overridable, false, kind);
    assert.deepEqual(layout.toolKinds.get(kind).retention, {
      class: 'current-input',
      until: 'task-settled',
    });
  }
  for (const kind of ['ci-performance', 'stress'])
    assert.deepEqual(layout.toolKinds.get(kind).retention, { class: 'historical-observation' });
  assert.deepEqual(layout.toolKinds.get('test').retention, { class: 'regenerable-output' });
  for (const root of layout.roots)
    if (root.tracking === 'tracked') assert.equal(root.retention, undefined, root.id);
  assert.equal(
    layout.roots.find((root) => root.id === 'artifact-plans').retention.until,
    'plan-closed',
  );
});

test('manifest validation rejects unknown fields, values outside the vocabulary and dangling ids', async () => {
  const { validateWorkspaceLayout } = await layoutModule();
  const mutations = [
    ['unknown root field', ({ binding }) => (binding.roots[0].color = 'blue')],
    [
      'class outside the vocabulary',
      ({ binding }) => (binding.roots[0].retention = { class: 'old' }),
    ],
    [
      'until on a tracked root',
      ({ binding }) =>
        (binding.roots.find((root) => root.tracking === 'tracked').retention = {
          class: 'current-input',
          until: 'plan-closed',
        }),
    ],
    ['duplicate path', ({ binding }) => (binding.roots[1].path = binding.roots[0].path)],
    ['retired root target', ({ binding }) => (binding.retiredRoots[0].use = 'nowhere')],
    ['core id', ({ binding }) => (binding.roots[0].core = 'nowhere')],
    ['kind without class', ({ binding }) => delete binding.toolKinds[0].retention],
    ['path escape', ({ binding }) => (binding.roots[0].path = '../outside')],
    ['schema', ({ core }) => (core.schema = 'htc-workspace-layout-core/v0')],
  ];
  for (const [name, mutate] of mutations) {
    const manifests = readManifests();
    mutate(manifests);
    assert.throws(
      () => validateWorkspaceLayout(manifests),
      /workspace layout manifest is invalid/u,
      name,
    );
  }
  assert.doesNotThrow(() => validateWorkspaceLayout(readManifests()));
});

// Root constants that host wiring still holds as literals. Each one is compared with the manifest until the wiring
// reads the manifest itself.
async function namedConstants() {
  const { PLAN_ROOT } = await import('../agents/common/plan-store.mjs');
  const { DEFAULT_ARTIFACTS_DIRECTORY } = await import('./paths.mjs');
  const codexHook = await import('../../.codex/hooks/knu-subagent-hooks.mjs');
  const { HOOK_RECORD_DIRECTORY } = await import('../agents/codex/subagent-hook-records.mjs');
  const { REVIEW_INPUT_RECORD_DIRS } = await import('../agents/claude/native-session.mjs');
  const lanes = await import('../ci/lanes/classify-changes.mjs');
  const source = (path) => readFileSync(resolve(repoRoot, path), 'utf8');
  // The three Codex `.omx/context` locations are module-private; their root token is read from the source line.
  const omxContext = [
    [
      'scripts/agents/codex/session-contract.mjs',
      /^const CONTEXT_PATH_PATTERN = \/\^(\S+?)\\\/context\\\//mu,
    ],
    [
      'scripts/agents/codex/session-preflight.mjs',
      /^const contextPattern = \/\^(\S+?)\\\/context\\\//mu,
    ],
    [
      'scripts/agents/codex/session-preflight.mjs',
      /^\s+const path = `(\S+?)\/context\/\$\{entry\.name\}`;$/mu,
    ],
  ].map(([path, pattern]) => source(path).match(pattern)?.[1]?.replaceAll('\\', '') ?? null);
  return {
    PLAN_ROOT,
    DEFAULT_ARTIFACTS_DIRECTORY,
    RECORD_DIRECTORY: codexHook.RECORD_DIRECTORY,
    REGISTRY_DIRECTORY: codexHook.REGISTRY_DIRECTORY,
    HOOK_RECORD_DIRECTORY,
    REVIEW_INPUT_RECORD_DIRS,
    CLASSIFIER_ENTRIES: [...lanes.REPO_POLICY_PREFIXES, ...lanes.REPO_POLICY_PATHS],
    OMX_CONTEXT_ROOTS: omxContext,
  };
}

function namedConstantMismatches(layout, actual) {
  const path = (id) => rootPath(layout, id);
  const ignored = layout.roots.filter((root) => root.tracking === 'ignored');
  // Ignored roots whose tracked files change in a PR, and the tracked overlay markers, route to repo-policy.
  const classifierExpected = [
    ...ignored
      .filter((root) => root.trackedFiles || root.trackedFilesOwner)
      .map((root) => `${root.path}/`),
    ...layout.roots.flatMap((root) => (root.marker ? [root.marker] : [])),
  ].sort();
  const classifierNamed = new Set([
    ...ignored.map((root) => `${root.path}/`),
    ...layout.roots.flatMap((root) => (root.marker ? [root.marker] : [])),
  ]);
  const expected = {
    PLAN_ROOT: path('plans'),
    DEFAULT_ARTIFACTS_DIRECTORY: path('tools'),
    RECORD_DIRECTORY: `${path('codex-hook-state')}/knu-subagent-hooks`,
    REGISTRY_DIRECTORY: `${path('tools')}/codex-native`,
    HOOK_RECORD_DIRECTORY: `${path('codex-hook-state')}/knu-subagent-hooks`,
    REVIEW_INPUT_RECORD_DIRS: layout.roots
      .filter((root) => root.reviewInput)
      .map((root) => `${root.path}/`)
      .sort(),
    CLASSIFIER_ENTRIES: classifierExpected,
    OMX_CONTEXT_ROOTS: [path('omx'), path('omx'), path('omx')],
  };
  const observed = {
    ...actual,
    REVIEW_INPUT_RECORD_DIRS: [...actual.REVIEW_INPUT_RECORD_DIRS].sort(),
    CLASSIFIER_ENTRIES: actual.CLASSIFIER_ENTRIES.filter((entry) =>
      classifierNamed.has(entry),
    ).sort(),
  };
  return Object.keys(expected)
    .filter((name) => JSON.stringify(observed[name]) !== JSON.stringify(expected[name]))
    .map((name) => ({ name, expected: expected[name], observed: observed[name] }));
}

test('root constants held by host wiring match the manifest', async () => {
  const { loadWorkspaceLayout } = await layoutModule();
  const layout = loadWorkspaceLayout();
  assert.ok(layout.toolKinds.has('codex-native'));
  const actual = await namedConstants();
  assert.deepEqual(namedConstantMismatches(layout, actual), []);
  // Control: a single changed constant or classifier entry is reported by name.
  for (const [name, value] of [
    ['PLAN_ROOT', '.plan'],
    ['DEFAULT_ARTIFACTS_DIRECTORY', '.artifacts/tool'],
    ['REVIEW_INPUT_RECORD_DIRS', actual.REVIEW_INPUT_RECORD_DIRS.slice(1)],
    ['CLASSIFIER_ENTRIES', actual.CLASSIFIER_ENTRIES.filter((entry) => entry !== '.omc-workspace')],
    ['OMX_CONTEXT_ROOTS', [null, ...actual.OMX_CONTEXT_ROOTS.slice(1)]],
  ])
    assert.deepEqual(
      namedConstantMismatches(layout, { ...actual, [name]: value }).map((m) => m.name),
      [name],
    );
});

// Non-agent rules are the ones whose first path segment is no manifest root. A rule with a slash under a tracked
// top-level directory cannot create a top-level entry; every other one belongs on the guard exclusion list.
function exclusionMismatches(layout, gitignore, trackedTopLevel) {
  const lines = gitignore.split('\n').map((line) => line.trim());
  const manifestTop = new Set(layout.roots.map((root) => root.path.split('/')[0]));
  const exclusions = new Set(layout.guardExclusions);
  const unclassified = [];
  for (const rule of lines) {
    if (!rule || rule.startsWith('#') || rule.startsWith('!')) continue;
    const top = rule.replace(/^\//u, '').split('/')[0];
    if (manifestTop.has(top) || exclusions.has(rule)) continue;
    if (rule.replace(/^\/|\/$/gu, '').includes('/') && trackedTopLevel.has(top)) continue;
    unclassified.push(rule);
  }
  return { missing: layout.guardExclusions.filter((rule) => !lines.includes(rule)), unclassified };
}

test('the guard exclusion list is the non-agent .gitignore rules that can create a top-level entry', async () => {
  const { loadWorkspaceLayout } = await layoutModule();
  const layout = loadWorkspaceLayout();
  const gitignore = readFileSync(resolve(repoRoot, '.gitignore'), 'utf8');
  const trackedTopLevel = new Set(tracked().map((path) => path.split('/')[0]));
  assert.deepEqual(exclusionMismatches(layout, gitignore, trackedTopLevel), {
    missing: [],
    unclassified: [],
  });
  assert.equal(layout.guardExclusions.length, 14);
  assert.ok(layout.guardExclusions.includes('next-env.d.ts'));
  // Controls: a new global rule must be classified, a dropped .gitignore rule leaves the list.
  assert.deepEqual(
    exclusionMismatches(layout, `${gitignore}\n*.cache-tmp\n`, trackedTopLevel).unclassified,
    ['*.cache-tmp'],
  );
  assert.deepEqual(
    exclusionMismatches(layout, gitignore.replace(/^\.vercel$/mu, ''), trackedTopLevel).missing,
    ['.vercel'],
  );
});

// Root literal scan. Universe: tracked scripts and configuration outside the app packages, without tests,
// fixtures (their test guards them) and the manifests themselves. A literal is a root name that is neither
// in a whole-line comment nor a property access (`value.artifacts`); an escaped regex root is a literal.
const ROOT_NAME = /\.(?:plans|omc|omx)\b|\.codex.{0,2}state|\.local-docs|\.artifacts/gu;
const COMMENT_LINE = /^(?:\/\/|\/\*|\*|#)/u;

function scanUniverse(paths) {
  return paths.filter(
    (path) =>
      /\.(?:mjs|js|ts|cjs|sh|py|json|toml)$/u.test(path) &&
      !/^(?:apps|packages)\//u.test(path) &&
      !/\.test\.|\/test\/|__tests__|\/fixtures\//u.test(path) &&
      !MANIFEST_FILES.includes(path),
  );
}

function literalTokens(line) {
  if (COMMENT_LINE.test(line.trim())) return [];
  return [...line.matchAll(ROOT_NAME)]
    .filter((match) => !/[\w$)\]]/u.test(line[match.index - 1] ?? ''))
    .map((match) => match[0].replaceAll('\\', ''));
}

function rootLiteralViolations(layout, files) {
  const roots = new Set(layout.roots.map((root) => root.path));
  const allowed = new Map(
    layout.rootLiteralAllowlist.map((entry) => [`${entry.file}\0${entry.text}`, entry.count ?? 1]),
  );
  const seen = new Map();
  const notManifestRoot = new Set();
  for (const [file, text] of files)
    for (const line of text.split('\n')) {
      const tokens = literalTokens(line);
      if (!tokens.length) continue;
      const key = `${file}\0${line.trim()}`;
      seen.set(key, (seen.get(key) ?? 0) + 1);
      for (const token of tokens) if (!roots.has(token)) notManifestRoot.add(`${file}: ${token}`);
    }
  for (const entry of layout.rootLiteralAllowlist)
    for (const token of literalTokens(entry.text))
      if (!roots.has(token)) notManifestRoot.add(`allowlist ${entry.file}: ${token}`);
  const show = (key) => key.replace('\0', ': ');
  return {
    unlisted: [...seen]
      .filter(([key, count]) => count > (allowed.get(key) ?? 0))
      .map(([key]) => show(key)),
    notManifestRoot: [...notManifestRoot].sort(),
    stale: [...allowed]
      .filter(([key, count]) => (seen.get(key) ?? 0) < count)
      .map(([key]) => show(key)),
  };
}

const repositoryFiles = () =>
  scanUniverse(tracked()).map((path) => [path, readFileSync(resolve(repoRoot, path), 'utf8')]);

test('root literals in tracked scripts are manifest roots on the per-file allowlist', async () => {
  const { loadWorkspaceLayout } = await layoutModule();
  const layout = loadWorkspaceLayout();
  assert.deepEqual(rootLiteralViolations(layout, repositoryFiles()), {
    unlisted: [],
    notManifestRoot: [],
    stale: [],
  });
  for (const entry of layout.rootLiteralAllowlist) assert.equal(entry.transition, 'P4', entry.file);
});

test('the root literal scan reports new literals and renamed roots and skips fixtures, comments and properties', async () => {
  const { loadWorkspaceLayout, validateWorkspaceLayout } = await layoutModule();
  const layout = loadWorkspaceLayout();
  const files = repositoryFiles();
  // A literal added to a scanned file.
  const added = files.map(([path, text]) =>
    path === 'scripts/agents/common/plan-impact.mjs'
      ? [path, `${text}\nconst extra = '.artifacts/x';\n`]
      : [path, text],
  );
  assert.deepEqual(rootLiteralViolations(layout, added).unlisted, [
    "scripts/agents/common/plan-impact.mjs: const extra = '.artifacts/x';",
  ]);
  // A manifest root renamed without touching the allowlist.
  const manifests = readManifests();
  manifests.binding.roots.find((root) => root.id === 'plans').path = '.plan';
  const renamed = rootLiteralViolations(validateWorkspaceLayout(manifests), files);
  assert.ok(
    renamed.notManifestRoot.some((entry) => entry.endsWith(': .plans')),
    renamed.notManifestRoot,
  );
  // Comments and property access are not literals; an escaped regex root is.
  const probe = [
    '// see the .plans root',
    ' * .artifacts in a block comment',
    'const x = value.artifacts;',
    'const y = result.plans.map(f);',
    'const z = /^\\.omx\\/context/u;',
  ].join('\n');
  assert.deepEqual(rootLiteralViolations(layout, [['scripts/git/probe.mjs', probe]]).unlisted, [
    'scripts/git/probe.mjs: const z = /^\\.omx\\/context/u;',
  ]);
  // Fixtures, tests, app packages and the manifests stay outside the universe.
  assert.deepEqual(
    scanUniverse([
      'scripts/ci/agents/common/fixtures/workflow-document-owners.json',
      'scripts/git/workspace-layout-check.test.mjs',
      'apps/api/test/stress/docker/run-dockerized-smoke.mjs',
      ...MANIFEST_FILES,
      'scripts/git/workspace-layout-check.mjs',
    ]),
    ['scripts/git/workspace-layout-check.mjs'],
  );
});

// Hook handlers import paths.mjs and plan-store at module load. A missing or broken manifest must not change what
// they return, because no handler reads it: paths.mjs reads it only under an override.
function scriptCopy(t, mutate) {
  const root = realpathSync(mkdtempSync(resolve(tmpdir(), 'knu-layout-scripts-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const directory of ['scripts/agents', 'scripts/artifacts'])
    cpSync(resolve(repoRoot, directory), resolve(root, directory), {
      recursive: true,
      filter: (source) => !source.endsWith('.test.mjs'),
    });
  mutate(root);
  return root;
}

function hookRuns(t, scripts) {
  const project = realpathSync(mkdtempSync(resolve(tmpdir(), 'knu-layout-project-')));
  t.after(() => rmSync(project, { recursive: true, force: true }));
  execFileSync('git', ['init', '-q'], { cwd: project });
  writeFileSync(resolve(project, 'a.txt'), 'x\n');
  const session = '11111111-2222-4333-8444-555555555555';
  const run = (args, event) => {
    const result = spawnSync(
      process.execPath,
      [resolve(scripts, 'scripts/agents/claude/native-session.mjs'), ...args],
      {
        cwd: project,
        env: { ...process.env, CLAUDE_PROJECT_DIR: project },
        input: JSON.stringify(event),
        encoding: 'utf8',
      },
    );
    return { status: result.status, stdout: result.stdout.replaceAll(scripts, '<scripts>') };
  };
  return [
    run(['--hook'], {
      hook_event_name: 'SessionStart',
      session_id: session,
      source: 'startup',
      cwd: project,
    }),
    run(['--hook', '--file-guard'], {
      hook_event_name: 'PreToolUse',
      session_id: session,
      tool_name: 'Edit',
      tool_input: { file_path: resolve(project, 'a.txt'), old_string: 'x', new_string: 'y' },
    }),
  ];
}

test('hook handlers behave the same with a missing or broken manifest', async (t) => {
  const manifestPaths = (root) => MANIFEST_FILES.map((path) => resolve(root, path));
  // The intact copy reads the manifests: a missing file fails before the hook comparison means anything.
  for (const path of manifestPaths(repoRoot)) readFileSync(path);
  const baseline = hookRuns(
    t,
    scriptCopy(t, () => {}),
  );
  assert.equal(baseline[0].status, 0);
  assert.equal(baseline[1].status, 0);
  const missing = scriptCopy(t, (root) => manifestPaths(root).forEach((path) => rmSync(path)));
  const broken = scriptCopy(t, (root) =>
    manifestPaths(root).forEach((path) => writeFileSync(path, '{')),
  );
  assert.deepEqual(hookRuns(t, missing), baseline);
  assert.deepEqual(hookRuns(t, broken), baseline);
  // Without an override paths.mjs never reads the manifest; with one a broken manifest fails closed.
  const paths = await import(resolve(broken, 'scripts/artifacts/paths.mjs'));
  assert.equal(
    paths.resolveArtifactPath('/repo', ['claude-native', 'x'], {}),
    '/repo/.artifacts/tools/claude-native/x',
  );
  assert.throws(
    () => paths.resolveArtifactPath('/repo', ['infra'], { KNU_ARTIFACTS_DIR: '/runner/out' }),
    /workspace layout manifest/u,
  );
  // Control: a loader that reads at module load breaks the hooks under the same broken manifest.
  const eager = scriptCopy(t, (root) => {
    manifestPaths(root).forEach((path) => writeFileSync(path, '{'));
    appendFileSync(
      resolve(root, 'scripts/artifacts/workspace-layout.mjs'),
      '\nloadWorkspaceLayout();\n',
    );
  });
  assert.notDeepEqual(hookRuns(t, eager), baseline);
});

test('the layout guide is linked from the manifests and the artifact README', async () => {
  const { loadWorkspaceLayout } = await layoutModule();
  const layout = loadWorkspaceLayout();
  const guide = 'docs/development/agent-workflows/workspace-layout.md';
  assert.equal(layout.core.guide, guide);
  assert.equal(layout.binding.guide, guide);
  const text = readFileSync(resolve(repoRoot, guide), 'utf8');
  for (const path of MANIFEST_FILES) assert.ok(text.includes(path.split('/').at(-1)), path);
  const readme = readFileSync(resolve(repoRoot, '.artifacts/README.md'), 'utf8');
  assert.match(readme, /workspace-layout\.md/u);
  assert.match(readme, /KNU_ARTIFACTS_DIR/u);
});
