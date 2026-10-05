import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';

import { cleanupRehearsal } from './cleanup.mjs';
import { verifyResourceBudget } from './resource-budget.mjs';
import {
  createRuntimeSecrets,
  resolveDatabaseUrls,
  writeApiRuntimeInputs,
} from './runtime-inputs.mjs';

const assertGate = (condition, message) => assert.ok(condition, message);

test('runtime inputs create separate host and container database boundaries', () => {
  const secrets = createRuntimeSecrets();
  const urls = resolveDatabaseUrls({
    databaseMode: 'local',
    ports: { postgres: 55432 },
    secrets,
    environment: {},
    assert: assertGate,
  });

  assert.match(urls.host.runtime, /127\.0\.0\.1:55432/u);
  assert.match(urls.container.runtime, /postgres:5432/u);
  assert.notEqual(secrets.runtimePassword, secrets.migrationPassword);
});

test('external database inputs require disposable approval and reject production-looking URLs', () => {
  const environment = {
    FULL_STACK_REHEARSAL_EXTERNAL_DB_CLASSIFICATION: 'disposable-test',
    FULL_STACK_REHEARSAL_EXTERNAL_DB_APPROVAL: 'I_ACKNOWLEDGE_DESTRUCTIVE_TEST_DB',
    FULL_STACK_REHEARSAL_EXTERNAL_MIGRATION_DATABASE_URL: 'postgresql://test/migration',
    FULL_STACK_REHEARSAL_EXTERNAL_RUNTIME_DATABASE_URL: 'postgresql://test/runtime',
    FULL_STACK_REHEARSAL_EXTERNAL_RETENTION_DATABASE_URL: 'postgresql://test/retention',
    FULL_STACK_REHEARSAL_EXTERNAL_DISCLOSURE_DATABASE_URL: 'postgresql://test/production',
  };

  assert.throws(
    () =>
      resolveDatabaseUrls({
        databaseMode: 'external',
        ports: {},
        secrets: {},
        environment,
        assert: assertGate,
      }),
    /looks like a production database/u,
  );
});

test('resource budget separates product limits from the local database allowance', () => {
  const memory = (value) => ({
    deploy: { resources: { limits: { memory: value * 1024 * 1024 } } },
  });
  const apiConfig = { services: { api: memory(1408), nginx: memory(128), postgres: memory(512) } };
  const webConfig = {
    services: {
      web: memory(512),
      prometheus: memory(256),
      loki: memory(192),
      alloy: memory(160),
      alertmanager: memory(0),
      grafana: memory(320),
    },
  };
  const scenarios = [];

  const result = verifyResourceBudget({
    apiConfig,
    webConfig,
    databaseMode: 'local',
    productEnvelopeMiB: 4096,
    localDatabaseAllowanceMiB: 512,
    expectedProductContainerLimitMiB: 2976,
    engineMemoryMiB: 4608,
    assert: assertGate,
    recordScenario: (...scenario) => scenarios.push(scenario),
  });

  assert.deepEqual(result, {
    productLimitMiB: 2976,
    databaseLimitMiB: 512,
    engineHeadroomMiB: 1120,
  });
  assert.equal(scenarios.length, 2);
});

test('cleanup repeats the same boundary and records idempotent completion', () => {
  const evidence = {
    cleanup: { attempted: false, firstPass: false, secondPass: false, resourcesRemaining: null },
  };
  let downCalls = 0;
  let networkCalls = 0;
  let inspections = 0;
  const scenarios = [];

  cleanupRehearsal({
    evidence,
    keepRunning: false,
    apiComposeArguments: ['compose', '-p', 'api'],
    webComposeArguments: ['compose', '-p', 'web'],
    safeComposeDown: () => {
      downCalls += 1;
    },
    cleanupNetworks: () => {
      networkCalls += 1;
    },
    noProjectResourcesRemain: () => {
      inspections += 1;
      return true;
    },
    countProjectResources: () => 0,
    recordScenario: (...scenario) => scenarios.push(scenario),
  });

  assert.equal(downCalls, 4);
  assert.equal(networkCalls, 2);
  assert.equal(inspections, 2);
  assert.equal(evidence.cleanup.secondPass, true);
  assert.equal(scenarios[0]?.[0], 'cleanup-idempotency');
});

test('legacy runtime file disables forwarding trust without changing its DB URLs', () => {
  const directory = mkdtempSync(resolve(tmpdir(), 'knu-full-stack-inputs-'));
  try {
    const secrets = createRuntimeSecrets();
    const urls = resolveDatabaseUrls({
      databaseMode: 'local',
      ports: { postgres: 55432 },
      secrets,
      environment: {},
      assert: assertGate,
    });
    const runtimeEnvPath = resolve(directory, 'runtime.env');
    writeApiRuntimeInputs({
      runtimeEnvPath,
      metricsTokenPath: resolve(directory, 'metrics-token'),
      urls,
      secrets,
    });
    const source = readFileSync(runtimeEnvPath, 'utf8');
    assert.match(source, /^HTTP_TRUST_PROXY_HOPS=0$/mu);
    assert.match(source, /^HTTP_TRUST_PROXY_CIDRS=$/mu);
    assert.match(source, /^CHAT_REALTIME_TRUST_PROXY=false$/mu);
    assert.ok(source.includes(`DATABASE_URL=${urls.container.runtime}`));
    assert.ok(source.includes(`MIGRATION_DATABASE_URL=${urls.container.migration}`));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
