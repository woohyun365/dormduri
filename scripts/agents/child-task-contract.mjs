import { assertValidTaskEnvelope } from './intake-policy.mjs';
import { selectAgentRoute } from './routing-policy.mjs';

const HARD_CHILD_LIMIT = 6;
const DEFAULT_CHILD_LIMIT = 3;
const MIN_BOUNDED_LANES = 2;
const PRIORITIES = new Set(['low', 'medium', 'high']);
const RISKS = new Set(['low', 'medium', 'high', 'critical']);
const TASK_KINDS = new Set([
  'lookup',
  'analysis',
  'implementation',
  'debugging',
  'test',
  'research',
  'verification',
  'architecture',
  'review',
]);
const BENEFIT_KINDS = new Set(['completeness', 'latency', 'specialist-evidence', 'risk-review']);
const ALLOWED_EVIDENCE = new Set(['repo', 'test', 'official-current', 'external-owner']);
const ALLOWED_TOOLS = new Set([
  'repository-read',
  'official-web-read',
  'test-runner',
  'workspace-edit',
]);
const LANE_FIELDS = new Set([
  'id',
  'domain',
  'taskKind',
  'priority',
  'risk',
  'objective',
  'question',
  'allowedEvidence',
  'allowedTools',
  'readScope',
  'writeOwnership',
  'dependencies',
  'nonGoals',
  'prohibitedAssumptions',
  'expectedOutputFields',
  'verification',
  'stopCondition',
  'handoffCondition',
  'benefit',
]);

export function recommendDelegation({
  envelope,
  contextPack,
  laneCandidates = [],
  roleRoutingAvailable = true,
  childLimit = DEFAULT_CHILD_LIMIT,
} = {}) {
  assertValidTaskEnvelope(envelope);
  assertContextPack(contextPack, envelope.requestId);
  validateBoolean(roleRoutingAvailable, 'roleRoutingAvailable');
  validateChildLimit(childLimit);

  if (!Array.isArray(laneCandidates)) throw new TypeError('laneCandidates must be an array.');
  if (laneCandidates.length > HARD_CHILD_LIMIT) {
    throw new TypeError(`laneCandidates cannot exceed the hard limit of ${HARD_CHILD_LIMIT}.`);
  }

  const lanes = laneCandidates.map((lane) => normalizeLane(lane, envelope));
  assertUniqueLaneIds(lanes);
  const assessments = lanes.map((lane) => assessNormalizedLane(lane, lanes));
  const baseGate = delegationGate(envelope, contextPack);

  if (baseGate) {
    return recommendation({
      envelope,
      execution: baseGate.execution,
      reason: baseGate.reason,
      childLimit,
      recommendedChildren: [],
      deferredLanes: assessments.map(deferredAssessment),
      gaps: baseGate.gaps,
    });
  }

  const routed = assessments.map((assessment) => ({
    ...assessment,
    route: selectAgentRoute({
      taskKind: assessment.lane.taskKind,
      risk: assessment.lane.risk,
      independent: assessment.independent,
      roleRoutingAvailable,
    }),
  }));
  const eligible = routed
    .filter(({ independent, route }) => independent && route.spawn)
    .sort(compareLanePriority);

  if (eligible.length < MIN_BOUNDED_LANES) {
    return recommendation({
      envelope,
      execution: 'single-sequential',
      reason:
        'Fewer than two independently completable, role-routable lanes remain; keep the leader on a sequential path.',
      childLimit,
      recommendedChildren: [],
      deferredLanes: routed.map((assessment) =>
        deferredAssessment(assessment, assessment.route.reason),
      ),
      gaps: eligible.length === 1 ? ['independent-lane-count-below-bounded-minimum'] : [],
    });
  }

  const selected = eligible.slice(0, childLimit);
  const selectedIds = new Set(selected.map(({ lane }) => lane.id));
  const recommendedChildren = selected.map(composeChildContract);
  const deferredLanes = routed
    .filter(({ lane }) => !selectedIds.has(lane.id))
    .map((assessment) =>
      deferredAssessment(
        assessment,
        assessment.independent && assessment.route.spawn
          ? `Deferred by the applied child limit of ${childLimit}.`
          : assessment.route.reason,
      ),
    );

  return recommendation({
    envelope,
    execution: 'bounded-lanes',
    reason: `${recommendedChildren.length} independent lanes have distinct ownership, bounded outputs, and explicit integration value.`,
    childLimit,
    recommendedChildren,
    deferredLanes,
    gaps:
      eligible.length > childLimit
        ? [
            `lane-consolidation-required: ${eligible.length - childLimit} eligible lane(s) deferred.`,
          ]
        : [],
  });
}

