import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import { assessLaneIndependence, recommendDelegation } from '../agents/child-task-contract.mjs';
import { discoverContextPack } from '../agents/domain-guide-registry.mjs';
import { buildTaskEnvelope } from '../agents/intake-policy.mjs';
import {
  createSemanticEvidenceId,
  createSemanticFactId,
  createSemanticSourceId,
} from '../agents/routing-policy.mjs';

const repoRoot = resolve(import.meta.dirname, '../..');
const legalEvidence = [
  { path: 'docs/policies/legal-basis.md', kind: 'policy' },
  { path: 'apps/web/src/legal/README.md', kind: 'owner-readme' },
  { path: 'apps/api/src/legal/legal.controller.ts', kind: 'controller' },
  { path: 'packages/shared/src/legal/contract.ts', kind: 'contract' },
  { path: 'apps/web/src/legal/__tests__/legal-document-pages.test.tsx', kind: 'test' },
];

test('keeps direct requests child-free even when semantic lane candidates are supplied', () => {
  const envelope = buildTaskEnvelope({ request: 'AGENTS.md의 줄 수를 알려줘.' });
  const contextPack = discoverContextPack({
    envelope,
    repositoryEvidence: [{ path: 'AGENTS.md', kind: 'changed-file' }],
  });
  const result = recommendDelegation({
    envelope,
    contextPack,
    laneCandidates: [repositoryLane(contextPack)],
  });

  assert.equal(result.execution, 'direct');
  assert.deepEqual(result.recommendedChildren, []);
  assert.equal(result.limits.defaultChildren, 0);
});

test('permits one independently valuable lane and carries the complete Pass 2 route', () => {
  const { envelope, contextPack } = legalFlow();
  const result = recommendDelegation({
    envelope,
    contextPack,
    laneCandidates: [repositoryLane(contextPack)],
  });

  assert.equal(result.execution, 'bounded-lanes');
  assert.equal(result.recommendedChildren.length, 1);
  const [contract] = result.recommendedChildren;
  assert.equal(contract.routeRecommendation.role, 'knu_explorer');
  assert.equal(contract.routeRecommendation.effort, 'high');
  assert.equal(contract.routeRecommendation.pass2Applied, true);
  assert.equal(contract.routeRecommendation.evidenceIds.length, 1);
  assert.equal(contract.routeRecommendation.assessment.reasoningComplexity, 'substantial');
  assert.deepEqual(
    contract.routeRecommendation.runtimeApplication,
    transitionalRuntimeApplication(),
  );
  assert.match(contract.routeRecommendation.gaps.join(' '), /runtime-role-evidence-deferred/u);
  assert.equal(contract.leaderOwnership.finalDecision, true);
  assert.equal(contract.leaderOwnership.finalUserResponse, true);
  assert.equal(contract.leaderOwnership.integration, true);
  assert.equal(contract.leaderOwnership.finalVerification, true);
  assert.equal('parentEffort' in contract.routeRecommendation, false);
});

test('selects zero-to-two children normally and requires bound high-value evidence for a third', () => {
  const { envelope, contextPack } = legalFlow();
  const standardThird = recommendDelegation({
    envelope,
    contextPack,
    laneCandidates: [
      repositoryLane(contextPack, { id: 'lane-one', priority: 'high' }),
      repositoryLane(contextPack, { id: 'lane-two', priority: 'high' }),
      repositoryLane(contextPack, { id: 'lane-three', priority: 'medium' }),
    ],
  });

  assert.deepEqual(
    standardThird.recommendedChildren.map(({ laneId }) => laneId),
    ['lane-one', 'lane-two'],
  );
  assert.match(standardThird.gaps.join(' '), /third-proactive-child-requires-high-value-evidence/u);

  const thirdEvidence = semanticEvidence(contextPack, {
    predicateId: 'SEC-07-official-evidence',
    statement: 'A third specialist lane closes a distinct current-authority evidence gap.',
  });
  const evidenceBackedThird = recommendDelegation({
    envelope,
    contextPack,
    laneCandidates: [
      repositoryLane(contextPack, { id: 'lane-one', priority: 'high' }),
      repositoryLane(contextPack, { id: 'lane-two', priority: 'high' }),
      repositoryLane(contextPack, {
        id: 'lane-three',
        priority: 'medium',
        pass2Evidence: thirdEvidence,
        benefit: {
          kind: 'specialist-evidence',
          rationale: 'The third lane closes a separately evidenced authority gap.',
          value: 'high',
          evidenceIds: thirdEvidence.predicateClaims.map(({ evidenceId }) => evidenceId),
        },
      }),
      repositoryLane(contextPack, { id: 'lane-four', priority: 'low' }),
    ],
  });

  assert.deepEqual(
    evidenceBackedThird.recommendedChildren.map(({ laneId }) => laneId),
    ['lane-one', 'lane-two', 'lane-three'],
  );
  assert.deepEqual(
    evidenceBackedThird.deferredLanes.map(({ laneId }) => laneId),
    ['lane-four'],
  );
  assert.deepEqual(evidenceBackedThird.limits.proactiveChildren, {
    normalMax: 2,
    evidenceBackedMax: 3,
  });
});

