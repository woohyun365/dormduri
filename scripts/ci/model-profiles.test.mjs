import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getModelProfile,
  createModelProfileBinding,
  assertCurrentModelProfileBinding,
  resolveRouteEffort,
} from '../agents/model-profiles.mjs';

test('finite immutable profiles resolve GPT-6 models independently from semantic effort', () => {
  for (const [id, model, effort] of [
    ['bounded-read', 'gpt-6-sol', 'medium'],
    ['bounded-build', 'gpt-6-sol', 'medium'],
    ['bounded-extract', 'gpt-6-luna', 'high'],
  ]) {
    const p = getModelProfile(id);
    const b = createModelProfileBinding(p);
    assert.equal(b.model, model);
    assert.equal(b.resolvedEffort, effort);
    assert.match(b.profileDigest, /^sha256:[a-f0-9]{64}$/);
    assert.doesNotThrow(() => assertCurrentModelProfileBinding(b));
    assert.throws(() => p.taskKinds.push('review'), TypeError);
    assert.equal(
      resolveRouteEffort({
        effort: 'medium',
        modelRecommendation: { status: 'candidate', profileBinding: b },
      }),
      effort,
    );
  }
  assert.equal(resolveRouteEffort({ effort: 'xhigh' }), 'xhigh');
  assert.equal(
    resolveRouteEffort({ effort: 'high', modelRecommendation: { status: 'baseline' } }),
    'high',
  );
  for (const id of ['gpt-5.6-sol', 'gpt-6-sol', 'latest', 'gpt-7', '__proto__'])
    assert.throws(() => getModelProfile(id), TypeError);
});

test('binding hashes complete policy canonically; synthetic future profiles never become installed', () => {
  const p = getModelProfile('bounded-build');
  const current = createModelProfileBinding(p);
  assert.deepEqual(
    createModelProfileBinding(Object.fromEntries(Object.entries(p).reverse())),
    current,
  );
  for (const patch of [
    { policyRevision: 'next' },
    { model: 'gpt-7' },
    { resolvedEffort: 'high' },
    { taskKinds: ['review'] },
    { allowedTools: ['repository-read'] },
    { routineRoles: [] },
  ]) {
    const future = createModelProfileBinding({ ...p, ...patch });
    assert.notEqual(future.profileDigest, current.profileDigest);
    assert.throws(() => assertCurrentModelProfileBinding(future), TypeError);
  }
  for (const patch of [
    { policyRevision: 'old' },
    { profileDigest: `sha256:${'0'.repeat(64)}` },
    { model: 'gpt-5.6-sol' },
    { resolvedEffort: 'high' },
    { cohort: 'bounded-extraction' },
    { extra: true },
  ]) {
    assert.throws(() => assertCurrentModelProfileBinding({ ...current, ...patch }), TypeError);
  }
});
