const HARD_CHILD_LIMIT = 6;
const DEFAULT_CONCURRENCY_LIMIT = 3;
const SOL_MODEL = 'gpt-5.6-sol';
const MAX_REPORTED_ROLES = 24;
const EFFORTS = new Set(['medium', 'high', 'xhigh']);
const INSTALLED_ROLES = new Set(['knu_explorer', 'knu_researcher', 'knu_executor', 'knu_reviewer']);
const RUNTIME_SURFACES = new Set(['native', 'omx']);
const RUNTIME_OBSERVATION_SCOPES = new Set(['current-turn', 'current-session']);
const RUNTIME_PROVENANCE = new Set(['host-tool-schema', 'omx-runtime-overlay']);
const RUNTIME_DISPATCH_PERMISSIONS = new Set(['allowed', 'denied', 'unknown']);
const RUNTIME_EVIDENCE_FIELDS = new Set([
  'schemaVersion',
  'surfaceMode',
  'observationScope',
  'freshness',
  'provenance',
  'dispatchPermission',
  'roles',
]);
const RUNTIME_ROLE_FIELDS = new Set([
  'agentType',
  'available',
  'effectiveModel',
  'effectiveEffort',
  'explicitEffortSupport',
]);
const RESULT_STATUSES = new Set(['completed', 'blocked', 'failed']);
const CONFIDENCE = new Set(['low', 'medium', 'high']);
const VERIFICATION_STATUSES = new Set(['passed', 'failed', 'not-run']);
const ATTEMPT_OUTCOMES = new Set(['success', 'failure']);
const DELEGATION_EXECUTIONS = new Set(['direct', 'single-sequential', 'bounded-lanes']);
const RECOVERY_STATUSES = new Set([
  'not-started',
  'complete',
  'alternate-available',
  'handoff-required',
]);
const RECOVERY_ACTIONS = new Set([
  'primary-attempt',
  'none',
  'alternate-once',
  'leader-sequential-fallback',
  'terminal-handoff',
]);
const RECOVERY_DISPOSITIONS = new Set([
  'plan-oq',
  'user-handoff',
  'evidence-gap',
  'leader-sequential',
  'blocker-handoff',
]);
const FAILURE_CATEGORIES = new Set([
  'official-source-unavailable',
  'repository-evidence-missing',
  'role-routing-unavailable',
  'tool-unavailable',
  'verification-failed',
  'scope-conflict',
  'missing-authority',
  'credential-required',
  'external-production',
  'unknown',
]);
const NON_RETRYABLE_FAILURES = new Set([
  'role-routing-unavailable',
  'scope-conflict',
  'missing-authority',
  'credential-required',
  'external-production',
]);
const CHILD_RESULT_FIELDS = new Set([
  'laneId',
  'status',
  'outputs',
  'facts',
  'inferences',
  'gaps',
  'confidence',
  'verification',
  'blocker',
]);

