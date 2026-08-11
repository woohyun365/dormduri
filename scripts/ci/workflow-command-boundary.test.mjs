import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const repoRoot = process.cwd();

function read(path) {
  return readFileSync(resolve(repoRoot, path), 'utf8');
}

function readPackage(path) {
  return JSON.parse(read(path)).scripts;
}

function scriptValue(scripts, key) {
  assert.equal(typeof scripts[key], 'string', `missing script: ${key}`);
  return scripts[key];
}

function assertIncludesAll(source, capabilities) {
  for (const capability of capabilities) {
    assert.ok(source.includes(capability), `missing ${capability}`);
  }
}

function occurrences(source, value) {
  return source.split(value).length - 1;
}

const rootScripts = readPackage('package.json');
const apiScripts = readPackage('apps/api/package.json');
const webScripts = readPackage('apps/web/package.json');
const sharedScripts = readPackage('packages/shared/package.json');

test('public package commands prepare themselves while CI capabilities stay preparation-free', () => {
  for (const [publicCommand, preparedCommand] of [
    ['build', 'ci:build'],
    ['lint', 'ci:lint'],
    ['typecheck', 'ci:typecheck'],
    ['test', 'ci:test:unit'],
    ['test:integration', 'ci:test:integration'],
    ['test:e2e', 'ci:test:e2e'],
    ['test:stress', 'ci:test:stress'],
    ['test:ci', 'ci:test'],
  ]) {
    assertIncludesAll(scriptValue(apiScripts, publicCommand), ['ci:prepare', preparedCommand]);
    assert.doesNotMatch(scriptValue(apiScripts, preparedCommand), /ci:prepare/);
  }

  for (const [publicCommand, preparedCommand] of [
    ['build', 'ci:build'],
    ['lint', 'ci:lint'],
    ['typecheck', 'ci:typecheck'],
    ['test', 'ci:test'],
    ['test:coverage', 'ci:test:coverage'],
    ['storybook:build', 'ci:storybook:build'],
  ]) {
    assertIncludesAll(scriptValue(webScripts, publicCommand), ['ci:prepare', preparedCommand]);
    assert.doesNotMatch(scriptValue(webScripts, preparedCommand), /ci:prepare/);
  }

  assertIncludesAll(scriptValue(webScripts, 'e2e'), ['ci:prepare', 'ci:build', 'ci:e2e']);
  assert.doesNotMatch(scriptValue(webScripts, 'ci:e2e'), /ci:build/);
  assertIncludesAll(scriptValue(sharedScripts, 'test'), ['build', 'test:prepared']);
  assert.doesNotMatch(scriptValue(sharedScripts, 'test:prepared'), /build/);
});

test('root commands expose prepared aggregate capabilities', () => {
  for (const capability of [
    'api:prepare',
    'api:check',
    'api:check:prepared',
    'api:test:ci',
    'api:test:ci:prepared',
    'api:build',
    'api:build:prepared',
    'web:prepare',
    'web:check',
    'web:check:prepared',
    'web:e2e',
    'web:e2e:prepared',
    'shared:test',
    'shared:test:prepared',
  ]) {
    assert.equal(
      typeof rootScripts[capability],
      'string',
      `missing root capability: ${capability}`,
    );
  }
});

for (const workflow of [
  {
    path: '.github/workflows/api-ci.yml',
    prepare: 'pnpm api:prepare',
    required: [
      'pnpm api:check:prepared',
      'pnpm api:test:prepared',
      'pnpm api:test:integration:prepared',
      'pnpm api:test:e2e:prepared',
      'pnpm api:test:stress:prepared',
      'pnpm api:build:prepared',
    ],
    forbidden: ['pnpm shared:build', 'pnpm api:prisma:generate'],
  },
  {
    path: '.github/workflows/web-ci.yml',
    prepare: 'pnpm web:prepare',
    required: [
      'pnpm web:lint:prepared',
      'pnpm web:typecheck:prepared',
      'pnpm web:test:prepared',
      'pnpm web:build:prepared',
      'pnpm web:e2e:prepared',
    ],
    forbidden: ['pnpm shared:build'],
  },
]) {
  test(`${workflow.path} prepares once and invokes prepared capabilities`, () => {
    const source = read(workflow.path);
    assert.equal(occurrences(source, workflow.prepare), 1);
    assertIncludesAll(source, workflow.required);
    for (const command of workflow.forbidden) {
      assert.ok(!source.includes(command), `unexpected ${command}`);
    }
  });
}

test('the monorepo orchestrator always produces a fail-closed summary', () => {
  const orchestrator = read('.github/workflows/ci.yml');
  const apiWorkflow = read('.github/workflows/api-ci.yml');
  const webWorkflow = read('.github/workflows/web-ci.yml');
  const infraWorkflow = read('.github/workflows/infra-ci.yml');

  assertIncludesAll(orchestrator, [
    'pull_request:',
    'push:',
    'node scripts/ci/classify-changes.mjs',
    'uses: ./.github/workflows/api-ci.yml',
    'uses: ./.github/workflows/web-ci.yml',
    'uses: ./.github/workflows/infra-ci.yml',
    'Shared contract gate',
    'CI summary',
    'if: ${{ always() }}',
  ]);
  assertIncludesAll(apiWorkflow, ['workflow_call:', 'cache: pnpm']);
  assertIncludesAll(webWorkflow, ['workflow_call:', 'cache: pnpm']);
  assertIncludesAll(infraWorkflow, ['workflow_call:', 'permissions:', 'contents: read']);
  assert.ok(!apiWorkflow.includes('pull_request:'));
  assert.ok(!webWorkflow.includes('pull_request:'));
  assert.ok(!infraWorkflow.includes('pull_request:'));
});