export function assessLaneIndependence({ lane, peerLanes = [], envelope } = {}) {
  assertValidTaskEnvelope(envelope);
  if (!Array.isArray(peerLanes)) throw new TypeError('peerLanes must be an array.');
  const normalizedLane = normalizeLane(lane, envelope);
  const normalizedPeers = peerLanes.map((peer) => normalizeLane(peer, envelope));
  assertUniqueLaneIds([normalizedLane, ...normalizedPeers]);
  return deepFreeze(assessNormalizedLane(normalizedLane, [normalizedLane, ...normalizedPeers]));
}

function assessNormalizedLane(lane, allLanes) {
  const reasons = [];
  if (lane.dependencies.length > 0) reasons.push('lane-has-result-dependencies');
  if (lane.taskKind === 'implementation' && lane.writeOwnership.length === 0) {
    reasons.push('implementation-write-owner-missing');
  }

  const conflictingLaneIds = allLanes
    .filter((peer) => peer.id !== lane.id && writeScopesOverlap(lane, peer))
    .map(({ id }) => id)
    .sort();
  if (conflictingLaneIds.length > 0) {
    reasons.push(`shared-write-ownership:${conflictingLaneIds.join(',')}`);
  }

  return {
    lane,
    independent: reasons.length === 0,
    reasons,
  };
}

function normalizeLane(lane, envelope) {
  if (!lane || typeof lane !== 'object' || Array.isArray(lane)) {
    throw new TypeError('lane candidate must be an object.');
  }
  for (const field of Object.keys(lane)) {
    if (!LANE_FIELDS.has(field)) throw new TypeError(`Unsupported lane field: ${field}`);
  }

  const taskKind = requireEnum(lane.taskKind, TASK_KINDS, 'taskKind');
  const risk = requireEnum(lane.risk ?? envelope.risk, RISKS, 'risk');
  const readScope = normalizeScopeArray(lane.readScope, 'readScope');
  const writeOwnership = normalizeScopeArray(lane.writeOwnership ?? [], 'writeOwnership', {
    allowHttps: false,
    allowEmpty: true,
  });
  const allowedEvidence = normalizeEnumArray(
    lane.allowedEvidence ?? envelope.requiredEvidence,
    ALLOWED_EVIDENCE,
    'allowedEvidence',
  );
  const allowedTools = normalizeEnumArray(
    lane.allowedTools ?? defaultTools(taskKind, writeOwnership.length > 0),
    ALLOWED_TOOLS,
    'allowedTools',
  );
  if (allowedTools.includes('workspace-edit') && writeOwnership.length === 0) {
    throw new TypeError('workspace-edit requires explicit writeOwnership.');
  }

  return {
    id: requireIdentifier(lane.id, 'lane id'),
    domain: requireIdentifier(lane.domain, 'lane domain'),
    taskKind,
    priority: requireEnum(lane.priority ?? 'medium', PRIORITIES, 'priority'),
    risk,
    objective: requireString(lane.objective, 'objective', 300),
    question: requireString(lane.question, 'question', 300),
    allowedEvidence,
    allowedTools,
    readScope,
    writeOwnership,
    dependencies: normalizeIdentifierArray(lane.dependencies ?? [], 'dependencies'),
    nonGoals: normalizeStringArray(
      lane.nonGoals ?? ['Do not rewrite the global plan or final user response.'],
      'nonGoals',
    ),
    prohibitedAssumptions: normalizeStringArray(
      lane.prohibitedAssumptions ?? [
        'Do not fill missing authority, policy, or evidence by assumption.',
      ],
      'prohibitedAssumptions',
    ),
    expectedOutputFields: normalizeStringArray(lane.expectedOutputFields, 'expectedOutputFields'),
    verification: normalizeStringArray(lane.verification, 'verification'),
    stopCondition: requireString(
      lane.stopCondition ??
        'Stop after the bounded output and its verification evidence are complete.',
      'stopCondition',
      300,
    ),
    handoffCondition: requireString(
      lane.handoffCondition ??
        'Return gaps, conflicts, or scope expansion to the leader without widening ownership.',
      'handoffCondition',
      300,
    ),
    benefit: normalizeBenefit(lane.benefit),
  };
}