export function createDispatchRecommendation({
  delegation,
  reportedRuntimeEvidence = null,
  concurrencyLimit = DEFAULT_CONCURRENCY_LIMIT,
} = {}) {
  assertDelegationRecommendation(delegation);
  const runtime = normalizeReportedRuntimeEvidence(reportedRuntimeEvidence);
  validateConcurrencyLimit(concurrencyLimit);

  if (delegation.execution !== 'bounded-lanes' || delegation.recommendedChildren.length < 1) {
    return dispatchRecommendation({
      delegation,
      execution: delegation.execution === 'direct' ? 'leader-direct' : 'leader-sequential',
      reason: 'The delegation recommendation does not authorize bounded child lanes.',
      dispatches: [],
      deferredLaneIds: delegation.recommendedChildren.map(({ laneId }) => laneId),
      runtime,
      concurrencyLimit,
      gaps: [],
    });
  }

  if (runtime.evidenceStatus !== 'accepted') {
    return dispatchRecommendation({
      delegation,
      execution: 'leader-sequential',
      reason: 'The reported runtime evidence is missing, stale, or incompatible with this policy.',
      dispatches: [],
      deferredLaneIds: delegation.recommendedChildren.map(({ laneId }) => laneId),
      runtime,
      concurrencyLimit,
      gaps: unique(['runtime-capability-fallback', ...runtime.gaps]),
    });
  }

  const selected = delegation.recommendedChildren.slice(0, concurrencyLimit);
  const deferred = delegation.recommendedChildren.slice(concurrencyLimit);
  const compatibility = assessRuntimeCompatibility(runtime, selected);
  if (!compatibility.compatible) {
    return dispatchRecommendation({
      delegation,
      execution: 'leader-sequential',
      reason: 'The current reported runtime cannot honor every selected child route safely.',
      dispatches: [],
      deferredLaneIds: delegation.recommendedChildren.map(({ laneId }) => laneId),
      runtime,
      concurrencyLimit,
      gaps: unique(['runtime-capability-fallback', ...compatibility.gaps]),
    });
  }

  const dispatches = selected.map((contract) => {
    const reportedRole = compatibility.rolesByAgentType.get(contract.routeRecommendation.role);
    return {
      laneId: contract.laneId,
      agentType: contract.routeRecommendation.role,
      effort: contract.routeRecommendation.effort,
      effectiveModel: reportedRole.effectiveModel,
      effectiveEffort: reportedRole.effectiveEffort,
      explicitEffortSupport: reportedRole.explicitEffortSupport,
      contract,
      dispatchOwner: 'leader',
      runtimeSurface: runtime.surfaceMode === 'omx' ? 'omx-native-child' : 'native-child',
      requiresLeaderRuntimeConfirmation: true,
    };
  });

  return dispatchRecommendation({
    delegation,
    execution: 'native-bounded-dispatch',
    reason: `${dispatches.length} typed lane(s) are ready for leader-controlled native dispatch.`,
    dispatches,
    deferredLaneIds: deferred.map(({ laneId }) => laneId),
    runtime,
    concurrencyLimit,
    gaps:
      deferred.length > 0
        ? [`runtime-concurrency-limit: ${deferred.length} lane(s) deferred.`]
        : [],
  });
}

export function evaluateRecovery({ laneId, attempts = [] } = {}) {
  const normalizedLaneId = requireIdentifier(laneId, 'laneId');
  if (!Array.isArray(attempts)) throw new TypeError('attempts must be an array.');
  if (attempts.length > 2) {
    throw new TypeError('Recovery allows one primary attempt and at most one alternate attempt.');
  }
  const normalizedAttempts = attempts.map((attempt, index) => normalizeAttempt(attempt, index));
  validateAttemptSequence(normalizedAttempts);

  if (normalizedAttempts.length === 0) {
    return recoveryDecision({
      laneId: normalizedLaneId,
      attempts: normalizedAttempts,
      status: 'not-started',
      action: 'primary-attempt',
      remainingAlternateAttempts: 1,
      blocker: null,
      disposition: null,
      confidence: 'high',
    });
  }

  const latest = normalizedAttempts.at(-1);
  if (latest.outcome === 'success') {
    return recoveryDecision({
      laneId: normalizedLaneId,
      attempts: normalizedAttempts,
      status: 'complete',
      action: 'none',
      remainingAlternateAttempts: 0,
      blocker: null,
      disposition: null,
      confidence: 'high',
    });
  }

  if (normalizedAttempts.length === 1 && !NON_RETRYABLE_FAILURES.has(latest.failureCategory)) {
    return recoveryDecision({
      laneId: normalizedLaneId,
      attempts: normalizedAttempts,
      status: 'alternate-available',
      action: 'alternate-once',
      remainingAlternateAttempts: 1,
      blocker: latest.evidence,
      disposition: null,
      confidence: 'high',
      prohibitedApproachIds: [latest.approachId],
    });
  }

  const disposition = terminalDisposition(latest.failureCategory);
  return recoveryDecision({
    laneId: normalizedLaneId,
    attempts: normalizedAttempts,
    status: 'handoff-required',
    action:
      latest.failureCategory === 'role-routing-unavailable'
        ? 'leader-sequential-fallback'
        : 'terminal-handoff',
    remainingAlternateAttempts: 0,
    blocker: latest.evidence,
    disposition,
    confidence: latest.failureCategory === 'unknown' ? 'low' : 'high',
  });
}

