import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createSemanticEvidenceId,
  createSemanticFactId,
  createSemanticSourceId,
  selectAgentRoute,
  normalizeModelRequest,
} from '../../../agents/codex/routing-policy.mjs';
import { ALLOWED_CHILD_MODELS } from '../../../agents/codex/model-profiles.mjs';

const UNLISTED_MODEL = 'gpt-x-unlisted';

const TASK_KINDS = [
  'lookup',
  'analysis',
  'implementation',
  'debugging',
  'test',
  'research',
  'verification',
  'architecture',
  'review',
];

test('optional model advice keeps the semantic tier and admits a candidate role only with quality evidence', () => {
  for (const [taskKind, model, cohort, profileId, role] of [
    ['lookup', 'gpt-6.1-sol', 'bounded-read-only', 'standard-read', 'knu_explorer'],
    ['research', 'gpt-6.1-sol', 'bounded-read-only', 'standard-read', 'knu_researcher'],
    ['implementation', 'gpt-6.1-sol', 'bounded-implementation', 'standard-build', 'knu_executor'],
    ['test', 'gpt-6.1-sol', 'bounded-implementation', 'standard-build', 'knu_executor'],
  ]) {
    const input = routeInput({ taskKind, impactRisk: 'low', predicateIds: mediumPredicateIds() });
    const legacy = selectAgentRoute(input);
    input.modelRequest = {
      profileId,
      purpose: 'pilot',
      verificationFacts: modelVerification(input.pass2Evidence, cohort),
    };
    const result = selectAgentRoute(input);
    assert.equal(legacy.modelRecommendation, undefined);
    assert.equal(result.tier, legacy.tier);
    assert.equal(legacy.role, `${role}_medium`);
    assert.equal(result.role, role);
    assert.equal(result.effort, 'high');
    assert.equal(result.modelRecommendation.recommendedModel, model);
    assert.equal(result.modelRecommendation.status, 'candidate');
    assert.equal(result.modelRecommendation.applied, false);
  }
});

test('model advice retains Astra for risk, QA, uncertainty and missing boundedness', () => {
  const cases = [
    { taskKind: 'architecture' },
    { taskKind: 'review' },
    { taskKind: 'verification' },
    { taskKind: 'debugging' },
    { impactRisk: 'high' },
    { predicateIds: ['M-01'] },
    ...[
      'BE-01-concurrency-transaction',
      'BE-02-migration-backfill',
      'BE-06-auth-session',
      'FE-06-auth-browser-trust',
      'X-01',
    ].map((predicate) => ({ predicateIds: [...mediumPredicateIds(), predicate] })),
  ];
  for (const patch of cases) {
    const input = routeInput({
      taskKind: 'lookup',
      impactRisk: 'low',
      predicateIds: mediumPredicateIds(),
      ...patch,
    });
    input.modelRequest = {
      profileId: 'standard-read',
      purpose: 'pilot',
      verificationFacts: modelVerification(input.pass2Evidence),
    };
    assert.equal(
      selectAgentRoute(input).modelRecommendation.recommendedModel,
      'gpt-6-astra',
      JSON.stringify(patch),
    );
  }
  for (const mutate of [
    (input) => {
      input.pass2Evidence.gaps.push('unknown root cause');
    },
    (input) => {
      input.pass2Evidence.confidence = 'medium';
    },
    (input) => {
      input.modelRequest.verificationFacts.acceptance = 'fact-absent';
    },
  ]) {
    const input = routeInput({
      taskKind: 'lookup',
      impactRisk: 'low',
      predicateIds: mediumPredicateIds(),
    });
    input.modelRequest = {
      profileId: 'standard-read',
      purpose: 'pilot',
      verificationFacts: modelVerification(input.pass2Evidence),
    };
    mutate(input);
    assert.equal(selectAgentRoute(input).modelRecommendation.status, 'baseline');
  }
});

