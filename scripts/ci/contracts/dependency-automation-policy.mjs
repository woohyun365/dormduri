// Each ecosystem has exactly one version-update owner. Dependabot ecosystems map to the Renovate manager that owns them.
export const VERSION_UPDATE_ECOSYSTEMS = {
  npm: { dependabot: 'npm', renovate: 'npm' },
  'github-actions': { dependabot: 'github-actions', renovate: 'github-actions' },
  docker: { dependabot: 'docker', renovate: 'dockerfile' },
  'docker-compose': { dependabot: 'docker-compose', renovate: 'docker-compose' },
};

function extractDependabotBlocks(config, ecosystem) {
  if (typeof config !== 'string') return [];
  const blocks = config.split(/\n(?=\s*-\s+package-ecosystem:)/u);
  const pattern = new RegExp(`package-ecosystem:\\s*['"]${ecosystem}['"]`, 'u');
  return blocks.filter((block) => pattern.test(block));
}

function isDependabotVersionUpdateActive(config, ecosystem) {
  return extractDependabotBlocks(config, ecosystem).some(
    (block) => !/open-pull-requests-limit:\s*0(?:\s|$)/u.test(block),
  );
}

function isRenovateManagerActive(config, manager) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) return false;
  if (config.enabled === false) return false;
  return Array.isArray(config.enabledManagers) && config.enabledManagers.includes(manager);
}

const RENOVATE_OWNER_GROUPS = [
  'lint-tooling',
  'web-framework',
  'web-test-storybook',
  'api-framework',
  'api-persistence',
  'api-runtime',
  'api-observability',
  'shared-contract',
  'api-test-tooling',
];

const HOSTED_RENOVATE_NODE_MAX_MEMORY_MIB = 1536;

function assertStringArray(value, fieldName) {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.some((item) => typeof item !== 'string')
  ) {
    throw new TypeError(`${fieldName} must be a non-empty string array`);
  }
}

function sameMembers(actual, expected) {
  return (
    Array.isArray(actual) &&
    actual.length === expected.length &&
    [...actual].sort().every((value, index) => value === [...expected].sort()[index])
  );
}

function renovateOwnerRules(config) {
  return config.packageRules.filter((rule) => RENOVATE_OWNER_GROUPS.includes(rule.groupName));
}

const AUTOMERGE_UPDATE_TYPES = ['minor', 'patch', 'digest'];

// pnpm is pinned in the root packageManager field (npm manager) and in the CI pnpm/action-setup version input
// (github-actions manager). Both move only with a reviewed toolchain change, so Renovate must not update either one.
const PNPM_PIN_SURFACES = [
  ['npm', 'packageManager'],
  ['github-actions', 'uses-with'],
];

function validatePnpmPins(config) {
  for (const [manager, depType] of PNPM_PIN_SURFACES) {
    const disabled = config.packageRules.some(
      (rule) =>
        rule.enabled === false &&
        rule.matchPackageNames?.includes('pnpm') &&
        rule.matchUpdateTypes === undefined &&
        (rule.matchManagers === undefined || rule.matchManagers.includes(manager)) &&
        (rule.matchDepTypes === undefined || rule.matchDepTypes.includes(depType)),
    );
    if (!disabled) {
      throw new TypeError(`pnpm updates must stay disabled for the ${manager} ${depType} pin`);
    }
  }
}

