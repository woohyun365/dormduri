import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { discoverSuiteTests } from './repo-policy-test-files.mjs';
import {
  AGENT_TEST_PRODUCT_INPUTS,
  changedPathsForComparison,
  classifyChanges,
  classifyGithubEvent,
  eventComparisonHints,
  FORMATTING_CHANGED_PATH_LIMIT,
  formattingScope,
  isIntendedFanOut,
  summarizeChangedPaths,
} from './classify-changes.mjs';

const fixtureUrl = new URL('./fixtures/change-impact-cases.json', import.meta.url);
const cases = JSON.parse(await readFile(fixtureUrl, 'utf8'));
const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const surfaceDocPath = 'docs/development/ci/ci-surface-ownership.md';
const LANES = ['web', 'api', 'shared', 'storybook', 'infra', 'repoPolicy', 'agentWorkflow'];
const STATUSES = ['분류됨', '의도한 fan-out'];
const tracked = new Set(
  execFileSync('git', ['ls-files', '-z'], { cwd: repoRoot, encoding: 'utf8' }).split('\0'),
);

function codeSpans(cell) {
  return [...cell.matchAll(/`([^`]+)`/gu)].map((match) => match[1]);
}

function surfaceTable(markdown) {
  const surfaces = codeSpans(
    markdown.split(/^## /mu).find((section) => section.startsWith('표면 정의')) ?? '',
  ).filter((name) => /^[A-Z]/u.test(name));
  const section = markdown.split(/^## /mu).find((part) => part.startsWith('경로 family 표'));
  assert.ok(section, `${surfaceDocPath} must keep the "경로 family 표" section`);
  const rows = section
    .split('\n')
    .filter((line) => line.startsWith('|'))
    .slice(2)
    .map((line) =>
      line
        .split('|')
        .slice(1, -1)
        .map((cell) => cell.trim()),
    )
    .map(([family, surface, lanes, status, owner, examples]) => ({
      family,
      surface,
      lanes,
      status,
      owner,
      examples: codeSpans(examples ?? ''),
    }));
  return { surfaces, rows };
}

function expectedLanes(cell) {
  if (cell === '전체') return Object.fromEntries(LANES.map((lane) => [lane, true]));
  const names = codeSpans(cell);
  for (const name of names) assert.ok(LANES.includes(name), `unknown lane ${name}`);
  return Object.fromEntries(LANES.map((lane) => [lane, names.includes(lane)]));
}

for (const fixture of cases) {
  test(`classifies ${fixture.name} changes without unrelated product lanes`, () => {
    assert.deepEqual(classifyChanges(fixture.paths), fixture.expected);
  });
}

test('keeps an empty comparison visible through the repo-policy lane', () => {
  assert.deepEqual(classifyChanges([]), {
    web: false,
    api: false,
    shared: false,
    storybook: false,
    infra: false,
    repoPolicy: true,
    agentWorkflow: true,
  });
});

test('tracked Claude project adapter files select policy checks without unrelated product lanes', () => {
  for (const paths of [
    ['.gitignore', 'CLAUDE.md', '.claude/agents/knu_explorer.md'],
    ['.claude/agents/knu_executor_xhigh.md'],
    ['.claude/settings.json'],
    ['.claude/skills/knu-review/SKILL.md'],
  ]) {
    assert.deepEqual(classifyChanges(paths), {
      web: false,
      api: false,
      shared: false,
      storybook: false,
      infra: false,
      repoPolicy: true,
      agentWorkflow: true,
    });
  }
});

test('uses pull request base and head commits as the primary comparison hints', () => {
  assert.deepEqual(
    eventComparisonHints({
      eventName: 'pull_request',
      githubSha: 'merge-sha',
      event: {
        pull_request: {
          base: { sha: 'base-sha', ref: 'main' },
          head: { sha: 'head-sha' },
        },
      },
    }),
    { base: 'base-sha', head: 'head-sha', baseRef: 'main' },
  );
});

test('uses push before and after commits before falling back to merge-base', () => {
  assert.deepEqual(
    eventComparisonHints({
      eventName: 'push',
      githubSha: 'workflow-sha',
      event: {
        before: 'before-sha',
        after: 'after-sha',
        repository: { default_branch: 'main' },
      },
    }),
    { base: 'before-sha', head: 'after-sha', baseRef: 'main' },
  );
});

test('bounds changed path output while preserving the total count', () => {
  const paths = Array.from({ length: 103 }, (_, index) => `docs/change-${index}.md`);

  assert.deepEqual(summarizeChangedPaths(paths), {
    changed_path_count: 103,
    changed_paths_json: JSON.stringify(paths.slice(0, 100)),
    changed_paths_truncated: true,
  });
});

test('unknown paths outside every surface keep the conservative fail-open', () => {
  for (const path of ['future-surface/unknown.file', 'DESIGN.md', '.npmrc', '.nvmrc']) {
    assert.deepEqual(classifyChanges([path]), {
      web: true,
      api: true,
      shared: true,
      storybook: true,
      infra: true,
      repoPolicy: true,
      agentWorkflow: true,
    });
  }
});

test('common agent workflow scripts select only the repo-policy lane', () => {
  for (const path of [
    'scripts/agents/common/workflow-entry.mjs',
    'scripts/agents/common/plan-store.mjs',
    'scripts/agents/common/adapter-contract.mjs',
  ]) {
    assert.deepEqual(classifyChanges([path]), {
      web: false,
      api: false,
      shared: false,
      storybook: false,
      infra: false,
      repoPolicy: true,
      agentWorkflow: true,
    });
  }
});

test('agent surface changes select the agent workflow lane with the repo-policy lane', () => {
  for (const path of [
    'scripts/ci/agents/claude/claude-native-skills.test.mjs',
    'scripts/agents/claude/native-session.mjs',
    '.claude/skills/knu-review/SKILL.md',
    'docs/development/agent-workflows/qa.md',
  ]) {
    assert.deepEqual(classifyChanges([path]), {
      web: false,
      api: false,
      shared: false,
      storybook: false,
      infra: false,
      repoPolicy: true,
      agentWorkflow: true,
    });
  }
});

test('token, new screen and Storybook check paths select the storybook lane', () => {
  for (const path of [
    'apps/web/src/styles/tokens/semantic.tokens.json',
    'apps/web/src/styles/tokens/tokens.generated.css',
    'apps/web/src/styles/fonts.ts',
    'apps/web/src/screens/README.md',
    'apps/web/src/screens/landing/LandingScreen.tsx',
    'apps/web/playwright.storybook.config.ts',
    'apps/web/e2e/storybook/stories.storybook.ts',
  ]) {
    assert.deepEqual(
      classifyChanges([path]),
      {
        web: true,
        api: false,
        shared: false,
        storybook: true,
        infra: false,
        repoPolicy: false,
        agentWorkflow: false,
      },
      path,
    );
  }
  for (const path of [
    'apps/web/e2e/smoke.spec.ts',
    'apps/web/src/app/page.tsx',
    'apps/web/src/stylesheet.ts',
    'apps/web/src/screens.ts',
  ]) {
    assert.equal(classifyChanges([path]).storybook, false, path);
  }
  assert.deepEqual(classifyChanges(['apps/web/src/styles/tokens/README.md']), {
    web: true,
    api: false,
    shared: false,
    storybook: true,
    infra: false,
    repoPolicy: false,
    agentWorkflow: true,
  });
});

test('the storybook lane runs the static build and then the story visual check', () => {
  const webWorkflow = readFileSync(`${repoRoot}.github/workflows/web-ci.yml`, 'utf8');
  const steps = webWorkflow.split(/\n\s+- name:/u);
  const stepIndex = (command) => steps.findIndex((step) => step.includes(command));
  const build = stepIndex('pnpm --dir apps/web ci:storybook:build');
  const browserInstall = stepIndex('playwright install --with-deps chromium');
  const visual = stepIndex('pnpm --dir apps/web ci:storybook:visual');

  assert.ok(build > 0 && browserInstall > build && visual > browserInstall);
  assert.match(steps[visual], /if: \$\{\{ inputs\.run_storybook \}\}/u);
});

test('product files that agent tests read select the agent workflow lane, other product files do not', () => {
  assert.deepEqual(classifyChanges(['apps/web/src/legal/components/LegalDocumentLayout.tsx']), {
    web: true,
    api: false,
    shared: false,
    storybook: false,
    infra: false,
    repoPolicy: false,
    agentWorkflow: true,
  });
  assert.equal(classifyChanges(['packages/shared/src/legal/contract.ts']).agentWorkflow, true);
  assert.equal(
    classifyChanges(['apps/web/src/main/tabs/home/sections/activity/dialogs/NewDialog.tsx'])
      .agentWorkflow,
    true,
  );
  assert.equal(classifyChanges(['apps/web/src/app/page.tsx']).agentWorkflow, false);
  assert.equal(classifyChanges(['apps/api/src/auth/auth.controller.ts']).agentWorkflow, false);
});

test('agent test product inputs are tracked and cover every product file the agent suite names or links', () => {
  for (const path of AGENT_TEST_PRODUCT_INPUTS.files) {
    assert.ok(tracked.has(path), `${path} is not tracked`);
    assert.match(path, /^(?:apps|packages)\//u);
  }
  for (const prefix of AGENT_TEST_PRODUCT_INPUTS.prefixes) {
    assert.ok(
      [...tracked].some((path) => path.startsWith(prefix)),
      `${prefix} has no tracked file`,
    );
  }
  const covered = (path) =>
    AGENT_TEST_PRODUCT_INPUTS.files.includes(path) ||
    AGENT_TEST_PRODUCT_INPUTS.prefixes.some((prefix) => path.startsWith(prefix));
  // Files under the agent test directory (tests of the agent suite, helpers and fixtures) that name a tracked product file,
  // and development documents that link one (the document graph test reads link targets). Directory names are routing
  // examples, not reads.
  const suite = discoverSuiteTests(repoRoot, 'agent-workflow');
  const sources = [...tracked].filter(
    (path) =>
      path.startsWith('scripts/ci/agents/') &&
      (!path.endsWith('.test.mjs') || suite.includes(path)),
  );
  const named = new Set();
  for (const source of sources) {
    for (const match of readFileSync(resolve(repoRoot, source), 'utf8').matchAll(
      /['`"]((?:apps|packages)\/[^'`"\s]+)['`"]/gu,
    ))
      if (tracked.has(match[1])) named.add(match[1]);
  }
  for (const document of [...tracked].filter(
    (path) => path.startsWith('docs/development/') && path.endsWith('.md'),
  )) {
    for (const match of readFileSync(resolve(repoRoot, document), 'utf8').matchAll(
      /\]\(([^)#\s]+)(?:#[^)]*)?\)/gu,
    )) {
      const target = relative(repoRoot, resolve(repoRoot, dirname(document), match[1]));
      if (/^(?:apps|packages)\//u.test(target) && tracked.has(target)) named.add(target);
    }
  }
  assert.ok(named.size > 0, 'the scan must find product files named by the agent suite');
  assert.deepEqual(
    [...named].filter((path) => !covered(path)),
    [],
  );
});

