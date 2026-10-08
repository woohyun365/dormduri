import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import { recommendDelegation } from '../../../agents/codex/child-task-contract.mjs';
import { discoverContextPack } from '../../../agents/common/domain-guide-registry.mjs';
import { buildTaskEnvelope } from '../../../agents/common/intake-policy.mjs';
import {
  createSemanticEvidenceId,
  createSemanticFactId,
  createSemanticSourceId,
} from '../../../agents/codex/routing-policy.mjs';
import {
  createDispatchRecommendation,
  evaluateRecovery,
  prepareLeaderSynthesis,
} from '../../../agents/codex/orchestration-policy.mjs';
import { FIXTURE_DISPATCH_TOKEN, observedChildren } from './fixtures/subagent-hook-observation.mjs';

const repoRoot = resolve(import.meta.dirname, '../../../..');
const fixtures = JSON.parse(
  readFileSync(
    resolve(repoRoot, 'scripts/ci/agents/common/fixtures/agent-intake-cases.json'),
    'utf8',
  ),
);
const analyzeOutputFields = new Set([
  'scope',
  'facts',
  'problems',
  'inferences',
  'gaps',
  'recommendations',
  'confidence',
]);
const planOutputFields = new Set([
  'planId',
  'objective',
  'nonGoals',
  'baseline',
  'facts',
  'inferences',
  'gaps',
  'decisions',
  'openQuestions',
  'dependencies',
  'phases',
  'verificationMatrix',
  'risks',
  'mitigations',
  'finalAcceptance',
]);

test('supplied incompatible context stops dispatch while preserving the complete handoff', () => {
  const fixture = fixtureById('legal-analysis');
  const options = {
    repositoryEvidence: legalEvidence({ officialVerified: false }),
    laneCandidates: legalLanes('analyze'),
  };
  const legacy = evaluateFixture(fixture, options);
  const first = legacy.delegation.recommendedChildren[0];
  // The project hook denies a full-history fork, so this supplied context cannot become a spawn.
  const request = {
    purpose: 'task',
    mode: 'full-history',
    rationale: 'The lane would need the earlier discussion.',
    snapshot: 'integration-fixture-v1',
    evidencePointers: [first.boundary.readScope[0]],
    findings: ['Keep unverified official authority as a gap.'],
    failures: ['Do not lose failed verification evidence.'],
    previous: null,
  };
  const flow = evaluateFixture(fixture, {
    ...options,
    deliveryByLane: { [first.laneId]: request },
  });
  const supplied = flow.delegation.recommendedChildren.find(
    ({ laneId }) => laneId === first.laneId,
  );
  const { contextDelivery, ...unchanged } = supplied;
  assert.deepEqual(unchanged, first);
  assert.equal(contextDelivery.compatible, false);
  assert.deepEqual(contextDelivery.gaps, ['full-history-fork-denied']);
  assert.equal(contextDelivery.applied, false);
  assert.deepEqual(contextDelivery.failures, request.failures);
  assert.equal(flow.dispatch.execution, 'leader-sequential');
  assert.deepEqual(flow.dispatch.dispatches, []);
  assert.ok(flow.dispatch.gaps.includes(`context-delivery-incompatible:${first.laneId}`));
  assert.deepEqual(flow.delegation.limits, legacy.delegation.limits);
  const later = recommendDelegation({ envelope: flow.envelope, contextPack: flow.contextPack });
  assert.deepEqual(later.recommendedChildren, []);
});

