import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import { assertBuilderGcPolicy, expectedGcLimits, parseInspectGcPolicy } from './builder-gc.mjs';

const repoRoot = resolve(import.meta.dirname, '../../..');
const configured = expectedGcLimits(
  readFileSync(resolve(repoRoot, 'scripts/infra/artifacts/buildkitd.toml'), 'utf8'),
);

// GC section of `docker buildx inspect` for a docker-container builder created without a config (BuildKit v0.31).
const defaultPolicy = `Name:          example
Driver:        docker-container

Nodes:
Name:                  example0
Status:                running
BuildKit version:      v0.31.2
GC Policy rule#0:
 All:            false
 Filters:        type==source.local type==exec.cachemount type==source.git.checkout
 Keep Duration:  48h0m0s
 Max Used Space: 488.3MiB
GC Policy rule#1:
 All:            false
 Keep Duration:  1440h0m0s
 Reserved Space: 9.313GiB
 Max Used Space: 93.13GiB
 Min Free Space: 125.7GiB
GC Policy rule#2:
 All:            true
 Reserved Space: 9.313GiB
 Max Used Space: 93.13GiB
 Min Free Space: 125.7GiB
`;

const configuredPolicy = `BuildKit version:      v0.31.2
GC Policy rule#0:
 All:            false
 Filters:        type==source.local type==exec.cachemount type==source.git.checkout
 Keep Duration:  48h0m0s
 Max Used Space: 488.3MiB
GC Policy rule#1:
 All:            false
 Keep Duration:  336h0m0s
 Reserved Space: 1.863GiB
 Max Used Space: 18.63GiB
GC Policy rule#2:
 All:            true
 Reserved Space: 1.863GiB
 Max Used Space: 18.63GiB
`;

test('buildkitd.toml declares a 20GB cache ceiling and 14-day retention', () => {
  assert.deepEqual(configured, { maxUsedSpace: 20 * 1024 ** 3, keepDurationHours: 336 });
});

test('inspect output is parsed per GC rule', () => {
  const rules = parseInspectGcPolicy(configuredPolicy);
  assert.equal(rules.length, 3);
  assert.equal(rules[1].keepDurationHours, 336);
  assert.equal(rules[2].all, true);
  assert.ok(Math.abs(rules[2].maxUsedSpace - 18.63 * 1024 ** 3) < 1024 ** 2);
});

test('a builder running the configured limits passes', () => {
  assert.equal(assertBuilderGcPolicy(configuredPolicy, configured).length, 3);
});

test('a builder created without the config fails with the default limits', () => {
  assert.throws(
    () => assertBuilderGcPolicy(defaultPolicy, configured),
    /rule#1 has no Max Used Space[\s\S]*no rule keeps unused cache for 336h/u,
  );
});

test('a builder that reports no GC policy fails', () => {
  assert.throws(
    () => assertBuilderGcPolicy('BuildKit version: v0.31.2\n', configured),
    /no GC policy is reported/u,
  );
});
