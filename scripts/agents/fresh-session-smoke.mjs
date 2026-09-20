import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { recommendDelegation } from './child-task-contract.mjs';
import { discoverContextPack } from './domain-guide-registry.mjs';
import { buildTaskEnvelope } from './intake-policy.mjs';
import {
  createDispatchRecommendation,
  createLifecycleRecommendation,
} from './orchestration-policy.mjs';
import {
  createSemanticEvidenceId,
  createSemanticFactId,
  createSemanticSourceId,
} from './routing-policy.mjs';

const repoRoot = resolve(import.meta.dirname, '../..');
const entryPoints = Object.freeze([
  'AGENTS.md',
  'docs/development/agent-workflows/README.md',
  'docs/development/agent-workflows/getting-started.md',
  'docs/development/agent-workflows/agent-execution-contract.md',
  'docs/development/agent-workflows/request-intake/README.md',
  'docs/development/agent-workflows/plan-authoring/README.md',
  'docs/development/agent-workflows/orchestration.md',
]);

export function runFreshSessionSmoke() {
  const discovery = discoverBootstrap();
  const direct = evaluateScenario({
    request: 'AGENTS.md의 줄 수를 알려줘.',
    repositoryEvidence: [{ path: 'AGENTS.md', kind: 'changed-file' }],
  });
  const singleDomain = evaluateScenario({
    request: 'Legal Web UI 책임을 분석하고 개선 계획을 작성해줘.',
    repositoryEvidence: [
      { path: 'docs/policies/legal-basis.md', kind: 'policy' },
      { path: 'apps/web/src/legal/README.md', kind: 'owner-readme' },
      { path: 'apps/web/src/legal/__tests__/legal-document-pages.test.tsx', kind: 'test' },
    ],
  });
  const mixedDomain = evaluateScenario({
    request: 'Legal Web/API 책임을 분석하고 개선 계획을 작성해줘.',
    repositoryEvidence: [
      { path: 'apps/web/src/legal/README.md', kind: 'owner-readme' },
      { path: 'apps/api/src/legal/README.md', kind: 'owner-readme' },
    ],
  });
  const unavailableRoleRouting = evaluateScenario({
    request: 'Legal 개선 지점 분석해줘.',
    repositoryEvidence: [
      { path: 'docs/policies/legal-basis.md', kind: 'policy' },
      { path: 'apps/web/src/legal/README.md', kind: 'owner-readme' },
    ],
    laneCandidates: advisoryLegalLanes(),
    reportedRuntimeEvidence: {
      schemaVersion: 1,
      surfaceMode: 'native',
      observationScope: 'current-turn',
      freshness: 'current-turn',
      provenance: ['host-tool-schema'],
      dispatchPermission: 'allowed',
      roles: [
        {
          agentType: 'explore',
          available: true,
          effectiveModel: 'gpt-5.6-luna',
          effectiveEffort: 'medium',
          explicitEffortSupport: true,
        },
      ],
    },
  });
  const routingEvidence = evaluateRoutingEvidence();

  return deepFreeze({
    schemaVersion: 1,
    discovery,
    scenarios: {
      direct: summarizeScenario(direct),
      singleDomain: summarizeScenario(singleDomain),
      mixedDomain: summarizeScenario(mixedDomain),
      unavailableRoleRouting: summarizeScenario(unavailableRoleRouting),
    },
    routingEvidence,
    lifecycleEvidence: evaluateLifecycleEvidence(),
    deliveryEvidence: evaluateDeliveryEvidence(),
    boundaries: {
      readsLocalResumeState: false,
      readsIgnoredPlan: false,
      invokesChild: false,
      mutatesWorkspace: false,
    },
  });
}