test('surface ownership document rows match the classifier for every representative path', async () => {
  const { surfaces, rows } = surfaceTable(await readFile(`${repoRoot}${surfaceDocPath}`, 'utf8'));
  assert.ok(surfaces.length > 0, 'surface definitions must name each surface in code spans');
  assert.ok(rows.length > 0, 'surface table must have rows');
  for (const status of STATUSES) {
    assert.ok(
      rows.some((row) => row.status === status),
      `surface table must keep a ${status} row`,
    );
  }
  for (const row of rows) {
    assert.ok(surfaces.includes(row.surface), `${row.family}: unknown surface ${row.surface}`);
    assert.ok(STATUSES.includes(row.status), `${row.family}: unknown status ${row.status}`);
    assert.equal(
      row.lanes === '전체',
      row.status !== '분류됨',
      `${row.family}: only intended fan-out rows select every lane`,
    );
    assert.ok(codeSpans(row.owner).length > 0, `${row.family}: owner document is required`);
    for (const owner of codeSpans(row.owner)) {
      assert.ok(tracked.has(owner), `${row.family}: owner ${owner} is not tracked`);
    }
    assert.ok(row.examples.length > 0, `${row.family}: representative path is required`);
    for (const path of row.examples) {
      assert.ok(tracked.has(path), `${row.family}: ${path} is not tracked`);
      assert.deepEqual(classifyChanges([path]), expectedLanes(row.lanes), `${row.family}: ${path}`);
      assert.equal(
        isIntendedFanOut(path),
        row.status === '의도한 fan-out',
        `${row.family}: ${path} status must match isIntendedFanOut`,
      );
    }
  }
  const fanOutFamilies = rows
    .filter((row) => row.status === '의도한 fan-out')
    .flatMap((row) => codeSpans(row.family));
  const uncovered = [...tracked]
    .filter((path) => path && isIntendedFanOut(path))
    .filter(
      (path) =>
        !fanOutFamilies.some((family) =>
          family.endsWith('/**') ? path.startsWith(family.slice(0, -2)) : path === family,
        ),
    );
  assert.deepEqual(uncovered, [], 'every intended fan-out path needs a fan-out row');
});