test('model request is strict and cannot create children for deterministic work', () => {
  for (const [model, cohort] of [
    [UNLISTED_MODEL, 'bounded-implementation'],
    [UNLISTED_MODEL, 'bounded-read-only'],
    [UNLISTED_MODEL, 'bounded-extraction'],
  ]) {
    const keys =
      cohort === 'bounded-implementation'
        ? ['acceptance', 'regression', 'astraQa']
        : cohort === 'bounded-read-only'
          ? ['acceptance', 'independentCheck']
          : ['acceptance', 'fixedInput', 'outputSchema', 'singleStep', 'independentCheck'];
    assert.throws(
      () =>
        normalizeModelRequest({
          model,
          cohort,
          purpose: 'pilot',
          verificationFacts: Object.fromEntries(keys.map((k) => [k, 'fact-original'])),
        }),
      TypeError,
    );
  }
  const input = routeInput({ predicateIds: mediumPredicateIds() });
  const request = {
    profileId: 'standard-build',
    purpose: 'pilot',
    verificationFacts: modelVerification(input.pass2Evidence, 'bounded-implementation'),
  };
  for (const patch of [
    { model: 'unknown-model' },
    // Raw models are never request input, whether or not the allowlist holds them.
    ...[UNLISTED_MODEL, ...ALLOWED_CHILD_MODELS].map((model) => ({ model })),
    { profileId: 'unknown-profile' },
    { cohort: 'bounded-implementation' },
    { pilot: true },
    { purpose: 'adopt' },
    { verificationFacts: {} },
  ]) {
    assert.throws(
      () => selectAgentRoute({ ...input, modelRequest: { ...request, ...patch } }),
      TypeError,
    );
  }
  const direct = selectAgentRoute({
    ...input,
    modelRequest: request,
    pass1: { ...input.pass1, executionShape: 'direct' },
  });
  assert.equal(direct.spawn, false);
});

test('keeps direct and missing-Pass-2 work child-free without claiming parent effort', () => {
  const direct = selectAgentRoute({
    pass1: pass1({ taskKind: 'lookup', executionShape: 'direct' }),
  });
  const missingPass2 = selectAgentRoute({ pass1: pass1() });

  assert.deepEqual(direct, {
    spawn: false,
    role: null,
    effort: null,
    execution: 'direct',
    reason: 'Pass 1 selected a direct path; repository child routing is not applied.',
    gaps: [],
  });
  assert.equal(missingPass2.spawn, false);
  assert.equal(missingPass2.execution, 'single-sequential');
  assert.equal(missingPass2.effort, null);
  assert.match(missingPass2.gaps.join(' '), /pass2-semantic-evidence-required/u);
  assert.equal('parentEffort' in missingPass2, false);
});

test('derives Medium only from complete positive boundedness evidence', () => {
  const result = selectAgentRoute(routeInput({ predicateIds: mediumPredicateIds() }));

  assert.equal(result.spawn, true);
  assert.equal(result.role, 'knu_executor_medium');
  assert.equal(result.tier, 'medium');
  assert.equal(result.effort, 'medium');
  assert.equal(result.assessment.mediumEligibility, true);
  assert.equal(result.assessment.reasoningComplexity, 'bounded');
  assert.deepEqual(result.assessment.xhighSignals, []);

  const incomplete = selectAgentRoute(
    routeInput({ predicateIds: mediumPredicateIds().slice(0, -1) }),
  );
  assert.equal(incomplete.tier, 'high');
  assert.equal(incomplete.assessment.mediumEligibility, false);
  assert.equal(incomplete.assessment.reasoningComplexity, 'substantial');
});

test('selects XHigh from semantic concurrency evidence regardless of task label or impact risk', () => {
  for (const taskKind of ['analysis', 'implementation', 'debugging', 'test', 'review']) {
    const result = selectAgentRoute(
      routeInput({
        taskKind,
        impactRisk: 'low',
        predicateIds: ['X-02', 'BE-01-concurrency-transaction'],
      }),
    );

    assert.equal(result.tier, 'xhigh', taskKind);
    assert.equal(result.assessment.reasoningComplexity, 'deep', taskKind);
    assert.equal(result.assessment.xhighSignals.includes('X-02'), true, taskKind);
  }

  const lexicalOnly = selectAgentRoute(
    routeInput({
      impactRisk: 'high',
      predicateIds: ['FE-05-browser-runtime'],
      statement: 'The request text mentions transaction migration critical xhigh.',
    }),
  );
  assert.equal(lexicalOnly.tier, 'high');
  assert.deepEqual(lexicalOnly.assessment.xhighSignals, []);
});

