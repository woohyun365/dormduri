import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import { assessLaneIndependence, recommendDelegation } from '../agents/child-task-contract.mjs';
import { discoverContextPack } from '../agents/domain-guide-registry.mjs';
import { buildTaskEnvelope } from '../agents/intake-policy.mjs';

const repoRoot = resolve(import.meta.dirname, '../..');
const legalEvidence = [
  { path: 'docs/policies/legal-basis.md' },
  { path: 'apps/web/src/legal/README.md' },
  { path: 'apps/web/src/app/api/legal/documents/[kind]/route.ts' },
  { path: 'apps/api/src/legal/legal.controller.ts' },
  { path: 'packages/shared/src/legal/contract.ts' },
  { path: 'apps/web/src/legal/__tests__/legal-document-pages.test.tsx' },
];

test('keeps direct requests child-free even when lane candidates are supplied', () => {
  const envelope = buildTaskEnvelope({ request: 'AGENTS.md의 줄 수를 알려줘.' });
  const contextPack = discoverContextPack({
    envelope,
    repositoryEvidence: [{ path: 'AGENTS.md', kind: 'changed-file' }],
  });
  const result = recommendDelegation({
    envelope,
    contextPack,
    laneCandidates: [legalRepositoryLane(), legalOfficialLane()],
  });

  assert.equal(result.execution, 'direct');
  assert.deepEqual(result.recommendedChildren, []);
  assert.equal(result.limits.defaultChildren, 0);
});

test('recommends typed child contracts only for independently completable bounded lanes', () => {
  const envelope = buildTaskEnvelope({ request: 'Legal 개선 지점 분석해줘.' });
  const contextPack = discoverContextPack({ envelope, repositoryEvidence: legalEvidence });
  const result = recommendDelegation({
    envelope,
    contextPack,
    laneCandidates: [legalRepositoryLane(), legalOfficialLane()],
  });

  assert.equal(result.execution, 'bounded-lanes');
  assert.equal(result.recommendedChildren.length, 2);
  assert.deepEqual(
    result.recommendedChildren.map(({ routeRecommendation }) => [
      routeRecommendation.role,
      routeRecommendation.effort,
    ]),
    [
      ['researcher', 'high'],
      ['explore', 'low'],
    ],
  );
  for (const contract of result.recommendedChildren) {
    assert.equal(contract.leaderOwnership.finalUserResponse, true);
    assert.equal(contract.leaderOwnership.finalVerification, true);
    assert.deepEqual(contract.expectedOutputSchema.evidenceLabels, ['fact', 'inference', 'gap']);
    assert.equal(contract.nonGoals.length > 0, true);
    assert.equal(contract.prohibitedAssumptions.length > 0, true);
    assert.equal(contract.verification.length > 0, true);
    assert.doesNotMatch(contract.routeRecommendation.effort, /max|ultra/u);
  }
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.recommendedChildren), true);
});

test('keeps dependent and shared-write lanes on the single sequential path', () => {
  const envelope = buildTaskEnvelope({ request: 'Legal 구현을 수정해줘.' });
  const contextPack = discoverContextPack({ envelope, repositoryEvidence: legalEvidence });
  const contractLane = implementationLane({
    id: 'legal-contract',
    writeOwnership: ['packages/shared/src/legal'],
  });
  const apiLane = implementationLane({
    id: 'legal-api',
    writeOwnership: ['packages/shared/src/legal/contract.ts'],
    dependencies: ['legal-contract'],
  });
  const result = recommendDelegation({
    envelope,
    contextPack,
    laneCandidates: [contractLane, apiLane],
  });

  assert.equal(result.execution, 'single-sequential');
  assert.deepEqual(result.recommendedChildren, []);
  assert.match(JSON.stringify(result.deferredLanes), /shared-write-ownership/u);
  assert.match(JSON.stringify(result.deferredLanes), /lane-has-result-dependencies/u);
});

test('requires at least two lanes and verified role routing before recommending delegation', () => {
  const envelope = buildTaskEnvelope({ request: 'Legal 개선 지점 분석해줘.' });
  const contextPack = discoverContextPack({ envelope, repositoryEvidence: legalEvidence });
  const single = recommendDelegation({
    envelope,
    contextPack,
    laneCandidates: [legalRepositoryLane()],
  });
  const unsupported = recommendDelegation({
    envelope,
    contextPack,
    laneCandidates: [legalRepositoryLane(), legalOfficialLane()],
    roleRoutingAvailable: false,
  });

  assert.equal(single.execution, 'single-sequential');
  assert.deepEqual(single.recommendedChildren, []);
  assert.match(single.gaps.join(' '), /below-bounded-minimum/u);
  assert.equal(unsupported.execution, 'single-sequential');
  assert.deepEqual(unsupported.recommendedChildren, []);
  assert.match(JSON.stringify(unsupported.deferredLanes), /cannot prove installed role routing/u);
});

