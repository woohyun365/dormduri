import {
  ROLE_EFFORTS,
  getModelProfile,
  getRecoveryStep,
  resolveRouteEffort,
} from './model-profiles.mjs';
import { isDeepStrictEqual } from 'node:util';
import { createModelScopeDigest } from './child-task-contract.mjs';
import { recommendModel } from './routing-policy.mjs';
import {
  COMPLETION_AUTHORITY,
  checkLaneCompletion,
  isDispatchToken,
  laneTaskName,
} from './subagent-hook-records.mjs';

const HARD_CHILD_LIMIT = 6;
const DEFAULT_CONCURRENCY_LIMIT = 3;
const EFFORTS = new Set(['medium', 'high', 'xhigh']);
const INSTALLED_ROLES = new Set(Object.keys(ROLE_EFFORTS));
const DISPATCH_INPUTS = new Set(['delegation', 'concurrencyLimit', 'dispatchToken']);
const RECOVERY_INPUTS = new Set(['laneId', 'route', 'attempts']);
const RECOVERY_ROUTE_FIELDS = new Set(['role', 'profileId']);
const RETRY_DISPATCH_INPUTS = new Set(['delegation', 'recoveryDecision', 'dispatchToken']);
// A failed lane's retry route is computed from its contract route and the ladder: an attempt records the approach and
// its outcome, never a model.
const ATTEMPT_FIELDS = new Set([
  'number',
  'approachId',
  'alternateOf',
  'outcome',
  'failureCategory',
  'evidence',
]);
const RECOVERY_DECISION_FIELDS = new Set([
  'schemaVersion',
  'laneId',
  'status',
  'action',
  'attempts',
  'remainingAlternateAttempts',
  'maxAlternateAttempts',
  'prohibitedApproachIds',
  'blocker',
  'disposition',
  'confidence',
  'route',
  'retryRoute',
]);
// Result-quality failures climb one rung; evidence and tool failures change the approach on the same contract.
const STEP_UP_FAILURES = new Set(['verification-failed', 'unknown']);
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
  'quota-exhausted',
  'capacity-denied',
]);
const NON_RETRYABLE_FAILURES = new Set([
  'quota-exhausted',
  'capacity-denied',
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

// Spawn advice from the contract alone. The project hook re-checks the role roster, the (role, model) pair and the fork at
// call time, and completion binds the child's own hook records (subagent-hook-records.mjs).
// dispatchToken (optional, 4-12 lowercase letters or digits, not `retry`) is a fresh per-dispatch value the Parent
// picks; it joins each spawn task_name so completion can bind this dispatch's own child.
export function createDispatchRecommendation(input = {}) {
  for (const key of Object.keys(input ?? {}))
    if (!DISPATCH_INPUTS.has(key)) throw new TypeError(`Unsupported dispatch input: ${key}`);
  const { delegation, concurrencyLimit = DEFAULT_CONCURRENCY_LIMIT, dispatchToken } = input ?? {};
  if (dispatchToken !== undefined && !isDispatchToken(dispatchToken))
    throw new TypeError('dispatch token must be 4-12 lowercase letters or digits other than retry');
  assertDelegationRecommendation(delegation);
  validateConcurrencyLimit(concurrencyLimit);
  const sequential = (reason, gaps) =>
    dispatchRecommendation({
      delegation,
      execution: 'leader-sequential',
      reason,
      dispatches: [],
      deferredLaneIds: delegation.recommendedChildren.map(({ laneId }) => laneId),
      concurrencyLimit,
      gaps,
    });

  if (delegation.execution !== 'bounded-lanes' || delegation.recommendedChildren.length < 1) {
    return dispatchRecommendation({
      delegation,
      execution: delegation.execution === 'direct' ? 'leader-direct' : 'leader-sequential',
      reason: 'The delegation recommendation does not authorize bounded child lanes.',
      dispatches: [],
      deferredLaneIds: delegation.recommendedChildren.map(({ laneId }) => laneId),
      concurrencyLimit,
      gaps: [],
    });
  }

  // Same-role lanes on different models run together (native observation, DA-018).
  const selected = delegation.recommendedChildren.slice(0, concurrencyLimit);
  const deferred = delegation.recommendedChildren.slice(concurrencyLimit);
  const gaps = selected.flatMap(spawnGaps);
  if (gaps.length > 0)
    return sequential('A selected lane cannot be spawned from its contract.', unique(gaps));

  const dispatches = selected.map((contract) => {
    const route = contract.routeRecommendation;
    const model = getModelProfile(route.profileId).model;
    return {
      laneId: contract.laneId,
      agentType: route.role,
      effort: route.effort,
      model,
      ...(route.modelRecommendation?.status === 'candidate'
        ? { modelPurpose: route.modelRecommendation.request.purpose }
        : {}),
      contract,
      dispatchOwner: 'leader',
      ...(dispatchToken === undefined ? {} : { dispatchToken }),
      spawnArguments: {
        task_name: laneTaskName(contract.laneId, dispatchToken),
        agent_type: route.role,
        model,
        reasoning_effort: resolveRouteEffort(route),
        fork_turns: 'none',
      },
    };
  });

  return dispatchRecommendation({
    delegation,
    execution: 'native-bounded-dispatch',
    reason: `${dispatches.length} typed lane(s) are ready for leader-controlled native dispatch.`,
    dispatches,
    deferredLaneIds: deferred.map(({ laneId }) => laneId),
    concurrencyLimit,
    gaps:
      deferred.length > 0
        ? [`runtime-concurrency-limit: ${deferred.length} lane(s) deferred.`]
        : [],
  });
}

// A spawn is fresh and scoped (`fork_turns: none`). Omitted context keeps that; a supplied one must be compatible
// advice, and a compatible reuse continues an earlier child rather than spawning one. A candidate keeps its profile's
// cohort boundary and the contract snapshot it was recommended with.
function spawnGaps(contract) {
  const delivery = contract.contextDelivery;
  const gaps = [];
  if (
    delivery !== undefined &&
    (delivery?.compatible !== true ||
      delivery?.applied !== false ||
      !Array.isArray(delivery?.gaps) ||
      delivery.gaps.length !== 0 ||
      !['scoped', 'reuse'].includes(delivery.mode))
  )
    gaps.push(`context-delivery-incompatible:${contract.laneId}`);
  else if (delivery?.mode === 'reuse') gaps.push(`context-reuse-not-a-spawn:${contract.laneId}`);
  if (contract.routeRecommendation.modelRecommendation?.status === 'candidate') {
    gaps.push(...assessModelContractBoundary(contract));
    if (contract.modelScopeDigest !== createModelScopeDigest(contract) || !contract.modelTaskId)
      gaps.push('model-contract-snapshot-changed');
  }
  return gaps;
}

// Every lifecycle observation remains leader-reported; this evaluator neither authenticates the host nor performs
// a lifecycle action.
export function createLifecycleRecommendation(input) {
  validateLifecycleEvidence(input);
  const { intent, observation, target, capabilities, result, retention, close, release } = input;
  const closeObserved = close.status !== 'not-attempted' || target.state === 'closed';
  let resultDisposition = 'unverified';
  let cleanupDisposition = 'unknown';
  let releaseDisposition = 'release-unverified';
  const decide = (recommendation, reason, closeDisposition) =>
    deepFreeze({
      schemaVersion: 1,
      intent,
      target: { parentId: target.parentId, childId: target.childId, taskId: target.taskId },
      recommendation,
      reason,
      gaps: [
        'close-eligible',
        'continue',
        'retained-for-followup',
        'status-only',
        'no-explicit-close-required',
      ].includes(reason)
        ? []
        : [reason],
      resultDisposition,
      cleanupDisposition,
      closeDisposition: closeDisposition ?? (closeObserved ? 'close-unverified' : 'not-attempted'),
      releaseDisposition,
      authority: 'leader-reported-not-host-authenticated',
      requiresLeaderRuntimeConfirmation: true,
    });

  if (
    observation.scope === 'unknown' ||
    observation.freshness !== 'current-turn' ||
    observation.provenance !== 'native-tools'
  )
    return decide('unsupported', 'observation-unverified');
  if (
    !target.parentId ||
    !target.childId ||
    !target.taskId ||
    target.ownerParentId !== target.parentId ||
    target.isRoot !== false ||
    target.childId === target.parentId ||
    target.observedTaskId !== target.taskId
  )
    return decide('unsupported', 'target-unverified');
  if (observation.actionPermission !== 'allowed') {
    return decide('unsupported', 'action-not-authorized');
  }

  const sameTarget = (event) => event.childId === target.childId && event.taskId === target.taskId;
  if (
    (close.status !== 'not-attempted' && !sameTarget(close)) ||
    (release.status === 'confirmed' && !sameTarget(release))
  )
    return decide('unsupported', 'lifecycle-observation-mismatch');

  // Collection of this task's final result does not prove a quiescent child.
  resultDisposition =
    result.collected === true && result.delivery === 'final' && result.taskId === target.taskId
      ? 'collected'
      : 'uncollected';
  if (target.pendingTasks !== 0 || target.pendingTools !== 0 || target.pendingMailbox !== 0)
    return decide('wait', 'pending-work');
  if (['running', 'waiting', 'unknown'].includes(target.state)) {
    return decide('wait', 'work-not-terminal');
  }
  if (resultDisposition !== 'collected') {
    return decide('retain', 'result-uncollected');
  }

  // An applicable contract is reported by the Parent, never inferred from a tool
  // name, local feature flag, source tag, or the absence of close alone.
  const runtimeManaged =
    input.lifecycleContract?.cleanup === 'runtime-managed' &&
    input.lifecycleContract.verification === 'current-host';
  if (runtimeManaged && capabilities.close !== false)
    return decide('unsupported', 'lifecycle-contract-conflict');

  // Resource release has its own correlated observation, even without close.
  releaseDisposition = release.status === 'confirmed' ? 'release-confirmed' : 'release-unverified';
  // A final task result is not proof of close. A successful close report also
  // needs the correlated fresh closed post-state.
  if (close.status === 'succeeded' && target.state === 'closed' && capabilities.close === true) {
    cleanupDisposition = 'satisfied';
    return decide('none', 'status-only', 'closed-confirmed');
  }
  if (close.status === 'failed') return decide('retain', 'close-failed', 'cleanup-failed');
  if (closeObserved) {
    return decide('retain', 'close-outcome-unverified', 'close-unverified');
  }
  if (intent === 'status') return decide('none', 'status-only');
  if (intent === 'continue') {
    if (release.status === 'confirmed')
      return decide('retain', 'released-target-requires-confirmation');
    return capabilities.startTurn === true
      ? decide('continue', 'continue')
      : decide('unsupported', 'start-turn-unsupported');
  }
  if (retention !== null) return decide('retain', 'retained-for-followup');
  if (runtimeManaged) {
    if (target.state !== 'completed') return decide('wait', 'work-not-terminal');
    cleanupDisposition = 'not-required';
    return decide('none', 'no-explicit-close-required');
  }
  if (capabilities.close !== true)
    return decide('unsupported', 'close-unsupported', 'cleanup-unavailable');
  if (target.state !== 'completed') return decide('wait', 'work-not-terminal');
  cleanupDisposition = 'required';
  if (release.status === 'confirmed')
    return decide('retain', 'released-target-requires-confirmation');
  return decide('close-eligible', 'close-eligible');
}

function validateLifecycleEvidence(value) {
  requireLifecycleRecord(
    value,
    [
      'schemaVersion',
      'intent',
      'observation',
      'target',
      'capabilities',
      'result',
      'retention',
      'close',
      'release',
    ],
    'input',
    ['lifecycleContract'],
  );
  if (value.schemaVersion !== 1) throw new TypeError('Unsupported lifecycle schemaVersion.');
  requireEnum(value.intent, new Set(['cleanup', 'continue', 'status']), 'lifecycle intent');
  requireLifecycleRecord(
    value.observation,
    ['scope', 'freshness', 'provenance', 'actionPermission'],
    'observation',
  );
  requireLifecycleRecord(
    value.target,
    [
      'parentId',
      'childId',
      'ownerParentId',
      'taskId',
      'observedTaskId',
      'isRoot',
      'state',
      'pendingTasks',
      'pendingTools',
    ],
    'target',
    ['pendingMailbox'],
  );
  requireLifecycleRecord(value.capabilities, ['close', 'startTurn'], 'capabilities');
  requireLifecycleRecord(value.result, ['taskId', 'collected', 'delivery'], 'result');
  requireLifecycleRecord(value.close, ['status', 'childId', 'taskId'], 'close');
  requireLifecycleRecord(value.release, ['status', 'childId', 'taskId'], 'release');

  for (const [field, choices] of Object.entries({
    scope: ['current-turn', 'current-session', 'unknown'],
    freshness: ['current-turn', 'stale', 'unknown'],
    provenance: ['native-tools', 'unknown'],
    actionPermission: ['allowed', 'denied', 'unknown'],
  }))
    requireEnum(value.observation[field], new Set(choices), `lifecycle observation.${field}`);
  for (const [field, entry, choices] of [
    [
      'target.state',
      value.target.state,
      ['running', 'waiting', 'idle', 'completed', 'closed', 'unknown'],
    ],
    ['result.delivery', value.result.delivery, ['final', 'queued', 'timeout', 'unknown']],
    ['close.status', value.close.status, ['not-attempted', 'succeeded', 'failed', 'unknown']],
    ['release.status', value.release.status, ['unknown', 'confirmed']],
  ])
    requireEnum(entry, new Set(choices), `lifecycle ${field}`);

  for (const [field, entry] of [
    ['parentId', value.target.parentId],
    ['childId', value.target.childId],
    ['ownerParentId', value.target.ownerParentId],
    ['taskId', value.target.taskId],
    ['observedTaskId', value.target.observedTaskId],
    ['result.taskId', value.result.taskId],
    ['close.childId', value.close.childId],
    ['close.taskId', value.close.taskId],
    ['release.childId', value.release.childId],
    ['release.taskId', value.release.taskId],
  ]) {
    if (entry === null) continue;
    // Native IDs may be UUIDs or paths; do not coerce/trim them into a match.
    if (requireString(entry, `lifecycle ${field}`, 256) !== entry) {
      throw new TypeError(`lifecycle ${field} must be an exact identifier.`);
    }
  }
  for (const [field, entry] of [
    ['isRoot', value.target.isRoot],
    ['close', value.capabilities.close],
    ['startTurn', value.capabilities.startTurn],
    ['collected', value.result.collected],
  ])
    if (entry !== null) requireBoolean(entry, `lifecycle ${field}`);
  for (const field of ['pendingTasks', 'pendingTools', 'pendingMailbox']) {
    if (field === 'pendingMailbox' && !Object.hasOwn(value.target, field)) continue;
    if (value.target[field] !== null) {
      requireBoundedInteger(value.target[field], `lifecycle ${field}`, 0, Number.MAX_SAFE_INTEGER);
    }
  }
  if (Object.hasOwn(value, 'lifecycleContract') && value.lifecycleContract !== null) {
    const contract = value.lifecycleContract;
    requireLifecycleRecord(contract, ['cleanup', 'verification', 'reference'], 'lifecycleContract');
    requireEnum(
      contract.cleanup,
      new Set(['explicit-close', 'runtime-managed', 'unknown']),
      'lifecycle contract.cleanup',
    );
    requireEnum(
      contract.verification,
      new Set(['current-host', 'unverified']),
      'lifecycle contract.verification',
    );
    if (contract.reference !== null || contract.verification === 'current-host') {
      requireString(contract.reference, 'lifecycle contract.reference', 500);
    }
  }
  if (value.retention !== null) {
    requireLifecycleRecord(value.retention, ['reason', 'revisit'], 'retention');
    requireString(value.retention.reason, 'lifecycle retention.reason', 500);
    requireString(value.retention.revisit, 'lifecycle retention.revisit', 500);
  }
}

function requireLifecycleRecord(value, fields, name, optionalFields = []) {
  requireExactRecord(value, fields, `lifecycle ${name}`, optionalFields);
}

function requireExactRecord(value, fields, name, optionalFields = []) {
  if (
    !value ||
    Object.getPrototypeOf(value) !== Object.prototype ||
    Object.keys(value).some(
      (field) => !fields.includes(field) && !optionalFields.includes(field),
    ) ||
    fields.some((field) => !Object.hasOwn(value, field))
  ) {
    throw new TypeError(
      `${name} must contain exactly: ${fields.join(', ')}; optional: ${optionalFields.join(', ')}.`,
    );
  }
}

// One primary attempt and at most one retry with a distinct approach, the same ceiling for every lane. The retry route
// is computed from the lane's contract route, never reported: a result-quality failure retries once one rung up on the
// same role (RECOVERY_LADDER); evidence and tool failures, and a lane already on the top rung, retry on the contract.
export function evaluateRecovery(input = {}) {
  for (const key of Object.keys(input ?? {}))
    if (!RECOVERY_INPUTS.has(key)) throw new TypeError(`Unsupported recovery input: ${key}`);
  const { laneId, route, attempts = [] } = input ?? {};
  const normalizedLaneId = requireIdentifier(laneId, 'laneId');
  const normalizedRoute = normalizeRecoveryRoute(route);
  if (!Array.isArray(attempts)) throw new TypeError('attempts must be an array.');
  if (attempts.length > 2) {
    throw new TypeError('Recovery allows one primary attempt and at most one alternate attempt.');
  }
  const normalizedAttempts = attempts.map((attempt, index) => normalizeAttempt(attempt, index));
  validateAttemptSequence(normalizedAttempts);
  // A finished retry keeps the route it ran on.
  const retryRoute =
    normalizedAttempts.length === 2
      ? recoveryRetryRoute(normalizedRoute, normalizedAttempts[0].failureCategory)
      : null;

  if (normalizedAttempts.length === 0) {
    return recoveryDecision({
      laneId: normalizedLaneId,
      route: normalizedRoute,
      retryRoute,
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
      route: normalizedRoute,
      retryRoute,
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
      route: normalizedRoute,
      retryRoute: recoveryRetryRoute(normalizedRoute, latest.failureCategory),
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
    route: normalizedRoute,
    retryRoute,
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

// A completed child counts only when its own hook records bind it (subagent-hook-records.mjs); a leader report alone
// is refused. hookObservation = readHookRecords() of the Parent session ({ sessionId, records, malformed });
// dispatchToken is the dispatch's token.
export function prepareLeaderSynthesis({
  delegation,
  childResults = [],
  recoveryDecisions = [],
  conflicts = [],
  hookObservation,
  dispatchToken,
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
    assertRecoveryRoute(contracts.get(recovery.laneId), recovery);
    const result = results.find(({ laneId }) => laneId === recovery.laneId);
    if (result?.status === 'completed' && recovery.action !== 'none') {
      throw new TypeError('A completed child result cannot have a pending or terminal recovery.');
    }
  }
  const normalizedConflicts = normalizeConflicts(conflicts, contracts);
  const recoveryByLane = new Map(
    normalizedRecoveries.map((recovery) => [recovery.laneId, recovery]),
  );
  const completionChecks = results
    .filter(({ status }) => status === 'completed')
    .map(({ laneId }) => ({
      laneId,
      ...checkLaneCompletion({
        observation: hookObservation,
        laneId,
        dispatchToken,
        ...completionExpectation(contracts.get(laneId), recoveryByLane.get(laneId)),
      }),
    }));
  const refusedLaneIds = completionChecks
    .filter(({ accepted }) => !accepted)
    .map(({ laneId }) => laneId);

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
        refusedLaneIds.includes(result.laneId) ||
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
    completionAuthority: COMPLETION_AUTHORITY,
    completionChecks,
    refusedLaneIds,
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

// The child a completed lane is checked against: its contract route, or the retry route on the retry task path once a
// recovery retry ran. A caller outside synthesis passes the lane's recovery decision, which is recomputed here.
export function laneCompletionExpectation({ contract, recoveryDecision }) {
  if (recoveryDecision === undefined) return completionExpectation(contract);
  const recovery = normalizeRecoveryDecision(recoveryDecision);
  if (recovery.laneId !== contract?.laneId)
    throw new TypeError(`Recovery references an unknown lane: ${recovery.laneId}`);
  assertRecoveryRoute(contract, recovery);
  return completionExpectation(contract, recovery);
}

// The retry of one failed lane: spawn arguments from its contract and its pending decision's retry route, under the
// lane's dispatch token with the `_retry` task name. The decision is recomputed, never trusted as given.
export function createRetryDispatch(input = {}) {
  for (const key of Object.keys(input ?? {}))
    if (!RETRY_DISPATCH_INPUTS.has(key))
      throw new TypeError(`Unsupported retry dispatch input: ${key}`);
  const { delegation, recoveryDecision, dispatchToken } = input ?? {};
  assertDelegationRecommendation(delegation);
  const recovery = normalizeRecoveryDecision(recoveryDecision);
  const contract = delegation.recommendedChildren.find(({ laneId }) => laneId === recovery.laneId);
  if (!contract) throw new TypeError(`Recovery references an unknown lane: ${recovery.laneId}`);
  assertRecoveryRoute(contract, recovery);
  if (recovery.action !== 'alternate-once')
    throw new TypeError('A retry dispatch needs a pending alternate decision.');
  if (dispatchToken === undefined)
    throw new TypeError('A retry dispatch requires a dispatch token.');
  // The primary dispatch gates stay: a lane kept out of native spawn (reuse, incompatible delivery, a candidate
  // boundary or scope snapshot that no longer holds) gets no retry spawn either.
  const gaps = spawnGaps(contract);
  if (gaps.length > 0)
    throw new TypeError(`A retry dispatch needs a dispatchable lane: ${gaps.join(', ')}`);
  const { role, model } = recovery.retryRoute;
  return deepFreeze({
    laneId: recovery.laneId,
    agentType: role,
    effort: ROLE_EFFORTS[role],
    model,
    retryRoute: recovery.retryRoute,
    retryOf: recovery.attempts[0].approachId,
    dispatchOwner: 'leader',
    dispatchToken,
    spawnArguments: {
      task_name: laneTaskName(recovery.laneId, dispatchToken, { retry: true }),
      agent_type: role,
      model,
      reasoning_effort: ROLE_EFFORTS[role],
      fork_turns: 'none',
    },
  });
}

function completionExpectation(contract, recovery) {
  if (recovery?.attempts.length === 2)
    return {
      expectedRole: recovery.retryRoute.role,
      expectedModel: recovery.retryRoute.model,
      retry: true,
    };
  const { role, profileId } = contract.routeRecommendation;
  return { expectedRole: role, expectedModel: getModelProfile(profileId).model, retry: false };
}

function assertRecoveryRoute(contract, recovery) {
  const { role, profileId } = contract.routeRecommendation;
  if (recovery.route.role !== role || recovery.route.profileId !== profileId)
    throw new TypeError('Recovery route must match its lane contract.');
}

function dispatchRecommendation({
  delegation,
  execution,
  reason,
  dispatches,
  deferredLaneIds,
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
  route,
  retryRoute,
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
    route,
    retryRoute,
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

// A candidate's profile cohort boundary, recomputed from the contract at dispatch; a refreshed scope digest does not
// make an invalid profile valid.
function assessModelContractBoundary(contract) {
  assertChildWriteBoundary(contract);
  const gaps = [];
  const route = contract.routeRecommendation;
  const profile = getModelProfile(route.modelRecommendation.request.profileId);
  // The candidate's role carries the profile effort; the tier gate itself is recomputed by recommendModel.
  if (
    !profile.roles.includes(route.role) ||
    route.effort !== profile.resolvedEffort ||
    route.profileId !== profile.profileId
  )
    gaps.push('model-effort-eligibility-mismatch');
  const delivery = contract.contextDelivery;
  if (
    !delivery ||
    delivery.compatible !== true ||
    delivery.applied !== false ||
    delivery.mode !== 'scoped' ||
    delivery.gaps.length !== 0 ||
    delivery.failures.length !== 0
  )
    gaps.push('model-context-incompatible');
  if (
    contract.boundary.readOnly !== profile.readOnly ||
    contract.allowed.tools.some((tool) => !profile.allowedTools.includes(tool)) ||
    profile.requiredTools.some((tool) => !contract.allowed.tools.includes(tool))
  )
    gaps.push('model-cohort-boundary-incompatible');
  return gaps;
}

function normalizeAttempt(attempt, index) {
  if (!attempt || typeof attempt !== 'object' || Array.isArray(attempt)) {
    throw new TypeError('attempt must be an object.');
  }
  for (const field of Object.keys(attempt))
    if (!ATTEMPT_FIELDS.has(field)) throw new TypeError(`Unsupported attempt field: ${field}`);
  if (attempt.number !== undefined && attempt.number !== index + 1)
    throw new TypeError(`Attempt number must equal its position: ${index + 1}.`);
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
  if (NON_RETRYABLE_FAILURES.has(attempts[0].failureCategory)) {
    throw new TypeError('A non-retryable failure has no alternate attempt.');
  }
  if (
    attempts[1].approachId === attempts[0].approachId ||
    attempts[1].alternateOf !== attempts[0].approachId
  ) {
    throw new TypeError('The second attempt must be one distinct alternate approach.');
  }
}

function normalizeRecoveryRoute(route) {
  if (!route || typeof route !== 'object' || Array.isArray(route))
    throw new TypeError('Recovery requires the lane route: role and profileId.');
  for (const field of Object.keys(route))
    if (!RECOVERY_ROUTE_FIELDS.has(field))
      throw new TypeError(`Unsupported recovery route field: ${field}`);
  // The profile must exist and carry the role; the ladder lookup checks both.
  getRecoveryStep(route.profileId, route.role);
  return { role: route.role, profileId: route.profileId };
}

function recoveryRetryRoute(route, failureCategory) {
  const step = STEP_UP_FAILURES.has(failureCategory)
    ? getRecoveryStep(route.profileId, route.role)
    : null;
  return step
    ? { kind: 'ladder', role: route.role, profileId: step.profileId, model: step.model }
    : {
        kind: 'same-contract',
        role: route.role,
        profileId: route.profileId,
        model: getModelProfile(route.profileId).model,
      };
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
  for (const field of Object.keys(value))
    if (!RECOVERY_DECISION_FIELDS.has(field))
      throw new TypeError(`Unsupported recovery decision field: ${field}`);
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
  const attempts = value.attempts.map(normalizeAttempt);
  validateAttemptSequence(attempts);
  const laneId = requireIdentifier(value.laneId, 'recovery laneId');
  // Optional derived fields are checked, not dropped: they must be what the route and attempts recompute to.
  const expected = evaluateRecovery({ laneId, route: value.route, attempts: value.attempts });
  for (const field of ['confidence', 'prohibitedApproachIds'])
    if (field in value && !isDeepStrictEqual(value[field], expected[field]))
      throw new TypeError(`Recovery decision ${field} must match its attempts.`);
  if ('retryRoute' in value && !isDeepStrictEqual(value.retryRoute, expected.retryRoute))
    throw new TypeError('Recovery decision retryRoute must match its route and attempts.');
  // The state is recomputed too, so a relabeled decision cannot buy a second retry or close a failed lane.
  const state = { status, action, remainingAlternateAttempts, blocker, disposition };
  for (const field of Object.keys(state))
    if (state[field] !== expected[field])
      throw new TypeError('Recovery decision status and action must match its attempts.');
  return deepFreeze({
    attempts,
    laneId,
    route: expected.route,
    retryRoute: expected.retryRoute,
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
  let writeContractCount = 0;
  for (const contract of delegation.recommendedChildren) {
    requireIdentifier(contract.laneId, 'contract laneId');
    if (assertChildWriteBoundary(contract)) writeContractCount += 1;
    const role = requireString(contract.routeRecommendation?.role, 'route role', 80);
    if (!INSTALLED_ROLES.has(role)) throw new TypeError(`Unsupported native role route: ${role}`);
    requireEnum(contract.routeRecommendation?.effort, EFFORTS, 'route effort');
    if (contract.routeRecommendation.effort !== ROLE_EFFORTS[role])
      throw new TypeError('Route effort must be the effort its role file pins.');
    requireEnum(contract.routeRecommendation.tier, EFFORTS, 'route tier');
    const routeProfile = getModelProfile(contract.routeRecommendation.profileId);
    if (!routeProfile.roles.includes(role))
      throw new TypeError('Route profile must list its role.');
    // Only an admitted candidate may carry a candidate profile; the spawn model comes from this profile.
    if (
      contract.routeRecommendation.modelRecommendation?.status !== 'candidate' &&
      routeProfile.kind !== 'assignment'
    )
      throw new TypeError(
        'A route without an admitted candidate must name an Astra assignment profile.',
      );
    if (contract.routeRecommendation?.execution !== 'bounded-child') {
      throw new TypeError('child route recommendation must use bounded-child execution.');
    }
    assertSemanticRouteRecommendation(contract.routeRecommendation);
    const model = contract.routeRecommendation.modelRecommendation;
    if (model !== undefined) {
      assertCurrentModelRecommendation(contract);
      if (contract.modelTaskId !== delegation.requestId)
        throw new TypeError('Model task identity must match the delegation.');
    }
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
  if (writeContractCount > 1) {
    throw new TypeError('delegation can select at most one write-capable child lane.');
  }
  assertUnique(
    delegation.recommendedChildren.map(({ laneId }) => laneId),
    'contract laneId',
  );
}

function assertChildWriteBoundary(contract) {
  const tools = contract.allowed?.tools;
  const boundary = contract.boundary;
  if (!Array.isArray(tools)) {
    throw new TypeError('child contract requires an allowed tools array.');
  }
  if (!boundary || typeof boundary !== 'object' || Array.isArray(boundary)) {
    throw new TypeError('child contract requires a boundary object.');
  }
  if (!Array.isArray(boundary.writeOwnership)) {
    throw new TypeError('child contract requires a write ownership array.');
  }
  if (typeof boundary.readOnly !== 'boolean') {
    throw new TypeError('child contract requires an explicit read-only boundary.');
  }

  const hasWriteOwnership = boundary.writeOwnership.length > 0;
  const requestsWorkspaceEdit = tools.includes('workspace-edit');
  if ((requestsWorkspaceEdit || boundary.readOnly === false) && !hasWriteOwnership) {
    throw new TypeError('child write capability requires explicit write ownership.');
  }
  if (boundary.readOnly === hasWriteOwnership) {
    throw new TypeError('child read-only boundary is inconsistent with write ownership.');
  }

  return hasWriteOwnership;
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

function assertCurrentModelRecommendation(contract) {
  const model = contract.routeRecommendation.modelRecommendation;
  requireExactRecord(
    model,
    [
      'request',
      'profileBinding',
      'taskKind',
      'role',
      'recommendedModel',
      'status',
      'reason',
      'applied',
    ],
    'model recommendation',
  );
  const expected = recommendModel({
    modelRequest: model.request,
    taskKind: model.taskKind,
    impactRisk: contract.routeRecommendation.impactRisk,
    assessment: contract.routeRecommendation.assessment,
  });
  if (!isDeepStrictEqual(model, expected))
    throw new TypeError(
      'Model recommendation must preserve semantic eligibility and applied=false.',
    );
  if (model.role !== contract.routeRecommendation.role)
    throw new TypeError('Model task must preserve the semantic role.');
}