test('allows explicit owner-directed fan-out up to the hard limit of six', () => {
  const { envelope, contextPack } = legalFlow();
  const result = recommendDelegation({
    envelope,
    contextPack,
    ownerDirectedChildLimit: 6,
    laneCandidates: Array.from({ length: 6 }, (_, index) =>
      repositoryLane(contextPack, { id: `manual-lane-${index + 1}` }),
    ),
  });

  assert.equal(result.execution, 'bounded-lanes');
  assert.equal(result.recommendedChildren.length, 6);
  assert.equal(result.limits.mode, 'owner-directed');
  assert.equal(result.limits.applied, 6);
  assert.equal(result.limits.ownerDirectedMax, 6);
});

test('keeps ambiguous, dependent, low-benefit, and missing-Pass-2 work child-free', () => {
  const ambiguousEnvelope = buildTaskEnvelope({ request: 'Legal을 개선해줘.' });
  const ambiguousContext = discoverContextPack({
    envelope: ambiguousEnvelope,
    repositoryEvidence: legalEvidence,
  });
  const ambiguous = recommendDelegation({
    envelope: ambiguousEnvelope,
    contextPack: ambiguousContext,
    laneCandidates: [repositoryLane(ambiguousContext)],
  });
  assert.equal(ambiguous.execution, 'single-sequential');
  assert.match(ambiguous.gaps.join(' '), /ambiguity-or-authority/u);

  const { envelope, contextPack } = legalFlow('Legal 구현을 수정해줘.');
  const dependent = recommendDelegation({
    envelope,
    contextPack,
    laneCandidates: [
      implementationLane(contextPack, {
        id: 'dependent-lane',
        dependencies: ['prior-result'],
        writeOwnership: ['apps/api/src/legal'],
      }),
    ],
  });
  assert.equal(dependent.execution, 'single-sequential');
  assert.match(JSON.stringify(dependent.deferredLanes), /lane-has-result-dependencies/u);

  const lowBenefit = recommendDelegation({
    envelope,
    contextPack,
    laneCandidates: [
      repositoryLane(contextPack, {
        benefit: {
          kind: 'latency',
          rationale: 'The lookup is cheaper for the leader to complete directly.',
          value: 'low',
        },
      }),
    ],
  });
  assert.equal(lowBenefit.execution, 'single-sequential');
  assert.match(lowBenefit.gaps.join(' '), /measurable-child-benefit-required/u);

  const missingPass2 = recommendDelegation({
    envelope,
    contextPack,
    laneCandidates: [{ ...repositoryLane(contextPack), pass2Evidence: undefined }],
  });
  assert.equal(missingPass2.execution, 'single-sequential');
  assert.match(missingPass2.gaps.join(' '), /pass2-semantic-evidence-required/u);
});

test('rejects lexical risk substitution and never selects more than one write child', () => {
  const { envelope, contextPack } = legalFlow('Legal 구현을 수정해줘.');
  assert.throws(
    () =>
      recommendDelegation({
        envelope,
        contextPack,
        laneCandidates: [{ ...repositoryLane(contextPack), risk: 'high' }],
      }),
    /Unsupported lane field: risk/u,
  );

  const distinctWrites = recommendDelegation({
    envelope,
    contextPack,
    laneCandidates: [
      implementationLane(contextPack, {
        id: 'api-writer',
        priority: 'high',
        writeOwnership: ['apps/api/src/legal'],
      }),
      implementationLane(contextPack, {
        id: 'web-writer',
        priority: 'medium',
        writeOwnership: ['apps/web/src/legal'],
      }),
    ],
  });
  assert.deepEqual(
    distinctWrites.recommendedChildren.map(({ laneId }) => laneId),
    ['api-writer'],
  );
  assert.match(distinctWrites.gaps.join(' '), /write-child-limit-exceeded/u);

  const overlappingWrites = recommendDelegation({
    envelope,
    contextPack,
    laneCandidates: [
      implementationLane(contextPack, {
        id: 'contract-writer',
        writeOwnership: ['packages/shared/src/legal'],
      }),
      implementationLane(contextPack, {
        id: 'contract-file-writer',
        writeOwnership: ['packages/shared/src/legal/contract.ts'],
      }),
    ],
  });
  assert.equal(overlappingWrites.execution, 'single-sequential');
  assert.match(JSON.stringify(overlappingWrites.deferredLanes), /shared-write-ownership/u);
});

