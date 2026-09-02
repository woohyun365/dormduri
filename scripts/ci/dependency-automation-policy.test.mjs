import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import {
  assertSingleNpmVersionUpdateOwner,
  detectNpmVersionUpdateOwners,
  mapRenovateOwnerGroups,
  parseDependencyAutomationEvidence,
  parsePnpmWorkspaceDependencySurface,
  validateHostedRenovateNpmConfig,
} from './dependency-automation-policy.mjs';

const dependabotConfig = readFileSync(resolve(process.cwd(), '.github/dependabot.yml'), 'utf8');
const baseline = JSON.parse(
  readFileSync(
    resolve(process.cwd(), 'scripts/ci/fixtures/dependency-automation-baseline.json'),
    'utf8',
  ),
);
const renovateConfig = JSON.parse(readFileSync(resolve(process.cwd(), 'renovate.json'), 'utf8'));
const renovateOwnerGroups = JSON.parse(
  readFileSync(resolve(process.cwd(), 'scripts/ci/fixtures/renovate-owner-groups.json'), 'utf8'),
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

test('keeps one active npm version-update owner', () => {
  const owners = detectNpmVersionUpdateOwners({ dependabotConfig, renovateConfig });

  assert.deepEqual(owners, ['renovate']);
  assert.doesNotThrow(() => assertSingleNpmVersionUpdateOwner(owners));
});

test('rejects simultaneous Dependabot and Renovate npm ownership', () => {
  const owners = detectNpmVersionUpdateOwners({
    dependabotConfig: `version: 2
updates:
  - package-ecosystem: 'npm'
    directory: '/'
`,
    renovateConfig: {
      enabledManagers: ['npm'],
    },
  });

  assert.deepEqual(owners, ['dependabot', 'renovate']);
  assert.throws(() => assertSingleNpmVersionUpdateOwner(owners), /exactly one active npm/u);
});

test('does not treat a disabled Renovate config as an active owner', () => {
  const owners = detectNpmVersionUpdateOwners({
    dependabotConfig,
    renovateConfig: {
      enabled: false,
      enabledManagers: ['npm'],
    },
  });

  assert.deepEqual(owners, []);
});

test('rejects a configuration without an npm version-update owner', () => {
  const owners = detectNpmVersionUpdateOwners({
    renovateConfig: {
      enabled: false,
      enabledManagers: ['npm'],
    },
  });

  assert.deepEqual(owners, []);
  assert.throws(() => assertSingleNpmVersionUpdateOwner(owners), /exactly one active npm/u);
});

test('keeps the hosted Renovate policy active and bounded to npm', () => {
  const policy = validateHostedRenovateNpmConfig(renovateConfig);
  const owners = detectNpmVersionUpdateOwners({ dependabotConfig, renovateConfig });

  assert.equal(policy.enabled, true);
  assert.deepEqual(policy.enabledManagers, ['npm']);
  assert.deepEqual(policy.baseBranchPatterns, ['dev']);
  assert.equal(policy.automerge, false);
  assert.equal(policy.dependencyDashboard, true);
  assert.ok(policy.prConcurrentLimit <= 5);
  assert.ok(policy.prHourlyLimit <= 2);
  assert.equal(policy.toolSettings.nodeMaxMemory, 1536);
  assert.equal(policy.env, undefined);
  assert.deepEqual(owners, ['renovate']);
});

test('fails closed when the hosted pnpm memory guard is missing or enlarged', () => {
  const missingGuard = structuredClone(renovateConfig);
  delete missingGuard.toolSettings;
  assert.throws(
    () => validateHostedRenovateNpmConfig(missingGuard),
    /nodeMaxMemory must equal 1536 MiB/u,
  );

  const enlargedGuard = structuredClone(renovateConfig);
  enlargedGuard.toolSettings.nodeMaxMemory = 2560;
  assert.throws(
    () => validateHostedRenovateNpmConfig(enlargedGuard),
    /nodeMaxMemory must equal 1536 MiB/u,
  );
});

test('does not treat pnpm worker overrides as a proved hosted OOM fix', () => {
  const config = structuredClone(renovateConfig);
  config.env = { PNPM_MAX_WORKERS: '1', PNPM_WORKERS: '1' };

  assert.throws(
    () => validateHostedRenovateNpmConfig(config),
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

test('keeps major updates independent and dashboard-gated', () => {
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
  assert.deepEqual(groupedMajorRules, []);
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
    'prom-client',
    'zod',
    'supertest',
  ]);

  assert.deepEqual(assignments, {
    '@nestjs/common': 'api-framework',
    '@prisma/client': 'api-persistence',
    '@aws-sdk/client-secrets-manager': 'api-runtime',
    'prom-client': 'api-observability',
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
