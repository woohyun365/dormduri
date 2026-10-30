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
  // nodenv reads .node-version and has no Dependabot ecosystem, so it adds no second owner to check.
  assert.deepEqual(policy.enabledManagers, [
    'npm',
    'github-actions',
    'dockerfile',
    'docker-compose',
    'nodenv',
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
    [
      (config) =>
        (config.enabledManagers = config.enabledManagers.filter((manager) => manager !== 'nodenv')),
      /enabledManagers must contain exactly .*nodenv/u,
    ],
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
      /packageRules must not override platformAutomerge/u,
    ],
    [
      (config) => (config.vulnerabilityAlerts.platformAutomerge = true),
      /vulnerabilityAlerts must not override platformAutomerge/u,
    ],
    [
      (config) => (config.vulnerabilityAlerts.rebaseWhen = 'never'),
      /vulnerabilityAlerts must not override rebaseWhen/u,
    ],
    [
      (config) =>
        config.packageRules.push({ matchManagers: ['github-actions'], rebaseWhen: 'conflicted' }),
      /packageRules must not override rebaseWhen/u,
    ],
    [
      (config) =>
        config.packageRules.push({
          matchManagers: ['docker-compose'],
          dependencyDashboardApproval: false,
        }),
      /must not lift the major dependency-dashboard approval/u,
    ],
    [
      (config) => {
        config.packageRules = config.packageRules.filter((rule) => rule.automerge !== true);
      },
      /a non-major automerge rule must exist/u,
    ],
    [
      (config) => {
        const automergeRules = config.packageRules.filter((rule) => rule.automerge === true);
        config.packageRules = [
          ...config.packageRules.filter((rule) => rule.automerge !== true),
          ...automergeRules,
        ];
      },
      /automerge rules must come before the group rules/u,
    ],
  ]) {
    const config = structuredClone(renovateConfig);
    mutate(config);
    assert.throws(() => validateHostedRenovateConfig(config), message);
  }

  // DS-R19: a person stops one group by setting automerge to false on its group rule.
  const stoppedGroup = structuredClone(renovateConfig);
  stoppedGroup.packageRules.find((rule) => rule.groupName === 'postgres-image').automerge = false;
  assert.doesNotThrow(() => validateHostedRenovateConfig(stoppedGroup));
});