test('fails closed on malformed contracts and hard-limit overflow', () => {
  const { envelope, contextPack } = legalFlow();
  assert.throws(
    () =>
      recommendDelegation({
        envelope,
        contextPack,
        laneCandidates: Array.from({ length: 7 }, (_, index) =>
          repositoryLane(contextPack, { id: `lane-${index}` }),
        ),
      }),
    /hard limit of 6/u,
  );
  assert.throws(
    () => recommendDelegation({ envelope, contextPack, ownerDirectedChildLimit: 7 }),
    /between 1 and 6/u,
  );
  assert.throws(
    () =>
      assessLaneIndependence({
        envelope,
        lane: { ...repositoryLane(contextPack), unexpected: true },
      }),
    /Unsupported lane field/u,
  );
});

test('child contract policy remains advisory and does not own runtime lifecycle', () => {
  const source = readFileSync(resolve(repoRoot, 'scripts/agents/child-task-contract.mjs'), 'utf8');

  assert.doesNotMatch(source, /node:child_process|spawn_agent|exec_command|create_goal/u);
  assert.doesNotMatch(source, /retry\s*\(|respawn|tmux/u);
});

function legalFlow(request = 'Legal 개선 지점 분석해줘.') {
  const envelope = buildTaskEnvelope({ request });
  const contextPack = discoverContextPack({ envelope, repositoryEvidence: legalEvidence });
  return { envelope, contextPack };
}

function repositoryLane(contextPack, overrides = {}) {
  return {
    id: 'legal-repository-map',
    domain: 'legal-policy',
    taskKind: 'analysis',
    priority: 'medium',
    objective: 'Map the current Legal policy, FE, BFF, BE, contract, and test surfaces.',
    question: 'Which current repository owners and executable boundaries implement Legal?',
    allowedEvidence: ['repo', 'test'],
    allowedTools: ['repository-read'],
    readScope: ['docs/policies', 'apps/web/src/legal', 'apps/api/src/legal'],
    writeOwnership: [],
    dependencies: [],
    expectedOutputFields: ['owners', 'paths', 'contracts', 'tests'],
    verification: ['Every claimed owner cites a current repository path.'],
    benefit: {
      kind: 'completeness',
      rationale: 'A bounded repository map can be collected independently.',
    },
    pass2Evidence: semanticEvidence(contextPack),
    ...overrides,
  };
}

function implementationLane(contextPack, overrides) {
  return repositoryLane(contextPack, {
    taskKind: 'implementation',
    allowedTools: ['repository-read', 'workspace-edit'],
    expectedOutputFields: ['changedFiles', 'behavior'],
    verification: ['Run the closest owner tests.'],
    benefit: {
      kind: 'latency',
      rationale: 'The write lane has bounded ownership and no result dependency.',
    },
    ...overrides,
  });
}

function semanticEvidence(
  contextPack,
  {
    predicateId = 'SEC-05-disclosure',
    statement = 'Current repository evidence supports a bounded Legal analysis lane.',
  } = {},
) {
  const current =
    contextPack.sources.find(({ path }) => path === 'docs/policies/legal-basis.md') ??
    contextPack.sources[0];
  const source = {
    path: current.path,
    locator: `fixture:${predicateId}`,
    kind: current.kind,
    observedAt: current.verifiedAt ?? current.freshness,
    contentDigest: `sha256:${'a'.repeat(64)}`,
  };
  source.sourceId = createSemanticSourceId(source);
  const fact = {
    statement,
    sourceIds: [source.sourceId],
    confidence: 'high',
  };
  fact.factId = createSemanticFactId(fact);
  const claim = {
    predicateId,
    outcome: 'confirmed',
    factIds: [fact.factId],
    semanticMatch: {
      matches: true,
      rationale: `The inspected source supports ${predicateId}.`,
    },
    compositeCategory: null,
  };
  claim.evidenceId = createSemanticEvidenceId(claim);
  return {
    sources: [source],
    facts: [fact],
    predicateClaims: [claim],
    inferences: [],
    gaps: [],
    confidence: 'high',
  };
}

function transitionalRuntimeApplication() {
  return {
    requested: true,
    supported: 'unknown',
    applied: false,
    evidenceStatus: 'deferred-to-runtime-compatibility',
  };
}
