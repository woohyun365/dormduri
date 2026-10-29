import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import {
  assertSingleVersionUpdateOwner,
  detectVersionUpdateOwners,
  mapRenovateOwnerGroups,
  parseDependencyAutomationEvidence,
  parsePnpmWorkspaceDependencySurface,
  validateHostedRenovateConfig,
} from './dependency-automation-policy.mjs';

const dependabotConfigPath = resolve(process.cwd(), '.github/dependabot.yml');
const dependabotConfig = existsSync(dependabotConfigPath)
  ? readFileSync(dependabotConfigPath, 'utf8')
  : '';
const baseline = JSON.parse(
  readFileSync(
    resolve(process.cwd(), 'scripts/ci/contracts/fixtures/dependency-automation-baseline.json'),
    'utf8',
  ),
);
const renovateConfig = JSON.parse(readFileSync(resolve(process.cwd(), 'renovate.json'), 'utf8'));
const renovateOwnerGroups = JSON.parse(
  readFileSync(
    resolve(process.cwd(), 'scripts/ci/contracts/fixtures/renovate-owner-groups.json'),
    'utf8',
  ),
);

function collectDependencyDeclarations() {
  const manifestPaths = [
    'package.json',
    'packages/shared/package.json',
    'packages/eslint-config/package.json',
    'packages/tsconfig/package.json',
    'apps/api/package.json',
    'apps/web/package.json',
  ];

  const declarations = manifestPaths.flatMap((manifestPath) => {
    const manifest = JSON.parse(readFileSync(resolve(process.cwd(), manifestPath), 'utf8'));
    return Object.entries({
      ...manifest.dependencies,
      ...manifest.devDependencies,
      ...manifest.optionalDependencies,
    });
  });
  const uniqueNames = (entries) => [...new Set(entries.map(([packageName]) => packageName))].sort();

  return {
    all: uniqueNames(declarations),
    catalog: uniqueNames(declarations.filter(([, version]) => version === 'catalog:')),
    inline: uniqueNames(
      declarations.filter(
        ([, version]) => version !== 'catalog:' && !String(version).startsWith('workspace:'),
      ),
    ),
    workspace: uniqueNames(
      declarations.filter(([, version]) => String(version).startsWith('workspace:')),
    ),
  };
}

const RENOVATE_ONLY = {
  npm: ['renovate'],
  'github-actions': ['renovate'],
  docker: ['renovate'],
  'docker-compose': ['renovate'],
};

test('keeps Renovate as the only version-update owner for every ecosystem', () => {
  const owners = detectVersionUpdateOwners({ dependabotConfig, renovateConfig });

  assert.equal(dependabotConfig, '');
  assert.equal(existsSync(resolve(process.cwd(), '.github/dependabot.yaml')), false);
  assert.deepEqual(owners, RENOVATE_ONLY);
  assert.doesNotThrow(() => assertSingleVersionUpdateOwner(owners));
});

test('rejects Dependabot and Renovate owning the same ecosystem', () => {
  const owners = detectVersionUpdateOwners({
    dependabotConfig: `version: 2
updates:
  - package-ecosystem: 'npm'
    directory: '/'
  - package-ecosystem: 'docker-compose'
    directory: '/infra/deploy'
`,
    renovateConfig,
  });

  assert.deepEqual(owners.npm, ['dependabot', 'renovate']);
  assert.deepEqual(owners['docker-compose'], ['dependabot', 'renovate']);
  assert.deepEqual(owners.docker, ['renovate']);
  assert.throws(() => assertSingleVersionUpdateOwner(owners), /exactly one active npm/u);
});

test('does not count a Dependabot ecosystem paused with a zero pull request limit', () => {
  const owners = detectVersionUpdateOwners({
    dependabotConfig: `version: 2
updates:
  - package-ecosystem: 'github-actions'
    directory: '/'
    open-pull-requests-limit: 0
`,
    renovateConfig,
  });

  assert.deepEqual(owners['github-actions'], ['renovate']);
});

test('rejects an ecosystem without a version-update owner', () => {
  const disabled = detectVersionUpdateOwners({
    renovateConfig: { ...renovateConfig, enabled: false },
  });
  assert.deepEqual(disabled.npm, []);
  assert.throws(() => assertSingleVersionUpdateOwner(disabled), /exactly one active npm/u);

  const npmOnly = detectVersionUpdateOwners({ renovateConfig: { enabledManagers: ['npm'] } });
  assert.deepEqual(npmOnly['github-actions'], []);
  assert.throws(
    () => assertSingleVersionUpdateOwner(npmOnly),
    /exactly one active github-actions/u,
  );
});

