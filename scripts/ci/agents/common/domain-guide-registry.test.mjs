import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import {
  discoverContextPack,
  listDomainGuides,
} from '../../../agents/common/domain-guide-registry.mjs';
import { buildTaskEnvelope } from '../../../agents/common/intake-policy.mjs';

const repoRoot = resolve(import.meta.dirname, '../../../..');
const fixtures = JSON.parse(
  readFileSync(
    resolve(repoRoot, 'scripts/ci/agents/common/fixtures/agent-intake-cases.json'),
    'utf8',
  ),
);

const legalEvidence = [
  { path: 'docs/policies/legal-basis.md' },
  { path: 'apps/web/src/legal/components/LegalDocumentLayout.tsx' },
  { path: 'apps/web/src/app/api/legal/documents/[kind]/route.ts' },
  { path: 'apps/api/src/legal/legal.controller.ts' },
  { path: 'packages/shared/src/legal/contract.ts' },
  { path: 'apps/web/src/legal/__tests__/legal-document-pages.test.tsx' },
];

test('discovers policy, FE, BFF, BE, shared contract, and test candidates for Legal analysis', () => {
  for (const { path } of legalEvidence) {
    assert.equal(readFileSync(resolve(repoRoot, path), 'utf8').length > 0, true, path);
  }
  const fixture = fixtures.find(({ id }) => id === 'legal-analysis');
  const envelope = buildTaskEnvelope({ request: fixture.request });
  const context = discoverContextPack({ envelope, repositoryEvidence: legalEvidence });
  const domains = new Set(context.domainCandidates.map(({ domain }) => domain));

  for (const domain of ['legal-policy', 'frontend', 'bff', 'backend', 'test']) {
    assert.equal(domains.has(domain), true, domain);
  }
  assert.equal(domains.has('shared-contract'), true);
  assert.deepEqual(context.selectedGuides, []);
  assert.deepEqual(context.gaps, []);
});

test('loads core, one primary guide, and evidence-selected cross-cutting lenses for a Plan', () => {
  const envelope = buildTaskEnvelope({ request: 'Legal Web 개선 계획을 작성해줘.' });
  const context = discoverContextPack({ envelope, repositoryEvidence: legalEvidence });

  assert.deepEqual(
    context.selectedGuides.map(({ owner }) => owner),
    ['plan-authoring-core', 'frontend', 'security-privacy'],
  );
  assert.equal(context.limits.primaryGuide, 1);
  assert.equal(context.limits.crossCuttingGuides, 2);
  assert.equal(
    context.selectedGuides.every(({ selectionReason }) => selectionReason.length > 0),
    true,
  );
});

test('keeps a simple direct lookup on the direct path without loading authoring guides', () => {
  const fixture = fixtures.find(({ id }) => id === 'direct-path');
  const envelope = buildTaskEnvelope({ request: fixture.request });
  const context = discoverContextPack({
    envelope,
    repositoryEvidence: [{ path: 'AGENTS.md', kind: 'changed-file' }],
  });

  assert.equal(envelope.recommendedPath, 'direct');
  assert.deepEqual(context.selectedGuides, []);
  assert.deepEqual(context.domainCandidates, []);
  assert.equal(context.sources.length, 1);
});

test('fails closed on equal primary-owner evidence instead of selecting arbitrarily', () => {
  const envelope = buildTaskEnvelope({ request: '회원 흐름 개선 계획을 작성해줘.' });
  const context = discoverContextPack({
    envelope,
    repositoryEvidence: [
      { path: 'apps/web/src/auth/index.ts', kind: 'changed-file' },
      { path: 'apps/api/src/auth/auth.module.ts', kind: 'changed-file' },
    ],
  });

  assert.deepEqual(
    context.selectedGuides.map(({ owner }) => owner),
    ['plan-authoring-core', 'security-privacy'],
  );
  assert.equal(
    context.selectedGuides.some(({ owner }) => owner === 'frontend'),
    false,
  );
  assert.equal(
    context.selectedGuides.some(({ owner }) => owner === 'backend'),
    false,
  );
  assert.match(context.gaps.join(' '), /primary-domain-conflict/u);
});

test('bounds cross-cutting selection and retains freshness and conflict metadata', () => {
  const envelope = buildTaskEnvelope({
    request: 'Auth provider 배포 계획을 작성해줘.',
    requiredEvidence: ['external-owner'],
    domainCandidates: [
      { domain: 'backend', confidence: 'high', evidence: ['apps/api/src/auth'] },
      { domain: 'auth', confidence: 'high', evidence: ['request term: Auth'] },
      { domain: 'provider', confidence: 'medium', evidence: ['request term: provider'] },
    ],
  });
  const context = discoverContextPack({
    envelope,
    crossCuttingLimit: 1,
    repositoryEvidence: [
      {
        path: 'https://example.com/provider-docs',
        kind: 'external-source',
        reason: 'Provider behavior requires external verification.',
      },
    ],
  });

  assert.deepEqual(
    context.selectedGuides.map(({ owner }) => owner),
    ['plan-authoring-core', 'backend', 'security-privacy'],
  );
  assert.equal(context.sources[0].freshness, 'unverified');
  assert.equal(context.sources[0].verifiedAt, null);
  assert.match(context.gaps.join(' '), /external-source-unverified/u);
  assert.equal(Object.isFrozen(context), true);
  assert.equal(Object.isFrozen(context.selectedGuides), true);
});

test('rejects unsafe paths, malformed freshness, and unbounded cross-cutting limits', () => {
  const envelope = buildTaskEnvelope({ request: 'Infra 계획을 작성해줘.' });

  assert.throws(
    () => discoverContextPack({ envelope, repositoryEvidence: [{ path: '../secret.env' }] }),
    /stay inside the repository/u,
  );
  assert.throws(
    () =>
      discoverContextPack({
        envelope,
        repositoryEvidence: [{ path: 'infra/README.md', verifiedAt: 'not-a-date' }],
      }),
    /verifiedAt must be/u,
  );
  assert.throws(
    () =>
      discoverContextPack({
        envelope,
        repositoryEvidence: [{ path: 'http://example.com/docs', kind: 'external-source' }],
      }),
    /must use HTTPS/u,
  );
  assert.throws(
    () =>
      discoverContextPack({
        envelope,
        repositoryEvidence: [{ path: 'infra/README.md', evidenceRole: 'verdict' }],
      }),
    /Unsupported evidenceRole/u,
  );
  assert.throws(() => discoverContextPack({ envelope, crossCuttingLimit: 3 }), /between 0 and 2/u);
});

test('registry is advisory, exposes only tracked guides, and imports no execution surface', () => {
  const source = readFileSync(
    resolve(repoRoot, 'scripts/agents/common/domain-guide-registry.mjs'),
    'utf8',
  );
  const guides = listDomainGuides();

  assert.equal(guides.length, 6);
  assert.equal(
    guides.every(({ path }) => path.startsWith('docs/development/agent-workflows/')),
    true,
  );
  assert.doesNotMatch(source, /node:child_process|spawn_agent|exec_command|fetch\s*\(/u);
  assert.doesNotMatch(source, /routing-policy|orchestration-policy/u);
});