// Renovate merges a non-major update itself once CI summary passes and the branch is up to date with dev. GitHub
// auto-merge (platformAutomerge) is off because it can merge a branch that is behind dev.
function validateAutomerge(config) {
  if (config.automerge !== false) throw new TypeError('top-level automerge must stay false');
  if (config.automergeType !== 'pr') throw new TypeError('automergeType must be pr');
  if (config.automergeStrategy !== 'squash')
    throw new TypeError('automergeStrategy must be squash');
  if (config.platformAutomerge !== false) throw new TypeError('platformAutomerge must be false');
  if (['conflicted', 'never'].includes(config.rebaseWhen)) {
    throw new TypeError('rebaseWhen must keep automerge branches up to date with dev');
  }
  if (config.vulnerabilityAlerts?.automerge !== undefined) {
    throw new TypeError(
      'vulnerability fixes must automerge only through the non-major packageRules',
    );
  }

  const automergeRules = config.packageRules.filter((rule) => rule.automerge === true);
  if (automergeRules.length === 0) throw new TypeError('a non-major automerge rule must exist');
  for (const rule of automergeRules) {
    if (
      !Array.isArray(rule.matchUpdateTypes) ||
      rule.matchUpdateTypes.length === 0 ||
      rule.matchUpdateTypes.some((updateType) => !AUTOMERGE_UPDATE_TYPES.includes(updateType))
    ) {
      throw new TypeError('automerge rules must match only minor, patch, or digest updates');
    }
    if (
      rule.matchUpdateTypes.includes('digest') &&
      !sameMembers(rule.matchDatasources, ['docker'])
    ) {
      throw new TypeError('digest automerge must stay limited to Docker images');
    }
    for (const key of ['automergeType', 'automergeStrategy', 'platformAutomerge', 'rebaseWhen']) {
      if (key in rule) throw new TypeError(`automerge rules must not override ${key}`);
    }
  }

  const majorRule = config.packageRules.find(
    (rule) =>
      sameMembers(rule.matchUpdateTypes, ['major']) &&
      rule.dependencyDashboardApproval === true &&
      rule.automerge === false,
  );
  if (!majorRule || majorRule.matchManagers !== undefined) {
    throw new TypeError('every manager must keep major updates dashboard-gated and manual');
  }
}

export function validateHostedRenovateConfig(config) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new TypeError('Renovate config must be an object');
  }
  if (config.enabled !== true) {
    throw new TypeError('hosted Renovate version-update owner must remain enabled');
  }
  if (
    !sameMembers(
      config.enabledManagers,
      Object.values(VERSION_UPDATE_ECOSYSTEMS).map(({ renovate }) => renovate),
    )
  ) {
    throw new TypeError(
      'enabledManagers must contain exactly npm, github-actions, dockerfile, and docker-compose',
    );
  }
  if (!sameMembers(config.baseBranchPatterns, ['dev'])) {
    throw new TypeError('baseBranchPatterns must contain only dev');
  }
  if (config.useBaseBranchConfig !== 'merge') {
    throw new TypeError(
      'useBaseBranchConfig must be merge so dev config applies to the dev base branch',
    );
  }
  if (config.configMigration === true) {
    throw new TypeError(
      'configMigration PRs must stay off; renovate.json changes only through reviewed PRs',
    );
  }
  if (config.dependencyDashboard !== true) {
    throw new TypeError('dependencyDashboard must remain enabled');
  }
  if (!Number.isInteger(config.prConcurrentLimit) || config.prConcurrentLimit < 1) {
    throw new TypeError('prConcurrentLimit must be a positive integer');
  }
  if (!Number.isInteger(config.prHourlyLimit) || config.prHourlyLimit < 1) {
    throw new TypeError('prHourlyLimit must be a positive integer');
  }
  if (
    !Number.isInteger(config.vulnerabilityAlerts?.prConcurrentLimit) ||
    config.vulnerabilityAlerts.prConcurrentLimit < 1
  ) {
    throw new TypeError('vulnerabilityAlerts.prConcurrentLimit must be a positive integer');
  }
  if (typeof config.minimumReleaseAge !== 'string' || config.minimumReleaseAge.trim() === '') {
    throw new TypeError('minimumReleaseAge must be explicit');
  }
  if (config.toolSettings?.nodeMaxMemory !== HOSTED_RENOVATE_NODE_MAX_MEMORY_MIB) {
    throw new TypeError(
      `toolSettings.nodeMaxMemory must equal ${HOSTED_RENOVATE_NODE_MAX_MEMORY_MIB} MiB for the hosted pnpm lockfile boundary`,
    );
  }
  if (config.env?.PNPM_WORKERS !== undefined || config.env?.PNPM_MAX_WORKERS !== undefined) {
    throw new TypeError(
      'repository Renovate config must not assume unproven PNPM_WORKERS overrides',
    );
  }
  if (!Array.isArray(config.packageRules)) {
    throw new TypeError('packageRules must be an array');
  }

  const ownerRules = renovateOwnerRules(config);
  if (
    !sameMembers(
      ownerRules.map((rule) => rule.groupName),
      RENOVATE_OWNER_GROUPS,
    )
  ) {
    throw new TypeError('packageRules must define every bounded owner group exactly once');
  }

  for (const rule of ownerRules) {
    if (!sameMembers(rule.matchManagers, ['npm'])) {
      throw new TypeError(`${rule.groupName} must match only the npm manager`);
    }
    if (!sameMembers(rule.matchUpdateTypes, ['minor', 'patch'])) {
      throw new TypeError(`${rule.groupName} must group only minor and patch updates`);
    }
    assertStringArray(rule.matchPackageNames, `${rule.groupName}.matchPackageNames`);
  }

  validateAutomerge(config);
  validatePnpmPins(config);

  return structuredClone(config);
}