test('Legal Analyze stays read-only while discovering repository surfaces and current-source gaps', () => {
  const fixture = fixtureById('legal-analysis');
  const flow = evaluateFixture(fixture, {
    repositoryEvidence: legalEvidence({ officialVerified: false }),
    laneCandidates: legalLanes('analyze'),
  });

  assertEnvelopeMatchesFixture(flow.envelope, fixture);
  assertRequiredDomains(flow.contextPack, fixture.expected.requiredDomains);
  assert.deepEqual(flow.contextPack.selectedGuides, []);
  assert.ok(flow.contextPack.gaps.some((gap) => gap.startsWith('external-source-unverified:')));
  assert.deepEqual(artifactAuthority(flow.envelope), { mutate: false, planArtifact: false });
  assert.equal(flow.delegation.execution, 'bounded-lanes');
  assert.equal(flow.dispatch.execution, 'native-bounded-dispatch');
  assert.deepEqual(flow.dispatch.dispatches.map(({ agentType }) => agentType).sort(), [
    'knu_explorer_xhigh',
    'knu_researcher_xhigh',
  ]);
  assert.ok(
    flow.delegation.recommendedChildren.every(
      ({ boundary, allowed }) => boundary.readOnly && !allowed.tools.includes('workspace-edit'),
    ),
  );
  assert.deepEqual(new Set(fixture.expected.outputFields), analyzeOutputFields);

  const synthesis = prepareLeaderSynthesis({
    delegation: flow.delegation,
    childResults: flow.delegation.recommendedChildren.map((contract) =>
      completedChildResult(contract, {
        preserveCurrentSourceGap: contract.laneId === 'legal-current-authority',
      }),
    ),
    hookObservation: observedChildren(flow.delegation),
    dispatchToken: FIXTURE_DISPATCH_TOKEN,
  });

  assert.equal(synthesis.readyForLeaderDecision, true);
  assert.ok(synthesis.gaps.some(({ statement }) => /current official source/u.test(statement)));
  assert.deepEqual(synthesis.leaderOwnership, {
    finalDecision: true,
    finalUserResponse: true,
    integration: true,
    finalVerification: true,
  });
});

test('Legal Plan selects tracked authoring guides without granting implementation authority', () => {
  const fixture = fixtureById('legal-plan');
  const flow = evaluateFixture(fixture, {
    repositoryEvidence: legalEvidence({ officialVerified: true }),
    laneCandidates: legalLanes('plan'),
  });

  assertEnvelopeMatchesFixture(flow.envelope, fixture);
  assertRequiredDomains(flow.contextPack, fixture.expected.requiredDomains);
  assert.deepEqual(artifactAuthority(flow.envelope), { mutate: false, planArtifact: true });
  assert.deepEqual(
    flow.contextPack.selectedGuides.map(({ path }) => path),
    [
      'docs/development/agent-workflows/plan-authoring/core.md',
      'docs/development/agent-workflows/plan-authoring/frontend.md',
      'docs/development/agent-workflows/plan-authoring/cross-cutting/security-privacy.md',
    ],
  );
  assert.equal(flow.contextPack.gaps.length, 0);
  assert.equal(flow.delegation.execution, 'bounded-lanes');
  assert.equal(flow.dispatch.execution, 'native-bounded-dispatch');
  assert.deepEqual(new Set(fixture.expected.outputFields), planOutputFields);

  const synthesis = prepareLeaderSynthesis({
    delegation: flow.delegation,
    childResults: flow.delegation.recommendedChildren.map((contract) =>
      completedChildResult(contract),
    ),
    hookObservation: observedChildren(flow.delegation),
    dispatchToken: FIXTURE_DISPATCH_TOKEN,
  });

  assert.equal(synthesis.readyForLeaderDecision, true);
  assert.equal(synthesis.leaderOwnership.finalDecision, true);
  assert.equal(synthesis.leaderOwnership.finalVerification, true);
});

test('direct requests remain child-free and do not load plan-authoring guidance', () => {
  const fixture = fixtureById('direct-path');
  const flow = evaluateFixture(fixture, {
    repositoryEvidence: [{ path: 'AGENTS.md', kind: 'changed-file' }],
  });

  assertEnvelopeMatchesFixture(flow.envelope, fixture);
  assert.deepEqual(artifactAuthority(flow.envelope), { mutate: false, planArtifact: false });
  assert.deepEqual(flow.contextPack.selectedGuides, []);
  assert.equal(flow.delegation.execution, 'direct');
  assert.deepEqual(flow.delegation.recommendedChildren, []);
  assert.equal(flow.dispatch.execution, 'leader-direct');
  assert.deepEqual(flow.dispatch.dispatches, []);
});

