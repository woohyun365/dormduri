import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';

export const BASELINE_CHILD_MODEL = 'gpt-6-astra';
// Bump for eligibility changes outside this data, too. Old bindings never migrate implicitly.
const POLICY_REVISION = '2026-10-09.1';
// Role files pin `model_reasoning_effort`, which outranks a spawn's effort; a test binds each `.codex/agents` file here.
export const ROLE_EFFORTS = deepFreeze({
  knu_explorer_medium: 'medium',
  knu_explorer: 'high',
  knu_explorer_xhigh: 'xhigh',
  knu_researcher_medium: 'medium',
  knu_researcher: 'high',
  knu_researcher_xhigh: 'xhigh',
  knu_executor_medium: 'medium',
  knu_executor: 'high',
  knu_executor_xhigh: 'xhigh',
  knu_reviewer: 'xhigh',
});
const READ = {
  taskKinds: ['lookup', 'analysis', 'research'],
  verificationKeys: ['acceptance', 'independentCheck'],
  readOnly: true,
  allowedTools: ['repository-read', 'official-web-read'],
  requiredTools: [],
};
const BUILD = {
  taskKinds: ['implementation', 'test'],
  verificationKeys: ['acceptance', 'regression', 'astraQa'],
  readOnly: false,
  allowedTools: ['repository-read', 'workspace-edit', 'test-runner'],
  requiredTools: ['workspace-edit', 'test-runner'],
};
// A profile names the model passed as spawn_agent.model; the chosen role names the effort. Candidate profiles are
// model requests with a quality gate and one effort; assignment profiles carry the Astra roles of every effort.
// 6.1 Sol is the routine bounded model (Owner adoption 2026-10-06); its quality rests on the oracle, Astra QA and the hook-observed
// model and effort.
const PROFILES = deepFreeze({
  extract: {
    profileId: 'extract',
    policyRevision: POLICY_REVISION,
    kind: 'candidate',
    model: 'gpt-6-luna',
    resolvedEffort: 'xhigh',
    cohort: 'bounded-extraction',
    tiers: ['medium'],
    taskKinds: ['lookup', 'analysis'],
    roles: ['knu_explorer_xhigh'],
    routineRoles: ['knu_explorer_xhigh'],
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
  'standard-read': {
    profileId: 'standard-read',
    policyRevision: POLICY_REVISION,
    kind: 'candidate',
    model: 'gpt-6.1-sol',
    resolvedEffort: 'high',
    cohort: 'bounded-read-only',
    tiers: ['medium'],
    ...READ,
    roles: ['knu_explorer', 'knu_researcher'],
    routineRoles: ['knu_explorer', 'knu_researcher'],
    impactRisks: ['low', 'medium'],
  },
  'elevated-read': {
    profileId: 'elevated-read',
    policyRevision: POLICY_REVISION,
    kind: 'candidate',
    model: 'gpt-6.1-sol',
    resolvedEffort: 'xhigh',
    cohort: 'elevated-read-only',
    tiers: ['high', 'xhigh'],
    ...READ,
    roles: ['knu_explorer_xhigh', 'knu_researcher_xhigh'],
    routineRoles: ['knu_explorer_xhigh', 'knu_researcher_xhigh'],
    impactRisks: ['low', 'medium', 'high'],
  },
  'standard-build': {
    profileId: 'standard-build',
    policyRevision: POLICY_REVISION,
    kind: 'candidate',
    model: 'gpt-6.1-sol',
    resolvedEffort: 'high',
    cohort: 'bounded-implementation',
    tiers: ['medium'],
    ...BUILD,
    roles: ['knu_executor'],
    routineRoles: ['knu_executor'],
    impactRisks: ['low', 'medium'],
  },
  'elevated-build': {
    profileId: 'elevated-build',
    policyRevision: POLICY_REVISION,
    kind: 'candidate',
    model: 'gpt-6.1-sol',
    resolvedEffort: 'xhigh',
    cohort: 'elevated-implementation',
    tiers: ['high'],
    ...BUILD,
    roles: ['knu_executor_xhigh'],
    routineRoles: ['knu_executor_xhigh'],
    impactRisks: ['low', 'medium'],
  },
  'deep-build': {
    profileId: 'deep-build',
    policyRevision: POLICY_REVISION,
    kind: 'assignment',
    model: BASELINE_CHILD_MODEL,
    roles: ['knu_executor', 'knu_executor_xhigh'],
  },
  review: {
    profileId: 'review',
    policyRevision: POLICY_REVISION,
    kind: 'assignment',
    model: BASELINE_CHILD_MODEL,
    roles: ['knu_reviewer'],
  },
  'astra-fallback': {
    profileId: 'astra-fallback',
    policyRevision: POLICY_REVISION,
    kind: 'assignment',
    model: BASELINE_CHILD_MODEL,
    roles: [
      'knu_explorer_medium',
      'knu_explorer',
      'knu_explorer_xhigh',
      'knu_researcher_medium',
      'knu_researcher',
      'knu_researcher_xhigh',
      'knu_executor_medium',
      'knu_executor',
    ],
  },
});
export const MODEL_PROFILE_IDS = Object.freeze(Object.keys(PROFILES));
// The only child models the repository requests. Any other ID fails for the same reason, whatever its name.
export const ALLOWED_CHILD_MODELS = Object.freeze([
  ...new Set([BASELINE_CHILD_MODEL, ...Object.values(PROFILES).map(({ model }) => model)]),
]);

// The (agent_type, model) pairs a spawn may request: each profile's roles with that profile's model. The promotion
// ladder (same role, next model) stays inside these pairs.
export const ALLOWED_ROLE_MODELS = deepFreeze(
  Object.fromEntries(
    Object.keys(ROLE_EFFORTS).map((role) => [
      role,
      ALLOWED_CHILD_MODELS.filter((model) =>
        Object.values(PROFILES).some(
          (profile) => profile.model === model && profile.roles.includes(role),
        ),
      ),
    ]),
  ),
);

export function isAllowedRoleModel(role, model) {
  return (
    typeof role === 'string' &&
    Object.hasOwn(ALLOWED_ROLE_MODELS, role) &&
    ALLOWED_ROLE_MODELS[role].includes(model)
  );
}

export function assertAllowedChildModel(model) {
  if (!ALLOWED_CHILD_MODELS.includes(model))
    throw new TypeError('Model is outside the allowed child model list.');
  return model;
}

export function getModelProfile(profileId) {
  if (typeof profileId !== 'string' || !Object.hasOwn(PROFILES, profileId))
    throw new TypeError(`Unknown model profile: ${String(profileId)}`);
  return PROFILES[profileId];
}

// The promotion ladder: a candidate profile's next rung for the same role (Luna → 6.1 Sol, 6.1 Sol → Astra). A failed
// lane climbs at most one rung, once; assignment profiles are the top rung.
export const RECOVERY_LADDER = deepFreeze({
  extract: 'elevated-read',
  'standard-read': 'astra-fallback',
  'elevated-read': 'astra-fallback',
  'standard-build': 'deep-build',
  'elevated-build': 'deep-build',
});

export function getRecoveryStep(profileId, role) {
  if (!getModelProfile(profileId).roles.includes(role))
    throw new TypeError(`Role ${String(role)} is not in profile ${profileId}.`);
  if (!Object.hasOwn(RECOVERY_LADDER, profileId)) return null;
  const next = getModelProfile(RECOVERY_LADDER[profileId]);
  return deepFreeze({ profileId: next.profileId, model: next.model });
}

// Pure fingerprint, not registry injection or authority. Runtime always checks installed data.
export function createModelProfileBinding(profile) {
  if (profile?.kind !== 'candidate')
    throw new TypeError('Only a candidate profile has a model binding.');
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
  assertAllowedChildModel(binding.model);
  if (!isDeepStrictEqual(binding, expected))
    throw new TypeError('Model profile binding must match the current installed policy.');
  return expected;
}

// The route's role pins invocation effort; a candidate binding must agree with that role.
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
