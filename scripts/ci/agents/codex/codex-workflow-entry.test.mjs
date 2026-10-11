import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { recommendDelegation } from '../../../agents/codex/child-task-contract.mjs';
import { getModelProfile } from '../../../agents/codex/model-profiles.mjs';
import {
  createDispatchRecommendation,
  evaluateRecovery,
} from '../../../agents/codex/orchestration-policy.mjs';
import {
  createSemanticSourceId,
  createSemanticFactId,
  createSemanticEvidenceId,
} from '../../../agents/codex/routing-policy.mjs';
import {
  prepareCodexWorkflow,
  validateCodexWorkflowResults,
} from '../../../agents/codex/workflow-entry.mjs';
import {
  acceptedChildren,
  FIXTURE_DISPATCH_TOKEN,
  observedChildren,
  observedReviews,
} from './fixtures/subagent-hook-observation.mjs';
const requests = {
  answer: 'API 코드의 역할을 설명해줘.',
  analyze: 'API 오류 원인을 분석해줘.',
  plan: 'API 변경 계획을 작성해줘.',
  implement: 'API 응답에 필드를 추가해줘.',
  review: 'API 변경을 리뷰해줘.',
  debug: 'API 재현 오류를 고쳐줘.',
};
const snapshot = {
  baseSHA: 'a'.repeat(40),
  headSHA: 'b'.repeat(40),
  dirtyDiffDigest: null,
  untrackedInputDigests: [],
};
const identity = {
  sourceDigest: `sha256:${'c'.repeat(64)}`,
  configDigest: `sha256:${'d'.repeat(64)}`,
};
const assignment = {
  owner: 'parent',
  dispatchId: 'direct-1',
  acceptance: ['specified evidence checked'],
  writeOwnership: [],
};
function input(intent = 'answer', mode = 'fresh') {
  return {
    request: requests[intent],
    mode,
    currentSnapshot: snapshot,
    adapterIdentity: identity,
    directAssignment: assignment,
    reviewDisposition: {
      required: ['implement', 'review', 'debug'].includes(intent),
      reason: 'Current task risk assessed against qa.md.',
    },
  };
}
function result(workflow) {
  const lane = workflow.lanes[0];
  return {
    resultId: 'result-1',
    dispatchId: lane.dispatchId,
    laneId: lane.id,
    owner: lane.owner,
    hostId: 'codex',
    adapterIdentity: identity,
    sourceSnapshot: snapshot,
    status: 'complete',
    checks: ['actual source read'],
    findings: [],
    gaps: [],
    changedPaths: [],
  };
}
for (const mode of ['fresh', 'resume'])
  for (const intent of Object.keys(requests))
    test(`${intent}/${mode}: actual Codex caller composes common route and result contract`, () => {
      const i = input(intent, mode),
        w = prepareCodexWorkflow(i);
      assert.equal(w.route.host, 'codex');
      assert.equal(w.route.intent, intent);
      assert.equal(w.route.mode, mode);
      assert.equal(w.dispatchAuthorized, false);
      assert.deepEqual(
        w.contextPack.selectedGuides,
        intent === 'plan' ? w.contextPack.selectedGuides : [],
      );
      assert.equal(w.laneValidation.valid, true);
      const checked = validateCodexWorkflowResults(i, { results: [result(w)] });
      assert.equal(checked.fanIn.valid, true);
      assert.equal(checked.dispatchAuthorized, false);
      assert.equal(checked.valid, !['implement', 'review', 'debug'].includes(intent));
      const wrong = result(w);
      wrong.hostId = 'claude-code';
      assert.equal(validateCodexWorkflowResults(i, { results: [wrong] }).valid, false);
    });
