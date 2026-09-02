function extractNpmDependabotBlock(config) {
  if (typeof config !== 'string') return '';
  return (
    config.match(
      /package-ecosystem:\s*['"]npm['"][\s\S]*?(?=\n\s*-\s+package-ecosystem:|$)/u,
    )?.[0] ?? ''
  );
}

function isDependabotNpmVersionUpdateActive(config) {
  const npmBlock = extractNpmDependabotBlock(config);
  if (npmBlock === '') return false;
  return !/open-pull-requests-limit:\s*0(?:\s|$)/u.test(npmBlock);
}

function isRenovateNpmVersionUpdateActive(config) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) return false;
  if (config.enabled === false) return false;
  return Array.isArray(config.enabledManagers) && config.enabledManagers.includes('npm');
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

export function validateHostedRenovateNpmConfig(config) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new TypeError('Renovate config must be an object');
  }
  if (config.enabled !== true) {
    throw new TypeError('hosted Renovate npm owner must remain enabled');
  }
  if (!sameMembers(config.enabledManagers, ['npm'])) {
    throw new TypeError('enabledManagers must contain only npm');
  }
  if (!sameMembers(config.baseBranchPatterns, ['dev'])) {
    throw new TypeError('baseBranchPatterns must contain only dev');
  }
  if (config.automerge !== false) throw new TypeError('automerge must remain disabled');
  if (config.dependencyDashboard !== true) {
    throw new TypeError('dependencyDashboard must remain enabled');
  }
  if (!Number.isInteger(config.prConcurrentLimit) || config.prConcurrentLimit < 1) {
    throw new TypeError('prConcurrentLimit must be a positive integer');
  }
  if (!Number.isInteger(config.prHourlyLimit) || config.prHourlyLimit < 1) {
    throw new TypeError('prHourlyLimit must be a positive integer');
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

  return structuredClone(config);
}

export function mapRenovateOwnerGroups(config, packageNames) {
  validateHostedRenovateNpmConfig(config);
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

export function detectNpmVersionUpdateOwners({ dependabotConfig = '', renovateConfig } = {}) {
  const owners = [];
  if (isDependabotNpmVersionUpdateActive(dependabotConfig)) owners.push('dependabot');
  if (isRenovateNpmVersionUpdateActive(renovateConfig)) owners.push('renovate');
  return owners;
}

export function assertSingleNpmVersionUpdateOwner(owners) {
  if (!Array.isArray(owners) || owners.length !== 1) {
    throw new Error(
      `expected exactly one active npm version-update owner, received: ${JSON.stringify(owners)}`,
    );
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