test('covers migration, lifecycle, auth, persisted contract, CI control-plane, and privacy XHigh signals', () => {
  const cases = [
    ['analysis', 'BE-02-migration-backfill'],
    ['implementation', 'BE-03-multi-lifecycle'],
    ['debugging', 'BE-06-auth-session'],
    ['test', 'BE-04-contract-persistence'],
    ['verification', 'INF-01-ci-control-plane'],
    ['review', 'SEC-02-sensitive-lifecycle'],
  ];

  for (const [taskKind, predicateId] of cases) {
    const result = selectAgentRoute(routeInput({ taskKind, predicateIds: [predicateId] }));
    assert.equal(result.tier, 'xhigh', `${taskKind}:${predicateId}`);
    assert.equal(result.assessment.xhighSignals.includes(predicateId), true, predicateId);
  }

  const broadVerificationOnly = selectAgentRoute(
    routeInput({
      claims: [claimSpec('INF-07-ci-performance', 'broad-verification')],
    }),
  );
  assert.equal(broadVerificationOnly.tier, 'high');
  assert.equal(broadVerificationOnly.assessment.deepComposite, false);
});

test('the same Pass 1 request can resolve to Medium, High, or XHigh from current evidence', () => {
  const common = { taskKind: 'debugging', impactRisk: 'medium' };
  const medium = selectAgentRoute(routeInput({ ...common, predicateIds: mediumPredicateIds() }));
  const high = selectAgentRoute(
    routeInput({ ...common, predicateIds: ['FE-08-performance-causal'] }),
  );
  const xhigh = selectAgentRoute(
    routeInput({ ...common, predicateIds: ['X-07', 'BE-01-concurrency-transaction'] }),
  );

  assert.deepEqual([medium.tier, high.tier, xhigh.tier], ['medium', 'high', 'xhigh']);
  // Debugging is a build: XHigh without high impact runs on the high executor (deep-build).
  assert.deepEqual([medium.effort, high.effort, xhigh.effort], ['medium', 'high', 'high']);
  assert.deepEqual(
    [medium.impactRisk, high.impactRisk, xhigh.impactRisk],
    ['medium', 'medium', 'medium'],
  );
});

test('derives DeepComposite from unique fact/category assignments with a structural category', () => {
  const result = selectAgentRoute(
    routeInput({
      claims: [
        claimSpec('FE-01-public-contract-crossing', 'cross-owner'),
        claimSpec('SEC-05-disclosure', 'public-contract'),
        claimSpec('INF-05-environment-parity', 'external-provider/release'),
      ],
    }),
  );

  assert.equal(result.tier, 'xhigh');
  assert.equal(result.assessment.deepComposite, true);
  assert.deepEqual(result.assessment.compositeCategories, [
    'cross-owner',
    'external-provider/release',
    'public-contract',
  ]);
});

test('rejects duplicate-fact category amplification and stale or orphan evidence', () => {
  const duplicated = routeInput({
    claims: [
      claimSpec('FE-01-public-contract-crossing', 'cross-owner', 'shared'),
      claimSpec('SEC-05-disclosure', 'public-contract', 'shared'),
      claimSpec('INF-05-environment-parity', 'external-provider/release', 'shared'),
    ],
  });
  const duplicateResult = selectAgentRoute(duplicated);
  assert.equal(duplicateResult.spawn, false);
  assert.match(duplicateResult.gaps.join(' '), /duplicate-fact-composite-category/u);

  const stale = routeInput({ predicateIds: ['X-02'] });
  stale.contextPack.sources[0].freshness = '2026-01-01T00:00:00.000Z';
  const staleResult = selectAgentRoute(stale);
  assert.equal(staleResult.spawn, false);
  assert.match(staleResult.gaps.join(' '), /stale-source/u);

  const orphan = routeInput({ predicateIds: ['X-02'] });
  orphan.pass2Evidence.predicateClaims[0].factIds = ['fact-does-not-exist'];
  orphan.pass2Evidence.predicateClaims[0].evidenceId = createSemanticEvidenceId(
    orphan.pass2Evidence.predicateClaims[0],
  );
  const orphanResult = selectAgentRoute(orphan);
  assert.equal(orphanResult.spawn, false);
  assert.match(orphanResult.gaps.join(' '), /orphan-fact/u);
});