test('ambiguous Legal mutation requests fail closed before delegation', () => {
  const fixture = fixtureById('ambiguity-oq');
  const flow = evaluateFixture(fixture, {
    repositoryEvidence: legalEvidence({ officialVerified: false }),
    laneCandidates: legalLanes('analyze'),
  });

  assertEnvelopeMatchesFixture(flow.envelope, fixture);
  assert.equal(flow.envelope.ambiguities[0].disposition, 'clarify-now');
  assert.deepEqual(artifactAuthority(flow.envelope), { mutate: false, planArtifact: false });
  assert.deepEqual(flow.contextPack.selectedGuides, []);
  assert.equal(flow.delegation.execution, 'single-sequential');
  assert.deepEqual(flow.delegation.recommendedChildren, []);
  assert.equal(flow.dispatch.execution, 'leader-sequential');
  assert.deepEqual(flow.dispatch.dispatches, []);
});

test('official-source recovery stops after one distinct alternate and preserves the blocker', () => {
  const fixture = fixtureById('retry-ceiling');
  const envelope = buildTaskEnvelope({ request: fixture.request });
  const contextPack = discoverContextPack({
    envelope,
    repositoryEvidence: [
      {
        path: 'https://www.law.go.kr/',
        kind: 'external-source',
        reason: 'Current official evidence required by the request.',
      },
    ],
  });

  assert.equal(envelope.intent, fixture.expected.intent);
  assert.ok(contextPack.gaps.some((gap) => gap.startsWith('external-source-unverified:')));

  const primary = {
    approachId: 'official-direct',
    alternateOf: null,
    outcome: 'failure',
    failureCategory: fixture.scenario.firstFailure,
    evidence: 'The direct official source could not be reached.',
  };
  // An official research lane on 6.1 Sol: a source failure changes the approach on the same contract.
  const route = { role: 'knu_researcher', profileId: 'standard-read' };
  const firstDecision = evaluateRecovery({
    laneId: 'official-evidence',
    route,
    attempts: [primary],
  });

  assert.equal(firstDecision.action, 'alternate-once');
  assert.equal(firstDecision.retryRoute.kind, 'same-contract');
  assert.equal(firstDecision.retryRoute.model, 'gpt-6.1-sol');
  assert.equal(firstDecision.remainingAlternateAttempts, 1);

  const alternate = {
    approachId: 'official-owner-index',
    alternateOf: primary.approachId,
    outcome: 'failure',
    failureCategory: 'official-source-unavailable',
    evidence: 'The alternate official owner index was also unavailable.',
  };
  const terminal = evaluateRecovery({
    laneId: 'official-evidence',
    route,
    attempts: [primary, alternate],
  });

  assert.equal(terminal.action, 'terminal-handoff');
  assert.equal(terminal.disposition, 'evidence-gap');
  assert.equal(terminal.maxAlternateAttempts, fixture.expected.maxAlternateAttempts);
  assert.equal(terminal.remainingAlternateAttempts, 0);
  assert.match(terminal.blocker, /alternate official owner index/u);
  assert.throws(
    () =>
      evaluateRecovery({
        laneId: 'official-evidence',
        route,
        attempts: [
          primary,
          alternate,
          {
            approachId: 'third-attempt',
            alternateOf: alternate.approachId,
            outcome: 'failure',
            failureCategory: 'official-source-unavailable',
            evidence: 'A third attempt must never be accepted.',
          },
        ],
      }),
    /at most one alternate/u,
  );
});

