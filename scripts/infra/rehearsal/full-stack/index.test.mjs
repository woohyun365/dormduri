import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const repoRoot = resolve(import.meta.dirname, '../../../..');
const readRepoFile = (path) => readFileSync(resolve(repoRoot, path), 'utf8');
const readRehearsalSources = () =>
  [
    'index.mjs',
    'runtime-inputs.mjs',
    'database-gates.mjs',
    'observability-gates.mjs',
    'resource-budget.mjs',
    'evidence.mjs',
    'cleanup.mjs',
  ]
    .map((file) => readRepoFile(`scripts/infra/rehearsal/full-stack/${file}`))
    .join('\n');

test('full-stack local rehearsal owns the disposable PostgreSQL 18 safety boundary', () => {
  const compose = readRepoFile('infra/rehearsal/compose.postgres.yml');
  const init = readRepoFile('infra/rehearsal/postgres/init-rehearsal-roles.sh');

  assert.match(compose, /postgres:18\.[0-9]+-alpine@sha256:[a-f0-9]{64}/u);
  assert.match(compose, /127\.0\.0\.1:\$\{REHEARSAL_POSTGRES_PORT/u);
  assert.match(compose, /rehearsal-postgres-data:/u);
  assert.match(compose, /memory: 512M/u);
  assert.match(init, /CREATE ROLE app_runtime NOLOGIN/u);
  assert.match(init, /CREATE ROLE retention_worker NOLOGIN/u);
  assert.match(init, /CREATE ROLE retention_disclosure NOLOGIN/u);
});

test('full-stack runner proves product, observability, secret and cleanup boundaries', () => {
  const runner = readRehearsalSources();

  assert.match(runner, /resolveArtifactPath\(repoRoot, \['infra', 'full-stack-rehearsal'\]\)/u);
  assert.match(runner, /api:db:deploy:migrate/u);
  assert.match(runner, /infra\/db\/apply-role-grants\.sh/u);
  assert.match(runner, /infra\/db\/smoke-role-grants\.sh/u);
  for (const service of ['alloy', 'loki', 'prometheus', 'grafana']) {
    assert.match(runner, new RegExp(`service: '${service}'`, 'u'));
  }
  assert.match(runner, /private-loopback-ports/u);
  assert.match(runner, /runtime-artifact-secret-scan/u);
  assert.match(runner, /cleanup-idempotency/u);
  assert.match(runner, /cleanupPass\(\);[\s\S]*cleanupPass\(\);/u);
  assert.doesNotMatch(runner, /\.omx\/(?:reports|artifacts|screenshots)/u);
});

test('full-stack profile excludes the standalone Web upstream fixture', () => {
  const inventory = JSON.parse(readRepoFile('infra/compose-profiles.json'));
  const standaloneFiles = inventory.profiles['web-rehearsal'].files;
  const fullStackFiles = inventory.profiles['full-stack-web-rehearsal'].files;
  const webRuntime = readRepoFile('infra/rehearsal/compose.web.yml');
  const fixtureOverlay = readRepoFile('infra/rehearsal/compose.web.fixture.yml');
  const runner = readRehearsalSources();

  assert.ok(standaloneFiles.includes('infra/rehearsal/compose.web.fixture.yml'));
  assert.equal(fullStackFiles.includes('infra/rehearsal/compose.web.fixture.yml'), false);
  assert.doesNotMatch(webRuntime, /web-upstream:/u);
  assert.match(fixtureOverlay, /web-upstream:/u);
  assert.match(fixtureOverlay, /depends_on:[\s\S]*web-upstream/u);
  assert.match(runner, /buildComposeArgs\(inventory, 'full-stack-web-rehearsal'/u);
});

test('local DB allowance is separate from the 4GiB product envelope', () => {
  const runner = readRepoFile('scripts/infra/rehearsal/full-stack/index.mjs');
  const apiResources = readRepoFile('infra/rehearsal/compose.api.runtime.yml');
  const webResources = readRepoFile('infra/observability/compose.resources.yml');

  assert.match(runner, /productEnvelopeMiB = 4096/u);
  assert.match(runner, /localDatabaseAllowanceMiB = 512/u);
  assert.match(runner, /engineTargetMiB/u);
  assert.match(apiResources, /memory: 1408M/u);
  assert.match(webResources, /alloy:[\s\S]*memory: 160M/u);
  assert.match(webResources, /grafana:[\s\S]*memory: 320M/u);
});

test('external DB use is explicit, disposable and guarded from production-looking URLs', () => {
  const runner = readRehearsalSources();

  assert.match(runner, /FULL_STACK_REHEARSAL_EXTERNAL_DB_CLASSIFICATION/u);
  assert.match(runner, /disposable-test/u);
  assert.match(runner, /I_ACKNOWLEDGE_DESTRUCTIVE_TEST_DB/u);
  assert.match(runner, /prod\(\?:uction\)\?/u);
});

test('rehearsal documentation separates local evidence from release evidence', () => {
  const readme = readRepoFile('infra/rehearsal/README.md');
  const runbook = readRepoFile('infra/runbooks/rehearsal/full-stack.md');

  assert.match(readme, /pnpm infra:rehearsal:full-stack/u);
  assert.match(readme, /\.artifacts\/tools\/infra\/full-stack-rehearsal/u);
  assert.match(runbook, /실제[\s\S]*release evidence를 대체하지 않는다/u);
  assert.match(runbook, /FULL_STACK_REHEARSAL_DB_MODE=external/u);
});

test('legacy DB-backed full-stack is explicitly a no-forwarding-trust fixture', () => {
  const runtime = readRepoFile('scripts/infra/rehearsal/full-stack/runtime-inputs.mjs');
  assert.match(runtime, /HTTP_TRUST_PROXY_HOPS=0/u);
  assert.match(runtime, /HTTP_TRUST_PROXY_CIDRS=/u);
  assert.match(runtime, /CHAT_REALTIME_TRUST_PROXY=false/u);
});