test('keeps the hosted Renovate policy active on dev with base branch config merged', () => {
  const policy = validateHostedRenovateConfig(renovateConfig);

  assert.equal(policy.enabled, true);
  assert.deepEqual(policy.enabledManagers, [
    'npm',
    'github-actions',
    'dockerfile',
    'docker-compose',
  ]);
  assert.deepEqual(policy.baseBranchPatterns, ['dev']);
  assert.equal(policy.useBaseBranchConfig, 'merge');
  assert.notEqual(policy.configMigration, true);
  assert.equal(policy.dependencyDashboard, true);
  assert.ok(policy.prConcurrentLimit <= 5);
  assert.ok(policy.prHourlyLimit <= 2);
  assert.equal(policy.vulnerabilityAlerts.prConcurrentLimit, 5);
  assert.equal(policy.minimumReleaseAge, '3 days');
  assert.equal(policy.toolSettings.nodeMaxMemory, 1536);
  assert.equal(policy.env, undefined);

  for (const [mutate, message] of [
    [(config) => delete config.useBaseBranchConfig, /useBaseBranchConfig must be merge/u],
    [(config) => (config.configMigration = true), /configMigration PRs must stay off/u],
    [(config) => (config.enabledManagers = ['npm']), /enabledManagers must contain exactly/u],
    [(config) => delete config.vulnerabilityAlerts, /vulnerabilityAlerts.prConcurrentLimit/u],
  ]) {
    const config = structuredClone(renovateConfig);
    mutate(config);
    assert.throws(() => validateHostedRenovateConfig(config), message);
  }
});

test('lets Renovate itself squash-merge non-major updates only when green and up to date', () => {
  const policy = validateHostedRenovateConfig(renovateConfig);
  const automergeRules = policy.packageRules.filter((rule) => rule.automerge === true);

  assert.equal(policy.automerge, false);
  assert.equal(policy.automergeType, 'pr');
  assert.equal(policy.automergeStrategy, 'squash');
  assert.equal(policy.platformAutomerge, false);
  assert.ok(!['conflicted', 'never'].includes(policy.rebaseWhen));
  assert.ok(automergeRules.length > 0);
  assert.ok(automergeRules.every((rule) => !rule.matchUpdateTypes.includes('major')));
  assert.deepEqual(
    automergeRules
      .filter((rule) => rule.matchUpdateTypes.includes('digest'))
      .map((rule) => rule.matchDatasources),
    [['docker']],
  );

  for (const [mutate, message] of [
    [(config) => (config.platformAutomerge = true), /platformAutomerge must be false/u],
    [(config) => (config.automergeStrategy = 'merge-commit'), /automergeStrategy must be squash/u],
    [(config) => (config.rebaseWhen = 'conflicted'), /rebaseWhen must keep/u],
    [(config) => (config.rebaseWhen = 'never'), /rebaseWhen must keep/u],
    [(config) => (config.automerge = true), /top-level automerge must stay false/u],
    [
      (config) => (config.vulnerabilityAlerts.automerge = true),
      /vulnerability fixes must automerge only/u,
    ],
    [
      (config) => config.packageRules.push({ matchUpdateTypes: ['major'], automerge: true }),
      /must match only minor, patch, or digest/u,
    ],
    [
      (config) => config.packageRules.push({ matchUpdateTypes: ['digest'], automerge: true }),
      /digest automerge must stay limited to Docker images/u,
    ],
    [
      (config) =>
        config.packageRules.push({
          matchUpdateTypes: ['patch'],
          automerge: true,
          platformAutomerge: true,
        }),
      /must not override platformAutomerge/u,
    ],
    [
      (config) => {
        config.packageRules = config.packageRules.filter((rule) => rule.automerge !== true);
      },
      /a non-major automerge rule must exist/u,
    ],
  ]) {
    const config = structuredClone(renovateConfig);
    mutate(config);
    assert.throws(() => validateHostedRenovateConfig(config), message);
  }
});