export function prepareLeaderSynthesis({
  delegation,
  childResults = [],
  recoveryDecisions = [],
  conflicts = [],
} = {}) {
  assertDelegationRecommendation(delegation);
  if (delegation.execution !== 'bounded-lanes') {
    throw new TypeError('Leader child synthesis requires a bounded-lanes delegation.');
  }
  if (!Array.isArray(childResults)) throw new TypeError('childResults must be an array.');
  if (!Array.isArray(recoveryDecisions)) {
    throw new TypeError('recoveryDecisions must be an array.');
  }

  const contracts = new Map(
    delegation.recommendedChildren.map((contract) => [contract.laneId, contract]),
  );
  const results = childResults.map((result) => normalizeChildResult(result, contracts));
  assertUnique(
    results.map(({ laneId }) => laneId),
    'child result laneId',
  );
  const normalizedRecoveries = recoveryDecisions.map(normalizeRecoveryDecision);
  assertUnique(
    normalizedRecoveries.map(({ laneId }) => laneId),
    'recovery laneId',
  );
  for (const recovery of normalizedRecoveries) {
    if (!contracts.has(recovery.laneId)) {
      throw new TypeError(`Recovery references an unknown lane: ${recovery.laneId}`);
    }
    const result = results.find(({ laneId }) => laneId === recovery.laneId);
    if (result?.status === 'completed' && recovery.action !== 'none') {
      throw new TypeError('A completed child result cannot have a pending or terminal recovery.');
    }
  }
  const normalizedConflicts = normalizeConflicts(conflicts, contracts);

  const resultByLane = new Map(results.map((result) => [result.laneId, result]));
  const missingLaneIds = [...contracts.keys()].filter((laneId) => !resultByLane.has(laneId));
  const facts = results.flatMap((result) =>
    result.facts.map((fact) => ({ laneId: result.laneId, ...fact })),
  );
  const inferences = results.flatMap((result) =>
    result.inferences.map((inference) => ({ laneId: result.laneId, ...inference })),
  );
  const gaps = results.flatMap((result) =>
    result.gaps.map((gap) => ({ laneId: result.laneId, ...gap })),
  );
  const verification = results.flatMap((result) =>
    result.verification.map((item) => ({ laneId: result.laneId, ...item })),
  );
  const blockingLaneIds = results
    .filter(
      (result) =>
        result.status !== 'completed' ||
        result.gaps.some(({ blocking }) => blocking) ||
        result.verification.some(({ status }) => status !== 'passed'),
    )
    .map(({ laneId }) => laneId);
  const pendingRecoveryLaneIds = normalizedRecoveries
    .filter(({ action }) => action === 'alternate-once')
    .map(({ laneId }) => laneId);
  const unresolvedConflicts = normalizedConflicts.filter(
    ({ resolution }) => resolution === 'unresolved',
  );
  const readyForLeaderDecision =
    missingLaneIds.length === 0 &&
    blockingLaneIds.length === 0 &&
    pendingRecoveryLaneIds.length === 0 &&
    unresolvedConflicts.length === 0;

  return deepFreeze({
    schemaVersion: 1,
    requestId: delegation.requestId,
    readyForLeaderDecision,
    facts,
    inferences,
    gaps,
    conflicts: normalizedConflicts,
    verification,
    laneSummaries: results.map(({ laneId, status, confidence, blocker }) => ({
      laneId,
      status,
      confidence,
      blocker,
    })),
    missingLaneIds,
    blockingLaneIds,
    pendingRecoveryLaneIds,
    recoveryDecisions: normalizedRecoveries,
    leaderOwnership: {
      finalDecision: true,
      finalUserResponse: true,
      integration: true,
      finalVerification: true,
    },
  });
}

function dispatchRecommendation({
  delegation,
  execution,
  reason,
  dispatches,
  deferredLaneIds,
  runtime,
  concurrencyLimit,
  gaps,
}) {
  return deepFreeze({
    schemaVersion: 1,
    requestId: delegation.requestId,
    execution,
    reason,
    dispatches,
    deferredLaneIds,
    gaps,
    reportedRuntimeEvidence: runtime,
    runtimeEvidenceAuthority: 'leader-reported-not-host-authenticated',
    requiresLeaderRuntimeConfirmation: dispatches.length > 0,
    limits: { hardMax: HARD_CHILD_LIMIT, appliedConcurrency: concurrencyLimit },
    leaderOwnership: {
      dispatchDecision: true,
      finalDecision: true,
      finalUserResponse: true,
      integration: true,
      finalVerification: true,
    },
  });
}

function recoveryDecision({
  laneId,
  attempts,
  status,
  action,
  remainingAlternateAttempts,
  blocker,
  disposition,
  confidence,
  prohibitedApproachIds = [],
}) {
  return deepFreeze({
    schemaVersion: 1,
    laneId,
    status,
    action,
    attempts,
    remainingAlternateAttempts,
    maxAlternateAttempts: 1,
    prohibitedApproachIds,
    blocker,
    disposition,
    confidence,
  });
}

