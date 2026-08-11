import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const repoRoot = resolve(import.meta.dirname, '../..');
const read = (path) => readFileSync(resolve(repoRoot, path), 'utf8');

test('production observability profile owns strict configuration and shared resource budgets', () => {
  const inventory = JSON.parse(read('infra/compose-profiles.json'));
  assert.deepEqual(inventory.profiles['observability-production'].files, [
    'infra/observability/compose.base.yml',
    'infra/observability/compose.resources.yml',
    'infra/observability/compose.production.yml',
  ]);
  assert.equal(
    inventory.profiles['observability-production'].preflight,
    'observability-production',
  );
  assert.match(read('infra/observability/compose.production.yml'), /OBSERVABILITY_STRICT: 'true'/u);
  assert.match(read('infra/observability/compose.resources.yml'), /memory: 320M/u);
});

test('Alloy only collects approved product services and records the socket risk', () => {
  const alloy = read('infra/observability/alloy/config.alloy');
  const operations = JSON.parse(read('infra/observability/production-operations.json'));

  assert.match(alloy, /regex\s+= "api\|nginx\|web"/u);
  assert.match(alloy, /action\s+= "keep"/u);
  assert.match(alloy, /sys\.env\("OBSERVABILITY_ENV"\)/u);
  assert.deepEqual(operations.alloyDockerSocket.serviceAllowlist, ['api', 'nginx', 'web']);
  assert.equal(operations.alloyDockerSocket.readOnlyMountIsNotAuthorizationBoundary, true);
});

test('failure rehearsal covers product fail-open and recovery for all query surfaces', () => {
  const runner = read('scripts/observability/web-local-rehearsal.mjs');
  for (const service of ['loki', 'prometheus', 'grafana']) {
    assert.ok(runner.includes(`service: '${service}'`));
  }
  assert.match(runner, /observabilityFailOpen/u);
  assert.match(runner, /recoveryMilliseconds/u);
});
