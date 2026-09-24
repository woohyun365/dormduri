import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';

export const BASELINE_CHILD_MODEL = 'gpt-6-astra';
// Bump for eligibility changes outside this data, too. Old grants never migrate implicitly.
const POLICY_REVISION = '2026-09-24.2';
const PROFILES = deepFreeze({
  'bounded-build': {
    profileId: 'bounded-build',
    policyRevision: POLICY_REVISION,
    model: 'gpt-6-sol',
    resolvedEffort: 'xhigh',
    cohort: 'bounded-implementation',
    taskKinds: ['implementation', 'test'],
    roles: ['knu_executor'],
    routineRoles: ['knu_executor'],
    impactRisks: ['low', 'medium'],
    verificationKeys: ['acceptance', 'regression', 'astraQa'],
    readOnly: false,
    allowedTools: ['repository-read', 'workspace-edit', 'test-runner'],
    requiredTools: ['workspace-edit', 'test-runner'],
  },
  'bounded-read': {
    profileId: 'bounded-read',
    policyRevision: POLICY_REVISION,
    model: 'gpt-6-sol',
    resolvedEffort: 'xhigh',
    cohort: 'bounded-read-only',
    taskKinds: ['lookup', 'analysis', 'research'],
    roles: ['knu_explorer', 'knu_researcher'],
    // Researcher remains pilot-only until independently validated for routine use.
    routineRoles: ['knu_explorer'],
    impactRisks: ['low', 'medium'],
    verificationKeys: ['acceptance', 'independentCheck'],
    readOnly: true,
    allowedTools: ['repository-read', 'official-web-read'],
    requiredTools: [],
  },
  'bounded-extract': {
    profileId: 'bounded-extract',
    policyRevision: POLICY_REVISION,
    model: 'gpt-6-luna',
    resolvedEffort: 'xhigh',
    cohort: 'bounded-extraction',
    taskKinds: ['lookup', 'analysis'],
    roles: ['knu_explorer'],
    routineRoles: ['knu_explorer'],
    impactRisks: ['low'],
    verificationKeys: [
      'acceptance',
      'fixedInput',
      'outputSchema',
      'singleStep',
      'independentCheck',
    ],
    readOnly: true,
    allowedTools: ['repository-read'],
    requiredTools: [],
  },
});

export function getModelProfile(profileId) {
  if (typeof profileId !== 'string' || !Object.hasOwn(PROFILES, profileId))
    throw new TypeError(`Unknown model profile: ${String(profileId)}`);
  return PROFILES[profileId];
}

// Pure fingerprint, not registry injection or authority. Runtime always checks installed data.
export function createModelProfileBinding(profile) {
  const { profileId, policyRevision, model, resolvedEffort, cohort } = profile;
  return deepFreeze({
    profileId,
    policyRevision,
    profileDigest: `sha256:${createHash('sha256')
      .update(JSON.stringify(canonical(profile)))
      .digest('hex')}`,
    model,
    resolvedEffort,
    cohort,
  });
}

export function assertCurrentModelProfileBinding(binding) {
  const expected = createModelProfileBinding(getModelProfile(binding?.profileId));
  if (!isDeepStrictEqual(binding, expected))
    throw new TypeError('Model profile binding must match the current installed policy.');
  return expected;
}

// Semantic route effort classifies risk; a finite candidate profile resolves invocation effort.
export function resolveRouteEffort(route) {
  return route.modelRecommendation?.status === 'candidate'
    ? assertCurrentModelProfileBinding(route.modelRecommendation.profileBinding).resolvedEffort
    : route.effort;
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])]),
    );
  return value;
}

function deepFreeze(value) {
  for (const child of Object.values(value))
    if (child && typeof child === 'object') deepFreeze(child);
  return Object.freeze(value);
}