export function mapRenovateOwnerGroups(config, packageNames) {
  validateHostedRenovateConfig(config);
  assertStringArray(packageNames, 'packageNames');

  const rules = renovateOwnerRules(config);
  return Object.fromEntries(
    packageNames.map((packageName) => {
      const matchingGroups = rules
        .filter((rule) => rule.matchPackageNames.includes(packageName))
        .map((rule) => rule.groupName);

      if (matchingGroups.length !== 1) {
        throw new Error(
          `${packageName} must map to exactly one Renovate owner group, received: ${JSON.stringify(matchingGroups)}`,
        );
      }

      return [packageName, matchingGroups[0]];
    }),
  );
}

function parseTopLevelYamlMapKeys(input, sectionName) {
  const lines = input.split(/\r?\n/u);
  const keys = [];
  let inSection = false;

  for (const line of lines) {
    if (!inSection) {
      inSection = line === `${sectionName}:`;
      continue;
    }
    if (/^\S/u.test(line)) break;
    if (!/^\s{2}\S/u.test(line)) continue;

    const separatorIndex = line.indexOf(':');
    if (separatorIndex === -1) continue;
    const rawKey = line.slice(0, separatorIndex).trim();
    keys.push(rawKey.replace(/^(['"])(.*)\1$/u, '$2'));
  }

  return keys.sort();
}

export function parsePnpmWorkspaceDependencySurface(input) {
  if (typeof input !== 'string' || input.trim() === '') {
    throw new TypeError('pnpm workspace config must be a non-empty string');
  }

  return {
    catalogPackages: parseTopLevelYamlMapKeys(input, 'catalog'),
    overrideSelectors: parseTopLevelYamlMapKeys(input, 'overrides'),
  };
}

export function detectVersionUpdateOwners({ dependabotConfig = '', renovateConfig } = {}) {
  return Object.fromEntries(
    Object.entries(VERSION_UPDATE_ECOSYSTEMS).map(([ecosystem, { dependabot, renovate }]) => {
      const owners = [];
      if (isDependabotVersionUpdateActive(dependabotConfig, dependabot)) owners.push('dependabot');
      if (isRenovateManagerActive(renovateConfig, renovate)) owners.push('renovate');
      return [ecosystem, owners];
    }),
  );
}

export function assertSingleVersionUpdateOwner(ownersByEcosystem) {
  for (const ecosystem of Object.keys(VERSION_UPDATE_ECOSYSTEMS)) {
    const owners = ownersByEcosystem?.[ecosystem];
    if (!Array.isArray(owners) || owners.length !== 1) {
      throw new Error(
        `expected exactly one active ${ecosystem} version-update owner, received: ${JSON.stringify(owners)}`,
      );
    }
  }
}

export function parseDependencyAutomationEvidence(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('dependency automation evidence must be an object');
  }
  if (input.schemaVersion !== 1) throw new TypeError('schemaVersion must equal 1');
  if (!Number.isInteger(input.directDependencyCount) || input.directDependencyCount <= 0) {
    throw new TypeError('directDependencyCount must be a positive integer');
  }
  if (!Array.isArray(input.runs) || input.runs.length < 2) {
    throw new TypeError('runs must contain automatic and manual evidence');
  }

  input.runs.forEach((run, index) => {
    if (!Number.isInteger(run.runId) || run.runId <= 0) {
      throw new TypeError(`runs[${index}].runId must be a positive integer`);
    }
    if (!Number.isInteger(run.jobId) || run.jobId <= 0) {
      throw new TypeError(`runs[${index}].jobId must be a positive integer`);
    }
    if (run.terminalOutcome !== 'cancelled') {
      throw new TypeError(`runs[${index}].terminalOutcome must equal cancelled`);
    }
    if (typeof run.durationSeconds !== 'number' || run.durationSeconds <= 0) {
      throw new TypeError(`runs[${index}].durationSeconds must be positive`);
    }
    if (!Number.isInteger(run.completedPullRequests) || run.completedPullRequests < 0) {
      throw new TypeError(`runs[${index}].completedPullRequests must be non-negative`);
    }
  });

  return structuredClone(input);
}