function evaluateLifecycleEvidence() {
  // Synthetic contract examples only, not observations of a real native host.
  const input = {
    schemaVersion: 1,
    intent: 'cleanup',
    observation: {
      scope: 'current-turn',
      freshness: 'current-turn',
      provenance: 'native-tools',
      actionPermission: 'allowed',
    },
    target: {
      parentId: '/smoke',
      childId: '/smoke/review',
      ownerParentId: '/smoke',
      taskId: 'synthetic-review',
      observedTaskId: 'synthetic-review',
      isRoot: false,
      state: 'completed',
      pendingTasks: 0,
      pendingTools: 0,
      pendingMailbox: 0,
    },
    capabilities: { close: false, startTurn: true },
    result: { taskId: 'synthetic-review', collected: true, delivery: 'final' },
    retention: null,
    close: { status: 'not-attempted', childId: null, taskId: null },
    release: { status: 'unknown', childId: null, taskId: null },
  };
  const noClose = {
    ...input,
    lifecycleContract: {
      cleanup: 'runtime-managed',
      verification: 'current-host',
      reference: 'synthetic-host-contract-not-a-native-observation',
    },
  };
  return {
    unsupported: createLifecycleRecommendation(input),
    noClose: createLifecycleRecommendation(noClose),
    mailboxUnknown: createLifecycleRecommendation({
      ...noClose,
      target: { ...input.target, pendingMailbox: null },
    }),
    releasedWithoutClose: createLifecycleRecommendation({
      ...noClose,
      release: { status: 'confirmed', childId: input.target.childId, taskId: input.target.taskId },
    }),
    eligible: createLifecycleRecommendation({
      ...input,
      capabilities: { ...input.capabilities, close: true },
    }),
    closedReleaseUnknown: createLifecycleRecommendation({
      ...input,
      capabilities: { ...input.capabilities, close: true },
      target: { ...input.target, state: 'closed' },
      close: { status: 'succeeded', childId: input.target.childId, taskId: input.target.taskId },
    }),
  };
}

function evaluateDeliveryEvidence() {
  // Deterministic fixtures, not a benchmark or real usage/host observations.
  const request = {
    purpose: 'task',
    mode: 'scoped',
    effortMode: 'explicit',
    rationale: null,
    snapshot: 'synthetic-source-v1',
    evidencePointers: ['docs/policies/legal-basis.md'],
    findings: ['Preserve the bounded source finding.'],
    failures: ['Preserve prior failed-check evidence.'],
    previous: null,
    runtime: {
      freshness: 'current-turn',
      scopedFork: true,
      fullHistoryFork: true,
      followup: true,
      explicitEffort: true,
      fullHistoryWithExplicitEffort: false,
      effectiveEffort: 'high',
    },
  };
  const packetFor = (delivery) =>
    evaluateScenario({
      request: 'Legal 개선 지점 분석해줘.',
      repositoryEvidence: [{ path: 'docs/policies/legal-basis.md', kind: 'policy' }],
      laneCandidates: [routingEvidenceLane(['FE-08-performance-causal'])],
      deliveryByLane: { 'legal-routing-evidence': delivery },
    }).delegation.recommendedChildren[0];
  const packet = packetFor(request);
  return {
    scoped: packet.contextDelivery,
    unknown: packetFor({ ...request, runtime: null }).contextDelivery,
    fullHistoryConflict: packetFor({
      ...request,
      mode: 'full-history',
      rationale: 'Synthetic full-history compatibility case.',
    }).contextDelivery,
    fixtureOnly: true,
    measurement: {
      unit: 'utf8-bytes',
      packetBytes: Buffer.byteLength(JSON.stringify(packet), 'utf8'),
      withSyntheticHistoryBytes: Buffer.byteLength(
        JSON.stringify({
          packet,
          history: 'Synthetic unrelated prior completed work.\n'.repeat(24),
        }),
        'utf8',
      ),
      tokens: null,
      weeklyAllowance: null,
    },
  };
}

function discoverBootstrap() {
  for (const path of entryPoints) {
    if (!existsSync(resolve(repoRoot, path)))
      throw new Error(`Missing bootstrap entry point: ${path}`);
  }

  const agents = read('AGENTS.md');
  const workflowIndex = read('docs/development/agent-workflows/README.md');
  const gettingStarted = read('docs/development/agent-workflows/getting-started.md');

  requireReference(agents, 'docs/development/agent-workflows/getting-started.md', 'AGENTS.md');
  requireReference(agents, 'agent-execution-contract.md', 'AGENTS.md');
  requireReference(agents, 'orchestration.md', 'AGENTS.md');
  requireReference(workflowIndex, 'request-intake/README.md', 'workflow index');
  requireReference(workflowIndex, 'plan-authoring/README.md', 'workflow index');
  requireReference(gettingStarted, 'request-intake/README.md', 'getting started');
  requireReference(gettingStarted, 'plan-authoring/README.md', 'getting started');

  return {
    entryPoints: [...entryPoints],
    order: [
      'current-request',
      'AGENTS.md',
      'minimum-relevant-workflow-guide',
      'current-code-contract-test-evidence',
    ],
    canonical: true,
  };
}

