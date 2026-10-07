import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';

export const BASELINE_CHILD_MODEL = 'gpt-6-astra';
// Bump for eligibility changes outside this data, too. Old grants never migrate implicitly.
const POLICY_REVISION = '2026-10-06.1';
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

// Suspended: the Astra-only rescue recorded a Low or semantic effort that a role-pinned rescue would not run, so a
// failed candidate returns to the Parent or a handoff until a same-role promotion ladder replaces this policy.
export const MODEL_RECOVERY_SUSPENDED = true;
export const MODEL_RECOVERY_SUSPENDED_REASON =
  'Model recovery is suspended; a failed candidate returns to the Parent or a handoff.';

// A separate recovery policy: never an ordinary candidate or a raw effort override.
export function createRecoveryBinding({ primary, rescue, assessment, ...extra }) {
  if (MODEL_RECOVERY_SUSPENDED) throw new TypeError(MODEL_RECOVERY_SUSPENDED_REASON);
  recoveryAssert(Object.keys(extra).length === 0);
  recoveryExact(primary, [
    'profileBinding',
    'attemptId',
    'taskId',
    'laneId',
    'childId',
    'sourceDigest',
    'scopeDigest',
    'ownershipDigest',
    'failureCategory',
  ]);
  assertCurrentModelProfileBinding(primary.profileBinding);
  recoveryExact(rescue, [
    'attemptId',
    'taskId',
    'laneId',
    'sourceDigest',
    'scopeDigest',
    'configDigest',
    'role',
    'semanticEffort',
    'impactRisk',
  ]);
  recoveryExact(assessment, [
    'cause',
    'bounded',
    'contextComplete',
    'oracleAvailable',
    'identityVerified',
    'reasonRefs',
  ]);
  for (const identity of [primary, rescue]) {
    for (const field of ['attemptId', 'taskId', 'laneId'])
      recoveryAssert(
        typeof identity[field] === 'string' &&
          /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,159}$/.test(identity[field]),
      );
    for (const field of ['sourceDigest', 'scopeDigest']) recoveryDigest(identity[field]);
  }
  recoveryDigest(rescue.configDigest);
  recoveryDigest(primary.ownershipDigest);
  recoveryAssert(
    [
      'verification-failed',
      'tool-unavailable',
      'repository-evidence-missing',
      'official-source-unavailable',
      'unknown',
    ].includes(primary.failureCategory),
  );
  recoveryAssert(
    typeof primary.childId === 'string' &&
      /^\/?[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/.test(primary.childId) &&
      primary.childId.length <= 160,
  );
  recoveryAssert(
    primary.taskId === rescue.taskId &&
      primary.laneId === rescue.laneId &&
      primary.attemptId !== rescue.attemptId,
  );
  recoveryAssert(['knu_executor', 'knu_explorer', 'knu_researcher'].includes(rescue.role));
  recoveryAssert(getModelProfile(primary.profileBinding.profileId).roles.includes(rescue.role));
  recoveryAssert(['medium', 'high', 'xhigh'].includes(rescue.semanticEffort));
  recoveryAssert(['low', 'medium', 'high'].includes(rescue.impactRisk));
  recoveryAssert(
    [
      'controlled-injection',
      'code-defect',
      'context-missing',
      'tool-fixture-environment',
      'task-model-mismatch',
      'reasoning-miss',
      'unknown',
    ].includes(assessment.cause),
  );
  for (const field of ['bounded', 'contextComplete', 'oracleAvailable', 'identityVerified'])
    recoveryAssert(typeof assessment[field] === 'boolean');
  recoveryAssert(
    assessment.identityVerified && assessment.contextComplete && assessment.oracleAvailable,
  );
  recoveryAssert(
    Array.isArray(assessment.reasonRefs) &&
      assessment.reasonRefs.length > 0 &&
      assessment.reasonRefs.length <= 16,
  );
  for (const ref of assessment.reasonRefs)
    recoveryAssert(
      typeof ref === 'string' && /^evidence:[a-zA-Z0-9][a-zA-Z0-9_-]{0,159}$/.test(ref),
    );
  const bounded =
    ['controlled-injection', 'code-defect', 'context-missing', 'tool-fixture-environment'].includes(
      assessment.cause,
    ) &&
    assessment.bounded &&
    assessment.contextComplete &&
    assessment.oracleAvailable &&
    rescue.impactRisk !== 'high' &&
    rescue.semanticEffort === 'medium';
  const data = {
    kind: 'model-recovery',
    policyRevision: POLICY_REVISION,
    policyId: bounded ? 'astra-bounded-recovery' : 'astra-standard-recovery',
    model: BASELINE_CHILD_MODEL,
    resolvedEffort: bounded ? 'low' : rescue.semanticEffort,
    primary,
    rescue,
    assessment,
  };
  return deepFreeze(
    structuredClone({
      ...data,
      selectionDigest: `sha256:${createHash('sha256')
        .update(JSON.stringify(canonical(data)))
        .digest('hex')}`,
    }),
  );
}

export function assertCurrentRecoveryBinding(binding) {
  const expected = createRecoveryBinding({
    primary: binding?.primary,
    rescue: binding?.rescue,
    assessment: binding?.assessment,
  });
  assertAllowedChildModel(binding.model);
  recoveryAssert(isDeepStrictEqual(binding, expected));
  return expected;
}
function recoveryAssert(valid) {
  if (!valid) throw new TypeError('Recovery binding must match the current bounded policy.');
}
function recoveryExact(value, keys) {
  recoveryAssert(
    value &&
      Object.getPrototypeOf(value) === Object.prototype &&
      Reflect.ownKeys(value).length === keys.length &&
      keys.every((key) => Object.hasOwn(value, key)),
  );
}
function recoveryDigest(value) {
  recoveryAssert(typeof value === 'string' && /^sha256:[a-f0-9]{64}$/.test(value));
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
