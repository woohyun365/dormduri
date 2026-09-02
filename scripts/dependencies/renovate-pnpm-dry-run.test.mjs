import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import {
  applyFixtureTargets,
  buildFixtureFiles,
  createSanitizedDryRunEnvironment,
  parseDryRunFixture,
  parseRenovateLookupLog,
  summarizeChangedFiles,
} from './renovate-pnpm-dry-run.mjs';

const repoRoot = process.cwd();
const fixture = parseDryRunFixture(
  JSON.parse(
    readFileSync(
      resolve(repoRoot, 'scripts/dependencies/fixtures/renovate-pnpm-dry-run.json'),
      'utf8',
    ),
  ),
);
const repositoryConfig = JSON.parse(readFileSync(resolve(repoRoot, 'renovate.json'), 'utf8'));
const lookupLog = readFileSync(
  resolve(repoRoot, 'scripts/dependencies/fixtures/renovate-local-lookup.ndjson'),
  'utf8',
);

test('materializes a credential-free pnpm workspace from the active repository policy', () => {
  const files = buildFixtureFiles({ fixture, repositoryConfig });
  const localConfig = JSON.parse(files['renovate.json']);

  assert.deepEqual(Object.keys(files).sort(), [
    'apps/api/package.json',
    'apps/web/package.json',
    'package.json',
    'pnpm-workspace.yaml',
    'renovate.json',
  ]);
  assert.equal(repositoryConfig.enabled, true);
  assert.equal(localConfig.enabled, true);
  assert.deepEqual(localConfig.enabledManagers, ['npm']);
  assert.equal(localConfig.minimumReleaseAge, null);
  assert.ok(
    localConfig.packageRules.some(
      (rule) =>
        rule.enabled === false &&
        rule.matchDepTypes?.includes('packageManager') &&
        rule.matchPackageNames?.includes('pnpm'),
    ),
  );
  assert.match(files['pnpm-workspace.yaml'], /vitest: 4\.0\.0/u);
  assert.match(files['apps/api/package.json'], /"@nestjs\/common": "11\.1\.20"/u);
  assert.match(files['apps/web/package.json'], /"motion": "12\.37\.0"/u);
});

test('passes only public-registry process state to the disposable tools', () => {
  const environment = createSanitizedDryRunEnvironment({
    baseEnvironment: {
      PATH: '/usr/bin',
      HOME: '/Users/example',
      GH_TOKEN: 'secret',
      GITHUB_TOKEN: 'secret',
      RENOVATE_TOKEN: 'secret',
      AWS_SECRET_ACCESS_KEY: 'secret',
      CI: 'true',
    },
    homeDirectory: '/tmp/renovate-home',
  });

  assert.deepEqual(environment, {
    CI: 'true',
    HOME: '/tmp/renovate-home',
    LOG_FORMAT: 'json',
    LOG_LEVEL: 'debug',
    NPM_CONFIG_USERCONFIG: '/tmp/renovate-home/.npmrc',
    PATH: '/usr/bin',
    XDG_CONFIG_HOME: '/tmp/renovate-home/.config',
  });
});

test('parses proposed owner branches while keeping blocked updates out of final branches', () => {
  const evidence = parseRenovateLookupLog(lookupLog);

  assert.equal(evidence.renovateVersion, '44.7.2');
  assert.deepEqual(evidence.extraction, { depCount: 8, fileCount: 4 });
  assert.deepEqual(
    evidence.proposedUpdates.map(({ packageName, ownerGroup }) => [packageName, ownerGroup]),
    [
      ['@nestjs/common', 'api-framework'],
      ['motion', 'web-framework'],
      ['vitest', 'web-test-storybook'],
    ],
  );
  assert.deepEqual(
    evidence.blockedUpdates.map(({ packageName }) => packageName),
    ['typescript'],
  );
  assert.equal(evidence.filteredUpdateCount, 1);
  assert.equal(evidence.durationMs, 1600);
  assert.equal(evidence.outputBytes, Buffer.byteLength(lookupLog));
});

test('applies only the three approved source targets before canonical lockfile regeneration', () => {
  const before = buildFixtureFiles({ fixture, repositoryConfig });
  const after = applyFixtureTargets(before, fixture);
  const changes = summarizeChangedFiles(before, after, fixture.allowedChangedFiles);

  assert.deepEqual(changes, [
    'apps/api/package.json',
    'apps/web/package.json',
    'pnpm-workspace.yaml',
  ]);
  assert.match(after['pnpm-workspace.yaml'], /vitest: 4\.1\.9/u);
  assert.match(after['apps/api/package.json'], /"@nestjs\/common": "11\.1\.26"/u);
  assert.match(after['apps/web/package.json'], /"motion": "12\.38\.0"/u);
  assert.equal(after['package.json'], before['package.json']);
  assert.equal(after['renovate.json'], before['renovate.json']);
});

test('rejects a mutation outside the explicit fixture file boundary', () => {
  assert.throws(
    () =>
      summarizeChangedFiles(
        { 'package.json': '{}\n' },
        { 'package.json': '{"private":true}\n' },
        fixture.allowedChangedFiles,
      ),
    /unexpected changed file/u,
  );
});