function evaluateScenario({
  request,
  repositoryEvidence,
  laneCandidates = [],
  reportedRuntimeEvidence = null,
  deliveryByLane = {},
}) {
  assertRepositoryEvidenceExists(repositoryEvidence);
  const envelope = buildTaskEnvelope({ request });
  const contextPack = discoverContextPack({ envelope, repositoryEvidence });
  const delegation = recommendDelegation({
    envelope,
    contextPack,
    deliveryByLane,
    laneCandidates: laneCandidates.map((lane) => {
      const { smokePredicateIds, ...candidate } = lane;
      return {
        ...candidate,
        pass2Evidence: semanticEvidence(
          contextPack,
          smokePredicateIds ??
            (lane.taskKind === 'research' ? 'SEC-07-official-evidence' : 'SEC-05-disclosure'),
        ),
      };
    }),
  });
  const dispatch = createDispatchRecommendation({ delegation, reportedRuntimeEvidence });

  return { envelope, contextPack, delegation, dispatch };
}

function evaluateRoutingEvidence() {
  const sameRequest = 'Legal 개선 지점 분석해줘.';
  const keywordOnly = routedEffort({
    request: 'critical migration transaction xhigh Legal 개선 지점 분석해줘.',
    predicateIds: ['FE-05-browser-runtime'],
  });
  const medium = routedEffort({ request: sameRequest, predicateIds: mediumPredicateIds() });
  const high = routedEffort({ request: sameRequest, predicateIds: ['FE-08-performance-causal'] });
  const xhigh = routedEffort({
    request: sameRequest,
    predicateIds: ['BE-01-concurrency-transaction'],
  });

  return {
    keywordOnly,
    sameRequest: {
      request: sameRequest,
      efforts: [medium.effort, high.effort, xhigh.effort],
      roles: [medium.role, high.role, xhigh.role],
      childCounts: [medium.childCount, high.childCount, xhigh.childCount],
    },
    parentEffortClaimed: false,
  };
}

function routedEffort({ request, predicateIds }) {
  const result = evaluateScenario({
    request,
    repositoryEvidence: [{ path: 'docs/policies/legal-basis.md', kind: 'policy' }],
    laneCandidates: [routingEvidenceLane(predicateIds)],
  });
  const [contract] = result.delegation.recommendedChildren;
  if (!contract) throw new Error('Fresh-session routing evidence requires one child contract.');
  return {
    effort: contract.routeRecommendation.effort,
    role: contract.routeRecommendation.role,
    childCount: result.delegation.recommendedChildren.length,
  };
}

function routingEvidenceLane(predicateIds) {
  return {
    id: 'legal-routing-evidence',
    domain: 'legal-policy',
    taskKind: 'analysis',
    priority: 'high',
    impactRisk: 'high',
    objective: 'Analyze one bounded Legal repository question.',
    question: 'Which current evidence determines the reasoning complexity?',
    allowedEvidence: ['repo', 'test'],
    allowedTools: ['repository-read'],
    readScope: ['docs/policies/legal-basis.md'],
    writeOwnership: [],
    dependencies: [],
    expectedOutputFields: ['findings'],
    verification: ['Cite the current repository evidence.'],
    benefit: {
      kind: 'completeness',
      rationale: 'The bounded evidence lane can be completed independently.',
    },
    smokePredicateIds: predicateIds,
  };
}