test('CLI routes six intents without private plan/runtime data or provider processes', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'codex-entry-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const mode of ['fresh', 'resume'])
    for (const [intent, request] of Object.entries(requests)) {
      const p = spawnSync(
        process.execPath,
        [
          new URL('../../../agents/codex/workflow-entry.mjs', import.meta.url).pathname,
          '--',
          '--request',
          request,
          '--mode',
          mode,
          '--json',
        ],
        { cwd: root, encoding: 'utf8', timeout: 10000 },
      );
      assert.equal(p.status, 0, p.stderr);
      const w = JSON.parse(p.stdout);
      assert.equal(w.route.intent, intent);
      assert.equal(w.plan, null);
      assert.equal(w.runtimeQualified, false);
    }
});
test('common authority, missing receipt, stale source and writes fail closed', () => {
  assert.throws(
    () =>
      prepareCodexWorkflow({
        ...input('analyze'),
        directAssignment: { ...assignment, writeOwnership: ['apps/api'] },
      }),
    /write exceeds/,
  );
  const i = input(),
    w = prepareCodexWorkflow(i),
    r = result(w);
  assert.equal(validateCodexWorkflowResults(i, { results: [] }).valid, false);
  assert.equal(
    validateCodexWorkflowResults(i, {
      results: [{ ...r, sourceSnapshot: { ...snapshot, headSHA: 'e'.repeat(40) } }],
    }).valid,
    false,
  );
  assert.equal(
    validateCodexWorkflowResults(i, { results: [{ ...r, changedPaths: ['apps/web'] }] }).valid,
    false,
  );
  assert.throws(() => prepareCodexWorkflow({ ...i, mode: 'auto' }));
  assert.throws(() => prepareCodexWorkflow({ ...i, planPath: '.plans/x.md' }), /resume/);
});
test('canonical selected plan gates resume; continuation is candidate only', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'codex-plans-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, '.plans'));
  const path = '.plans/selected.md';
  writeFileSync(
    join(root, path),
    '- Plan ID: selected\n- Status: active\n## Work\n' + 'x'.repeat(100000),
  );
  mkdirSync(join(root, '.plans/supporting'));
  writeFileSync(
    join(root, '.plans/supporting/detail.md'),
    '- Document Type: reference\n- Status: narrative\n',
  );
  const source = { branch: 'fixture', head: 'b'.repeat(40), diffHash: 'f'.repeat(64) };
  const i = {
    ...input('analyze', 'resume'),
    root,
    planPath: path,
    continuation: {
      expectedPlanId: 'selected',
      checkpointSnapshot: source,
      currentSnapshot: source,
    },
  };
  const w = prepareCodexWorkflow(i);
  assert.equal(w.continuation.decision, 'candidate');
  assert.equal(w.plan.complete, false);
  assert.equal(w.plan.identityComplete, true);
  assert.equal(
    prepareCodexWorkflow({
      ...i,
      continuation: { ...i.continuation, currentSnapshot: { ...source, diffHash: 'a'.repeat(64) } },
    }).continuation.decision,
    'needs-review',
  );
  assert.equal(w.continuation.grantsExecutionAuthority, false);
  writeFileSync(join(root, path), '- Plan ID: selected\n- Status: cancelled\n');
  assert.equal(prepareCodexWorkflow(i).continuation.decision, 'needs-review');
  assert.equal(validateCodexWorkflowResults(i, { results: [result(w)] }).valid, false);
});
test('plan readiness uses existing validator and cannot create execution authority', () => {
  const readiness = JSON.parse(
    readFileSync(
      new URL('../../../agents/fixtures/plan-readiness/implementation-ready.json', import.meta.url),
    ),
  );
  const w = prepareCodexWorkflow({ ...input('plan'), planReadiness: readiness });
  assert.equal(w.planReadiness.ready, true);
  assert.equal(w.dispatchAuthorized, false);
  assert.throws(
    () => prepareCodexWorkflow({ ...input('answer'), planReadiness: readiness }),
    /plan intent/,
  );
});
test('QA uses common exchange validation, never accepts self review or substitutes runtime proof', () => {
  const qa = JSON.parse(
    readFileSync(new URL('../common/fixtures/cross-model-handoff-cases.json', import.meta.url)),
  );
  qa.basePacket.objective = requests.review;
  qa.baseResult.acceptanceCoverage[0].criterion = assignment.acceptance[0];
  const i = {
    ...input('review'),
    currentSnapshot: qa.basePacket.snapshot,
    directAssignment: { ...assignment, owner: qa.basePacket.authority.writeOwner },
  };
  const w = prepareCodexWorkflow(i),
    r = { ...result(w), sourceSnapshot: qa.basePacket.snapshot };
  const review = {
    reviewerId: 'independent',
    builderIds: [qa.basePacket.authority.writeOwner],
    packet: qa.basePacket,
    result: qa.baseResult,
    currentSnapshot: qa.basePacket.snapshot,
  };
  const valid = validateCodexWorkflowResults(i, { results: [r], review });
  assert.equal(valid.valid, true, JSON.stringify(valid));
  assert.equal(valid.runtimeQualified, false);
  assert.equal(
    validateCodexWorkflowResults(i, {
      results: [r],
      review: { ...review, reviewerId: qa.basePacket.authority.writeOwner },
    }).valid,
    false,
  );
});

