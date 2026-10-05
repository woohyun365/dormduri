import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const repoRoot = resolve(import.meta.dirname, '../../../..');
const gitignorePath = resolve(repoRoot, '.gitignore');
const cases = JSON.parse(
  readFileSync(
    resolve(repoRoot, 'scripts/ci/agents/codex/fixtures/project-codex-tracking-cases.json'),
    'utf8',
  ),
);
const expectedPortablePaths = [
  '.codex/config.toml',
  '.codex/agents/knu_explorer.toml',
  '.codex/agents/knu_researcher.toml',
  '.codex/agents/knu_reviewer.toml',
  '.codex/agents/knu_executor.toml',
];
const expectedProjectConfig = `[agents]
enabled = true
default_subagent_model = "gpt-6-astra"
default_subagent_reasoning_effort = "high"
max_concurrent_threads_per_session = 6
`;
const expectedRoles = [
  { file: 'knu_executor.toml', name: 'knu_executor', sandboxMode: 'workspace-write', model: null },
  { file: 'knu_explorer.toml', name: 'knu_explorer', sandboxMode: 'read-only', model: null },
  { file: 'knu_researcher.toml', name: 'knu_researcher', sandboxMode: 'read-only', model: null },
  {
    file: 'knu_reviewer.toml',
    name: 'knu_reviewer',
    sandboxMode: 'read-only',
    model: 'gpt-6-astra',
  },
];
const allowedRoleKeys = ['description', 'developer_instructions', 'model', 'name', 'sandbox_mode'];

function checkIgnore(path) {
  return spawnSync('git', ['check-ignore', '--no-index', '-q', path], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
}

function readQuotedField(source, field) {
  return source.match(new RegExp(`^${field} = "([^"\\n]+)"$`, 'mu'))?.[1];
}

function topLevelKeys(source) {
  return [...source.matchAll(/^([A-Za-z0-9_.-]+)\s*=/gmu)]
    .map(([, key]) => key)
    .sort((left, right) => left.localeCompare(right));
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

test('project config owns child defaults without pinning parent or provider settings', () => {
  const source = readFileSync(resolve(repoRoot, '.codex/config.toml'), 'utf8');

  assert.equal(source, expectedProjectConfig);
  assert.doesNotMatch(
    source,
    /^(?:model|model_reasoning_effort|provider|auth|approval|profile|notify|mcp_servers)\s*=/mu,
  );
});

test('project roles inherit task models except the Astra reviewer with unchanged effort and sandboxes', () => {
  const agentDirectory = resolve(repoRoot, '.codex/agents');
  const files = readdirSync(agentDirectory)
    .filter((file) => file.endsWith('.toml'))
    .sort((left, right) => left.localeCompare(right));

  assert.deepEqual(
    files,
    expectedRoles.map(({ file }) => file),
  );

  for (const role of expectedRoles) {
    const source = readFileSync(resolve(agentDirectory, role.file), 'utf8');
    assertRoleContract(source, role);
  }
});

test('role instructions reference bounded peer facts without delegating task or QA authority', () => {
  // Instruction presence only: actual communication/refusal behavior needs an observed pilot.
  for (const { file } of expectedRoles) {
    const source = readFileSync(resolve(repoRoot, '.codex/agents', file), 'utf8');
    assert.match(source, /owner-lead-collaboration\.md/u, file);
    assert.match(source, /Default to parent-mediated communication\./u, file);
    assert.match(source, /Do not offload tasks/u, file);
    assert.match(source, /source\/scope changes/u, file);
    assert.match(source, /host\/role restrictions/u, file);
    assert.match(source, /qa\.md/u, file);
  }
});

function assertRoleContract(source, role) {
  const instructions = source.match(/developer_instructions\s*=\s*"""([\s\S]*?)"""/u)?.[1].trim();

  assert.deepEqual(
    topLevelKeys(source),
    role.model === null ? allowedRoleKeys.filter((key) => key !== 'model') : allowedRoleKeys,
    role.file,
  );
  assert.equal(readQuotedField(source, 'name'), role.name, role.file);
  assert.ok(readQuotedField(source, 'description')?.length > 20, role.file);
  assert.equal(readQuotedField(source, 'model'), role.model ?? undefined, role.file);
  assert.equal(readQuotedField(source, 'sandbox_mode'), role.sandboxMode, role.file);
  assert.ok(instructions?.length > 300, role.file);
  assert.match(instructions, /Do not spawn child agents\./u, role.file);
  assert.match(instructions, /facts/u, role.file);
  assert.match(instructions, /inferences/u, role.file);
  assert.match(instructions, /gaps/u, role.file);
  assert.match(instructions, /confidence/u, role.file);
  assert.match(instructions, /verification/u, role.file);
  assert.match(instructions, /blocker/u, role.file);
  assert.doesNotMatch(source, /^model_reasoning_effort\s*=/mu, role.file);
  assert.doesNotMatch(source, /^skills\.config\s*=/mu, role.file);
  assert.doesNotMatch(source, /\/Users\//u, role.file);
}

test('role contract rejects execution repins, reviewer downgrade and permission or effort drift', () => {
  // File contract only, not a simulation of the native configuration resolver.
  for (const role of expectedRoles) {
    const source = readFileSync(resolve(repoRoot, '.codex/agents', role.file), 'utf8');
    const mutations = [
      source + '\nmodel_reasoning_effort = "low"\n',
      source.replace(`sandbox_mode = "${role.sandboxMode}"`, 'sandbox_mode = "danger-full-access"'),
      source.replace(`name = "${role.name}"`, 'name = "shadow_role"'),
    ];
    if (role.model === null) {
      mutations.push(source + '\nmodel = "gpt-6-astra"\n', source + '\nmodel = "gpt-5.6-luna"\n');
    } else {
      mutations.push(
        source.replace('model = "gpt-6-astra"\n', ''),
        source.replace('model = "gpt-6-astra"', 'model = "gpt-5.6-sol"'),
      );
    }
    for (const mutated of mutations)
      assert.throws(() => assertRoleContract(mutated, role), assert.AssertionError);
  }
});
