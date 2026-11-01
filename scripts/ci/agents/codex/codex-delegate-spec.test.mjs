import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

import {
  createSemanticFactId,
  createSemanticSourceId,
} from '../../../agents/codex/routing-policy.mjs';
import {
  createReviewDispatch,
  registerDispatch,
  runRegistryCommand,
} from '../../../agents/codex/task-registry.mjs';

// Loaded dynamically so a missing module fails each test with its own reason, not the whole file at import.
const delegateSpec = await import('../../../agents/codex/delegate-spec.mjs').catch(() => ({}));

const root = resolve(import.meta.dirname, '../../../..');
const TOKEN = 'n4bspec1';
const SOURCE = 'docs/policies/legal-basis.md';

// A spec the Parent writes by hand: indices instead of ids, `verifies` tags instead of a verificationFacts map.
function spec(patch = {}) {
  const facts = [
    {
      statement: 'The policy names the legal basis owner.',
      sources: [0],
      confidence: 'high',
      verifies: ['acceptance'],
    },
    {
      statement: 'The Parent checks the owner against the policy section.',
      sources: [0],
      confidence: 'high',
      verifies: ['independentCheck'],
    },
    {
      statement: 'The policy section is the only legal basis source.',
      sources: [0],
      confidence: 'high',
    },
  ];
  const claims = Array.from({ length: 15 }, (_, index) => ({
    predicateId: `M-${String(index + 1).padStart(2, '0')}`,
    outcome: 'confirmed',
    facts: [index % 3],
    rationale: 'The inspected policy section supports this boundedness predicate.',
  }));
  const lane = {
    id: 'legal-read',
    domain: 'legal-policy',
    taskKind: 'lookup',
    priority: 'medium',
    impactRisk: 'low',
    objective: 'Find the bounded legal basis owner.',
    question: 'Which policy section names the legal basis owner?',
    allowedEvidence: ['repo'],
    allowedTools: ['repository-read'],
    readScope: ['docs/policies'],
    dependencies: [],
    expectedOutputFields: ['owner', 'evidence'],
    verification: ['Cite the policy section.'],
    benefit: {
      kind: 'latency',
      rationale: 'The read lane has a bounded scope and no result dependency.',
    },
    delivery: {
      snapshot: 'current-source-snapshot',
      evidencePointers: [SOURCE],
      findings: ['The legal basis owner is named in the policy.'],
      failures: [],
    },
    evidence: {
      sources: [{ path: SOURCE, locator: 'legal basis section' }],
      facts,
      claims,
      confidence: 'high',
    },
    ...patch.lane,
  };
  if (patch.evidence) Object.assign(lane.evidence, patch.evidence);
  return {
    request: '법적 근거 owner를 분석해줘.',
    mode: 'fresh',
    repositoryEvidence: [{ path: SOURCE, kind: 'policy' }],
    dispatchToken: TOKEN,
    lanes: [lane],
    ...patch.top,
  };
}