test('QA for a different task or owner cannot complete the current workflow', () => {
  const qa = JSON.parse(
    readFileSync(new URL('../common/fixtures/cross-model-handoff-cases.json', import.meta.url)),
  );
  const i = { ...input('implement'), currentSnapshot: qa.basePacket.snapshot };
  const w = prepareCodexWorkflow(i);
  const checked = validateCodexWorkflowResults(i, {
    results: [{ ...result(w), sourceSnapshot: qa.basePacket.snapshot }],
    review: {
      reviewerId: 'independent',
      builderIds: [qa.basePacket.authority.writeOwner],
      packet: qa.basePacket,
      result: qa.baseResult,
    },
  });
  assert.equal(checked.valid, false);
  assert.ok(checked.errors.some((x) => x.includes('objective')));
});

function reviewCase() {
  const qa = JSON.parse(
    readFileSync(new URL('../common/fixtures/cross-model-handoff-cases.json', import.meta.url)),
  );
  const i = {
    ...input('implement'),
    currentSnapshot: qa.basePacket.snapshot,
    directAssignment: {
      ...assignment,
      owner: qa.basePacket.authority.writeOwner,
      writeOwnership: ['apps/api'],
    },
  };
  qa.basePacket.objective = i.request;
  qa.basePacket.boundaries.allowedReadPaths.push('apps/api');
  qa.baseResult.acceptanceCoverage[0].criterion = assignment.acceptance[0];
  const review = {
    reviewerId: 'independent',
    builderIds: [i.directAssignment.owner],
    packet: qa.basePacket,
    result: qa.baseResult,
  };
  const r = { ...result(prepareCodexWorkflow(i)), sourceSnapshot: i.currentSnapshot };
  return { i, review, r };
}
test('QA must cover lane acceptance and assigned write scope, not just task title', () => {
  const { i, review, r } = reviewCase();
  assert.equal(validateCodexWorkflowResults(i, { results: [r], review }).valid, true);
  review.result.acceptanceCoverage[0].criterion = 'Unrelated handoff schema';
  assert.equal(validateCodexWorkflowResults(i, { results: [r], review }).valid, false);
  review.result.acceptanceCoverage[0].criterion = assignment.acceptance[0];
  review.packet.boundaries.allowedReadPaths = ['docs'];
  assert.equal(validateCodexWorkflowResults(i, { results: [r], review }).valid, false);
});
test('QA FAIL/BLOCKED is a valid exchange but cannot satisfy completion', () => {
  for (const verdict of ['FAIL', 'BLOCKED']) {
    const { i, review, r } = reviewCase();
    review.result.verdict = verdict;
    const checked = validateCodexWorkflowResults(i, { results: [r], review });
    assert.equal(checked.valid, false);
  }
});
test('explicit justified direct QA disposition is preserved; missing disposition is a gap', () => {
  const i = {
    ...input('debug'),
    request: '문서의 오타를 고쳐줘.',
    reviewDisposition: { required: false, reason: 'Typo only; no independent QA risk trigger.' },
  };
  assert.equal(
    validateCodexWorkflowResults(i, { results: [result(prepareCodexWorkflow(i))] }).valid,
    true,
  );
  delete i.reviewDisposition;
  assert.equal(
    validateCodexWorkflowResults(i, { results: [result(prepareCodexWorkflow(i))] }).valid,
    false,
  );
  assert.throws(
    () => prepareCodexWorkflow({ ...i, reviewDisposition: { required: false } }),
    /disposition/,
  );
});