test('fails closed when the Node heap guard for pnpm 11.x and earlier is missing or enlarged', () => {
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

test('keeps major updates dashboard-gated and manual, grouping only the ESLint core pair', () => {
  const majorRule = renovateConfig.packageRules.find(
    (rule) =>
      Array.isArray(rule.matchUpdateTypes) &&
      rule.matchUpdateTypes.length === 1 &&
      rule.matchUpdateTypes[0] === 'major' &&
      rule.dependencyDashboardApproval === true,
  );
  // A group rule that selects major by update type; the pnpm group takes every update type and is checked apart.
  const groupedMajorRules = renovateConfig.packageRules.filter(
    (rule) => rule.groupName && rule.matchUpdateTypes?.includes('major'),
  );

  assert.ok(majorRule);
  assert.equal(majorRule.matchManagers, undefined);
  assert.equal(majorRule.automerge, false);
  assert.equal(
    groupedMajorRules.length,
    1,
    'exactly one group rule (eslint-major) selects major updates',
  );
  assert.deepEqual(groupedMajorRules[0].matchManagers, ['npm']);
  assert.deepEqual(groupedMajorRules[0].matchUpdateTypes, ['major']);
  assert.deepEqual([...groupedMajorRules[0].matchPackageNames].sort(), ['@eslint/js', 'eslint']);
  assert.equal(groupedMajorRules[0].groupName, 'eslint-major');
  assert.equal(groupedMajorRules[0].groupSlug, 'eslint-major');
  assert.equal(groupedMajorRules[0].dependencyDashboardApproval, true);
  assert.equal(groupedMajorRules[0].automerge, false);

  const ungated = structuredClone(renovateConfig);
  ungated.packageRules.find((rule) => rule.dependencyDashboardApproval === true).matchManagers = [
    'npm',
  ];
  assert.throws(() => validateHostedRenovateConfig(ungated), /every manager must keep major/u);

  const eslintMajor = (config) =>
    config.packageRules.find((rule) => rule.groupName === 'eslint-major');
  for (const mutate of [
    (config) =>
      config.packageRules.push({
        matchManagers: ['npm'],
        matchUpdateTypes: ['major'],
        matchPackageNames: ['next', 'react'],
        groupName: 'web-major',
        groupSlug: 'web-major',
        dependencyDashboardApproval: true,
        automerge: false,
      }),
    (config) => eslintMajor(config).matchPackageNames.push('typescript'),
    (config) => (eslintMajor(config).matchPackageNames = ['eslint']),
    (config) => (eslintMajor(config).matchManagers = ['npm', 'github-actions']),
    (config) => (eslintMajor(config).groupName = 'lint-major'),
    (config) => (eslintMajor(config).matchUpdateTypes = ['major', 'minor']),
    (config) => delete eslintMajor(config).dependencyDashboardApproval,
  ]) {
    const config = structuredClone(renovateConfig);
    mutate(config);
    assert.throws(
      () => validateHostedRenovateConfig(config),
      /the only major group must be eslint-major/u,
    );
  }

  const everyTypeGroup = structuredClone(renovateConfig);
  everyTypeGroup.packageRules.push({
    matchManagers: ['npm'],
    matchPackageNames: ['next'],
    groupName: 'next-everything',
    groupSlug: 'next-everything',
  });
  assert.throws(
    () => validateHostedRenovateConfig(everyTypeGroup),
    /only the pnpm-package-manager group may group every update type/u,
  );
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
  // The Node images (docker) and .node-version (nodenv, node-version datasource) move in one PR.
  assert.deepEqual(groups['node-image'].matchDatasources, ['docker', 'node-version']);
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

test('the API, Web and ingress fixture images stay on the .node-version patch of one trixie-slim digest pin', () => {
  const read = (path) => readFileSync(resolve(process.cwd(), path), 'utf8');
  const references = [
    read('infra/deploy/api/Dockerfile').match(/^ARG NODE_IMAGE=(\S+)$/mu)?.[1],
    read('infra/deploy/web/Dockerfile').match(/^ARG NODE_IMAGE=(\S+)$/mu)?.[1],
    read('scripts/infra/rehearsal/ingress-trust/Dockerfile').match(/^FROM (node:\S+)$/mu)?.[1],
  ];
  const nodeVersion = read('.node-version').trim();

  assert.equal(new Set(references).size, 1, `Node image references drifted: ${references}`);
  // node-image keeps the tag suffix on every update, so the Debian line changes only in a reviewed PR.
  assert.match(
    references[0],
    new RegExp(`^node:${nodeVersion.replaceAll('.', '\\.')}-trixie-slim@sha256:[0-9a-f]{64}$`, 'u'),
  );
});

test('shows TypeScript and the ESLint core pair majors as dashboard approval lines', () => {
  const majorGroupsFor = (packageName) =>
    renovateConfig.packageRules
      .filter(
        (rule) =>
          rule.groupName &&
          rule.matchUpdateTypes?.includes('major') &&
          rule.matchPackageNames?.includes(packageName),
      )
      .map((rule) => rule.groupName);

  // TypeScript 7 takes the general major rule as its own approval line; eslint and @eslint/js share one.
  assert.deepEqual(majorGroupsFor('typescript'), []);
  assert.deepEqual(majorGroupsFor('eslint'), ['eslint-major']);
  assert.deepEqual(majorGroupsFor('@eslint/js'), ['eslint-major']);

  for (const packageNames of [['typescript'], ['eslint', '@eslint/js']]) {
    const config = structuredClone(renovateConfig);
    config.packageRules.push({
      description: 'revisit: hide this major again.',
      matchManagers: ['npm'],
      matchUpdateTypes: ['major'],
      matchPackageNames: packageNames,
      enabled: false,
    });
    assert.throws(
      () => validateHostedRenovateConfig(config),
      /updates must stay visible as a dashboard approval line/u,
    );
  }
  const disableAll = structuredClone(renovateConfig);
  disableAll.packageRules.push({ matchManagers: ['npm'], enabled: false });
  assert.throws(
    () => validateHostedRenovateConfig(disableAll),
    /typescript updates must stay visible as a dashboard approval line/u,
  );
  // A regex, glob or negation entry may match a held package, so a disabled rule with one is rejected too.
  for (const pattern of ['/^typescript$/', 'typescript{,-eslint}', 'eslint*', '!next']) {
    const config = structuredClone(renovateConfig);
    config.packageRules.push({ matchPackageNames: [pattern], enabled: false });
    assert.throws(
      () => validateHostedRenovateConfig(config),
      /updates must stay visible as a dashboard approval line/u,
      pattern,
    );
  }
  const disableOther = structuredClone(renovateConfig);
  disableOther.packageRules.push({ matchPackageNames: ['@tabler/icons-react'], enabled: false });
  assert.doesNotThrow(() => validateHostedRenovateConfig(disableOther));
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

test('puts the root and CI pnpm pins on one dashboard approval line for every update type', () => {
  const pnpmRules = renovateConfig.packageRules.filter((rule) =>
    rule.matchPackageNames?.includes('pnpm'),
  );

  assert.equal(pnpmRules.length, 1);
  const [pnpmRule] = pnpmRules;
  assert.deepEqual(pnpmRule.matchManagers, ['npm', 'github-actions']);
  assert.deepEqual(pnpmRule.matchDepTypes, ['packageManager', 'uses-with']);
  assert.deepEqual(pnpmRule.matchPackageNames, ['pnpm']);
  assert.equal(pnpmRule.matchUpdateTypes, undefined);
  assert.equal(pnpmRule.groupName, 'pnpm-package-manager');
  assert.equal(pnpmRule.groupSlug, 'pnpm-package-manager');
  assert.equal(pnpmRule.dependencyDashboardApproval, true);
  assert.equal(pnpmRule.automerge, false);
  assert.equal(pnpmRule.enabled, undefined);
  assert.match(pnpmRule.description, /cold lockfile benchmark/u);
  assert.match(pnpmRule.description, /pnpm\/action-setup/u);
  // The first rule automerges every minor and patch; this later group rule wins and keeps pnpm manual.
  assert.ok(
    renovateConfig.packageRules.indexOf(pnpmRule) >
      renovateConfig.packageRules.findLastIndex((rule) => rule.automerge === true),
  );
  assert.doesNotThrow(() => validateHostedRenovateConfig(renovateConfig));

  const pnpmRuleOf = (config) =>
    config.packageRules.find((rule) => rule.matchPackageNames?.includes('pnpm'));
  // The github-actions manager reads the pnpm/action-setup `version` input as a `pnpm` dependency.
  const rootOnly = structuredClone(renovateConfig);
  pnpmRuleOf(rootOnly).matchManagers = ['npm'];
  pnpmRuleOf(rootOnly).matchDepTypes = ['packageManager'];
  assert.throws(
    () => validateHostedRenovateConfig(rootOnly),
    /pnpm updates must stay on one dashboard approval line for the github-actions uses-with pin/u,
  );

  for (const mutate of [
    (config) => (pnpmRuleOf(config).matchUpdateTypes = ['major']),
    (config) => delete pnpmRuleOf(config).dependencyDashboardApproval,
    (config) => (pnpmRuleOf(config).automerge = undefined),
    (config) => delete pnpmRuleOf(config).groupName,
  ]) {
    const config = structuredClone(renovateConfig);
    mutate(config);
    assert.throws(
      () => validateHostedRenovateConfig(config),
      /pnpm updates must stay on one dashboard approval line/u,
    );
  }

  const disabled = structuredClone(renovateConfig);
  pnpmRuleOf(disabled).enabled = false;
  assert.throws(
    () => validateHostedRenovateConfig(disabled),
    /pnpm updates must stay visible as a dashboard approval line/u,
  );

  const automerged = structuredClone(renovateConfig);
  pnpmRuleOf(automerged).automerge = true;
  assert.throws(
    () => validateHostedRenovateConfig(automerged),
    /automerge rules must match only minor, patch, or digest/u,
  );
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
