import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import {
  buildComposeArgs,
  loadComposeInventory,
  resolveManagedNetworks,
} from './compose-profile.mjs';

const repoRoot = resolve(import.meta.dirname, '../..');

test('production API profile에는 rehearsal과 stress overlay가 합성되지 않는다', () => {
  const inventory = loadComposeInventory(repoRoot);
  const args = buildComposeArgs(inventory, 'api-base', ['config'], { repoRoot });
  const command = args.join(' ');

  assert.match(command, /infra\/deploy\/compose\.api\.yml/u);
  assert.doesNotMatch(command, /infra\/rehearsal/u);
  assert.doesNotMatch(command, /compose\.stress\.yml/u);
});

test('stress profile은 base, runtime resource, stress policy 순서로 합성된다', () => {
  const inventory = loadComposeInventory(repoRoot);
  const args = buildComposeArgs(inventory, 'api-stress', ['config'], { repoRoot });
  const files = args.filter((value, index) => args[index - 1] === '-f');

  assert.deepEqual(files, [
    'infra/deploy/compose.api.yml',
    'infra/rehearsal/compose.api.runtime.yml',
    'apps/api/test/stress/docker/compose.stress.yml',
  ]);
  for (const profileName of [
    'api-rehearsal',
    'api-stress',
    'full-stack-api-rehearsal',
    'observability-rehearsal',
    'web-rehearsal',
  ]) {
    assert.deepEqual(resolveManagedNetworks(inventory.profiles[profileName]), [
      'knu-roommate-observability',
    ]);
  }
  assert.deepEqual(
    resolveManagedNetworks(inventory.profiles['api-stress'], {
      OBSERVABILITY_NETWORK: 'custom-observability',
    }),
    ['custom-observability'],
  );
});

test('full-stack rehearsal profile은 production base와 resource budget, disposable DB만 합성한다', () => {
  const inventory = loadComposeInventory(repoRoot);
  const args = buildComposeArgs(inventory, 'full-stack-api-rehearsal', ['config'], {
    repoRoot,
  });
  const files = args.filter((value, index) => args[index - 1] === '-f');

  assert.deepEqual(files, [
    'infra/deploy/compose.api.yml',
    'infra/rehearsal/compose.api.runtime.yml',
    'infra/rehearsal/compose.postgres.yml',
  ]);
  assert.equal(
    files.some((path) => path.includes('compose.stress.yml')),
    false,
  );
});

test('Web standalone과 full-stack profile은 fixture 책임을 분리한다', () => {
  const inventory = loadComposeInventory(repoRoot);
  const standaloneArgs = buildComposeArgs(inventory, 'web-rehearsal', ['config'], { repoRoot });
  const fullStackArgs = buildComposeArgs(inventory, 'full-stack-web-rehearsal', ['config'], {
    repoRoot,
  });
  const standaloneFiles = standaloneArgs.filter(
    (value, index) => standaloneArgs[index - 1] === '-f',
  );
  const fullStackFiles = fullStackArgs.filter((value, index) => fullStackArgs[index - 1] === '-f');

  assert.ok(standaloneFiles.includes('infra/rehearsal/compose.web.fixture.yml'));
  assert.equal(fullStackFiles.includes('infra/rehearsal/compose.web.fixture.yml'), false);
  assert.ok(fullStackFiles.includes('infra/observability/compose.resources.yml'));
});

test('production render source에는 stress 전용 key가 없고 resource budget은 rehearsal owner가 가진다', () => {
  const base = readFileSync(resolve(repoRoot, 'infra/deploy/compose.api.yml'), 'utf8');
  const runtime = readFileSync(
    resolve(repoRoot, 'infra/rehearsal/compose.api.runtime.yml'),
    'utf8',
  );
  const stress = readFileSync(
    resolve(repoRoot, 'apps/api/test/stress/docker/compose.stress.yml'),
    'utf8',
  );

  assert.doesNotMatch(base, /STRESS_|AUTH_THROTTLE_LIMIT/u);
  assert.match(runtime, /cpus:\s*'1\.50'/u);
  assert.match(runtime, /memory:\s*1408M/u);
  assert.doesNotMatch(runtime, /AUTH_THROTTLE_LIMIT/u);
  assert.match(stress, /AUTH_THROTTLE_LIMIT/u);
});
