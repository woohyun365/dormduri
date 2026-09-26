import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  classifyChanges,
  eventComparisonHints,
  summarizeChangedPaths,
} from './classify-changes.mjs';

const fixtureUrl = new URL('./fixtures/change-impact-cases.json', import.meta.url);
const cases = JSON.parse(await readFile(fixtureUrl, 'utf8'));

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
  assert.deepEqual(
    classifyChanges([
      '.gitignore',
      'CLAUDE.md',
      '.claude/agents/knu_explorer.md',
      '.claude/skills/design-taste-frontend/SKILL.md',
      '.claude/skills/redesign-existing-projects/SOURCE.json',
    ]),
    { web: false, api: false, shared: false, storybook: false, infra: false, repoPolicy: true },
  );
  assert.deepEqual(classifyChanges(['.claude/settings.json']), {
    web: true,
    api: true,
    shared: true,
    storybook: true,
    infra: true,
    repoPolicy: true,
  });
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
