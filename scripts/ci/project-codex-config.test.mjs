import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const repoRoot = resolve(import.meta.dirname, '../..');
const gitignorePath = resolve(repoRoot, '.gitignore');
const cases = JSON.parse(
  readFileSync(resolve(repoRoot, 'scripts/ci/fixtures/project-codex-tracking-cases.json'), 'utf8'),
);
const expectedPortablePaths = [
  '.codex/config.toml',
  '.codex/agents/knu_explorer.toml',
  '.codex/agents/knu_researcher.toml',
  '.codex/agents/knu_reviewer.toml',
  '.codex/agents/knu_executor.toml',
];

function checkIgnore(path) {
  return spawnSync('git', ['check-ignore', '--no-index', '-q', path], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
}

test('project Codex tracking uses a narrow config and top-level agent allowlist', () => {
  const gitignore = readFileSync(gitignorePath, 'utf8');

  assert.doesNotMatch(gitignore, /^\.codex\/$/mu);
  assert.match(gitignore, /^\.codex\/\*$/mu);
  assert.match(gitignore, /^!\.codex\/config\.toml$/mu);
  assert.match(gitignore, /^!\.codex\/agents\/$/mu);
  assert.match(gitignore, /^\.codex\/agents\/\*$/mu);
  assert.match(gitignore, /^!\.codex\/agents\/\*\.toml$/mu);
});

test('only portable project Codex candidates are trackable', () => {
  assert.deepEqual(cases.allowlisted, expectedPortablePaths);

  for (const path of cases.allowlisted) {
    const result = checkIgnore(path);
    assert.equal(result.status, 1, `${path} must be available for Git tracking`);
  }

  for (const path of cases.ignored) {
    const result = checkIgnore(path);
    assert.equal(result.status, 0, `${path} must remain ignored`);
  }
});

test('portable project Codex configuration is present', () => {
  const missing = cases.allowlisted.filter((path) => !existsSync(resolve(repoRoot, path)));

  assert.deepEqual(
    missing,
    [],
    'The reviewed project config and four agent files must exist before the project Codex contract can pass',
  );
});