test('infrastructure CI separates static and container-backed validation', () => {
  const infraWorkflow = read('.github/workflows/infra-ci.yml');

  assertIncludesAll(infraWorkflow, [
    'Infrastructure static gate',
    'Infrastructure container config gate',
    'pnpm infra:check:static',
    'pnpm infra:check:runtime',
    'retention-days: 7',
    'timeout-minutes: 15',
  ]);
  assert.match(scriptValue(rootScripts, 'infra:check'), /scripts\/infra\/check\/run\.mjs$/u);
  assert.match(
    scriptValue(rootScripts, 'infra:check:static'),
    /scripts\/infra\/check\/run\.mjs --static$/u,
  );
  assert.match(
    scriptValue(rootScripts, 'infra:check:runtime'),
    /scripts\/infra\/check\/run\.mjs --runtime$/u,
  );
  assert.ok(!infraWorkflow.includes('secrets.'));
  assert.ok(infraWorkflow.includes('runner.temp'));
  assert.ok(infraWorkflow.includes('KNU_ARTIFACTS_DIR'));
  assert.ok(!infraWorkflow.includes('.omx/'));
});

test('API CI leaves schema migration ownership to disposable database suites', () => {
  const apiWorkflow = read('.github/workflows/api-ci.yml');

  assert.ok(!apiWorkflow.includes('prisma migrate deploy'));
  assertIncludesAll(apiWorkflow, [
    'pnpm api:prepare',
    '--stage=unit',
    '--stage=integration-db',
    '--stage=e2e-db',
    '--stage=stress-harness',
  ]);
});

test('app workflows publish comparable stage timing and cache evidence', () => {
  const apiWorkflow = read('.github/workflows/api-ci.yml');
  const webWorkflow = read('.github/workflows/web-ci.yml');

  assertIncludesAll(apiWorkflow, [
    'run-timed-command.mjs',
    '--stage=install',
    '--stage=static',
    '--stage=build',
    'total_duration_seconds',
    'pnpm_store_cache',
  ]);
  assertIncludesAll(webWorkflow, [
    'id: next-cache',
    'run-timed-command.mjs',
    '--stage=unit',
    '--stage=build',
    '--stage=browser',
    'next_build_cache_hit',
    'total_duration_seconds',
  ]);
});

test('current workflows validate changes without claiming production deployment authority', () => {
  const workflowDirectory = resolve(repoRoot, '.github/workflows');
  const workflowSource = readdirSync(workflowDirectory)
    .filter((fileName) => fileName.endsWith('.yml') || fileName.endsWith('.yaml'))
    .map((fileName) => read(`.github/workflows/${fileName}`))
    .join('\n');

  for (const unsupportedCapability of [
    'aws-actions/configure-aws-credentials',
    'id-token: write',
  ]) {
    assert.ok(
      !workflowSource.includes(unsupportedCapability),
      `unexpected deployment capability: ${unsupportedCapability}`,
    );
  }
});

test('Web CI reuses one production build and preserves bounded browser evidence', () => {
  const webWorkflow = read('.github/workflows/web-ci.yml');
  const playwrightConfig = read('apps/web/playwright.config.ts');
  const preparedCheck = scriptValue(webScripts, 'ci:check');
  const preparedE2e = scriptValue(webScripts, 'ci:e2e');

  assert.equal(occurrences(preparedCheck, 'ci:build'), 1);
  assert.match(preparedE2e, /PLAYWRIGHT_PREBUILT=1/);
  assert.doesNotMatch(preparedE2e, /ci:build/);
  assert.match(
    scriptValue(webScripts, 'ci:standalone:prepare'),
    /prepare-next-standalone\.mjs --web-root=\./,
  );
  assertIncludesAll(playwrightConfig, [
    'usePrebuiltStandalone',
    'standaloneServerCommand',
    'NEXT_PUBLIC_APP_URL=https://ci.knu-roommate.invalid',
  ]);
  assertIncludesAll(webWorkflow, [
    'path: apps/web/.next/cache',
    'run_storybook:',
    'pnpm --dir apps/web ci:storybook:build',
    'if: ${{ !cancelled() }}',
    'if: ${{ failure() && !cancelled() }}',
  ]);
  assert.equal(occurrences(webWorkflow, 'pnpm web:build:prepared'), 1);
  assert.match(playwrightConfig, /workers: process\.env\.CI \? 1 : undefined/);
  assertIncludesAll(playwrightConfig, ["name: 'desktop-chromium'", "name: 'mobile-chromium'"]);
});