test('fails closed when the hosted pnpm memory guard is missing or enlarged', () => {
  const missingGuard = structuredClone(renovateConfig);
  delete missingGuard.toolSettings;
  assert.throws(
    () => validateHostedRenovateConfig(missingGuard),
    /nodeMaxMemory must equal 1536 MiB/u,
  );

  const enlargedGuard = structuredClone(renovateConfig);
  enlargedGuard.toolSettings.nodeMaxMemory = 2560;
  assert.throws(
    () => validateHostedRenovateConfig(enlargedGuard),
    /nodeMaxMemory must equal 1536 MiB/u,
  );
});

test('does not treat pnpm worker overrides as a proved hosted OOM fix', () => {
  const config = structuredClone(renovateConfig);
  config.env = { PNPM_MAX_WORKERS: '1', PNPM_WORKERS: '1' };

  assert.throws(
    () => validateHostedRenovateConfig(config),
    /must not assume unproven PNPM_WORKERS overrides/u,
  );
});

test('maps every external direct dependency to exactly one owner group', () => {
  const currentDependencies = collectDependencyDeclarations().all;
  const expectedDependencies = [
    ...Object.values(renovateOwnerGroups.groups).flat(),
    ...renovateOwnerGroups.ignoredPackages,
  ].sort();
  const externalDependencies = currentDependencies.filter(
    (packageName) => !renovateOwnerGroups.ignoredPackages.includes(packageName),
  );
  const assignments = mapRenovateOwnerGroups(renovateConfig, externalDependencies);

  assert.deepEqual(expectedDependencies, currentDependencies);
  for (const [groupName, packageNames] of Object.entries(renovateOwnerGroups.groups)) {
    for (const packageName of packageNames) {
      assert.equal(assignments[packageName], groupName);
    }
  }
});

test('locks catalog, inline, workspace, override, and lockfile inputs explicitly', () => {
  const declarations = collectDependencyDeclarations();
  const workspaceSurface = parsePnpmWorkspaceDependencySurface(
    readFileSync(resolve(process.cwd(), 'pnpm-workspace.yaml'), 'utf8'),
  );

  assert.deepEqual(declarations.catalog, renovateOwnerGroups.managedInputs.catalogPackages);
  assert.deepEqual(declarations.inline, renovateOwnerGroups.managedInputs.inlinePackages);
  assert.deepEqual(declarations.workspace, renovateOwnerGroups.managedInputs.workspacePackages);
  assert.deepEqual(
    workspaceSurface.catalogPackages,
    renovateOwnerGroups.managedInputs.catalogPackages,
  );
  assert.deepEqual(
    workspaceSurface.overrideSelectors,
    renovateOwnerGroups.managedInputs.overrideSelectors,
  );
  assert.equal(renovateOwnerGroups.managedInputs.lockfile, 'pnpm-lock.yaml');
  assert.doesNotThrow(() =>
    readFileSync(resolve(process.cwd(), renovateOwnerGroups.managedInputs.lockfile), 'utf8'),
  );
});

test('keeps major updates independent, dashboard-gated, and manual in every manager', () => {
  const majorRule = renovateConfig.packageRules.find(
    (rule) =>
      Array.isArray(rule.matchUpdateTypes) &&
      rule.matchUpdateTypes.length === 1 &&
      rule.matchUpdateTypes[0] === 'major' &&
      rule.dependencyDashboardApproval === true,
  );
  const groupedMajorRules = renovateConfig.packageRules.filter(
    (rule) => rule.groupName && rule.matchUpdateTypes?.includes('major'),
  );

  assert.ok(majorRule);
  assert.equal(majorRule.matchManagers, undefined);
  assert.equal(majorRule.automerge, false);
  assert.deepEqual(groupedMajorRules, []);

  const ungated = structuredClone(renovateConfig);
  ungated.packageRules.find((rule) => rule.dependencyDashboardApproval === true).matchManagers = [
    'npm',
  ];
  assert.throws(() => validateHostedRenovateConfig(ungated), /every manager must keep major/u);
});