test('rejects malformed stable IDs, semantic mismatches, and caller-supplied conclusions', () => {
  const malformed = routeInput({ predicateIds: ['X-02'] });
  malformed.pass2Evidence.facts[0].factId = 'fact-caller-invented';
  const malformedResult = selectAgentRoute(malformed);
  assert.equal(malformedResult.spawn, false);
  assert.match(malformedResult.gaps.join(' '), /malformed-fact-id/u);

  const mismatch = routeInput({ predicateIds: ['X-02'] });
  mismatch.pass2Evidence.predicateClaims[0].semanticMatch.matches = false;
  const mismatchResult = selectAgentRoute(mismatch);
  assert.equal(mismatchResult.spawn, false);
  assert.match(mismatchResult.gaps.join(' '), /semantic-mismatch/u);

  const injected = routeInput({ predicateIds: ['X-02'] });
  injected.pass2Evidence.mediumEligibility = true;
  assert.throws(() => selectAgentRoute(injected), /Unsupported Pass 2 evidence field/u);
});

test('maps semantic task kinds to project roles without treating the role as runtime proof', () => {
  const expected = {
    lookup: 'knu_explorer',
    analysis: 'knu_explorer',
    implementation: 'knu_executor',
    debugging: 'knu_executor',
    test: 'knu_executor',
    research: 'knu_researcher',
    verification: 'knu_reviewer',
    architecture: 'knu_reviewer',
    review: 'knu_reviewer',
  };

  for (const taskKind of TASK_KINDS) {
    const result = selectAgentRoute(
      routeInput({ taskKind, predicateIds: ['FE-05-browser-runtime'] }),
    );
    assert.equal(result.role, expected[taskKind], taskKind);
    assert.equal(['medium', 'high', 'xhigh'].includes(result.effort), true);
  }
});

test('keeps impact risk separate and rejects legacy critical/role-availability shortcuts', () => {
  const lowRisk = selectAgentRoute(
    routeInput({ impactRisk: 'low', predicateIds: mediumPredicateIds() }),
  );
  const highRisk = selectAgentRoute(
    routeInput({ impactRisk: 'high', predicateIds: mediumPredicateIds() }),
  );

  // Impact never changes the semantic tier; it selects the variant (a high-impact build is the xhigh executor).
  assert.equal(lowRisk.tier, 'medium');
  assert.equal(highRisk.tier, 'medium');
  assert.equal(lowRisk.role, 'knu_executor_medium');
  assert.equal(highRisk.role, 'knu_executor_xhigh');
  assert.notEqual(lowRisk.impactRisk, highRisk.impactRisk);
  const architecture = selectAgentRoute(
    routeInput({ taskKind: 'architecture', predicateIds: ['FE-05-browser-runtime'] }),
  );
  assert.equal(architecture.tier, 'high');
  assert.equal(architecture.effort, 'xhigh');
  assert.throws(
    () => selectAgentRoute({ pass1: pass1({ impactRisk: 'critical' }) }),
    /Unsupported impact risk/u,
  );
  assert.throws(
    () => selectAgentRoute({ ...routeInput(), roleRoutingAvailable: true }),
    /Unsupported routing input field/u,
  );
  assert.throws(
    () => selectAgentRoute({ ...routeInput(), fileCount: 3, loc: 40 }),
    /Unsupported routing input field/u,
  );
});