test('every tracked path that selects every lane is an intended fan-out path', () => {
  const gaps = [...tracked]
    .filter(Boolean)
    .filter((path) => Object.values(classifyChanges([path])).every(Boolean))
    .filter((path) => !isIntendedFanOut(path));
  assert.deepEqual(gaps, []);
});

test('every path literal in the classifier rules matches a tracked path', async () => {
  const source = await readFile(new URL('./classify-changes.mjs', import.meta.url), 'utf8');
  const start = source.indexOf('const ROOT_TOOLCHAIN_PATHS');
  const end = source.indexOf('function runGit');
  assert.ok(start >= 0 && end > start, 'classifier rule region must stay before runGit');
  const literals = [...source.slice(start, end).matchAll(/'([^'\s]+)'/gu)]
    .map((match) => match[1])
    .filter((literal) => /[A-Za-z]/u.test(literal) && /[./]/u.test(literal) && literal !== '.md');
  assert.ok(literals.length > 0, 'classifier rules must name paths');
  const dead = [...new Set(literals)].filter((literal) =>
    literal.endsWith('/')
      ? ![...tracked].some((path) => path.startsWith(literal))
      : !tracked.has(literal),
  );
  assert.deepEqual(dead, []);
});

// Lane jobs run repository scripts: workflow `node scripts/...` steps, `pnpm` scripts (root and `--dir` packages,
// followed recursively), the lane package's own scripts and the web image build. Files of the lane package (tests,
// configs, harnesses) may also import a repository script or read one by its repository path. A change to such a
// script, or to any module an executed or imported script imports, must still select that lane.
const RELATIVE_IMPORT = /(?:\bfrom\s+|\bimport\s*\(?\s*)['"](\.{1,2}\/[^'"]+)['"]/gu;

function repositoryPath(fromDirectory, target) {
  return relative(repoRoot, resolve(repoRoot, fromDirectory, target))
    .split(sep)
    .join('/');
}

function importClosure(entries) {
  const seen = new Set();
  const queue = [...entries];
  while (queue.length) {
    const path = queue.shift();
    if (seen.has(path) || !tracked.has(path)) continue;
    seen.add(path);
    for (const match of readFileSync(`${repoRoot}${path}`, 'utf8').matchAll(RELATIVE_IMPORT))
      queue.push(repositoryPath(dirname(path), match[1]));
  }
  return seen;
}

function packageScripts(directory) {
  return JSON.parse(readFileSync(`${repoRoot}${directory}/package.json`, 'utf8')).scripts ?? {};
}

function repositoryScripts(command, directory = '.', depth = 0, found = new Set()) {
  for (const match of command.matchAll(/\bnode\s+((?:\.\.\/)*scripts\/\S+?\.mjs)\b/gu))
    found.add(repositoryPath(directory, match[1]));
  if (depth > 6) return found;
  for (const match of command.matchAll(
    /\bpnpm((?:\s+(?:--dir|-C)\s+\S+|\s+-s|\s+--silent|\s+run)*)\s+([a-z][\w:.-]*)/gu,
  )) {
    const target = (match[1].match(/(?:--dir|-C)\s+(\S+)/u) ?? [])[1];
    const scriptDirectory = target ? repositoryPath(directory, target) || '.' : directory;
    const script = packageScripts(scriptDirectory)[match[2]];
    if (script) repositoryScripts(script, scriptDirectory, depth + 1, found);
  }
  return found;
}

// Repository scripts that files of a lane package import (followed through their imports) or name by repository
// path (read as text, so only that file).
function packageScriptReferences(directory) {
  const imported = new Set();
  const named = new Set();
  for (const path of tracked) {
    if (!path.startsWith(`${directory}/`) || !/\.[cm]?[jt]sx?$/u.test(path)) continue;
    const source = readFileSync(`${repoRoot}${path}`, 'utf8');
    for (const match of source.matchAll(RELATIVE_IMPORT)) {
      const target = repositoryPath(dirname(path), match[1]);
      if (target.startsWith('scripts/')) imported.add(target);
    }
    for (const match of source.matchAll(/['"`](scripts\/[^'"`\s]+\.(?:mjs|js|sh))['"`]/gu))
      named.add(match[1]);
  }
  return { imported: [...imported], named: [...named] };
}

function laneEntries(sources, packageDirectory) {
  const found = new Set();
  for (const source of sources) repositoryScripts(source, '.', 0, found);
  if (!packageDirectory) return { run: [...found], named: [] };
  for (const script of Object.values(packageScripts(packageDirectory)))
    repositoryScripts(script, packageDirectory, 0, found);
  const references = packageScriptReferences(packageDirectory);
  return { run: [...found, ...references.imported], named: references.named };
}

test('scripts run or referenced by lane jobs and their imports select that lane', () => {
  const read = (path) => readFileSync(`${repoRoot}${path}`, 'utf8');
  const ciWorkflow = read('.github/workflows/ci.yml');
  const sharedJob = ciWorkflow.slice(
    ciWorkflow.indexOf('\n  shared:'),
    ciWorkflow.indexOf('\n  api:'),
  );
  assert.match(sharedJob, /pnpm shared:/u, 'the shared job must be found in ci.yml');
  const webWorkflow = read('.github/workflows/web-ci.yml');
  const storybookSteps = webWorkflow
    .split(/\n\s+- name:/u)
    .filter((step) => step.includes('inputs.run_storybook') && /\brun:/u.test(step));
  assert.ok(storybookSteps.length > 0, 'the storybook step must be found in web-ci.yml');
  const infraChecks = [...tracked].filter(
    (path) =>
      /^scripts\/(?:infra|observability)\/.+\.mjs$/u.test(path) && !path.endsWith('.test.mjs'),
  );
  const infra = laneEntries([read('.github/workflows/infra-ci.yml')]);
  const lanes = {
    api: laneEntries([read('.github/workflows/api-ci.yml')], 'apps/api'),
    web: laneEntries([webWorkflow, read('infra/deploy/web/Dockerfile')], 'apps/web'),
    storybook: laneEntries(storybookSteps),
    shared: laneEntries([sharedJob], 'packages/shared'),
    infra: { run: [...infra.run, ...infraChecks], named: [] },
  };
  for (const lane of ['api', 'web', 'storybook', 'infra'])
    assert.ok(lanes[lane].run.length > 0, `${lane} lane must run at least one repository script`);
  const missing = [];
  for (const [lane, { run, named }] of Object.entries(lanes))
    for (const path of new Set([...importClosure(run), ...named.filter((p) => tracked.has(p))]))
      if (!classifyChanges([path])[lane]) missing.push(`${lane}: ${path}`);
  assert.deepEqual(missing, []);
});

test('formatting configuration changes at any depth select the full formatting check', () => {
  for (const path of [
    '.prettierrc',
    '.prettierrc.json',
    'apps/web/.prettierrc.yaml',
    'prettier.config.mjs',
    'packages/shared/prettier.config.ts',
    '.prettierignore',
    '.gitignore',
    '.gitattributes',
    'apps/web/.gitattributes',
    'omx_wiki/.gitignore',
    '.editorconfig',
    'apps/api/.editorconfig',
    'package.json',
    'apps/web/package.json',
    'packages/shared/package.yaml',
    'pnpm-lock.yaml',
    'pnpm-workspace.yaml',
  ]) {
    assert.equal(formattingScope([path]), 'full', path);
    assert.equal(formattingScope(['docs/README.md', path]), 'full', `docs/README.md + ${path}`);
  }
});

test('every formatting configuration file in the surface document selects the full check', async () => {
  const section = (await readFile(`${repoRoot}${surfaceDocPath}`, 'utf8'))
    .split(/^## /mu)
    .find((part) => part.startsWith('Formatting 검사 범위'));
  assert.ok(section, `${surfaceDocPath} must keep the "Formatting 검사 범위" section`);
  const files = section
    .split('\n')
    .filter((line) => line.startsWith('|'))
    .slice(2)
    .flatMap((line) => codeSpans(line.split('|')[1]));
  assert.ok(files.length >= 10, 'the formatting table must list the configuration files');
  for (const file of files) {
    const path = file.replace('*', file.startsWith('prettier.config') ? 'mjs' : 'json');
    assert.equal(formattingScope([path]), 'full', path);
  }
});

test('other changes select only the changed files for the formatting check', () => {
  for (const paths of [
    ['docs/README.md'],
    ['apps/web/src/app/[id]/page.tsx', 'scripts/ci/lanes/classify-changes.mjs'],
    ['.github/workflows/ci.yml'],
    ['docs/prettierrc-notes.md', 'apps/web/package.json.md', 'scripts/ci/editorconfig.mjs'],
  ]) {
    assert.equal(formattingScope(paths), 'changed', paths.join(', '));
  }
});

test('a path outside every lane rule keeps the full formatting check like every lane', () => {
  for (const path of ['future-surface/prettier-plugin.mjs', 'DESIGN.md', '.github/new-tool.yml']) {
    assert.ok(Object.values(classifyChanges([path])).every(Boolean), `${path} must be unknown`);
    assert.equal(formattingScope([path]), 'full', path);
    assert.equal(formattingScope(['docs/README.md', path]), 'full', `docs/README.md + ${path}`);
  }
  assert.equal(formattingScope(['packages/tsconfig/base.json']), 'changed');
});

test('an empty or oversized change list keeps the full formatting check', () => {
  const paths = (count) => Array.from({ length: count }, (_, index) => `docs/change-${index}.md`);
  assert.equal(formattingScope([]), 'full');
  assert.equal(formattingScope(paths(FORMATTING_CHANGED_PATH_LIMIT)), 'changed');
  assert.equal(formattingScope(paths(FORMATTING_CHANGED_PATH_LIMIT + 1)), 'full');
});

function temporaryRepository() {
  const root = mkdtempSync(join(tmpdir(), 'knu-classify-changes-'));
  const git = (...args) =>
    execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  git('init', '-q');
  git('config', 'user.email', 'ci@example.invalid');
  git('config', 'user.name', 'CI');
  git('config', 'commit.gpgsign', 'false');
  git('config', 'diff.renames', 'true');
  const write = (path, content) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  };
  const commit = (message) => {
    git('add', '-A');
    git('commit', '-q', '--no-verify', '-m', message);
    return git('rev-parse', 'HEAD');
  };
  return { root, git, write, commit };
}

test('changed paths list deletions and both sides of a rename for classification and formatting', () => {
  const repository = temporaryRepository();
  try {
    repository.write('apps/web/src/moved.ts', 'export const moved = 1;\n');
    repository.write('apps/api/src/removed.ts', 'export const removed = 1;\n');
    repository.write('docs/kept.md', '# Kept\n');
    const base = repository.commit('base');
    renameSync(
      join(repository.root, 'apps/web/src/moved.ts'),
      join(repository.root, 'docs/moved.ts'),
    );
    rmSync(join(repository.root, 'apps/api/src/removed.ts'));
    repository.write('docs/kept.md', '# Kept\n\nEdited.\n');
    const head = repository.commit('head');
    assert.match(
      repository.git('diff', '--name-status', base, head),
      /^R100\tapps\/web\/src\/moved\.ts/mu,
      'the fixture must be a rename under diff.renames',
    );

    const paths = changedPathsForComparison({ base, head }, repository.root);
    assert.deepEqual(paths.toSorted(), [
      'apps/api/src/removed.ts',
      'apps/web/src/moved.ts',
      'docs/kept.md',
      'docs/moved.ts',
    ]);
    const lanes = classifyChanges(paths);
    assert.equal(lanes.web, true, 'the rename source keeps its lane');
    assert.equal(lanes.api, true, 'the deleted path keeps its lane');
    assert.equal(formattingScope(paths), 'changed');
  } finally {
    rmSync(repository.root, { recursive: true, force: true });
  }
});

function githubOutputs(path) {
  return Object.fromEntries(
    readFileSync(path, 'utf8')
      .trim()
      .split('\n')
      .map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]),
  );
}

test('the classify step outputs the formatting scope and the changed paths it covers', () => {
  const repository = temporaryRepository();
  try {
    repository.write('docs/a.md', '# A\n');
    repository.write('docs/b.md', '# B\n');
    const base = repository.commit('base');
    rmSync(join(repository.root, 'docs/b.md'));
    repository.write('docs/a.md', '# A\n\nEdited.\n');
    const head = repository.commit('docs');
    repository.write('.prettierrc', '{}\n');
    const configHead = repository.commit('config');

    const event = join(tmpdir(), `knu-classify-event-${process.pid}.json`);
    const output = join(tmpdir(), `knu-classify-output-${process.pid}`);
    const run = (before, after) => {
      writeFileSync(event, JSON.stringify({ before, after }));
      writeFileSync(output, '');
      classifyGithubEvent({
        eventName: 'push',
        eventPath: event,
        githubSha: after,
        githubOutput: output,
        cwd: repository.root,
      });
      return githubOutputs(output);
    };

    try {
      const changed = run(base, head);
      assert.equal(changed.formatting_scope, 'changed');
      assert.deepEqual(JSON.parse(changed.formatting_paths_json).toSorted(), [
        'docs/a.md',
        'docs/b.md',
      ]);

      const full = run(head, configHead);
      assert.equal(full.formatting_scope, 'full');
      assert.equal(full.formatting_paths_json, '[]');
    } finally {
      rmSync(event, { force: true });
      rmSync(output, { force: true });
    }
  } finally {
    rmSync(repository.root, { recursive: true, force: true });
  }
});

test('a fallback comparison against the head parent keeps the full formatting check', () => {
  const repository = temporaryRepository();
  const output = join(tmpdir(), `knu-classify-fallback-output-${process.pid}`);
  try {
    repository.write('docs/a.md', '# A\n');
    repository.commit('base');
    repository.write('docs/a.md', '# A\n\nEdited.\n');
    const head = repository.commit('docs');
    writeFileSync(output, '');
    const result = classifyGithubEvent({
      eventName: 'workflow_dispatch',
      githubSha: head,
      githubOutput: output,
      cwd: repository.root,
    });
    assert.equal(result.comparison.strategy, 'head-parent');
    assert.deepEqual(result.changedPaths, ['docs/a.md']);
    assert.equal(formattingScope(result.changedPaths), 'changed');
    const outputs = githubOutputs(output);
    assert.equal(outputs.formatting_scope, 'full');
    assert.equal(outputs.formatting_paths_json, '[]');
  } finally {
    rmSync(output, { force: true });
    rmSync(repository.root, { recursive: true, force: true });
  }
});

test('a classification failure keeps the full formatting check', () => {
  const root = mkdtempSync(join(tmpdir(), 'knu-classify-failure-'));
  try {
    const output = join(root, 'github-output');
    writeFileSync(join(root, 'event.json'), '{not json');
    const result = classifyGithubEvent({
      eventName: 'pull_request',
      eventPath: join(root, 'event.json'),
      githubOutput: output,
      cwd: root,
    });
    assert.equal(result.classificationFailed, true);
    const outputs = githubOutputs(output);
    assert.equal(outputs.classification_failed, 'true');
    assert.equal(outputs.formatting_scope, 'full');
    assert.equal(outputs.formatting_paths_json, '[]');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