test('the integrated intake path remains advisory and cannot write files or invoke children', () => {
  for (const path of [
    'scripts/agents/common/intake-policy.mjs',
    'scripts/agents/common/domain-guide-registry.mjs',
    'scripts/agents/codex/child-task-contract.mjs',
    'scripts/agents/codex/orchestration-policy.mjs',
  ]) {
    const source = readFileSync(resolve(repoRoot, path), 'utf8');

    assert.doesNotMatch(source, /from ['"]node:(?:fs|child_process)['"]/u, path);
    assert.doesNotMatch(
      source,
      /\b(?:appendFile|apply_patch|execSync|rm|spawnSync|spawn_agent|unlink|writeFile)\s*\(/u,
      path,
    );
  }
});

function evaluateFixture(
  fixture,
  { repositoryEvidence = [], laneCandidates = [], deliveryByLane = {} } = {},
) {
  assertRepositoryEvidenceExists(repositoryEvidence);
  const envelope = buildTaskEnvelope({ request: fixture.request });
  const contextPack = discoverContextPack({ envelope, repositoryEvidence });
  const delegation = recommendDelegation({
    envelope,
    contextPack,
    deliveryByLane,
    laneCandidates: laneCandidates.map((lane) => ({
      ...lane,
      pass2Evidence: semanticEvidence(
        contextPack,
        lane.taskKind === 'research' ? 'SEC-07-official-evidence' : 'SEC-05-disclosure',
      ),
    })),
  });
  const dispatch = createDispatchRecommendation({ delegation });

  return { envelope, contextPack, delegation, dispatch };
}

function fixtureById(id) {
  const fixture = fixtures.find((candidate) => candidate.id === id);
  assert.ok(fixture, `Missing intake fixture: ${id}`);
  return fixture;
}

function assertEnvelopeMatchesFixture(envelope, fixture) {
  assert.equal(envelope.intent, fixture.expected.intent);
  assert.equal(envelope.authorizedAction, fixture.expected.authorizedAction);
  assert.equal(envelope.recommendedPath, fixture.expected.recommendedPath);
  assert.deepEqual(envelope.requiredEvidence, fixture.expected.requiredEvidence);
}

function assertRequiredDomains(contextPack, requiredDomains) {
  const actual = new Set(contextPack.domainCandidates.map(({ domain }) => domain));
  for (const domain of requiredDomains) assert.ok(actual.has(domain), `Missing domain: ${domain}`);
}

function assertRepositoryEvidenceExists(repositoryEvidence) {
  for (const { path } of repositoryEvidence) {
    if (!path.startsWith('https://')) {
      assert.equal(
        existsSync(resolve(repoRoot, path)),
        true,
        `Missing repository evidence: ${path}`,
      );
    }
  }
}

function artifactAuthority(envelope) {
  return {
    mutate: envelope.authorizedAction === 'mutate',
    planArtifact: envelope.authorizedAction === 'produce-plan',
  };
}

function legalEvidence({ officialVerified }) {
  return [
    { path: 'docs/policies/legal-basis.md', kind: 'policy' },
    { path: 'apps/web/src/legal/README.md', kind: 'owner-readme' },
    { path: 'apps/web/src/app/api/legal/documents/active-bundle/route.ts', kind: 'bff' },
    { path: 'apps/api/src/legal/legal.controller.ts', kind: 'controller' },
    { path: 'packages/shared/src/legal/contract.ts', kind: 'contract' },
    { path: 'apps/web/src/legal/__tests__/legal-document-pages.test.tsx', kind: 'test' },
    { path: 'apps/api/src/legal/contracts/legal-public-api.spec.ts', kind: 'test' },
    {
      path: 'https://www.law.go.kr/',
      kind: 'external-source',
      reason:
        'Current official legal authority must be verified separately from repository policy.',
      ...(officialVerified ? { verifiedAt: '2026-08-13T00:00:00.000Z' } : {}),
    },
  ];
}

function legalLanes(outputKind) {
  const planning = outputKind === 'plan';
  return [
    {
      id: 'legal-repository-surfaces',
      domain: 'legal-policy',
      taskKind: planning ? 'architecture' : 'analysis',
      priority: 'high',
      impactRisk: 'high',
      objective: planning
        ? 'Map current Legal FE, BFF, API, contract, policy, and test ownership for planning.'
        : 'Analyze current Legal policy, FE, BFF, API, contract, and test responsibilities.',
      question: 'Which current repository facts, problems, and ownership boundaries affect Legal?',
      allowedEvidence: ['repo', 'test'],
      allowedTools: ['repository-read'],
      readScope: [
        'docs/policies/legal-basis.md',
        'apps/web/src/legal',
        'apps/web/src/app/api/legal',
        'apps/api/src/legal',
        'packages/shared/src/legal',
      ],
      writeOwnership: [],
      dependencies: [],
      expectedOutputFields: planning
        ? ['decisions', 'dependencies', 'phases', 'verificationMatrix', 'finalAcceptance']
        : ['problems', 'recommendations'],
      verification: ['Every repository fact cites a current path or executable test.'],
      benefit: {
        kind: 'completeness',
        rationale: 'The repository lane can inspect bounded local ownership independently.',
      },
    },
    {
      id: 'legal-current-authority',
      domain: 'legal-policy',
      taskKind: 'research',
      priority: 'high',
      impactRisk: 'high',
      objective: 'Verify current official legal authority without treating recall as evidence.',
      question: 'Which current official sources support or limit the repository Legal claims?',
      allowedEvidence: ['official-current'],
      allowedTools: ['official-web-read'],
      readScope: ['https://www.law.go.kr/'],
      writeOwnership: [],
      dependencies: [],
      expectedOutputFields: planning ? ['currentClaims', 'openQuestions'] : ['currentClaims'],
      verification: ['Every current legal claim includes a directly verified official source.'],
      benefit: {
        kind: 'specialist-evidence',
        rationale:
          'Current external authority can be researched independently from repository mapping.',
      },
    },
  ];
}

function semanticEvidence(contextPack, predicateId) {
  const current =
    contextPack.sources.find(({ path }) => path === 'docs/policies/legal-basis.md') ??
    contextPack.sources[0];
  const source = {
    path: current.path,
    locator: `fixture:${predicateId}`,
    kind: current.kind,
    observedAt: current.verifiedAt ?? current.freshness,
    contentDigest: `sha256:${'c'.repeat(64)}`,
  };
  source.sourceId = createSemanticSourceId(source);
  const fact = {
    statement: `Current intake evidence supports ${predicateId}.`,
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
      rationale: `The current source supports ${predicateId}.`,
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

function completedChildResult(contract, { preserveCurrentSourceGap = false } = {}) {
  const outputFields = contract.expectedOutputSchema.required.filter(
    (field) => !['facts', 'inferences', 'gaps', 'confidence'].includes(field),
  );
  return {
    laneId: contract.laneId,
    status: 'completed',
    outputs: Object.fromEntries(outputFields.map((field) => [field, [`fixture-${field}`]])),
    facts: [
      {
        statement: `Bounded evidence was collected for ${contract.laneId}.`,
        source: `fixture:${contract.laneId}`,
      },
    ],
    inferences: [
      {
        statement: `The ${contract.laneId} result remains advisory until leader synthesis.`,
        confidence: 'high',
      },
    ],
    gaps: preserveCurrentSourceGap
      ? [
          {
            statement: 'A current official source was not verified in the fixture.',
            impact: 'The leader must present current legal conclusions as an evidence gap.',
            blocking: false,
          },
        ]
      : [],
    confidence: preserveCurrentSourceGap ? 'medium' : 'high',
    verification: [
      {
        claim: `The ${contract.laneId} output follows its bounded contract.`,
        evidence: `fixture:${contract.laneId}:contract-check`,
        status: 'passed',
      },
    ],
    blocker: null,
  };
}