function composeChildContract({ lane, route }) {
  return {
    schemaVersion: 1,
    laneId: lane.id,
    domain: lane.domain,
    objective: lane.objective,
    question: lane.question,
    allowed: {
      evidence: lane.allowedEvidence,
      tools: lane.allowedTools,
    },
    boundary: {
      readScope: lane.readScope,
      writeOwnership: lane.writeOwnership,
      readOnly: lane.writeOwnership.length === 0,
    },
    nonGoals: lane.nonGoals,
    prohibitedAssumptions: lane.prohibitedAssumptions,
    expectedOutputSchema: {
      required: unique([...lane.expectedOutputFields, 'facts', 'inferences', 'gaps', 'confidence']),
      evidenceLabels: ['fact', 'inference', 'gap'],
    },
    verification: lane.verification,
    stopCondition: lane.stopCondition,
    handoffCondition: lane.handoffCondition,
    benefit: lane.benefit,
    routeRecommendation: {
      role: route.role,
      effort: route.effort,
      execution: route.execution,
      reason: route.reason,
    },
    leaderOwnership: {
      finalDecision: true,
      finalUserResponse: true,
      integration: true,
      finalVerification: true,
    },
  };
}

function delegationGate(envelope, contextPack) {
  if (envelope.recommendedPath === 'direct' || envelope.intent === 'answer') {
    return {
      execution: 'direct',
      reason: 'The request is answerable on the direct path without child coordination.',
      gaps: [],
    };
  }
  if (
    ['clarify', 'oq-handoff'].includes(envelope.recommendedPath) ||
    envelope.ambiguities.some(({ disposition }) => disposition === 'clarify-now')
  ) {
    return {
      execution: 'single-sequential',
      reason: 'Unresolved authority or ambiguity must be handled before delegation.',
      gaps: ['delegation-blocked-by-ambiguity-or-authority'],
    };
  }
  if (
    envelope.intent === 'plan' &&
    contextPack.gaps.some((gap) => gap.startsWith('primary-domain-conflict'))
  ) {
    return {
      execution: 'single-sequential',
      reason:
        'The primary plan owner is unresolved; delegation cannot choose ownership by assumption.',
      gaps: ['delegation-blocked-by-primary-owner-conflict'],
    };
  }
  return null;
}

function recommendation({
  envelope,
  execution,
  reason,
  childLimit,
  recommendedChildren,
  deferredLanes,
  gaps,
}) {
  return deepFreeze({
    schemaVersion: 1,
    requestId: envelope.requestId,
    execution,
    reason,
    recommendedChildren,
    deferredLanes,
    gaps: unique(gaps),
    limits: {
      defaultChildren: 0,
      recommendedChildren: { min: 2, max: 3 },
      hardMax: HARD_CHILD_LIMIT,
      applied: childLimit,
    },
    leaderOwnership: {
      dispatchDecision: true,
      finalDecision: true,
      finalUserResponse: true,
      integration: true,
      finalVerification: true,
    },
  });
}

function deferredAssessment(assessment, routeReason) {
  return {
    laneId: assessment.lane.id,
    reasons:
      assessment.reasons.length > 0
        ? assessment.reasons
        : [routeReason ?? 'Delegation is not authorized on the current path.'],
  };
}

function compareLanePriority(left, right) {
  return (
    priorityWeight(right.lane.priority) - priorityWeight(left.lane.priority) ||
    left.lane.id.localeCompare(right.lane.id)
  );
}

function priorityWeight(priority) {
  return { low: 1, medium: 2, high: 3 }[priority];
}