// Same positive semantic predicates as the existing cohort oracle, through the actual caller.
function boundedInput() {
  const i = {
    ...input('implement'),
    request: 'Legal test 구현해줘.',
    directAssignment: undefined,
    repositoryEvidence: [{ path: 'docs/policies/legal-basis.md', kind: 'policy' }],
    reviewDisposition: { required: false, reason: 'Probe cannot waive mandatory cohort QA.' },
    assignments: { 'legal-test': { owner: 'builder', dispatchId: 'child-1' } },
  };
  const current = prepareCodexWorkflow({ ...i, assignments: {} }).contextPack.sources[0];
  const parts = Array.from({ length: 15 }, (_, index) => {
    const predicateId = `M-${String(index + 1).padStart(2, '0')}`;
    const source = {
      path: current.path,
      kind: current.kind,
      observedAt: current.verifiedAt ?? current.freshness,
      locator: `fixture:${predicateId}`,
      contentDigest: `sha256:${'a'.repeat(64)}`,
    };
    source.sourceId = createSemanticSourceId(source);
    const fact = {
      statement: `Bounded verification requirement ${index}`,
      sourceIds: [source.sourceId],
      confidence: 'high',
    };
    fact.factId = createSemanticFactId(fact);
    const claim = {
      predicateId,
      outcome: 'confirmed',
      factIds: [fact.factId],
      semanticMatch: { matches: true, rationale: `The inspected source supports ${predicateId}.` },
      compositeCategory: null,
    };
    claim.evidenceId = createSemanticEvidenceId(claim);
    return { source, fact, claim };
  });
  const evidence = {
    sources: parts.map((p) => p.source),
    facts: parts.map((p) => p.fact),
    predicateClaims: parts.map((p) => p.claim),
    inferences: [],
    gaps: [],
    confidence: 'high',
  };
  i.laneCandidates = [
    {
      id: 'legal-test',
      domain: 'legal-policy',
      taskKind: 'implementation',
      priority: 'medium',
      impactRisk: 'low',
      objective: 'Implement bounded legal test.',
      question: 'Which assertion locks current behavior?',
      allowedEvidence: ['repo', 'test'],
      allowedTools: ['repository-read', 'workspace-edit', 'test-runner'],
      readScope: ['docs/policies'],
      writeOwnership: ['apps/web/src/legal/example.test.ts'],
      dependencies: [],
      expectedOutputFields: ['changedFiles', 'behavior'],
      verification: ['Run the closest owner tests.'],
      benefit: {
        kind: 'latency',
        rationale: 'The write lane has bounded ownership and no result dependency.',
      },
      pass2Evidence: evidence,
      modelRequest: {
        profileId: 'standard-build',
        purpose: 'pilot',
        verificationFacts: {
          acceptance: evidence.facts[0].factId,
          regression: evidence.facts[1].factId,
          astraQa: evidence.facts[2].factId,
        },
      },
    },
  ];
  return i;
}
test('bounded actual caller preserves leaf model/effort/recovery policy and enforces scope binding', () => {
  const i = boundedInput(),
    w = prepareCodexWorkflow(i);
  assert.equal(w.lanes.length, 1);
  assert.equal(w.requiresIndependentReview, true);
  assert.equal(w.requiresAstraReview, true);
  assert.equal(
    w.delegation.recommendedChildren[0].routeRecommendation.modelRecommendation.recommendedModel,
    'gpt-6.1-sol',
  );
  const leaf = recommendDelegation({
    envelope: w.envelope,
    contextPack: w.contextPack,
    laneCandidates: i.laneCandidates,
  });
  assert.deepEqual(w.delegation, leaf);
  assert.deepEqual(w.dispatch, createDispatchRecommendation({ delegation: leaf }));
  // Removed runtime and admission inputs are refused rather than silently ignored.
  for (const key of ['reportedRuntimeEvidence', 'modelUseByLane'])
    assert.throws(() => prepareCodexWorkflow({ ...i, [key]: {} }), {
      name: 'TypeError',
      message: `Unsupported workflow input: ${key}`,
    });
  assert.deepEqual(w.lanes[0].writeOwnership, i.laneCandidates[0].writeOwnership);
  assert.equal(validateCodexWorkflowResults(i, { results: [result(w)] }).valid, false);
  assert.ok(prepareCodexWorkflow({ ...i, assignments: {} }).gaps.length);
  assert.throws(
    () =>
      prepareCodexWorkflow({
        ...i,
        assignments: { 'legal-test': { ...i.assignments['legal-test'], writeOwnership: ['apps'] } },
      }),
    /override/,
  );
  const qa = JSON.parse(
    readFileSync(new URL('../common/fixtures/cross-model-handoff-cases.json', import.meta.url)),
  );
  i.currentSnapshot = qa.basePacket.snapshot;
  qa.basePacket.objective = i.request;
  qa.basePacket.authority.writeOwner = 'builder';
  qa.basePacket.boundaries.allowedReadPaths = ['docs/policies', 'apps/web/src/legal'];
  qa.baseResult.acceptanceCoverage[0].criterion = w.lanes[0].acceptance[0];
  const review = {
    reviewerId: 'independent',
    builderIds: ['builder'],
    packet: qa.basePacket,
    result: qa.baseResult,
  };
  const r = { ...result(prepareCodexWorkflow(i)), sourceSnapshot: i.currentSnapshot };
  assert.equal(validateCodexWorkflowResults(i, { results: [r], review }).valid, false);
  qa.baseResult.identity.observedModel = 'gpt-6-astra';
  // A reported complete child lane is not accepted until its own hook records bind it.
  assert.deepEqual(validateCodexWorkflowResults(i, { results: [r], review }).errors, [
    'child lane legal-test completion refused: dispatch-token-missing',
  ]);
  i.dispatchToken = FIXTURE_DISPATCH_TOKEN;
  // With hook records the QA result must come from the registered reviewer child of this dispatch.
  qa.basePacket.lifecycle.dispatchId = 'review-disp1-1';
  qa.baseResult.dispatchId = 'review-disp1-1';
  const reviewed = (observation, reviews = observedReviews({ laneIds: ['legal-test'] })) => ({
    ...observation,
    records: [...observation.records, ...reviews.records],
  });
  const settled = (observation, extra = {}) => ({
    results: [r],
    review,
    hookObservation: observation,
    acceptances: acceptedChildren(observation),
    ...extra,
  });
  // The workflow forwards the token, so the spawn name binds this dispatch's own hook records. An ordinary lane shows
  // it: the candidate above has no supplied scoped context, so its dispatch stays sequential.
  const ordinary = structuredClone(i);
  delete ordinary.laneCandidates[0].modelRequest;
  assert.deepEqual(
    prepareCodexWorkflow(ordinary).dispatch.dispatches.map(
      ({ spawnArguments }) => spawnArguments.task_name,
    ),
    [`legal_test_${FIXTURE_DISPATCH_TOKEN}`],
  );
  const reportedOnly = validateCodexWorkflowResults(i, { results: [r], review });
  assert.equal(reportedOnly.valid, false, 'a refused child lane invalidates the fan-in');
  assert.deepEqual(reportedOnly.errors, [
    'child lane legal-test completion refused: observation-missing',
  ]);
  const solChild = reviewed(observedChildren(w.delegation, { model: 'gpt-6.1-sol' }));
  const observed = validateCodexWorkflowResults(i, settled(solChild));
  assert.equal(observed.valid, true, JSON.stringify(observed.errors));
  assert.deepEqual(
    observed.completionChecks.map(({ laneId, accepted }) => [laneId, accepted]),
    [['legal-test', true]],
  );
  // The lane contract asks for 6.1 Sol; an allowed Astra child of the same role does not complete it.
  const [legalTest] = w.delegation.recommendedChildren;
  assert.equal(getModelProfile(legalTest.routeRecommendation.profileId).model, 'gpt-6.1-sol');
  assert.deepEqual(
    validateCodexWorkflowResults(
      i,
      settled(reviewed(observedChildren(w.delegation, { model: 'gpt-6-astra' }))),
    ).errors,
    ['child lane legal-test completion refused: model-mismatch'],
  );
  // The 6.1 Sol attempt failed its result quality and retried one rung up: the Astra retry child completes the lane
  // only with its recovery decision, which names the retry route and task path.
  const { role, profileId } = legalTest.routeRecommendation;
  const retried = evaluateRecovery({
    laneId: 'legal-test',
    route: { role, profileId },
    attempts: [
      {
        approachId: 'primary',
        outcome: 'failure',
        failureCategory: 'verification-failed',
        evidence: 'The oracle failed.',
      },
      {
        approachId: 'astra-retry',
        alternateOf: 'primary',
        outcome: 'success',
        evidence: 'Passed.',
      },
    ],
  });
  const onRetry = reviewed(
    observedChildren(w.delegation, {
      model: 'gpt-6-astra',
      retryLaneIds: ['legal-test'],
    }),
  );
  const retryChecked = validateCodexWorkflowResults(
    i,
    settled(onRetry, { recoveryDecisions: [retried] }),
  );
  assert.equal(retryChecked.valid, true, JSON.stringify(retryChecked.errors));
  for (const [recoveryDecisions, message] of [
    [retried, 'recoveryDecisions must be an array.'],
    [[{ ...retried, laneId: 'missing-lane' }], 'Recovery references an unknown lane: missing-lane'],
    [[retried, retried], 'recovery laneId values must be unique.'],
    // A complete result cannot carry a pending or terminal decision, and every decision is checked.
    [
      [
        evaluateRecovery({
          laneId: 'legal-test',
          route: { role, profileId },
          attempts: [
            retried.attempts[0],
            { ...retried.attempts[1], outcome: 'failure', failureCategory: 'verification-failed' },
          ],
        }),
      ],
      'A completed child result cannot have a pending or terminal recovery.',
    ],
    [[{ laneId: 'legal-test' }], 'recovery decision must use the bounded schema.'],
    [[null], 'recovery decision must be an object.'],
  ])
    assert.throws(
      () =>
        validateCodexWorkflowResults(i, {
          results: [r],
          review,
          hookObservation: onRetry,
          recoveryDecisions,
        }),
      { name: 'TypeError', message },
    );
  assert.throws(
    () =>
      validateCodexWorkflowResults(i, {
        results: [],
        review,
        hookObservation: onRetry,
        recoveryDecisions: [{ laneId: 'legal-test' }],
      }),
    { name: 'TypeError', message: 'recovery decision must use the bounded schema.' },
  );
  assert.deepEqual(validateCodexWorkflowResults(i, settled(onRetry)).errors, [
    'child lane legal-test completion refused: retry-unreported',
  ]);
  assert.deepEqual(
    validateCodexWorkflowResults(
      i,
      settled(reviewed(observedChildren(w.delegation, { bind: false }))),
    ).errors,
    ['child lane legal-test completion refused: observation-unbound'],
  );
  const foreign = reviewed(observedChildren(w.delegation, { agentType: 'default' }));
  assert.deepEqual(validateCodexWorkflowResults(i, settled(foreign)).errors, [
    'child lane legal-test completion refused: role-not-in-roster',
  ]);
  // Acceptance: each complete child lane and every reviewer child under the token needs its acceptance record.
  assert.deepEqual(validateCodexWorkflowResults(i, settled(solChild, { acceptances: [] })).errors, [
    'child lane legal-test completion refused: acceptance-missing',
    'QA reviewer review_disp1_1 completion refused: acceptance-missing',
  ]);
  for (const options of [settled(solChild, { acceptances: {} }), { results: [], acceptances: {} }])
    assert.throws(() => validateCodexWorkflowResults(i, options), {
      name: 'TypeError',
      message: 'acceptances must be an array.',
    });
  // A resumed child is no longer the accepted one.
  const resumedStop = (observation, agentPath) => ({
    ...observation,
    records: [
      ...observation.records,
      {
        ...observation.records.findLast((record) => record.agentPath === agentPath),
        lastMessageBytes: 7,
      },
    ],
  });
  const acceptedSol = acceptedChildren(solChild);
  assert.deepEqual(
    validateCodexWorkflowResults(i, {
      ...settled(resumedStop(solChild, '/root/legal_test_disp1')),
      acceptances: acceptedSol,
    }).errors,
    ['child lane legal-test completion refused: resumed-after-acceptance'],
  );
  assert.deepEqual(
    validateCodexWorkflowResults(i, {
      ...settled(resumedStop(solChild, '/root/review_disp1_1')),
      acceptances: acceptedSol,
    }).errors,
    ['QA reviewer review_disp1_1 completion refused: resumed-after-acceptance'],
  );
  // Success ends the lane: an accepted primary child refuses the retry child's completion.
  assert.deepEqual(
    validateCodexWorkflowResults(
      i,
      settled(onRetry, {
        recoveryDecisions: [retried],
        acceptances: [
          ...acceptedChildren(onRetry),
          ...acceptedChildren(solChild, { only: ['legal_test_disp1'] }),
        ],
      }),
    ).errors,
    ['child lane legal-test completion refused: lane-accepted'],
  );
  // Reviewer binding: a registered reviewer spawn on the review profile, covering every lane, whose latest round
  // reported the result; an earlier sibling round stays bound by its own acceptance.
  const lanesOnly = observedChildren(w.delegation, { model: 'gpt-6.1-sol' });
  assert.deepEqual(validateCodexWorkflowResults(i, settled(lanesOnly)).errors, [
    'QA review has no registered reviewer spawn under this dispatch token',
  ]);
  assert.deepEqual(
    validateCodexWorkflowResults(
      i,
      settled(reviewed(lanesOnly, observedReviews({ laneIds: ['other-lane'] }))),
    ).errors,
    ['QA review registration must cover every current lane'],
  );
  const twoRounds = reviewed(
    lanesOnly,
    observedReviews({ laneIds: ['legal-test'], rounds: [1, 2] }),
  );
  assert.deepEqual(validateCodexWorkflowResults(i, settled(twoRounds)).errors, [
    'QA result must come from the latest registered review round',
  ]);
  qa.basePacket.lifecycle.dispatchId = 'review-disp1-2';
  qa.baseResult.dispatchId = 'review-disp1-2';
  assert.equal(validateCodexWorkflowResults(i, settled(twoRounds)).valid, true);
  assert.deepEqual(
    validateCodexWorkflowResults(i, {
      ...settled(twoRounds),
      acceptances: acceptedChildren(twoRounds, { only: ['legal_test_disp1', 'review_disp1_2'] }),
    }).errors,
    ['QA reviewer review_disp1_1 completion refused: acceptance-missing'],
  );
  // Every reviewer task under the token counts, whatever its seal says: a round sealed with fields that do not spell
  // its task name, or spawned without an allow record, is refused and still sets the latest round.
  {
    const reportRoundOne = (observation, acceptances = acceptedChildren(observation)) => {
      qa.basePacket.lifecycle.dispatchId = 'review-disp1-1';
      qa.baseResult.dispatchId = 'review-disp1-1';
      const verdict = validateCodexWorkflowResults(i, { ...settled(observation), acceptances });
      qa.basePacket.lifecycle.dispatchId = 'review-disp1-2';
      qa.baseResult.dispatchId = 'review-disp1-2';
      return verdict;
    };
    const roundTwo = (change) => {
      const observation = structuredClone(twoRounds);
      change(observation);
      return observation;
    };
    const sealOf = (observation) =>
      observation.records.find(({ registration }) => registration?.round === 2).registration;
    const roundOneAccepted = acceptedChildren(twoRounds, {
      only: ['legal_test_disp1', 'review_disp1_1'],
    });
    for (const [label, observation, reason, acceptances] of [
      [
        'kind lane',
        roundTwo((o) => (sealOf(o).kind = 'lane')),
        'registration-mismatch',
        roundOneAccepted,
      ],
      [
        'other token',
        roundTwo((o) => (sealOf(o).dispatchToken = 'zzzz')),
        'registration-invalid',
        roundOneAccepted,
      ],
      [
        'no allow record',
        roundTwo((o) => {
          o.records = o.records.filter(({ registration }) => registration?.round !== 2);
        }),
        'observation-unbound',
        roundOneAccepted,
      ],
      [
        'round-one review id',
        roundTwo((o) => (sealOf(o).reviewId = 'review-disp1-1')),
        'registration-invalid',
      ],
      ['round one', roundTwo((o) => (sealOf(o).round = 1)), 'registration-invalid'],
    ]) {
      const verdict = reportRoundOne(observation, acceptances);
      assert.equal(verdict.valid, false, label);
      assert.ok(
        verdict.errors.includes(`QA reviewer review_disp1_2 completion refused: ${reason}`),
        `${label}: ${JSON.stringify(verdict.errors)}`,
      );
      assert.ok(
        verdict.errors.includes('QA result must come from the latest registered review round'),
        `${label}: ${JSON.stringify(verdict.errors)}`,
      );
    }
  }
  qa.basePacket.lifecycle.dispatchId = 'review-disp1-1';
  qa.baseResult.dispatchId = 'review-disp1-1';
  assert.deepEqual(
    validateCodexWorkflowResults(
      i,
      settled(
        reviewed(lanesOnly, observedReviews({ laneIds: ['legal-test'], model: 'gpt-6.1-sol' })),
      ),
    ).errors,
    ['QA reviewer review_disp1_1 completion refused: pair-not-allowed'],
  );
  // A sealed round that is not a positive integer is refused before its task path is computed.
  assert.deepEqual(
    validateCodexWorkflowResults(
      i,
      settled(reviewed(lanesOnly, observedReviews({ laneIds: ['legal-test'], rounds: [0] }))),
    ).errors,
    [
      'QA reviewer review_disp1_0 completion refused: registration-invalid',
      'QA result must come from the latest registered review round',
    ],
  );
  // Another token's reviewer does not bind this dispatch's QA.
  assert.deepEqual(
    validateCodexWorkflowResults(
      i,
      settled(
        reviewed(lanesOnly, observedReviews({ laneIds: ['legal-test'], dispatchToken: 'disp9' })),
      ),
    ).errors,
    ['QA review has no registered reviewer spawn under this dispatch token'],
  );
});