function normalizeReportedRuntimeEvidence(value) {
  const gaps = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return rejectedRuntimeEvidence(['runtime-evidence-missing']);
  }

  for (const field of Object.keys(value)) {
    if (!RUNTIME_EVIDENCE_FIELDS.has(field))
      gaps.push(`runtime-evidence-field-unsupported:${field}`);
  }

  if (value.schemaVersion !== 1) gaps.push('runtime-evidence-schema-unsupported');
  const surfaceMode = optionalEnum(value.surfaceMode, RUNTIME_SURFACES);
  if (surfaceMode === null) gaps.push('runtime-surface-unrecognized');
  const observationScope = optionalEnum(value.observationScope, RUNTIME_OBSERVATION_SCOPES);
  if (observationScope === null) gaps.push('runtime-observation-scope-unrecognized');
  const freshness = optionalEnum(value.freshness, RUNTIME_OBSERVATION_SCOPES);
  if (freshness === null) gaps.push('runtime-freshness-unrecognized');
  const dispatchPermission = optionalEnum(value.dispatchPermission, RUNTIME_DISPATCH_PERMISSIONS);
  if (dispatchPermission === null) gaps.push('runtime-dispatch-permission-unrecognized');

  const provenance = normalizeRuntimeProvenance(value.provenance, gaps);
  validateRuntimeEvidenceOrigin({ surfaceMode, observationScope, freshness, provenance, gaps });
  const roles = normalizeRuntimeRoles(value.roles, gaps);

  if (gaps.length > 0) {
    return rejectedRuntimeEvidence(gaps, {
      surfaceMode,
      observationScope,
      freshness,
      provenance,
      dispatchPermission,
      roles,
    });
  }

  return deepFreeze({
    schemaVersion: 1,
    evidenceStatus: 'accepted',
    authority: 'leader-reported-not-host-authenticated',
    surfaceMode,
    observationScope,
    freshness,
    provenance,
    dispatchPermission,
    roles,
    gaps: [],
  });
}

function normalizeRuntimeProvenance(value, gaps) {
  if (!Array.isArray(value) || value.length === 0) {
    gaps.push('runtime-provenance-missing');
    return [];
  }
  const provenance = [];
  for (const entry of value) {
    if (typeof entry !== 'string' || !RUNTIME_PROVENANCE.has(entry)) {
      gaps.push('runtime-provenance-unrecognized');
      continue;
    }
    provenance.push(entry);
  }
  if (new Set(provenance).size !== provenance.length) gaps.push('runtime-provenance-duplicate');
  return [...new Set(provenance)].sort();
}

function validateRuntimeEvidenceOrigin({
  surfaceMode,
  observationScope,
  freshness,
  provenance,
  gaps,
}) {
  if (surfaceMode === 'native') {
    if (observationScope !== 'current-turn' || freshness !== 'current-turn') {
      gaps.push('runtime-evidence-stale');
    }
    if (provenance.length !== 1 || provenance[0] !== 'host-tool-schema') {
      gaps.push('runtime-native-provenance-incomplete');
    }
  }
  if (surfaceMode === 'omx') {
    if (observationScope !== 'current-session' || freshness !== 'current-session') {
      gaps.push('runtime-evidence-stale');
    }
    if (
      provenance.length !== 2 ||
      !provenance.includes('host-tool-schema') ||
      !provenance.includes('omx-runtime-overlay')
    ) {
      gaps.push('runtime-omx-provenance-incomplete');
    }
  }
}

function normalizeRuntimeRoles(value, gaps) {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_REPORTED_ROLES) {
    gaps.push('runtime-role-roster-invalid');
    return [];
  }
  const roles = [];
  for (const [index, role] of value.entries()) {
    if (!role || typeof role !== 'object' || Array.isArray(role)) {
      gaps.push(`runtime-role-record-invalid:${index}`);
      continue;
    }
    for (const field of Object.keys(role)) {
      if (!RUNTIME_ROLE_FIELDS.has(field)) gaps.push(`runtime-role-field-unsupported:${field}`);
    }
    try {
      roles.push({
        agentType: requireRuntimeRole(role.agentType),
        available: requireBoolean(role.available, 'runtime role available'),
        effectiveModel: requireString(role.effectiveModel, 'runtime role effectiveModel', 80),
        effectiveEffort: requireEnum(role.effectiveEffort, EFFORTS, 'runtime role effectiveEffort'),
        explicitEffortSupport: requireBoolean(
          role.explicitEffortSupport,
          'runtime role explicitEffortSupport',
        ),
      });
    } catch {
      gaps.push(`runtime-role-metadata-invalid:${index}`);
    }
  }
  if (new Set(roles.map(({ agentType }) => agentType)).size !== roles.length) {
    gaps.push('runtime-role-roster-duplicate');
  }
  return roles;
}