function routeInput({
  taskKind = 'implementation',
  impactRisk = 'medium',
  predicateIds,
  claims,
  statement = 'Current repository evidence supports the bounded semantic predicate.',
} = {}) {
  const source = {
    path: 'apps/api/src/auth/auth.service.ts',
    kind: 'changed-file',
    freshness: 'current-working-tree',
    verifiedAt: null,
    conflictStatus: 'none',
    authorityLevel: 'repository-evidence',
  };
  const inspectedSource = {
    path: source.path,
    locator: 'AuthService',
    kind: source.kind,
    observedAt: source.freshness,
    contentDigest: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  };
  inspectedSource.sourceId = createSemanticSourceId(inspectedSource);

  const claimInputs =
    claims ?? (predicateIds ?? ['FE-05-browser-runtime']).map((id) => claimSpec(id));
  const factsByKey = new Map();
  for (const { factKey = 'default' } of claimInputs) {
    if (!factsByKey.has(factKey)) {
      const factStatement = `${statement} (${factKey})`;
      factsByKey.set(factKey, {
        statement: factStatement,
        sourceIds: [inspectedSource.sourceId],
        confidence: 'high',
      });
    }
  }
  const facts = [...factsByKey.values()].map((fact) => ({
    ...fact,
    factId: createSemanticFactId(fact),
  }));
  const factIdByKey = new Map(
    [...factsByKey.keys()].map((key, index) => [key, facts[index].factId]),
  );
  const predicateClaims = claimInputs.map(({ predicateId, category, factKey = 'default' }) => {
    const claim = {
      predicateId,
      outcome: 'confirmed',
      factIds: [factIdByKey.get(factKey)],
      semanticMatch: {
        matches: true,
        rationale: `The current source supports ${predicateId}.`,
      },
      compositeCategory: category ?? null,
    };
    return { ...claim, evidenceId: createSemanticEvidenceId(claim) };
  });

  return {
    pass1: pass1({ taskKind, impactRisk }),
    contextPack: { sources: [source] },
    pass2Evidence: {
      sources: [inspectedSource],
      facts,
      predicateClaims,
      inferences: [],
      gaps: [],
      confidence: 'high',
    },
  };
}

function pass1({
  taskKind = 'implementation',
  executionShape = 'bounded-child',
  impactRisk = 'medium',
} = {}) {
  return {
    taskKind,
    executionShape,
    impactRisk,
    candidateRole: null,
    requiredEvidence: ['repo', 'test'],
    confidence: 'high',
  };
}

function claimSpec(predicateId, category = null, factKey = predicateId) {
  return { predicateId, category, factKey };
}

function mediumPredicateIds() {
  return Array.from({ length: 15 }, (_, index) => `M-${String(index + 1).padStart(2, '0')}`);
}

test('routes carry no transitional runtime placeholder', () => {
  // The project hook and completion check replace the leader-reported runtime confirmation this field deferred to.
  const result = selectAgentRoute(routeInput({ predicateIds: mediumPredicateIds() }));
  assert.equal(result.spawn, true);
  assert.equal('runtimeApplication' in result, false, 'runtimeApplication placeholder');
  assert.equal(
    result.gaps.includes('runtime-role-evidence-deferred'),
    false,
    'runtime evidence gap',
  );
});

function modelVerification(evidence, cohort = 'bounded-read-only') {
  const id = evidence.facts[0].factId;
  return cohort === 'bounded-read-only'
    ? { acceptance: id, independentCheck: id }
    : { acceptance: id, regression: id, astraQa: id };
}

test('Luna extraction requires low-impact finite semantic work and never replaces shell or QA', () => {
  const make = (patch = {}) => {
    const input = routeInput({
      taskKind: 'lookup',
      impactRisk: 'low',
      predicateIds: mediumPredicateIds(),
      ...patch,
    });
    const ids = input.pass2Evidence.facts.map(({ factId }) => factId);
    input.modelRequest = {
      profileId: 'extract',
      purpose: 'routine',
      verificationFacts: Object.fromEntries(
        ['acceptance', 'fixedInput', 'outputSchema', 'singleStep', 'independentCheck'].map(
          (key, i) => [key, ids[i]],
        ),
      ),
    };
    return input;
  };
  const result = selectAgentRoute(make());
  assert.equal(result.modelRecommendation.recommendedModel, 'gpt-6-luna');
  assert.equal(result.role, 'knu_explorer_xhigh');
  assert.equal(result.tier, 'medium');
  assert.equal(result.effort, 'xhigh');
  assert.equal(result.modelRecommendation.profileBinding.resolvedEffort, 'xhigh');
  for (const patch of [
    { impactRisk: 'medium' },
    { impactRisk: 'high' },
    ...['implementation', 'research', 'review', 'verification', 'architecture'].map((taskKind) => ({
      taskKind,
    })),
  ]) {
    assert.equal(selectAgentRoute(make(patch)).modelRecommendation.recommendedModel, 'gpt-6-astra');
  }
  for (const key of [
    'acceptance',
    'fixedInput',
    'outputSchema',
    'singleStep',
    'independentCheck',
  ]) {
    const missing = make();
    delete missing.modelRequest.verificationFacts[key];
    assert.throws(() => selectAgentRoute(missing), TypeError);
    const unknown = make();
    unknown.modelRequest.verificationFacts[key] = 'missing-fact';
    assert.equal(selectAgentRoute(unknown).modelRecommendation.status, 'baseline');
  }
  const uncertain = make();
  uncertain.pass2Evidence.gaps.push('incomplete input set');
  assert.equal(selectAgentRoute(uncertain).modelRecommendation.status, 'baseline');
  assert.equal(selectAgentRoute({ ...make(), childBenefit: false }).spawn, false);
});

