import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import {
  assertValidTaskEnvelope,
  buildTaskEnvelope,
  validateTaskEnvelope,
} from '../agents/intake-policy.mjs';

const repoRoot = resolve(import.meta.dirname, '../..');
const fixtures = JSON.parse(
  readFileSync(resolve(repoRoot, 'scripts/ci/fixtures/agent-intake-cases.json'), 'utf8'),
);

test('maps representative requests to advisory intent, authority, evidence, and path', () => {
  const legal = fixtures.find(({ id }) => id === 'legal-analysis');
  const direct = fixtures.find(({ id }) => id === 'direct-path');
  const ambiguous = fixtures.find(({ id }) => id === 'ambiguity-oq');
  const retry = fixtures.find(({ id }) => id === 'retry-ceiling');
  const legalEnvelope = buildTaskEnvelope({ request: legal.request });
  const directEnvelope = buildTaskEnvelope({ request: direct.request });
  const ambiguousEnvelope = buildTaskEnvelope({ request: ambiguous.request });
  const retryEnvelope = buildTaskEnvelope({ request: retry.request });

  assert.equal(legalEnvelope.intent, legal.expected.intent);
  assert.equal(legalEnvelope.authorizedAction, legal.expected.authorizedAction);
  assert.equal(legalEnvelope.recommendedPath, legal.expected.recommendedPath);
  assert.deepEqual(legalEnvelope.requiredEvidence, legal.expected.requiredEvidence);

  assert.equal(directEnvelope.intent, direct.expected.intent);
  assert.equal(directEnvelope.authorizedAction, direct.expected.authorizedAction);
  assert.equal(directEnvelope.recommendedPath, direct.expected.recommendedPath);

  assert.equal(ambiguousEnvelope.intent, ambiguous.expected.intent);
  assert.equal(ambiguousEnvelope.authorizedAction, ambiguous.expected.authorizedAction);
  assert.equal(ambiguousEnvelope.recommendedPath, ambiguous.expected.recommendedPath);
  assert.equal(ambiguousEnvelope.ambiguities[0].disposition, 'clarify-now');

  assert.equal(retryEnvelope.intent, retry.expected.intent);
  assert.equal(retryEnvelope.authorizedAction, retry.expected.authorizedAction);
  assert.deepEqual(retryEnvelope.requiredEvidence, ['test', 'official-current']);
});

test('grants mutate authority only for an explicit implementation or debugging request', () => {
  const implementation = buildTaskEnvelope({ request: '인증 흐름을 구현해줘.' });
  const debugging = buildTaskEnvelope({ request: '로그인 런타임 버그를 해결해줘.' });
  const lowConfidence = buildTaskEnvelope({ request: 'Legal을 개선해줘.' });
  const plan = buildTaskEnvelope({ request: 'Legal 개선 계획을 작성해줘.' });

  assert.equal(implementation.intent, 'implement');
  assert.equal(implementation.authorizedAction, 'mutate');
  assert.equal(debugging.intent, 'debug');
  assert.equal(debugging.authorizedAction, 'mutate');
  assert.equal(lowConfidence.confidence, 'low');
  assert.equal(lowConfidence.authorizedAction, 'inspect');
  assert.equal(plan.intent, 'plan');
  assert.equal(plan.authorizedAction, 'produce-plan');
});

test('preserves typed fact, inference, gap, confidence, constraints, and candidate evidence', () => {
  const envelope = buildTaskEnvelope({
    request: 'Auth 구조 개선 계획을 작성해줘.',
    domainCandidates: [
      {
        domain: 'auth',
        confidence: 'high',
        evidence: ['apps/api/src/auth', 'request term: Auth'],
      },
    ],
    constraints: [{ source: 'user', statement: '새 dependency를 추가하지 않는다.' }],
    evidence: [
      {
        kind: 'fact',
        statement: 'Auth module exists.',
        source: 'apps/api/src/auth/auth.module.ts',
        confidence: 'high',
      },
      {
        kind: 'inference',
        statement: 'Owner-local grouping may reduce coupling.',
        confidence: 'medium',
      },
      {
        kind: 'gap',
        statement: 'Production traffic is unknown.',
        confidence: 'high',
      },
    ],
  });

  assert.deepEqual(
    envelope.evidence.map(({ kind, confidence }) => ({ kind, confidence })),
    [
      { kind: 'fact', confidence: 'high' },
      { kind: 'inference', confidence: 'medium' },
      { kind: 'gap', confidence: 'high' },
    ],
  );
  assert.equal(envelope.domainCandidates[0].domain, 'auth');
  assert.equal(envelope.constraints[0].source, 'user');
  assert.equal(Object.isFrozen(envelope), true);
  assert.equal(Object.isFrozen(envelope.evidence), true);
  assert.throws(() => envelope.evidence.push({}), TypeError);
});

test('redacts bounded summaries and does not preserve raw credentials or personal email', () => {
  const envelope = buildTaskEnvelope({
    request: 'token=super-secret student@kangwon.ac.kr 로그인 오류를 분석해줘.',
  });

  assert.doesNotMatch(envelope.requestSummary, /super-secret/u);
  assert.doesNotMatch(envelope.requestSummary, /student@kangwon\.ac\.kr/u);
  assert.match(envelope.requestSummary, /\[redacted\]/u);
  assert.match(envelope.requestSummary, /\[email\]/u);
});

test('rejects malformed and authority-conflicting envelopes', () => {
  assert.throws(() => buildTaskEnvelope({ request: '' }), /request must be/u);
  assert.throws(
    () =>
      buildTaskEnvelope({
        request: 'Auth를 분석해줘.',
        domainCandidates: [{ domain: 'auth', confidence: 'high', evidence: [] }],
      }),
    /requires evidence/u,
  );

  const invalid = {
    requestId: 'request-invalid',
    requestSummary: 'Analyze but mutate',
    intent: 'analyze',
    authorizedAction: 'mutate',
    risk: 'high',
    domainCandidates: [],
    constraints: [],
    evidence: [],
    requiredEvidence: ['repo'],
    ambiguities: [],
    recommendedPath: 'bounded-lanes',
    confidence: 'low',
    rawRequest: 'must not be retained',
  };

  const result = validateTaskEnvelope(invalid);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(' '), /Analyze intent must use produce-analysis authority/u);
  assert.match(result.errors.join(' '), /Unsupported TaskEnvelope field: rawRequest/u);
  assert.throws(() => assertValidTaskEnvelope(invalid), /Analyze intent/u);

  const { rawRequest: _discarded, ...knownFields } = invalid;
  const sensitive = validateTaskEnvelope({
    ...knownFields,
    requestSummary: 'user@example.com',
    authorizedAction: 'produce-analysis',
    recommendedPath: 'sequential',
  });
  assert.equal(sensitive.valid, false);
  assert.match(sensitive.errors.join(' '), /unredacted sensitive input/u);
});

test('intake policy is pure advisory and imports no execution surface', () => {
  const source = readFileSync(resolve(repoRoot, 'scripts/agents/intake-policy.mjs'), 'utf8');

  assert.doesNotMatch(source, /node:child_process|spawn_agent|exec_command|fetch\s*\(/u);
  assert.doesNotMatch(source, /routing-policy|domain-guide-registry|orchestration-policy/u);
});