test('groups non-npm updates so shared pins move in one PR', () => {
  const groups = Object.fromEntries(
    renovateConfig.packageRules
      .filter((rule) => rule.groupName)
      .map((rule) => [rule.groupName, rule]),
  );

  assert.deepEqual(groups['actions-minor-patch'].matchManagers, ['github-actions']);
  assert.deepEqual(groups['postgres-image'].matchPackageNames, ['postgres']);
  assert.deepEqual(groups['node-image'].matchPackageNames, ['node']);
  assert.deepEqual(groups['observability-images'].matchFileNames, ['infra/observability/**']);
  for (const name of [
    'actions-minor-patch',
    'postgres-image',
    'node-image',
    'observability-images',
  ]) {
    assert.ok(!groups[name].matchUpdateTypes.includes('major'), name);
  }
});

test('blocks unsupported TypeScript and the complete ESLint major pair with revisit reasons', () => {
  for (const packageName of ['typescript', 'eslint', '@eslint/js']) {
    const blockedRule = renovateConfig.packageRules.find(
      (rule) =>
        rule.enabled === false &&
        rule.matchPackageNames?.includes(packageName) &&
        rule.matchUpdateTypes?.includes('major'),
    );

    assert.ok(blockedRule, `${packageName} major must remain disabled`);
    assert.match(blockedRule.description, /revisit:/u);
  }
});

test('keeps eslint-config-next with the Web framework owner', () => {
  const assignments = mapRenovateOwnerGroups(renovateConfig, ['eslint-config-next']);

  assert.equal(assignments['eslint-config-next'], 'web-framework');
});

test('separates API framework, persistence, runtime, observability, contract, and test owners', () => {
  const assignments = mapRenovateOwnerGroups(renovateConfig, [
    '@nestjs/common',
    '@prisma/client',
    '@aws-sdk/client-secrets-manager',
    '@prometheus-io/client',
    'zod',
    'supertest',
  ]);

  assert.deepEqual(assignments, {
    '@nestjs/common': 'api-framework',
    '@prisma/client': 'api-persistence',
    '@aws-sdk/client-secrets-manager': 'api-runtime',
    '@prometheus-io/client': 'api-observability',
    zod: 'shared-contract',
    supertest: 'api-test-tooling',
  });
});

test('keeps pnpm package-manager upgrades manual until the toolchain moves together', () => {
  const packageManagerRule = renovateConfig.packageRules.find(
    (rule) =>
      rule.enabled === false &&
      rule.matchDepTypes?.includes('packageManager') &&
      rule.matchPackageNames?.includes('pnpm'),
  );

  assert.ok(packageManagerRule);
  assert.match(packageManagerRule.description, /Corepack/u);
  assert.match(packageManagerRule.description, /CI action/u);
  assert.doesNotThrow(() => validateHostedRenovateConfig(renovateConfig));

  // The github-actions manager reads the pnpm/action-setup `version` input as a `pnpm` dependency.
  const rootOnly = structuredClone(renovateConfig);
  const rootOnlyRule = rootOnly.packageRules.find((rule) =>
    rule.matchPackageNames?.includes('pnpm'),
  );
  rootOnlyRule.matchManagers = ['npm'];
  rootOnlyRule.matchDepTypes = ['packageManager'];
  assert.throws(
    () => validateHostedRenovateConfig(rootOnly),
    /pnpm updates must stay disabled for the github-actions uses-with pin/u,
  );

  const majorOnly = structuredClone(renovateConfig);
  majorOnly.packageRules.find((rule) => rule.matchPackageNames?.includes('pnpm')).matchUpdateTypes =
    ['major'];
  assert.throws(() => validateHostedRenovateConfig(majorOnly), /pnpm updates must stay disabled/u);
});

test('keeps both provider cancellations and the manual terminal counts reproducible', () => {
  const evidence = parseDependencyAutomationEvidence(baseline);
  const manual = evidence.runs.find((run) => run.trigger === 'administrator Check for updates');

  assert.deepEqual(
    evidence.runs.map((run) => run.runId),
    [32156713206, 32215794576],
  );
  assert.ok(evidence.runs.every((run) => run.terminalOutcome === 'cancelled'));
  assert.equal(manual.dependenciesChecked, 53);
  assert.equal(manual.pnpmUpdateCommands, 50);
  assert.equal(manual.pullRequestSubmissions, 6);
  assert.equal(manual.completedPullRequests, 0);
});

test('rejects provider evidence without an exact terminal outcome', () => {
  const input = structuredClone(baseline);
  delete input.runs[0].terminalOutcome;

  assert.throws(() => parseDependencyAutomationEvidence(input), /terminalOutcome/u);
});