function assessRuntimeCompatibility(runtime, contracts) {
  const gaps = [];
  if (runtime.dispatchPermission !== 'allowed') {
    gaps.push(`runtime-dispatch-permission-${runtime.dispatchPermission}`);
  }
  const rolesByAgentType = new Map(runtime.roles.map((role) => [role.agentType, role]));
  for (const contract of contracts) {
    const requestedRole = contract.routeRecommendation.role;
    const requestedEffort = contract.routeRecommendation.effort;
    const reportedRole = rolesByAgentType.get(requestedRole);
    if (!reportedRole || !reportedRole.available) {
      gaps.push(`runtime-role-unavailable:${requestedRole}`);
      continue;
    }
    if (reportedRole.effectiveModel !== SOL_MODEL) {
      gaps.push(`runtime-model-incompatible:${requestedRole}`);
    }
    if (reportedRole.effectiveEffort !== requestedEffort) {
      gaps.push(
        reportedRole.explicitEffortSupport
          ? `runtime-effective-effort-mismatch:${requestedRole}`
          : `runtime-fixed-effort-conflict:${requestedRole}`,
      );
    }
  }
  return {
    compatible: gaps.length === 0,
    gaps,
    rolesByAgentType,
  };
}

function rejectedRuntimeEvidence(gaps, partial = {}) {
  return deepFreeze({
    schemaVersion: 1,
    evidenceStatus: 'rejected',
    authority: 'leader-reported-not-host-authenticated',
    surfaceMode: partial.surfaceMode ?? null,
    observationScope: partial.observationScope ?? null,
    freshness: partial.freshness ?? null,
    provenance: partial.provenance ?? [],
    dispatchPermission: partial.dispatchPermission ?? null,
    roles: partial.roles ?? [],
    gaps: unique(gaps),
  });
}

function optionalEnum(value, allowed) {
  return typeof value === 'string' && allowed.has(value) ? value : null;
}

function requireRuntimeRole(value) {
  const normalized = requireString(value, 'runtime role agentType', 80);
  if (!/^[a-z][a-z\d_-]*$/u.test(normalized)) {
    throw new TypeError('runtime role agentType must use lowercase identifier syntax.');
  }
  return normalized;
}

function normalizeAttempt(attempt, index) {
  if (!attempt || typeof attempt !== 'object' || Array.isArray(attempt)) {
    throw new TypeError('attempt must be an object.');
  }
  const outcome = requireEnum(attempt.outcome, ATTEMPT_OUTCOMES, 'attempt outcome');
  return {
    number: index + 1,
    approachId: requireIdentifier(attempt.approachId, 'approachId'),
    alternateOf:
      attempt.alternateOf == null ? null : requireIdentifier(attempt.alternateOf, 'alternateOf'),
    outcome,
    failureCategory:
      outcome === 'failure'
        ? requireEnum(attempt.failureCategory, FAILURE_CATEGORIES, 'failure category')
        : null,
    evidence: requireString(attempt.evidence, 'attempt evidence', 500),
  };
}

function validateAttemptSequence(attempts) {
  if (attempts.length === 0) return;
  if (attempts[0].alternateOf !== null) {
    throw new TypeError('The primary attempt cannot declare alternateOf.');
  }
  if (attempts.length === 1) return;
  if (attempts[0].outcome !== 'failure') {
    throw new TypeError('An alternate attempt cannot follow a successful primary attempt.');
  }
  if (
    attempts[1].approachId === attempts[0].approachId ||
    attempts[1].alternateOf !== attempts[0].approachId
  ) {
    throw new TypeError('The second attempt must be one distinct alternate approach.');
  }
}

function terminalDisposition(category) {
  if (['missing-authority', 'scope-conflict'].includes(category)) return 'plan-oq';
  if (['credential-required', 'external-production'].includes(category)) return 'user-handoff';
  if (['official-source-unavailable', 'repository-evidence-missing'].includes(category)) {
    return 'evidence-gap';
  }
  if (category === 'role-routing-unavailable') return 'leader-sequential';
  return 'blocker-handoff';
}

