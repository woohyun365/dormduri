import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  classifyChanges,
  eventComparisonHints,
  isIntendedFanOut,
  summarizeChangedPaths,
} from './classify-changes.mjs';

const fixtureUrl = new URL('./fixtures/change-impact-cases.json', import.meta.url);
const cases = JSON.parse(await readFile(fixtureUrl, 'utf8'));
const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const surfaceDocPath = 'docs/development/ci/ci-surface-ownership.md';
const LANES = ['web', 'api', 'shared', 'storybook', 'infra', 'repoPolicy'];
const STATUSES = ['분류됨', '의도한 fan-out', '의도하지 않은 fail-open'];
const REQUIRED_STATUSES = ['분류됨', '의도한 fan-out'];
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
    });
  }
});

test('surface ownership document rows match the classifier for every representative path', async () => {
  const { surfaces, rows } = surfaceTable(await readFile(`${repoRoot}${surfaceDocPath}`, 'utf8'));
  assert.ok(surfaces.length > 0, 'surface definitions must name each surface in code spans');
  assert.ok(rows.length > 0, 'surface table must have rows');
  for (const status of REQUIRED_STATUSES) {
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
      `${row.family}: only fan-out and fail-open rows select every lane`,
    );
    assert.ok(codeSpans(row.owner).length > 0, `${row.family}: owner document is required`);
    for (const owner of codeSpans(row.owner)) {
      assert.ok(tracked.has(owner), `${row.family}: owner ${owner} is not tracked`);
    }
    assert.ok(row.examples.length > 0, `${row.family}: representative path is required`);
    for (const path of row.examples) {
      assert.ok(tracked.has(path), `${row.family}: ${path} is not tracked`);
      assert.deepEqual(classifyChanges([path]), expectedLanes(row.lanes), `${row.family}: ${path}`);
    }
  }
});

test('every tracked path that selects every lane is an intended fan-out path', () => {
  const gaps = [...tracked]
    .filter(Boolean)
    .filter((path) => Object.values(classifyChanges([path])).every(Boolean))
    .filter((path) => !isIntendedFanOut(path));
  assert.deepEqual(gaps, []);
});

// Planned paths may name a rule before a tracked file exists; each entry records its owner decision.
const PLANNED_RULE_PATHS = new Map([
  ['.agents/', 'Codex repository skill directory adopted by the host adapter requalification plan'],
]);

test('every path literal in the classifier rules matches a tracked path or a planned owner entry', async () => {
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
      ? ![...tracked].some((path) => path.startsWith(literal)) && !PLANNED_RULE_PATHS.has(literal)
      : !tracked.has(literal),
  );
  assert.deepEqual(dead, []);
});
