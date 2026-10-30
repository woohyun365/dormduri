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

function workflowJob(source, jobId) {
  const marker = `  ${jobId}:\n`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `missing workflow job: ${jobId}`);

  const jobAndFollowing = source.slice(start);
  const nextJobOffset = jobAndFollowing.slice(marker.length).search(/\n  [a-z][a-z0-9_-]*:\n/u);
  return nextJobOffset === -1
    ? jobAndFollowing
    : jobAndFollowing.slice(0, marker.length + nextJobOffset);
}

// Renovate moves the pnpm/action-setup SHA and version comment, so the contract is one full-SHA pin shared by every
// workflow instead of a copied SHA value.
const PNPM_SETUP_PIN = /uses: pnpm\/action-setup@([^\s#]+)(?: # (\S+))?$/gmu;

function pnpmSetupPins(sources) {
  return sources.flatMap((source) =>
    [...source.matchAll(PNPM_SETUP_PIN)].map(([, reference, versionComment]) => ({
      reference,
      versionComment,
    })),
  );
}

function assertSinglePnpmSetupPin(pins) {
  assert.ok(pins.length > 0, 'missing pnpm/action-setup');
  for (const { reference, versionComment } of pins) {
    assert.match(
      reference,
      /^[a-f0-9]{40}$/u,
      `pnpm/action-setup@${reference} is not a full commit SHA`,
    );
    assert.match(
      versionComment ?? '',
      /^v\d+\.\d+\.\d+$/u,
      `pnpm/action-setup@${reference} lacks a version comment`,
    );
  }
  assert.equal(
    new Set(pins.map(({ reference, versionComment }) => `${reference} ${versionComment}`)).size,
    1,
    'every workflow must pin the same pnpm/action-setup commit',
  );
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

test('Web product typecheck refreshes generated Next route types exactly once before tsc', () => {
  assert.equal(scriptValue(webScripts, 'ci:typegen'), 'next typegen');

  const typecheck = scriptValue(webScripts, 'ci:typecheck');
  assert.equal(occurrences(typecheck, 'ci:typegen'), 1);
  assert.ok(typecheck.indexOf('ci:typegen') < typecheck.indexOf('ci:typecheck:product'));
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

test('infrastructure env commands prepare their Shared type dependency', () => {
  assert.equal(scriptValue(rootScripts, 'infra:env:prepare'), 'pnpm shared:build');
  assertIncludesAll(scriptValue(rootScripts, 'infra:env:generate'), [
    'pnpm infra:env:prepare',
    'pnpm --dir apps/api env:manifest:generate',
  ]);
  assertIncludesAll(scriptValue(rootScripts, 'infra:env:check'), [
    'pnpm infra:env:prepare',
    'pnpm --dir apps/api env:manifest:check',
    'validate-env-projections.mjs',
  ]);
});

for (const workflow of [
  {
    path: '.github/workflows/api-ci.yml',
    prepare: 'pnpm api:prepare',
    prepareCount: 2,
    required: [
      'pnpm api:check:prepared',
      'pnpm api:test:runtime-config-health-contract:prepared',
      'pnpm api:test:prepared',
      'pnpm --dir apps/api ci:test:integration:shard',
      'pnpm api:test:e2e:prepared',
      'pnpm api:test:stress:prepared',
      'pnpm api:build:prepared',
    ],
    forbidden: ['pnpm shared:build', 'pnpm api:prisma:generate'],
  },
  {
    path: '.github/workflows/web-ci.yml',
    prepare: 'pnpm web:prepare',
    prepareCount: 2,
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
  test(`${workflow.path} prepares each runner and invokes prepared capabilities`, () => {
    const source = read(workflow.path);
    assert.equal(occurrences(source, workflow.prepare), workflow.prepareCount);
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
    'node scripts/ci/lanes/classify-changes.mjs',
    'node scripts/ci/lanes/run-repo-policy.mjs',
    'uses: ./.github/workflows/api-ci.yml',
    'uses: ./.github/workflows/web-ci.yml',
    'uses: ./.github/workflows/infra-ci.yml',
    'Shared contract gate',
    'CI summary',
    'if: ${{ always() }}',
  ]);
  assert.match(orchestrator, /push:\s*\n\s*branches:\s*\n\s*- main/u);
  assert.doesNotMatch(orchestrator, /push:\s*\n\s*branches:[\s\S]{0,80}\n\s*- dev/u);
  assertIncludesAll(orchestrator, [
    'uses: pnpm/action-setup@',
    'pnpm install --frozen-lockfile',
    'formatting_scope: ${{ steps.changes.outputs.formatting_scope }}',
    'formatting_paths: ${{ steps.changes.outputs.formatting_paths_json }}',
    'node scripts/ci/lanes/check-formatting.mjs',
  ]);
  assertIncludesAll(apiWorkflow, ['workflow_call:', 'cache: pnpm']);
  assertIncludesAll(webWorkflow, ['workflow_call:', 'cache: pnpm']);
  assertIncludesAll(infraWorkflow, ['workflow_call:', 'permissions:', 'contents: read']);
  assert.ok(!apiWorkflow.includes('pull_request:'));
  assert.ok(!webWorkflow.includes('pull_request:'));
  assert.ok(!infraWorkflow.includes('pull_request:'));
});

test('every workflow pins pnpm/action-setup to one full commit SHA with its version comment', () => {
  assertSinglePnpmSetupPin(pnpmSetupPins([workflowSources()]));

  const sha = (character) => character.repeat(40);
  const pinned = `        uses: pnpm/action-setup@${sha('a')} # v6.0.10`;
  assert.doesNotThrow(() => assertSinglePnpmSetupPin(pnpmSetupPins([pinned, pinned])));
  assert.doesNotThrow(() =>
    assertSinglePnpmSetupPin(
      pnpmSetupPins([`        uses: pnpm/action-setup@${sha('b')} # v6.1.0`]),
    ),
  );
  assert.throws(
    () => assertSinglePnpmSetupPin(pnpmSetupPins(['        uses: pnpm/action-setup@v6 # v6.0.10'])),
    /not a full commit SHA/u,
  );
  assert.throws(
    () => assertSinglePnpmSetupPin(pnpmSetupPins([`        uses: pnpm/action-setup@${sha('a')}`])),
    /lacks a version comment/u,
  );
  assert.throws(
    () =>
      assertSinglePnpmSetupPin(
        pnpmSetupPins([pinned, `        uses: pnpm/action-setup@${sha('b')} # v6.1.0`]),
      ),
    /same pnpm\/action-setup commit/u,
  );
  assert.throws(() => assertSinglePnpmSetupPin([]), /missing pnpm\/action-setup/u);
});

test('the repository policy gate gives pnpm setup bounded headroom before policy execution', () => {
  const repositoryPolicyJob = workflowJob(read('.github/workflows/ci.yml'), 'repo_policy');

  assert.match(repositoryPolicyJob, /^    timeout-minutes: 15$/mu);
  assert.match(
    repositoryPolicyJob,
    /- name: Setup pnpm\n\s+timeout-minutes: 10\n\s+uses: pnpm\/action-setup@[a-f0-9]{40} # v\d+\.\d+\.\d+$/mu,
  );
  assert.equal(occurrences(repositoryPolicyJob, 'timeout-minutes:'), 2);
  assertIncludesAll(repositoryPolicyJob, [
    'pnpm install --frozen-lockfile',
    'node scripts/ci/lanes/run-repo-policy.mjs --suite repo-policy',
    'FORMATTING_SCOPE: ${{ needs.classify.outputs.formatting_scope }}',
    'FORMATTING_PATHS: ${{ needs.classify.outputs.formatting_paths }}',
    'node scripts/ci/lanes/check-formatting.mjs',
  ]);
});

test('the agent workflow gate runs the agent suite without installing packages', () => {
  const ci = read('.github/workflows/ci.yml');
  const agentJob = workflowJob(ci, 'agent_workflow');

  assertIncludesAll(workflowJob(ci, 'classify'), [
    'agent_workflow: ${{ steps.changes.outputs.agentWorkflow }}',
  ]);
  assertIncludesAll(agentJob, [
    'name: Agent workflow gate',
    'needs: classify',
    "if: ${{ needs.classify.outputs.agent_workflow == 'true' }}",
    "node-version: '26'",
    'node scripts/ci/lanes/run-repo-policy.mjs --suite agent-workflow',
  ]);
  for (const installStep of ['pnpm install', 'pnpm/action-setup', 'cache: pnpm'])
    assert.ok(!agentJob.includes(installStep), `agent workflow gate must not use ${installStep}`);
});

const PULL_REQUEST_CONDITION = "${{ github.event_name == 'pull_request' }}";

function workflowSources() {
  return readdirSync(resolve(repoRoot, '.github/workflows'))
    .filter((fileName) => fileName.endsWith('.yml') || fileName.endsWith('.yaml'))
    .map((fileName) => read(`.github/workflows/${fileName}`))
    .join('\n');
}

test('the lifecycle gate reads every pull request without waiting for classification', () => {
  const lifecycleJob = workflowJob(read('.github/workflows/ci.yml'), 'lifecycle_gate');

  assertIncludesAll(lifecycleJob, [
    'name: Lifecycle gate',
    `if: ${PULL_REQUEST_CONDITION}`,
    'pull-requests: read',
    'fetch-depth: 0',
    "node-version: '26'",
    'node scripts/ci/lifecycle/run.mjs',
  ]);
  assert.doesNotMatch(
    lifecycleJob,
    /^ {4}needs:/mu,
    'the lifecycle gate must not wait for classify',
  );
  assert.ok(
    !lifecycleJob.includes('needs.classify'),
    'the lifecycle gate must not read classify outputs',
  );
  for (const installStep of ['pnpm install', 'pnpm/action-setup', 'cache: pnpm'])
    assert.ok(!lifecycleJob.includes(installStep), `lifecycle gate must not use ${installStep}`);
  assert.ok(
    !workflowSources().includes('github.event.pull_request.body'),
    'workflows must read the pull request body through the API, not an expression',
  );
});

// A summary need is selected by its classify output or, for a job that runs on every pull request, by that job's own
// event condition. Any other source would let a failed need pass as unselected.
function selectionSource(ci, summary, job) {
  const selected = summary.match(new RegExp(`^ +${job.toUpperCase()}_SELECTED: (.+)$`, 'mu'))?.[1];
  if (selected === `\${{ needs.classify.outputs.${job} }}`) return 'classify';
  const condition = workflowJob(ci, job).match(/^ {4}if: (.+)$/mu)?.[1];
  return selected === PULL_REQUEST_CONDITION && condition === PULL_REQUEST_CONDITION
    ? 'event'
    : null;
}

test('the CI summary fails closed for every lane job it waits for', () => {
  const ci = read('.github/workflows/ci.yml');
  const summary = workflowJob(ci, 'ci-summary');
  const needs = [...summary.matchAll(/^      - ([a-z_]+)$/gmu)].map((match) => match[1]);
  assert.ok(needs.includes('agent_workflow'), 'ci-summary must wait for agent_workflow');
  assert.ok(needs.includes('lifecycle_gate'), 'ci-summary must wait for lifecycle_gate');
  for (const job of needs.filter((name) => name !== 'classify')) {
    const env = job.toUpperCase();
    assert.ok(
      selectionSource(ci, summary, job),
      `${job} must be selected by a classify output or its own event condition`,
    );
    assertIncludesAll(summary, [
      `${env}_RESULT: \${{ needs.${job}.result }}`,
      `"$${env}_SELECTED" "$${env}_RESULT"`,
    ]);
  }
  assert.equal(selectionSource(ci, summary, 'lifecycle_gate'), 'event');
});

test('the summary selection check rejects a need without a classify output or its own event condition', () => {
  const ci = [
    'jobs:',
    '  constant:',
    '    runs-on: ubuntu-slim',
    '  push_only:',
    "    if: ${{ github.event_name == 'push' }}",
    '  classified:',
    "    if: ${{ needs.classify.outputs.web == 'true' }}",
    '  ci-summary:',
    '    needs:',
    '      - constant',
    '      - push_only',
    '      - classified',
    '    steps:',
    '      - env:',
    "          CONSTANT_SELECTED: 'true'",
    `          PUSH_ONLY_SELECTED: ${PULL_REQUEST_CONDITION}`,
    `          CLASSIFIED_SELECTED: ${PULL_REQUEST_CONDITION}`,
    '',
  ].join('\n');
  const summary = workflowJob(ci, 'ci-summary');

  for (const job of ['constant', 'push_only', 'classified'])
    assert.equal(selectionSource(ci, summary, job), null, job);
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
  assertIncludesAll(infraWorkflow, [
    'KNU_ARTIFACTS_DIR=$RUNNER_TEMP/knu-roommate-artifacts',
    '>> "$GITHUB_ENV"',
  ]);
  assert.ok(!infraWorkflow.includes('KNU_ARTIFACTS_DIR: ${{ runner.temp }}'));
  assert.ok(!infraWorkflow.includes('.omx/'));
});

test('API CI migrates its fresh public schema before generating TypedSQL artifacts', () => {
  const apiWorkflow = read('.github/workflows/api-ci.yml');

  assertIncludesAll(apiWorkflow, [
    '--stage=schema',
    'pnpm --dir apps/api exec prisma migrate deploy --schema prisma/schema.prisma',
    'pnpm api:prepare',
    '--stage=runtime-config-health-contract',
    '--stage=unit',
    '--stage=integration-db',
    '--stage=e2e-db',
    '--stage=stress-harness',
  ]);
  assert.ok(apiWorkflow.indexOf('prisma migrate deploy') < apiWorkflow.indexOf('pnpm api:prepare'));
});

test('API integration shards own isolated runners and PostgreSQL services', () => {
  const apiWorkflow = read('.github/workflows/api-ci.yml');

  assertIncludesAll(apiWorkflow, [
    'api-integration:',
    'fail-fast: false',
    "shard: '1/2'",
    "shard: '2/2'",
    'KNU_API_INTEGRATION_SHARD: ${{ matrix.shard }}',
    'pnpm --dir apps/api ci:test:integration:shard',
  ]);
  assert.equal(occurrences(apiWorkflow, 'services:'), 2);
  assert.equal(occurrences(apiWorkflow, 'POSTGRES_DB: knu_roommate'), 2);
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

test('compiler cache stays small, architecture-aware, and owner-local', () => {
  const orchestrator = read('.github/workflows/ci.yml');
  const apiWorkflow = read('.github/workflows/api-ci.yml');
  const webWorkflow = read('.github/workflows/web-ci.yml');

  assert.equal(occurrences(orchestrator, 'runs-on: ubuntu-slim'), 3);
  assert.equal(occurrences(orchestrator, 'runs-on: ubuntu-24.04'), 3);
  assert.ok(!apiWorkflow.includes('API TypeScript build info'));
  assert.ok(!apiWorkflow.includes('apps/api/dist/.tsbuildinfo'));
  assertIncludesAll(webWorkflow, [
    'path: apps/web/.next/cache',
    'Restore Web TypeScript build info',
    'Save Web TypeScript build info',
    'apps/web/*.tsbuildinfo',
    '${{ runner.os }}-${{ runner.arch }}-web-tsc-',
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
    'run_storybook:',
    'pnpm --dir apps/web ci:storybook:build',
    'pnpm web:sentry:verify-build',
    'if: ${{ failure() && !cancelled() }}',
  ]);
  const nextCache = webWorkflow.slice(
    webWorkflow.indexOf('- name: Restore Next build cache'),
    webWorkflow.indexOf('- name: Install dependencies'),
  );
  assert.match(nextCache, /runner\.os \}\}-\$\{\{ runner\.arch \}\}-next-/u);
  assert.ok(!nextCache.includes('apps/web/src'));
  assert.ok(!webWorkflow.includes('if: ${{ !cancelled() }}'));
  assert.equal(occurrences(webWorkflow, 'if: ${{ failure() && !cancelled() }}'), 2);
  assert.equal(occurrences(webWorkflow, 'SENTRY_AUTH_TOKEN:'), 1);
  assert.equal(occurrences(webWorkflow, 'SENTRY_ARTIFACT_SECRET_SENTINEL:'), 1);
  assert.equal(occurrences(webWorkflow, 'pnpm web:build:prepared'), 1);
  assert.match(playwrightConfig, /workers: process\.env\.CI \? 1 : undefined/);
  assertIncludesAll(playwrightConfig, ["name: 'desktop-chromium'", "name: 'mobile-chromium'"]);

  const staticStep = webWorkflow.slice(
    webWorkflow.indexOf('- name: Web static checks'),
    webWorkflow.indexOf('- name: Save Web TypeScript build info'),
  );
  assert.match(staticStep, /NODE_OPTIONS: --max-old-space-size=4096/u);
});

test('Web CI isolates unit work without duplicating the production build', () => {
  const webWorkflow = read('.github/workflows/web-ci.yml');
  const [coreJob, unitJob] = webWorkflow.split('\n  web-unit:\n');

  assert.ok(coreJob);
  assert.ok(unitJob);
  assertIncludesAll(coreJob, [
    'web-core:',
    'Web static checks',
    'Web production build',
    'Web browser smoke with prebuilt standalone artifact',
  ]);
  assert.ok(!coreJob.includes('Web unit tests'));
  assertIncludesAll(unitJob, ['Web unit tests', 'pnpm web:test:prepared']);
  assert.ok(!unitJob.includes('Web static checks'));
  assert.ok(!unitJob.includes('Web production build'));
  assert.ok(!unitJob.includes('Web browser smoke with prebuilt standalone artifact'));
  assert.equal(occurrences(webWorkflow, 'Web production build'), 1);
});