test('an eligible lane without a request gets the routine candidate and a registrable dispatch', () => {
  const out = delegateSpec.buildDelegation(spec(), { root });
  assert.equal(out.schema, 'knu-codex-delegation/v1');
  assert.equal(out.dispatchToken, TOKEN);
  assert.deepEqual(out.lanes, [
    {
      laneId: 'legal-read',
      modelRequest: 'default',
      profileId: 'standard-read',
      role: 'knu_explorer',
      effort: 'high',
      model: 'gpt-6.1-sol',
    },
  ]);
  assert.equal(out.dispatches.length, 1);
  assert.deepEqual(out.dispatches[0].spawnArguments, {
    task_name: `legal_read_${TOKEN}`,
    agent_type: 'knu_explorer',
    model: 'gpt-6.1-sol',
    reasoning_effort: 'high',
    fork_turns: 'none',
  });
  // The computed request names the facts the spec tagged, by their stable ids.
  const request = out.dispatches[0].contract.routeRecommendation.modelRecommendation.request;
  assert.deepEqual(request.purpose, 'routine');
  assert.deepEqual(Object.keys(request.verificationFacts), ['acceptance', 'independentCheck']);
  // Recomputed here from the file bytes: the source digest and every id derived from it.
  const source = {
    path: SOURCE,
    locator: 'legal basis section',
    kind: 'policy',
    observedAt: 'current-working-tree',
    contentDigest: `sha256:${createHash('sha256')
      .update(readFileSync(resolve(root, SOURCE)))
      .digest('hex')}`,
  };
  const sourceIds = [createSemanticSourceId(source)];
  const [acceptance, independentCheck] = spec().lanes[0].evidence.facts.map(({ statement }) =>
    createSemanticFactId({ statement, sourceIds, confidence: 'high' }),
  );
  assert.deepEqual(request.verificationFacts, { acceptance, independentCheck });
  // The output file is what codex:register reads.
  const temp = mkdtempSync(join(tmpdir(), 'knu-delegate-'));
  try {
    const registered = registerDispatch({
      root: temp,
      sessionId: 'n4b-test',
      dispatch: out.dispatches[0],
    });
    assert.equal(registered.taskName, `legal_read_${TOKEN}`);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});

test('an ineligible or opted-out lane keeps the request omitted and goes to the Astra assignment', () => {
  for (const [label, patch, modelRequest] of [
    ['gap', { evidence: { gaps: ['unknown owner'] } }, 'omitted'],
    ['medium confidence', { evidence: { confidence: 'medium' } }, 'omitted'],
    [
      'untagged facts',
      { evidence: { facts: spec().lanes[0].evidence.facts.map(({ verifies, ...fact }) => fact) } },
      'omitted',
    ],
    ['opt-out', { lane: { modelRequest: false } }, 'astra'],
  ]) {
    const out = delegateSpec.buildDelegation(spec(patch), { root });
    const [lane] = out.lanes;
    assert.equal(lane.modelRequest, modelRequest, label);
    assert.equal(lane.model, 'gpt-6-astra', label);
    assert.equal(out.dispatches[0].spawnArguments.model, 'gpt-6-astra', label);
    assert.equal(
      out.dispatches[0].contract.routeRecommendation.modelRecommendation,
      undefined,
      label,
    );
  }
});

test('a candidate without a scoped packet is deferred with the context gap', () => {
  const out = delegateSpec.buildDelegation(spec({ lane: { delivery: undefined } }), { root });
  assert.equal(out.dispatches.length, 0);
  assert.equal(out.lanes[0].modelRequest, 'default');
  assert.equal(out.lanes[0].deferred.stage, 'dispatch');
  assert.ok(
    out.lanes[0].deferred.gaps.includes('model-context-incompatible'),
    JSON.stringify(out.lanes[0]),
  );
});

// Live N4b: a lane without a confirmed claim beside a dispatched lane showed the dispatch-wide reason and no gap.
test('a lane the delegation defers names its own reason, not the dispatch of the other lanes', () => {
  const ready = spec().lanes[0];
  const bare = {
    ...ready,
    id: 'bare-lane',
    evidence: { ...ready.evidence, claims: [] },
  };
  const out = delegateSpec.buildDelegation(spec({ top: { lanes: [ready, bare] } }), { root });
  assert.deepEqual(
    out.dispatches.map(({ laneId }) => laneId),
    ['legal-read'],
  );
  const deferred = out.lanes.find(({ laneId }) => laneId === 'bare-lane').deferred;
  assert.equal(deferred.stage, 'delegation', JSON.stringify(deferred));
  assert.ok(
    deferred.reasons.some((reason) => /Pass 2 evidence is incomplete/u.test(reason)),
    JSON.stringify(deferred),
  );
});

test('an explicit request is kept as the Parent wrote it, with facts from the tags', () => {
  const out = delegateSpec.buildDelegation(
    spec({ lane: { modelRequest: { profileId: 'standard-read', purpose: 'pilot' } } }),
    { root },
  );
  assert.equal(out.lanes[0].modelRequest, 'explicit');
  const { request } = out.dispatches[0].contract.routeRecommendation.modelRecommendation;
  assert.equal(request.purpose, 'pilot');
  assert.equal(out.lanes[0].model, 'gpt-6.1-sol');
});

test('the spec is strict and refuses evidence the context pack cannot bind', () => {
  for (const [label, value, message] of [
    [
      'unknown top field',
      spec({ top: { laneCandidates: [] } }),
      /Unsupported delegation spec field: laneCandidates/u,
    ],
    [
      'unknown evidence field',
      spec({ evidence: { predicateClaims: [] } }),
      /Unsupported lane evidence field: predicateClaims/u,
    ],
    [
      'source outside the pack',
      spec({ evidence: { sources: [{ path: 'docs/README.md', locator: 'x' }] } }),
      /not in the context pack: docs\/README\.md/u,
    ],
    [
      'fact source index',
      spec({ evidence: { facts: [{ statement: 's', sources: [3], confidence: 'high' }] } }),
      /fact 0 names source 3/u,
    ],
    [
      'claim fact index',
      spec({
        evidence: {
          claims: [{ predicateId: 'M-01', outcome: 'confirmed', facts: [9], rationale: 'r' }],
        },
      }),
      /claim 0 names fact 9/u,
    ],
    [
      'verification key',
      spec({
        evidence: {
          facts: [{ statement: 's', sources: [0], confidence: 'high', verifies: ['oracle'] }],
        },
      }),
      /unknown verification key: oracle/u,
    ],
    ['bad token', spec({ top: { dispatchToken: 'Bad' } }), /dispatchToken/u],
  ])
    assert.throws(
      () => delegateSpec.buildDelegation(value, { root }),
      { name: 'TypeError', message },
      label,
    );
});

test('the CLI writes the delegation and the review dispatch files codex:register reads', () => {
  const temp = mkdtempSync(join(tmpdir(), 'knu-delegate-cli-'));
  try {
    const specPath = join(temp, 'spec.json');
    const outPath = join(temp, 'delegation.json');
    writeFileSync(specPath, `${JSON.stringify(spec(), null, 2)}\n`);
    const lanes = delegateSpec.runDelegateCommand(['lanes', '--spec', specPath, '--out', outPath], {
      root,
    });
    assert.equal(lanes.exitCode, 0);
    const written = JSON.parse(readFileSync(outPath, 'utf8'));
    assert.equal(written.dispatches[0].spawnArguments.task_name, `legal_read_${TOKEN}`);
    assert.deepEqual(JSON.parse(lanes.stdout).lanes, written.lanes);

    const reviewPath = join(temp, 'review.json');
    const review = delegateSpec.runDelegateCommand(
      ['review', '--lanes', 'legal-read', '--token', TOKEN, '--round', '2', '--out', reviewPath],
      { root },
    );
    assert.equal(review.exitCode, 0);
    assert.deepEqual(
      JSON.parse(readFileSync(reviewPath, 'utf8')),
      createReviewDispatch({ laneIds: ['legal-read'], dispatchToken: TOKEN, round: 2 }),
    );
    // Both written files go through the codex:register command as they are.
    const registryRoot = join(temp, 'registry-root');
    for (const [file, taskName] of [
      [outPath, `legal_read_${TOKEN}`],
      [reviewPath, `review_${TOKEN}_2`],
    ]) {
      const registered = runRegistryCommand(
        ['register', '--dispatch', file, '--session', 'n4b-cli'],
        {
          root: registryRoot,
        },
      );
      assert.equal(registered.exitCode, 0);
      assert.deepEqual(
        JSON.parse(registered.stdout).registered.map((entry) => entry.taskName),
        [taskName],
      );
    }
    for (const argv of [
      ['lanes', '--spec', specPath],
      ['review', '--lanes', 'legal-read', '--token', TOKEN, '--out', reviewPath, '--model', 'x'],
      ['delegate'],
    ])
      assert.throws(
        () => delegateSpec.runDelegateCommand(argv, { root }),
        { name: 'TypeError' },
        argv.join(' '),
      );
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});
