import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const repoRoot = resolve(import.meta.dirname, '../../..');
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

test('Alloy only collects approved product services of the user host project and records the socket risk', () => {
  const alloy = read('infra/observability/alloy/config.alloy');
  const operations = JSON.parse(read('infra/observability/production-operations.json'));
  const allowlist = operations.alloyDockerSocket.serviceAllowlist;

  // ingress(user host 공개 edge)·api·web만 받는다(production-api-baseline D-AB14).
  assert.deepEqual(allowlist, ['api', 'ingress', 'web']);
  assert.match(alloy, new RegExp(`regex\\s+= "${allowlist.join('\\|')}"`, 'u'));
  assert.match(alloy, /action\s+= "keep"/u);
  assert.match(alloy, /sys\.env\("OBSERVABILITY_ENV"\)/u);
  assert.match(
    alloy,
    /__meta_docker_container_label_com_docker_compose_project"\]\n\s+regex\s+= coalesce\(sys\.env\("OBSERVABILITY_COMPOSE_PROJECT"\), "\.\+"\)/u,
  );
  assert.equal(operations.topology.composeProject, 'dormduri-web');
  assert.equal(operations.topology.operatorAccess, 'loopback-via-ssm-port-forwarding');
  assert.equal(operations.alloyDockerSocket.readOnlyMountIsNotAuthorizationBoundary, true);
});
