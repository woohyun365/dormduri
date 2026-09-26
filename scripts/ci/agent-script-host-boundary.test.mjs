import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '../..');
const codexOwners = [
  'model-profiles',
  'routing-policy',
  'child-task-contract',
  'orchestration-policy',
  'model-run-evidence',
  'fresh-session-smoke',
  'session-contract',
];

test('common facade exposes only host-neutral intake, decision, readiness and QA', async () => {
  const common = await import('../agents/common/index.mjs');
  const expected = [
    'buildTaskEnvelope',
    'validateTaskEnvelope',
    'discoverContextPack',
    'assessPlanReadiness',
    'validateCrossModelPacket',
    'validateCrossModelResult',
    'validateCrossModelExchange',
  ];
  for (const name of expected) assert.equal(typeof common[name], 'function', name);
  for (const name of [
    'getModelProfile',
    'selectAgentRoute',
    'recommendDelegation',
    'createDispatchRecommendation',
    'parseContextContract',
  ]) {
    assert.equal(common[name], undefined, `${name} must remain Codex/OMX-owned`);
  }

  const envelope = common.buildTaskEnvelope({ request: 'H3S Phase 0~2 작업을 진행해줘.' });
  assert.equal(common.validateTaskEnvelope(envelope).valid, true);
  assert.equal(common.validateTaskEnvelope({ ...envelope, modelRequest: {} }).valid, false);
  assert.equal(common.validateTaskEnvelope({ ...envelope, reasoning_effort: 'low' }).valid, false);
  assert.equal(common.validateTaskEnvelope({ ...envelope, nativeDispatch: true }).valid, false);
  assert.ok(
    ['direct', 'sequential', 'clarify', 'oq-handoff', 'bounded-lanes'].includes(
      envelope.recommendedPath,
    ),
  );
});

test('common H3 packet cannot grant Claude runtime or accept Codex-only defaults', async () => {
  const common = await import('../agents/common/index.mjs');
  const { basePacket, baseResult } = JSON.parse(
    readFileSync(resolve(root, 'scripts/ci/fixtures/cross-model-handoff-cases.json'), 'utf8'),
  );
  const packet = structuredClone(basePacket);
  const result = structuredClone(baseResult);
  const validation = common.validateCrossModelExchange({
    packet,
    result,
    currentSnapshot: packet.snapshot,
  });
  assert.equal(validation.decision, 'accept');
  assert.equal(validation.verificationClass, 'runner-live-required');
  packet.modelRequest = { profileId: 'bounded-build' };
  assert.equal(common.validateCrossModelPacket(packet).decision, 'reject');
});

test('Claude extension is an explicit fail-closed namespace, not model admission', async () => {
  const { CLAUDE_ADAPTER_READINESS } = await import('../agents/claude/index.mjs');
  assert.deepEqual(CLAUDE_ADAPTER_READINESS, {
    host: 'claude-code',
    admission: 'unsupported',
    runtimeSupport: 'unknown',
    applied: false,
  });
  assert.equal(Object.isFrozen(CLAUDE_ADAPTER_READINESS), true);
});

test('Codex implementations have one owner and no root compatibility imports remain', async () => {
  for (const name of codexOwners) {
    const owner = await import(`../agents/codex/${name}.mjs`);
    assert.ok(Object.keys(owner).length > 0, name);
    assert.equal(existsSync(resolve(root, `scripts/agents/${name}.mjs`)), false, name);
  }
  assert.equal(existsSync(resolve(root, 'scripts/agents/session-preflight.mjs')), false);
  const cli = resolve(root, 'scripts/agents/codex/session-preflight.mjs');
  assert.notEqual(statSync(cli).mode & 0o111, 0, 'direct preflight CLI stays executable');
  const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
  assert.match(
    manifest.scripts['agent:preflight'],
    /scripts\/agents\/codex\/session-preflight\.mjs/u,
  );
});

test('common import graph cannot acquire Codex, Claude, model or OMX policy', () => {
  const neutralFiles = [
    'common/index.mjs',
    'intake-policy.mjs',
    'domain-guide-registry.mjs',
    'plan-readiness-policy.mjs',
    'cross-model-handoff.mjs',
  ];
  for (const file of neutralFiles) {
    const source = readFileSync(resolve(root, 'scripts/agents', file), 'utf8');
    assert.doesNotMatch(
      source,
      /(?:from|import)\s*['"][^'"]*(?:\/codex\/|\/claude\/|model-profiles|routing-policy|child-task-contract|orchestration-policy|session-contract|session-preflight)/u,
      file,
    );
    assert.doesNotMatch(source, /gpt-6-|reasoning_effort|\.omx\//u, file);
  }
});

test('common delegation guidance links to host policy without inheriting Codex defaults', () => {
  const common = readFileSync(
    resolve(root, 'docs/development/agent-workflows/request-intake/delegation.md'),
    'utf8',
  );
  const codex = readFileSync(
    resolve(root, 'docs/development/agent-workflows/adapters/codex-delegation.md'),
    'utf8',
  );
  assert.match(common, /codex-delegation\.md#model-recommendation/u);
  assert.doesNotMatch(common, /gpt-6-|reasoning_effort|profileBinding|spawnArguments/u);
  assert.match(codex, /modelRequest/u);
  assert.match(codex, /profileBinding/u);
  assert.match(codex, /applied=false/u);
});