test('researcher and explorer routine requests get the 6.1 Sol read profile like a pilot', () => {
  const input = routeInput({
    taskKind: 'research',
    impactRisk: 'low',
    predicateIds: mediumPredicateIds(),
  });
  input.modelRequest = {
    profileId: 'standard-read',
    purpose: 'routine',
    verificationFacts: modelVerification(input.pass2Evidence),
  };
  assert.equal(selectAgentRoute(input).modelRecommendation.status, 'candidate');
  assert.equal(selectAgentRoute(input).role, 'knu_researcher');
  const explorer = structuredClone(input);
  explorer.pass1.taskKind = 'lookup';
  assert.equal(selectAgentRoute(explorer).modelRecommendation.status, 'candidate');
  assert.equal(selectAgentRoute(explorer).role, 'knu_explorer');
  // Admission conditions still bind a routine request: an incomplete Medium falls back to the Astra assignment.
  const uncertain = structuredClone(input);
  uncertain.pass2Evidence.gaps.push('incomplete input set');
  assert.equal(selectAgentRoute(uncertain).modelRecommendation.status, 'baseline');
  assert.equal(selectAgentRoute(uncertain).profileId, 'astra-fallback');
});

// Effort structure: Pass 2 picks a role variant whose file pins effort, and a profile that names the model.
const HIGH_PREDICATES = mediumPredicateIds().slice(0, -1);
const XHIGH_PREDICATES = ['X-02'];

test('Pass 2 tier, task family and impact select the role variant, its pinned effort and the Astra profile', async () => {
  const { ROLE_EFFORTS } = await import('../../../agents/codex/model-profiles.mjs');
  // [taskKind, impactRisk, predicates, tier, role, profileId]
  for (const [taskKind, impactRisk, predicateIds, tier, role, profileId] of [
    ['lookup', 'low', mediumPredicateIds(), 'medium', 'knu_explorer_medium', 'astra-fallback'],
    ['research', 'medium', HIGH_PREDICATES, 'high', 'knu_researcher', 'astra-fallback'],
    ['analysis', 'low', XHIGH_PREDICATES, 'xhigh', 'knu_explorer_xhigh', 'astra-fallback'],
    ['lookup', 'high', mediumPredicateIds(), 'medium', 'knu_explorer_xhigh', 'astra-fallback'],
    [
      'implementation',
      'low',
      mediumPredicateIds(),
      'medium',
      'knu_executor_medium',
      'astra-fallback',
    ],
    ['debugging', 'medium', HIGH_PREDICATES, 'high', 'knu_executor', 'astra-fallback'],
    ['test', 'medium', XHIGH_PREDICATES, 'xhigh', 'knu_executor', 'deep-build'],
    ['implementation', 'high', mediumPredicateIds(), 'medium', 'knu_executor_xhigh', 'deep-build'],
    ['implementation', 'high', XHIGH_PREDICATES, 'xhigh', 'knu_executor_xhigh', 'deep-build'],
    ['review', 'low', mediumPredicateIds(), 'medium', 'knu_reviewer', 'review'],
    ['architecture', 'high', XHIGH_PREDICATES, 'xhigh', 'knu_reviewer', 'review'],
  ]) {
    const label = `${taskKind}/${impactRisk}/${tier}`;
    const result = selectAgentRoute(routeInput({ taskKind, impactRisk, predicateIds }));
    assert.equal(result.tier, tier, label);
    assert.equal(result.role, role, label);
    assert.equal(result.effort, ROLE_EFFORTS[role], label);
    assert.equal(result.profileId, profileId, label);
    assert.equal(result.modelRecommendation, undefined, label);
  }
});