test('malformed QA coverage returns invalid rather than throwing after structural rejection', () => {
  const { i, review, r } = reviewCase();
  for (const coverage of [[null], [42], {}, null]) {
    review.result.acceptanceCoverage = coverage;
    assert.equal(validateCodexWorkflowResults(i, { results: [r], review }).valid, false);
  }
});

test('same-host reviewer extension preserves Codex independent QA and builder completion gates', () => {
  const { i, review, r } = reviewCase();
  review.packet.intent.direction = 'same-host-independent-review';
  const accepted = validateCodexWorkflowResults(i, { results: [r], review });
  assert.equal(accepted.valid, true, JSON.stringify(accepted.errors));
  assert.equal(accepted.runtimeQualified, false);
  assert.equal(accepted.dispatchAuthorized, false);
  for (const mutate of [
    (q) => {
      q.reviewerId = q.builderIds[0];
    },
    (q) => {
      q.packet.review.freshContext = false;
    },
    (q) => {
      q.result.verdict = 'FAIL';
    },
    (q) => {
      q.result.reviewedSnapshot.headSHA = 'f'.repeat(40);
    },
    (q) => {
      q.result.acceptanceCoverage = [];
    },
  ]) {
    const bad = structuredClone(review);
    mutate(bad);
    assert.equal(validateCodexWorkflowResults(i, { results: [r], review: bad }).valid, false);
  }
  assert.equal(validateCodexWorkflowResults(i, { results: [r] }).valid, false);
});