function normalizeChildResult(result, contracts) {
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    throw new TypeError('child result must be an object.');
  }
  for (const field of Object.keys(result)) {
    if (!CHILD_RESULT_FIELDS.has(field)) {
      throw new TypeError(`Unsupported child result field: ${field}`);
    }
  }
  const laneId = requireIdentifier(result.laneId, 'child result laneId');
  const contract = contracts.get(laneId);
  if (!contract) throw new TypeError(`Child result references an unknown lane: ${laneId}`);
  const status = requireEnum(result.status, RESULT_STATUSES, 'child result status');
  const blocker = result.blocker == null ? null : requireString(result.blocker, 'blocker', 500);
  if (status !== 'completed' && blocker === null) {
    throw new TypeError('Blocked or failed child results require a blocker.');
  }
  const verification = normalizeVerification(result.verification ?? []);
  if (status === 'completed' && verification.length === 0) {
    throw new TypeError('Completed child results require verification evidence.');
  }
  return {
    laneId,
    status,
    outputs: normalizeOutputs(result.outputs, contract.expectedOutputSchema.required),
    facts: normalizeFacts(result.facts ?? []),
    inferences: normalizeInferences(result.inferences ?? []),
    gaps: normalizeGaps(result.gaps ?? []),
    confidence: requireEnum(result.confidence, CONFIDENCE, 'child result confidence'),
    verification,
    blocker,
  };
}

function normalizeOutputs(outputs, requiredFields) {
  if (!outputs || typeof outputs !== 'object' || Array.isArray(outputs)) {
    throw new TypeError('child outputs must be an object.');
  }
  const missing = requiredFields.filter(
    (field) =>
      !['facts', 'inferences', 'gaps', 'confidence'].includes(field) && !(field in outputs),
  );
  if (missing.length > 0) {
    throw new TypeError(`child outputs are missing required fields: ${missing.join(', ')}`);
  }
  return normalizeJsonObject(outputs, 0);
}

function normalizeFacts(values) {
  return normalizeObjectArray(values, 'facts', (fact) => ({
    statement: requireString(fact.statement, 'fact statement', 500),
    source: requireString(fact.source, 'fact source', 500),
  }));
}

function normalizeInferences(values) {
  return normalizeObjectArray(values, 'inferences', (inference) => ({
    statement: requireString(inference.statement, 'inference statement', 500),
    confidence: requireEnum(inference.confidence, CONFIDENCE, 'inference confidence'),
  }));
}

function normalizeGaps(values) {
  return normalizeObjectArray(values, 'gaps', (gap) => ({
    statement: requireString(gap.statement, 'gap statement', 500),
    impact: requireString(gap.impact, 'gap impact', 500),
    blocking: requireBoolean(gap.blocking ?? false, 'gap blocking'),
  }));
}

function normalizeVerification(values) {
  return normalizeObjectArray(values, 'verification', (item) => ({
    claim: requireString(item.claim, 'verification claim', 500),
    evidence: requireString(item.evidence, 'verification evidence', 500),
    status: requireEnum(item.status, VERIFICATION_STATUSES, 'verification status'),
  }));
}

function normalizeRecoveryDecision(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('recovery decision must be an object.');
  }
  if (value.schemaVersion !== 1 || value.maxAlternateAttempts !== 1) {
    throw new TypeError('recovery decision must use the bounded schema.');
  }
  const status = requireEnum(value.status, RECOVERY_STATUSES, 'recovery status');
  const action = requireEnum(value.action, RECOVERY_ACTIONS, 'recovery action');
  const remainingAlternateAttempts = requireBoundedInteger(
    value.remainingAlternateAttempts,
    'remainingAlternateAttempts',
    0,
    1,
  );
  const blocker =
    value.blocker == null ? null : requireString(value.blocker, 'recovery blocker', 500);
  const disposition =
    value.disposition == null
      ? null
      : requireEnum(value.disposition, RECOVERY_DISPOSITIONS, 'recovery disposition');
  validateRecoveryShape({ status, action, remainingAlternateAttempts, blocker, disposition });
  return deepFreeze({
    laneId: requireIdentifier(value.laneId, 'recovery laneId'),
    status,
    action,
    remainingAlternateAttempts,
    maxAlternateAttempts: 1,
    blocker,
    disposition,
  });
}