test('6.1 Sol profiles admit pilot and routine requests on their own role variants', () => {
  for (const [taskKind, profileId, predicateIds, role, cohort] of [
    ['lookup', 'standard-read', mediumPredicateIds(), 'knu_explorer', 'bounded-read-only'],
    [
      'implementation',
      'standard-build',
      mediumPredicateIds(),
      'knu_executor',
      'bounded-implementation',
    ],
    ['research', 'elevated-read', HIGH_PREDICATES, 'knu_researcher_xhigh', 'bounded-read-only'],
    ['analysis', 'elevated-read', XHIGH_PREDICATES, 'knu_explorer_xhigh', 'bounded-read-only'],
    [
      'implementation',
      'elevated-build',
      HIGH_PREDICATES,
      'knu_executor_xhigh',
      'bounded-implementation',
    ],
  ]) {
    const label = `${profileId}/${taskKind}`;
    const input = routeInput({ taskKind, impactRisk: 'low', predicateIds });
    const verificationFacts = modelVerification(input.pass2Evidence, cohort);
    for (const purpose of ['pilot', 'routine']) {
      const route = selectAgentRoute({
        ...input,
        modelRequest: { profileId, purpose, verificationFacts },
      });
      assert.equal(route.modelRecommendation.status, 'candidate', `${label}/${purpose}`);
      assert.equal(
        route.modelRecommendation.recommendedModel,
        'gpt-6.1-sol',
        `${label}/${purpose}`,
      );
      assert.equal(route.role, role, `${label}/${purpose}`);
      assert.equal(route.modelRecommendation.role, role, `${label}/${purpose}`);
      assert.equal(route.profileId, profileId, `${label}/${purpose}`);
    }
  }
});

test('elevated pilots keep the bounded quality conditions and exclude deep or high-impact builds', () => {
  const pilot = (taskKind, impactRisk, predicateIds, profileId, cohort, mutate = () => {}) => {
    const input = routeInput({ taskKind, impactRisk, predicateIds });
    mutate(input);
    return selectAgentRoute({
      ...input,
      modelRequest: {
        profileId,
        purpose: 'pilot',
        verificationFacts: modelVerification(input.pass2Evidence, cohort),
      },
    });
  };
  const read = 'bounded-read-only';
  const build = 'bounded-implementation';
  assert.equal(
    pilot('lookup', 'high', mediumPredicateIds(), 'elevated-read', read).modelRecommendation.status,
    'candidate',
  );
  for (const result of [
    pilot('lookup', 'low', mediumPredicateIds(), 'elevated-read', read),
    pilot('lookup', 'low', HIGH_PREDICATES, 'standard-read', read),
    pilot('lookup', 'low', ['FE-08-performance-causal'], 'elevated-read', read),
    pilot('lookup', 'low', HIGH_PREDICATES, 'elevated-read', read, (input) => {
      input.pass2Evidence.gaps = ['missing owner'];
    }),
    pilot('implementation', 'low', XHIGH_PREDICATES, 'elevated-build', build),
    pilot('implementation', 'high', HIGH_PREDICATES, 'elevated-build', build),
    pilot('implementation', 'low', mediumPredicateIds(), 'elevated-build', build),
  ])
    assert.equal(result.modelRecommendation.status, 'baseline');
});

test('Luna extraction stays routine on the xhigh explorer and model requests need a candidate profile', () => {
  const input = routeInput({
    taskKind: 'lookup',
    impactRisk: 'low',
    predicateIds: mediumPredicateIds(),
  });
  const id = input.pass2Evidence.facts[0].factId;
  const verificationFacts = {
    acceptance: id,
    fixedInput: id,
    outputSchema: id,
    singleStep: id,
    independentCheck: id,
  };
  const result = selectAgentRoute({
    ...input,
    modelRequest: { profileId: 'extract', purpose: 'routine', verificationFacts },
  });
  assert.equal(result.modelRecommendation.status, 'candidate');
  assert.equal(result.modelRecommendation.recommendedModel, 'gpt-6-luna');
  assert.equal(result.role, 'knu_explorer_xhigh');
  assert.equal(result.effort, 'xhigh');
  assert.equal(result.profileId, 'extract');
  for (const profileId of ['deep-build', 'review', 'astra-fallback'])
    assert.throws(
      () => normalizeModelRequest({ profileId, purpose: 'pilot', verificationFacts: {} }),
      { name: 'TypeError', message: 'Model request needs a candidate profile.' },
    );
});