function summarizeScenario({ envelope, contextPack, delegation, dispatch }) {
  return {
    intent: envelope.intent,
    authorizedAction: envelope.authorizedAction,
    recommendedPath: envelope.recommendedPath,
    domains: contextPack.domainCandidates.map(({ domain }) => domain),
    selectedGuides: contextPack.selectedGuides.map(({ path }) => path),
    gaps: [...contextPack.gaps, ...delegation.gaps, ...dispatch.gaps],
    delegation: delegation.execution,
    delegationReason: delegation.reason,
    dispatch: dispatch.execution,
    dispatchReason: dispatch.reason,
    childCount: dispatch.dispatches.length,
    routedRoles: dispatch.dispatches.map(({ agentType }) => agentType),
  };
}

function advisoryLegalLanes() {
  return [
    {
      id: 'legal-repository',
      domain: 'legal-policy',
      taskKind: 'analysis',
      priority: 'high',
      impactRisk: 'high',
      objective: 'Analyze current repository Legal responsibilities.',
      question: 'Which current repository boundaries affect Legal?',
      allowedEvidence: ['repo', 'test'],
      allowedTools: ['repository-read'],
      readScope: ['docs/policies/legal-basis.md', 'apps/web/src/legal'],
      writeOwnership: [],
      dependencies: [],
      expectedOutputFields: ['problems', 'recommendations'],
      verification: ['Cite current repository paths.'],
      benefit: {
        kind: 'completeness',
        rationale: 'Repository evidence can be inspected independently.',
      },
    },
    {
      id: 'legal-official',
      domain: 'legal-policy',
      taskKind: 'research',
      priority: 'high',
      impactRisk: 'high',
      objective: 'Verify current official Legal evidence.',
      question: 'Which current official sources support the Legal claims?',
      allowedEvidence: ['official-current'],
      allowedTools: ['official-web-read'],
      readScope: ['https://www.law.go.kr/'],
      writeOwnership: [],
      dependencies: [],
      expectedOutputFields: ['currentClaims'],
      verification: ['Cite a directly verified official source.'],
      benefit: {
        kind: 'specialist-evidence',
        rationale: 'External authority can be checked independently.',
      },
    },
  ];
}

function semanticEvidence(contextPack, predicateIds) {
  const normalizedPredicateIds = Array.isArray(predicateIds) ? predicateIds : [predicateIds];
  const current =
    contextPack.sources.find(({ path }) => path === 'docs/policies/legal-basis.md') ??
    contextPack.sources[0];
  const source = {
    path: current.path,
    locator: `fresh-session:${normalizedPredicateIds.join(',')}`,
    kind: current.kind,
    observedAt: current.verifiedAt ?? current.freshness,
    contentDigest: `sha256:${'d'.repeat(64)}`,
  };
  source.sourceId = createSemanticSourceId(source);
  const facts = normalizedPredicateIds.map((predicateId) => {
    const fact = {
      statement: `Fresh-session evidence supports ${predicateId}.`,
      sourceIds: [source.sourceId],
      confidence: 'high',
    };
    return { ...fact, factId: createSemanticFactId(fact) };
  });
  const predicateClaims = normalizedPredicateIds.map((predicateId, index) => {
    const claim = {
      predicateId,
      outcome: 'confirmed',
      factIds: [facts[index].factId],
      semanticMatch: {
        matches: true,
        rationale: `The fresh ContextPack source supports ${predicateId}.`,
      },
      compositeCategory: null,
    };
    return { ...claim, evidenceId: createSemanticEvidenceId(claim) };
  });
  return {
    sources: [source],
    facts,
    predicateClaims,
    inferences: [],
    gaps: [],
    confidence: 'high',
  };
}

function mediumPredicateIds() {
  return Array.from({ length: 15 }, (_, index) => `M-${String(index + 1).padStart(2, '0')}`);
}

function assertRepositoryEvidenceExists(repositoryEvidence) {
  for (const { path } of repositoryEvidence) {
    if (!path.startsWith('https://') && !existsSync(resolve(repoRoot, path))) {
      throw new Error(`Missing repository evidence: ${path}`);
    }
  }
}

function requireReference(source, expected, owner) {
  if (!source.includes(expected)) throw new Error(`${owner} does not discover ${expected}`);
}

function read(path) {
  return readFileSync(resolve(repoRoot, path), 'utf8');
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
}

if (process.argv.includes('--json')) {
  process.stdout.write(`${JSON.stringify(runFreshSessionSmoke(), null, 2)}\n`);
}