function validateRecoveryShape({
  status,
  action,
  remainingAlternateAttempts,
  blocker,
  disposition,
}) {
  const validPair =
    (status === 'not-started' && action === 'primary-attempt') ||
    (status === 'complete' && action === 'none') ||
    (status === 'alternate-available' && action === 'alternate-once') ||
    (status === 'handoff-required' &&
      ['leader-sequential-fallback', 'terminal-handoff'].includes(action));
  if (!validPair) throw new TypeError('recovery status and action are inconsistent.');
  if (['not-started', 'complete'].includes(status) && (blocker !== null || disposition !== null)) {
    throw new TypeError('non-failure recovery states cannot include blocker or disposition.');
  }
  if (['alternate-available', 'handoff-required'].includes(status) && blocker === null) {
    throw new TypeError('failure recovery states require a blocker.');
  }
  if (status === 'handoff-required' && disposition === null) {
    throw new TypeError('handoff-required recovery requires a disposition.');
  }
  const expectedRemaining = status === 'not-started' || status === 'alternate-available' ? 1 : 0;
  if (remainingAlternateAttempts !== expectedRemaining) {
    throw new TypeError('recovery remaining attempt count is inconsistent.');
  }
}

function normalizeConflicts(values, contracts) {
  return normalizeObjectArray(values, 'conflicts', (conflict) => {
    const laneIds = normalizeIdentifierArray(conflict.laneIds, 'conflict laneIds');
    if (laneIds.some((laneId) => !contracts.has(laneId))) {
      throw new TypeError('conflict references an unknown lane.');
    }
    return {
      statement: requireString(conflict.statement, 'conflict statement', 500),
      laneIds,
      resolution: requireEnum(
        conflict.resolution,
        new Set(['unresolved', 'leader-resolved']),
        'conflict resolution',
      ),
      evidence: requireString(conflict.evidence, 'conflict evidence', 500),
    };
  });
}

function assertDelegationRecommendation(delegation) {
  if (!delegation || typeof delegation !== 'object' || Array.isArray(delegation)) {
    throw new TypeError('delegation recommendation must be an object.');
  }
  if (delegation.schemaVersion !== 1 || !Array.isArray(delegation.recommendedChildren)) {
    throw new TypeError('delegation recommendation must use the supported schema.');
  }
  requireString(delegation.requestId, 'delegation requestId', 80);
  const execution = requireEnum(
    delegation.execution,
    DELEGATION_EXECUTIONS,
    'delegation execution',
  );
  if (delegation.recommendedChildren.length > HARD_CHILD_LIMIT) {
    throw new TypeError(`delegation exceeds the hard child limit of ${HARD_CHILD_LIMIT}.`);
  }
  if (
    (execution === 'bounded-lanes' && delegation.recommendedChildren.length < 1) ||
    (execution !== 'bounded-lanes' && delegation.recommendedChildren.length > 0)
  ) {
    throw new TypeError('delegation execution and recommended child count are inconsistent.');
  }
  if (
    !delegation.leaderOwnership ||
    [
      'dispatchDecision',
      'finalDecision',
      'finalUserResponse',
      'integration',
      'finalVerification',
    ].some((field) => delegation.leaderOwnership[field] !== true)
  ) {
    throw new TypeError('delegation must preserve leader-only ownership.');
  }
  const writeContracts = delegation.recommendedChildren.filter(
    ({ boundary }) => Array.isArray(boundary?.writeOwnership) && boundary.writeOwnership.length > 0,
  );
  if (writeContracts.length > 1) {
    throw new TypeError('delegation can select at most one write-capable child lane.');
  }
  for (const contract of delegation.recommendedChildren) {
    requireIdentifier(contract.laneId, 'contract laneId');
    const role = requireString(contract.routeRecommendation?.role, 'route role', 80);
    if (!INSTALLED_ROLES.has(role)) throw new TypeError(`Unsupported native role route: ${role}`);
    requireEnum(contract.routeRecommendation?.effort, EFFORTS, 'route effort');
    if (contract.routeRecommendation?.execution !== 'bounded-child') {
      throw new TypeError('child route recommendation must use bounded-child execution.');
    }
    assertSemanticRouteRecommendation(contract.routeRecommendation);
    if (!Array.isArray(contract.expectedOutputSchema?.required)) {
      throw new TypeError('child contract requires an expected output schema.');
    }
    if (
      !contract.leaderOwnership ||
      ['finalDecision', 'finalUserResponse', 'integration', 'finalVerification'].some(
        (field) => contract.leaderOwnership[field] !== true,
      )
    ) {
      throw new TypeError('child contract must preserve leader-only ownership.');
    }
  }
  assertUnique(
    delegation.recommendedChildren.map(({ laneId }) => laneId),
    'contract laneId',
  );
}