function writeScopesOverlap(left, right) {
  return left.writeOwnership.some((leftPath) =>
    right.writeOwnership.some((rightPath) => pathsOverlap(leftPath, rightPath)),
  );
}

function pathsOverlap(left, right) {
  return left === right || left.startsWith(`${right}/`) || right.startsWith(`${left}/`);
}

function assertContextPack(contextPack, requestId) {
  if (!contextPack || typeof contextPack !== 'object' || Array.isArray(contextPack)) {
    throw new TypeError('ContextPack must be an object.');
  }
  if (contextPack.schemaVersion !== 1 || contextPack.requestId !== requestId) {
    throw new TypeError('ContextPack must match the TaskEnvelope request and schema.');
  }
  for (const field of ['domainCandidates', 'selectedGuides', 'sources', 'gaps']) {
    if (!Array.isArray(contextPack[field]))
      throw new TypeError(`ContextPack ${field} must be an array.`);
  }
}

function assertUniqueLaneIds(lanes) {
  const ids = lanes.map(({ id }) => id);
  if (new Set(ids).size !== ids.length) throw new TypeError('lane ids must be unique.');
}

function normalizeBenefit(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('lane benefit is required.');
  }
  return {
    kind: requireEnum(value.kind, BENEFIT_KINDS, 'benefit kind'),
    rationale: requireString(value.rationale, 'benefit rationale', 300),
  };
}

function defaultTools(taskKind, hasWriteOwnership) {
  if (taskKind === 'research') return ['official-web-read'];
  if (hasWriteOwnership && ['implementation', 'debugging'].includes(taskKind)) {
    return ['repository-read', 'workspace-edit'];
  }
  if (taskKind === 'test') {
    return hasWriteOwnership
      ? ['repository-read', 'test-runner', 'workspace-edit']
      : ['repository-read', 'test-runner'];
  }
  return ['repository-read'];
}

function normalizeScopeArray(values, field, { allowHttps = true, allowEmpty = false } = {}) {
  if (!Array.isArray(values) || (!allowEmpty && values.length === 0)) {
    throw new TypeError(`${field} must be ${allowEmpty ? 'an' : 'a non-empty'} array.`);
  }
  const normalized = values
    .map((value) => requireString(value, field, 300))
    .map((value) => normalizeScope(value, allowHttps));
  return unique(normalized);
}

function normalizeScope(value, allowHttps) {
  const normalized = value.replaceAll('\\', '/');
  if (allowHttps && normalized.startsWith('https://')) return normalized;
  if (/^[a-z][a-z\d+.-]*:\/\//iu.test(normalized)) {
    throw new TypeError('lane scope external URLs must use HTTPS.');
  }
  if (normalized.startsWith('/') || normalized.split('/').includes('..')) {
    throw new TypeError('lane scope must stay inside the repository.');
  }
  return normalized.replace(/\/$/u, '').replace(/^\.\//u, '');
}

function normalizeEnumArray(values, allowed, field) {
  if (!Array.isArray(values) || values.length === 0) {
    throw new TypeError(`${field} must be a non-empty array.`);
  }
  return unique(values.map((value) => requireEnum(value, allowed, field)));
}

function normalizeIdentifierArray(values, field) {
  if (!Array.isArray(values)) throw new TypeError(`${field} must be an array.`);
  return unique(values.map((value) => requireIdentifier(value, field)));
}

function normalizeStringArray(values, field) {
  if (!Array.isArray(values) || values.length === 0) {
    throw new TypeError(`${field} must be a non-empty array.`);
  }
  return unique(values.map((value) => requireString(value, field, 300)));
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

function validateChildLimit(value) {
  if (!Number.isInteger(value) || value < MIN_BOUNDED_LANES || value > HARD_CHILD_LIMIT) {
    throw new TypeError(`childLimit must be between ${MIN_BOUNDED_LANES} and ${HARD_CHILD_LIMIT}.`);
  }
}

function validateBoolean(value, field) {
  if (typeof value !== 'boolean') throw new TypeError(`${field} must be a boolean.`);
}

function unique(values) {
  return [...new Set(values)];
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
}
