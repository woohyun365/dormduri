import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const repoRoot = resolve(import.meta.dirname, '../..');
const workflowRoot = 'docs/development/agent-workflows';
const authoringRoot = `${workflowRoot}/plan-authoring`;

function read(path) {
  return readFileSync(resolve(repoRoot, path), 'utf8');
}

test('plan authoring uses one core, one primary domain, and bounded cross-cutting lenses', () => {
  const index = read(`${authoringRoot}/README.md`);

  for (const path of [
    'core.md',
    'frontend.md',
    'backend.md',
    'infrastructure.md',
    'cross-cutting/security-privacy.md',
    'cross-cutting/operations-release.md',
    'migration-map.md',
  ]) {
    assert.match(index, new RegExp(path.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'));
  }

  assert.match(index, /primary owner guide 하나/u);
  assert.match(index, /cross-cutting guide를 0~2개/u);
  assert.match(index, /계획 작성은 구현 권한이 아닙니다/u);
});

test('core contract preserves evidence, decision, phase, verification, and ownership boundaries', () => {
  const core = read(`${authoringRoot}/core.md`);

  for (const phrase of [
    'Source of truth and freshness',
    'Baseline and ownership',
    'Evidence labels',
    'Decision, OQ, and future evidence',
    'Required plan structure',
    'Phase contract',
    'Verification matrix',
    'AI-readable architecture without AI-specific layers',
    'Checkpoint and final report',
  ]) {
    assert.match(core, new RegExp(phrase, 'u'));
  }

  assert.match(core, /Analyze 요청은 read-only 결과로 끝내며 plan file을 자동 생성하지 않습니다/u);
  assert.match(core, /Plan은 `produce-plan`만 승인/u);
});

test('primary domain guides retain their non-overlapping planning concerns', () => {
  const frontend = read(`${authoringRoot}/frontend.md`);
  const backend = read(`${authoringRoot}/backend.md`);
  const infrastructure = read(`${authoringRoot}/infrastructure.md`);

  for (const phrase of [
    'Next.js, React, and BFF boundary',
    'State, form, mutation, and cache',
    'Accessibility and responsive interaction',
    'Performance and browser reliability',
  ]) {
    assert.match(frontend, new RegExp(phrase, 'u'));
  }

  for (const phrase of [
    'Domain owner and invariant',
    'Public contract and error semantics',
    'Transaction, concurrency, and idempotency',
    'Persistence and lifecycle',
    'Background work and integration',
  ]) {
    assert.match(backend, new RegExp(phrase, 'u'));
  }

  for (const phrase of [
    'Current and target topology',
    'Runtime, artifact, and configuration',
    'Stateful data and recovery',
    'CI/CD and automation',
    'Ownership, IaC, integration, and lifecycle',
  ]) {
    assert.match(infrastructure, new RegExp(phrase, 'u'));
  }
});

test('cross-cutting guides and migration map preserve security and release concerns without local plan dependency', () => {
  const security = read(`${authoringRoot}/cross-cutting/security-privacy.md`);
  const operations = read(`${authoringRoot}/cross-cutting/operations-release.md`);
  const migration = read(`${authoringRoot}/migration-map.md`);

  assert.match(security, /Auth, legal, PII, profile\/chat, moderation, abuse/u);
  assert.match(security, /negative tests for unauthorized actor/u);
  assert.match(operations, /Local rehearsal 통과를 production success로 표현하지 않/u);
  assert.match(operations, /evidence absence 시 `NO-GO`/u);
  assert.match(migration, /Frontend feature\/refactor authoring/u);
  assert.match(migration, /Infrastructure feature\/refactor authoring/u);
  assert.match(migration, /Former local handoffs were retired/u);
  assert.match(read(`${authoringRoot}/README.md`), /유일한 durable owner/u);

  for (const document of [security, operations, migration]) {
    assert.doesNotMatch(document, /\.omx\/plans/u);
  }
});

test('developer entry points discover tracked plan-authoring guidance', () => {
  for (const path of [
    `${workflowRoot}/README.md`,
    `${workflowRoot}/getting-started.md`,
    `${workflowRoot}/request-intake/README.md`,
  ]) {
    assert.match(read(path), /plan-authoring\/README\.md/u, path);
  }
});