function assertSemanticRouteRecommendation(route) {
  if (route.pass2Applied !== true) {
    throw new TypeError('child route recommendation requires validated Pass 2 evidence.');
  }
  if (!Array.isArray(route.evidenceIds) || route.evidenceIds.length === 0) {
    throw new TypeError('child route recommendation requires semantic evidenceIds.');
  }
  assertUnique(route.evidenceIds, 'route evidenceId');
  if (
    !route.assessment ||
    typeof route.assessment !== 'object' ||
    Array.isArray(route.assessment)
  ) {
    throw new TypeError('child route recommendation requires a semantic assessment.');
  }
  requireEnum(route.impactRisk, new Set(['low', 'medium', 'high']), 'route impact risk');
  requireEnum(route.confidence, CONFIDENCE, 'route confidence');
  if (!Array.isArray(route.gaps) || !route.gaps.includes('runtime-role-evidence-deferred')) {
    throw new TypeError('child route recommendation must preserve the runtime evidence gap.');
  }
  const runtime = route.runtimeApplication;
  if (
    !runtime ||
    runtime.requested !== true ||
    runtime.supported !== 'unknown' ||
    runtime.applied !== false ||
    runtime.evidenceStatus !== 'deferred-to-runtime-compatibility'
  ) {
    throw new TypeError('child route recommendation has invalid transitional runtime evidence.');
  }
}

function normalizeObjectArray(values, field, mapper) {
  if (!Array.isArray(values)) throw new TypeError(`${field} must be an array.`);
  return values.map((value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new TypeError(`${field} entries must be objects.`);
    }
    return mapper(value);
  });
}

function normalizeJsonObject(value, depth) {
  if (depth > 4) throw new TypeError('child outputs exceed the supported nesting depth.');
  return Object.fromEntries(
    Object.entries(value).map(([key, nested]) => [
      requireOutputField(key),
      normalizeJsonValue(nested, depth + 1),
    ]),
  );
}

function normalizeJsonValue(value, depth) {
  if (value === null || typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string') return requireString(value, 'output value', 1_000);
  if (Array.isArray(value)) return value.map((item) => normalizeJsonValue(item, depth + 1));
  if (value && typeof value === 'object') return normalizeJsonObject(value, depth + 1);
  throw new TypeError('child outputs must contain bounded JSON values.');
}

function normalizeIdentifierArray(values, field) {
  if (!Array.isArray(values) || values.length === 0) {
    throw new TypeError(`${field} must be a non-empty array.`);
  }
  return [...new Set(values.map((value) => requireIdentifier(value, field)))];
}

function validateConcurrencyLimit(value) {
  if (!Number.isInteger(value) || value < 1 || value > HARD_CHILD_LIMIT) {
    throw new TypeError(`concurrencyLimit must be between 1 and ${HARD_CHILD_LIMIT}.`);
  }
}

function requireOutputField(value) {
  const normalized = requireString(value, 'output field', 80);
  if (!/^[a-z][a-zA-Z\d]*$/u.test(normalized)) {
    throw new TypeError('output field must use lower camelCase.');
  }
  return normalized;
}

function requireBoundedInteger(value, field, minimum, maximum) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new TypeError(`${field} must be between ${minimum} and ${maximum}.`);
  }
  return value;
}

function requireIdentifier(value, field) {
  const normalized = requireString(value, field, 80);
  if (!/^[a-z][a-z\d-]*$/u.test(normalized)) {
    throw new TypeError(`${field} must use lowercase kebab-case.`);
  }
  return normalized;
}

function requireString(value, field, maxLength) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maxLength) {
    throw new TypeError(`${field} must be a bounded string.`);
  }
  return value.trim();
}

function requireEnum(value, allowed, field) {
  if (!allowed.has(value)) throw new TypeError(`Unsupported ${field}: ${value}`);
  return value;
}

function requireBoolean(value, field) {
  if (typeof value !== 'boolean') throw new TypeError(`${field} must be a boolean.`);
  return value;
}

function assertUnique(values, field) {
  if (new Set(values).size !== values.length)
    throw new TypeError(`${field} values must be unique.`);
}

function unique(values) {
  return [...new Set(values)];
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
}
