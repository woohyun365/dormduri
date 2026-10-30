import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import {
  applyFixtureTargets,
  assertLookupMatchesFixture,
  buildFixtureFiles,
  createSanitizedDryRunEnvironment,
  dashboardApprovalBranches,
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
const { packageManager } = JSON.parse(readFileSync(resolve(repoRoot, 'package.json'), 'utf8'));
const lookupLog = readFileSync(
  resolve(repoRoot, 'scripts/dependencies/fixtures/renovate-local-lookup.ndjson'),
  'utf8',
);
const lookupRecords = () =>
  lookupLog
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
const toLog = (records) => records.map((record) => JSON.stringify(record)).join('\n');

// The recorded lookup with a pnpm release on branchName; lookup mode logs a branch record for it.
function lookupWithPnpm(branchName) {
  const records = lookupRecords();
  const packageFiles = records.find(({ msg }) => msg === 'packageFiles with updates');
  const root = packageFiles.config.npm.find(({ packageFile }) => packageFile === 'package.json');
  const pnpm = root.deps.find(({ depName }) => depName === 'pnpm');
  pnpm.updates = [{ newVersion: '12.17.0', updateType: 'minor', branchName }];
  const branch = {
    level: 20,
    repository: 'local',
    branch: branchName,
    msg: 'Branch is not pending, removing pending upgrades',
  };
  return toLog([branch, ...records]);
}

// The recorded lookup without the branch records of branchName, as when a disabled rule filters its update out.
const lookupWithoutBranch = (branchName) =>
  toLog(lookupRecords().filter(({ branch }) => branch !== branchName));

test('materializes a credential-free pnpm workspace from the active repository policy', () => {
  const files = buildFixtureFiles({ fixture, packageManager, repositoryConfig });
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
  assert.deepEqual(localConfig.enabledManagers, repositoryConfig.enabledManagers);
  assert.ok(localConfig.enabledManagers.includes('npm'));
  assert.equal(localConfig.minimumReleaseAge, null);
  assert.ok(
    localConfig.packageRules.some(
      (rule) =>
        rule.groupName === 'pnpm-package-manager' &&
        rule.dependencyDashboardApproval === true &&
        rule.matchDepTypes?.includes('packageManager') &&
        rule.matchPackageNames?.includes('pnpm'),
    ),
    'local config must keep the pnpm-package-manager dashboard approval group',
  );
  // The root packageManager is the only pnpm version owner; the fixture keeps no copy of it.
  assert.equal(fixture.packageManager, undefined);
  assert.equal(JSON.parse(files['package.json']).packageManager, packageManager);
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

test('names the non-major approval group branches of the active repository policy', () => {
  assert.deepEqual(dashboardApprovalBranches(repositoryConfig), ['renovate/pnpm-package-manager']);
});

test('parses owner branches and keeps dashboard approval lines apart from them', () => {
  const evidence = parseRenovateLookupLog(lookupLog, {
    approvalBranches: dashboardApprovalBranches(repositoryConfig),
  });

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
    evidence.pendingApprovalUpdates.map(({ packageName, updateType, branchName }) => [
      packageName,
      updateType,
      branchName,
    ]),
    [['typescript', 'major', 'renovate/typescript-7.x']],
  );
  assert.deepEqual(evidence.hiddenUpdates, []);
  assert.equal(evidence.durationMs, 409);
  assert.equal(evidence.outputBytes, Buffer.byteLength(lookupLog));
});

test('treats a pnpm release as an approval line and a branchless update as hidden', () => {
  const options = { approvalBranches: dashboardApprovalBranches(repositoryConfig) };

  const pnpmEvidence = parseRenovateLookupLog(
    lookupWithPnpm('renovate/pnpm-package-manager'),
    options,
  );
  assert.deepEqual(
    pnpmEvidence.pendingApprovalUpdates.map(({ packageName }) => packageName),
    ['pnpm', 'typescript'],
  );
  assert.ok(!pnpmEvidence.proposedUpdates.some(({ packageName }) => packageName === 'pnpm'));

  const hiddenEvidence = parseRenovateLookupLog(
    lookupWithoutBranch('renovate/typescript-7.x'),
    options,
  );
  assert.deepEqual(
    hiddenEvidence.hiddenUpdates.map(({ packageName }) => packageName),
    ['typescript'],
  );
  assert.deepEqual(hiddenEvidence.pendingApprovalUpdates, []);
});

test('fails the dry-run on a hidden update or a pnpm release outside its approval branch', () => {
  const options = { approvalBranches: dashboardApprovalBranches(repositoryConfig) };
  const check = (log) => assertLookupMatchesFixture(parseRenovateLookupLog(log, options), fixture);

  assert.doesNotThrow(() => check(lookupLog));
  assert.doesNotThrow(() => check(lookupWithPnpm('renovate/pnpm-package-manager')));
  assert.throws(
    () => check(lookupWithoutBranch('renovate/typescript-7.x')),
    /filtered out updates that must stay on the Dashboard: \["typescript"\]/u,
  );
  assert.throws(
    () => check(lookupWithPnpm('renovate/pnpm-12.x')),
    /pnpm must wait for dashboard approval, not renovate\/pnpm-12\.x/u,
  );
});

test('applies only the three approved source targets before canonical lockfile regeneration', () => {
  const before = buildFixtureFiles({ fixture, packageManager, repositoryConfig });
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