test('applies explicit priority within the bounded recommendation and records deferred lanes', () => {
  const envelope = buildTaskEnvelope({ request: 'Legal 개선 지점 분석해줘.' });
  const contextPack = discoverContextPack({ envelope, repositoryEvidence: legalEvidence });
  const result = recommendDelegation({
    envelope,
    contextPack,
    childLimit: 2,
    laneCandidates: [
      legalRepositoryLane(),
      legalOfficialLane(),
      {
        ...legalRepositoryLane(),
        id: 'legal-test-map',
        priority: 'low',
        domain: 'test',
        objective: 'Map Legal regression coverage.',
        question: 'Which executable tests protect the current Legal behavior?',
        readScope: ['apps/web/src/legal/__tests__', 'apps/api/src/legal'],
      },
    ],
  });

  assert.deepEqual(
    result.recommendedChildren.map(({ laneId }) => laneId),
    ['legal-official-evidence', 'legal-repository-map'],
  );
  assert.match(result.gaps.join(' '), /lane-consolidation-required/u);
  assert.deepEqual(
    result.deferredLanes.map(({ laneId }) => laneId),
    ['legal-test-map'],
  );
});

test('fails closed on malformed lane contracts and hard-limit overflow', () => {
  const envelope = buildTaskEnvelope({ request: 'Legal 개선 지점 분석해줘.' });
  const contextPack = discoverContextPack({ envelope, repositoryEvidence: legalEvidence });

  assert.throws(
    () =>
      recommendDelegation({
        envelope,
        contextPack,
        laneCandidates: Array.from({ length: 7 }, (_, index) => ({
          ...legalRepositoryLane(),
          id: `lane-${index}`,
        })),
      }),
    /hard limit of 6/u,
  );
  assert.throws(
    () =>
      recommendDelegation({
        envelope,
        contextPack,
        laneCandidates: [{ ...legalRepositoryLane(), writeOwnership: ['../outside'] }],
      }),
    /stay inside the repository/u,
  );
  assert.throws(
    () =>
      assessLaneIndependence({
        envelope,
        lane: { ...legalRepositoryLane(), unexpected: true },
      }),
    /Unsupported lane field/u,
  );
  assert.throws(
    () =>
      recommendDelegation({
        envelope,
        contextPack,
        laneCandidates: [
          {
            ...legalRepositoryLane(),
            allowedTools: ['repository-read', 'workspace-edit'],
          },
        ],
      }),
    /workspace-edit requires explicit writeOwnership/u,
  );
});

test('child contract policy remains advisory and does not own runtime lifecycle', () => {
  const source = readFileSync(resolve(repoRoot, 'scripts/agents/child-task-contract.mjs'), 'utf8');

  assert.doesNotMatch(source, /node:child_process|spawn_agent|exec_command|create_goal/u);
  assert.doesNotMatch(source, /retry\s*\(|respawn|tmux/u);
});

function legalRepositoryLane() {
  return {
    id: 'legal-repository-map',
    domain: 'legal',
    taskKind: 'lookup',
    priority: 'medium',
    objective: 'Map the current Legal policy, FE, BFF, BE, contract, and test surfaces.',
    question: 'Which current repository owners and executable boundaries implement Legal?',
    allowedEvidence: ['repo', 'test'],
    allowedTools: ['repository-read'],
    readScope: [
      'docs/policies',
      'apps/web/src/legal',
      'apps/api/src/legal',
      'packages/shared/src/legal',
    ],
    writeOwnership: [],
    dependencies: [],
    expectedOutputFields: ['owners', 'paths', 'contracts', 'tests'],
    verification: ['Every claimed owner cites a current repository path.'],
    benefit: {
      kind: 'completeness',
      rationale:
        'A bounded repository map can be collected independently from official legal research.',
    },
  };
}

function legalOfficialLane() {
  return {
    id: 'legal-official-evidence',
    domain: 'legal-policy',
    taskKind: 'research',
    priority: 'high',
    risk: 'high',
    objective: 'Collect only current official legal evidence relevant to the repository surface.',
    question: 'Which current official sources constrain the Legal surface and where are gaps?',
    allowedEvidence: ['official-current'],
    allowedTools: ['official-web-read'],
    readScope: ['https://www.law.go.kr'],
    writeOwnership: [],
    dependencies: [],
    expectedOutputFields: ['officialSources', 'datedConstraints'],
    verification: ['Every external claim includes a direct official URL and verification date.'],
    benefit: {
      kind: 'specialist-evidence',
      rationale:
        'Fresh legal evidence is independent from repository mapping and needs a research role.',
    },
  };
}

function implementationLane({ id, writeOwnership, dependencies = [] }) {
  return {
    id,
    domain: 'legal',
    taskKind: 'implementation',
    objective: `Implement the bounded ${id} owner change.`,
    question: `What change is required within ${id} ownership?`,
    readScope: ['docs/policies/legal-basis.md'],
    writeOwnership,
    dependencies,
    expectedOutputFields: ['changedFiles', 'behavior'],
    verification: ['Run the closest owner tests.'],
    benefit: {
      kind: 'latency',
      rationale:
        'The lane is useful only if it has distinct write ownership and no result dependency.',
    },
  };
}
