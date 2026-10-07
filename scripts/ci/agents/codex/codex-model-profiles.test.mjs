import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import {
  ALLOWED_CHILD_MODELS,
  BASELINE_CHILD_MODEL,
  MODEL_PROFILE_IDS,
  getModelProfile,
  createModelProfileBinding,
  assertAllowedChildModel,
  assertCurrentModelProfileBinding,
  resolveRouteEffort,
} from '../../../agents/codex/model-profiles.mjs';

const repoRoot = resolve(import.meta.dirname, '../../../..');
const UNLISTED_MODEL = 'gpt-x-unlisted';
const UNLISTED_REASON = {
  name: 'TypeError',
  message: 'Model is outside the allowed child model list.',
};
// Version-shaped model IDs; the synthetic UNLISTED_MODEL is deliberately not one.
const MODEL_ID_LITERAL = /\bgpt-\d/iu;
const ALLOWLIST_OWNER = 'scripts/agents/codex/model-profiles.mjs';
// The Codex-target review bridge keeps its own model constant until that bridge is reworked: exactly one literal there.
const MODEL_LITERAL_EXCEPTIONS = { 'scripts/agents/codex/review-bridge.mjs': 1 };

test('one allowlist owns child models and rejects any other ID for the same reason', () => {
  const profileModels = MODEL_PROFILE_IDS.map((id) => getModelProfile(id).model);
  assert.deepEqual(ALLOWED_CHILD_MODELS, [...new Set([BASELINE_CHILD_MODEL, ...profileModels])]);
  assert.ok(Object.isFrozen(ALLOWED_CHILD_MODELS));
  for (const model of ALLOWED_CHILD_MODELS) assert.equal(assertAllowedChildModel(model), model);
  for (const model of [
    UNLISTED_MODEL,
    '',
    undefined,
    null,
    'GPT-6-ASTRA',
    ` ${BASELINE_CHILD_MODEL}`,
  ])
    assert.throws(() => assertAllowedChildModel(model), UNLISTED_REASON);
  const binding = createModelProfileBinding(getModelProfile('standard-build'));
  assert.throws(
    () => assertCurrentModelProfileBinding({ ...binding, model: UNLISTED_MODEL }),
    UNLISTED_REASON,
  );
});

test('runtime modules take model IDs only from the allowlist owner', () => {
  // A directory read, not `git ls-files`: this suite stays off the tracked tree and also sees untracked modules.
  const runtime = readdirSync(resolve(repoRoot, 'scripts/agents/codex'), { recursive: true })
    .map((path) => `scripts/agents/codex/${path.split('\\').join('/')}`)
    .filter((path) => /\.(?:mjs|js|cjs)$/u.test(path));
  assert.ok(runtime.includes(ALLOWLIST_OWNER));
  const literalCounts = Object.fromEntries(
    runtime
      .filter((path) => path !== ALLOWLIST_OWNER)
      .map((path) => [
        path,
        readFileSync(resolve(repoRoot, path), 'utf8').match(new RegExp(MODEL_ID_LITERAL, 'giu'))
          ?.length ?? 0,
      ])
      .filter(([, count]) => count > 0),
  );
  assert.deepEqual(literalCounts, MODEL_LITERAL_EXCEPTIONS);
  assert.match(readFileSync(resolve(repoRoot, ALLOWLIST_OWNER), 'utf8'), MODEL_ID_LITERAL);
});

const CANDIDATE_PROFILES = [
  ['extract', 'gpt-6-luna', 'xhigh'],
  ['standard-read', 'gpt-6.1-sol', 'high'],
  ['elevated-read', 'gpt-6.1-sol', 'xhigh'],
  ['standard-build', 'gpt-6.1-sol', 'high'],
  ['elevated-build', 'gpt-6.1-sol', 'xhigh'],
];

test('finite immutable candidate profiles bind their model and the effort of their roles', () => {
  for (const [id, model, effort] of CANDIDATE_PROFILES) {
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
  for (const id of [UNLISTED_MODEL, 'gpt-6-sol', 'latest', 'gpt-7', '__proto__', 'bounded-build'])
    assert.throws(() => getModelProfile(id), TypeError);
});

test('binding hashes complete policy canonically; synthetic future profiles never become installed', () => {
  const p = getModelProfile('standard-build');
  const current = createModelProfileBinding(p);
  assert.deepEqual(
    createModelProfileBinding(Object.fromEntries(Object.entries(p).reverse())),
    current,
  );
  for (const patch of [
    { policyRevision: 'next' },
    { model: 'gpt-7' },
    { resolvedEffort: 'medium' },
    { tiers: ['high'] },
    { taskKinds: ['review'] },
    { allowedTools: ['repository-read'] },
    // Routine admission is policy too: narrowing it to pilot-only needs a new revision.
    { routineRoles: [] },
  ]) {
    const future = createModelProfileBinding({ ...p, ...patch });
    assert.notEqual(future.profileDigest, current.profileDigest);
    assert.throws(() => assertCurrentModelProfileBinding(future), TypeError);
  }
  for (const patch of [
    { policyRevision: 'old' },
    { profileDigest: `sha256:${'0'.repeat(64)}` },
    { model: UNLISTED_MODEL },
    { resolvedEffort: 'medium' },
    { cohort: 'bounded-extraction' },
    { extra: true },
  ]) {
    assert.throws(() => assertCurrentModelProfileBinding({ ...current, ...patch }), TypeError);
  }
});

test('previous effort revisions cannot be restored by rehashing profile data', () => {
  for (const [id] of CANDIDATE_PROFILES) {
    const profile = getModelProfile(id);
    assert.notEqual(profile.policyRevision, '2026-09-24.1');
    for (const resolvedEffort of ['medium', 'high', 'max']) {
      assert.throws(
        () =>
          assertCurrentModelProfileBinding(
            createModelProfileBinding({
              ...profile,
              policyRevision: '2026-09-24.1',
              resolvedEffort,
            }),
          ),
        TypeError,
      );
    }
  }
});

test('quality-only revision grants do not survive recovery policy activation', () => {
  for (const [id] of CANDIDATE_PROFILES) {
    const old = createModelProfileBinding({
      ...getModelProfile(id),
      policyRevision: '2026-09-24.2',
    });
    assert.throws(() => assertCurrentModelProfileBinding(old), TypeError);
  }
});

// GPT-6 Sol to GPT-6.1 Sol and the effort structure: each change came with a new revision.
const SOL_PROFILES = ['standard-read', 'elevated-read', 'standard-build', 'elevated-build'];
const SOL6_REVISION = '2026-09-24.3';
const STALE_REASON = {
  name: 'TypeError',
  message: 'Model profile binding must match the current installed policy.',
};

test('Sol profiles bind GPT-6.1 Sol under a revision newer than both earlier Sol revisions', () => {
  for (const id of SOL_PROFILES) {
    const profile = getModelProfile(id);
    assert.equal(profile.model, 'gpt-6.1-sol');
    for (const old of [SOL6_REVISION, '2026-10-05.1']) assert.notEqual(profile.policyRevision, old);
  }
  for (const id of MODEL_PROFILE_IDS)
    assert.equal(getModelProfile(id).policyRevision, getModelProfile('extract').policyRevision);
});

test('the previous revision is stale even when it already names the new model', () => {
  for (const id of SOL_PROFILES) {
    const stale = createModelProfileBinding({
      ...getModelProfile(id),
      model: 'gpt-6.1-sol',
      policyRevision: SOL6_REVISION,
    });
    assert.throws(() => assertCurrentModelProfileBinding(stale), STALE_REASON);
  }
});

test('a reused Sol 6 grant fails like any unlisted model, with no rule naming it', () => {
  for (const id of SOL_PROFILES) {
    const old = { ...getModelProfile(id), model: 'gpt-6-sol', policyRevision: SOL6_REVISION };
    const unlisted = { ...old, model: UNLISTED_MODEL };
    for (const profile of [old, unlisted])
      assert.throws(
        () => assertCurrentModelProfileBinding(createModelProfileBinding(profile)),
        UNLISTED_REASON,
      );
  }
});

// Fingerprint/data seam only: this does not install a registry or protect against
// an operator restoring old validator code together with old grants.
test('rollback data with a new revision has a new binding, not a revived old grant', () => {
  const current = getModelProfile('standard-build');
  const original = createModelProfileBinding(current);
  const changed = createModelProfileBinding({
    ...current,
    policyRevision: 'synthetic-next',
    resolvedEffort: 'medium',
  });
  const rolledBack = createModelProfileBinding({
    ...current,
    policyRevision: 'synthetic-rollback-new-revision',
  });
  assert.equal(rolledBack.model, original.model);
  assert.equal(rolledBack.resolvedEffort, original.resolvedEffort);
  assert.notEqual(rolledBack.profileDigest, original.profileDigest);
  assert.notEqual(rolledBack.profileDigest, changed.profileDigest);
  for (const uninstalled of [changed, rolledBack])
    assert.throws(() => assertCurrentModelProfileBinding(uninstalled), TypeError);
  assert.deepEqual(assertCurrentModelProfileBinding(original), original);
});

// Effort structure: role files pin effort, profiles pin the model passed as spawn_agent.model.
const EXPECTED_PROFILES = {
  extract: ['candidate', 'gpt-6-luna', ['knu_explorer_xhigh'], ['knu_explorer_xhigh']],
  'standard-read': [
    'candidate',
    'gpt-6.1-sol',
    ['knu_explorer', 'knu_researcher'],
    ['knu_explorer', 'knu_researcher'],
  ],
  'elevated-read': [
    'candidate',
    'gpt-6.1-sol',
    ['knu_explorer_xhigh', 'knu_researcher_xhigh'],
    ['knu_explorer_xhigh', 'knu_researcher_xhigh'],
  ],
  'standard-build': ['candidate', 'gpt-6.1-sol', ['knu_executor'], ['knu_executor']],
  'elevated-build': ['candidate', 'gpt-6.1-sol', ['knu_executor_xhigh'], ['knu_executor_xhigh']],
  'deep-build': ['assignment', 'gpt-6-astra', ['knu_executor', 'knu_executor_xhigh'], null],
  review: ['assignment', 'gpt-6-astra', ['knu_reviewer'], null],
  'astra-fallback': [
    'assignment',
    'gpt-6-astra',
    [
      'knu_explorer_medium',
      'knu_explorer',
      'knu_explorer_xhigh',
      'knu_researcher_medium',
      'knu_researcher',
      'knu_researcher_xhigh',
      'knu_executor_medium',
      'knu_executor',
    ],
    null,
  ],
};
test('profiles own models and roles while each role file owns its effort', async () => {
  const { ROLE_EFFORTS, MODEL_PROFILE_IDS } =
    await import('../../../agents/codex/model-profiles.mjs');
  assert.deepEqual(MODEL_PROFILE_IDS, Object.keys(EXPECTED_PROFILES));
  for (const [id, [kind, model, roles, routineRoles]] of Object.entries(EXPECTED_PROFILES)) {
    const profile = getModelProfile(id);
    assert.equal(profile.kind, kind, id);
    assert.equal(profile.model, model, id);
    assert.deepEqual(profile.roles, roles, id);
    assert.ok(Object.isFrozen(profile.roles), id);
    if (kind === 'candidate') {
      // Every candidate is routine on all of its roles: 6.1 Sol by Owner adoption, Luna from its observed cohort.
      assert.deepEqual(profile.routineRoles, routineRoles, id);
      for (const role of roles)
        assert.equal(profile.resolvedEffort, ROLE_EFFORTS[role], `${id}:${role}`);
      assert.equal(createModelProfileBinding(profile).resolvedEffort, profile.resolvedEffort);
    } else {
      // An assignment profile names the model for roles of different efforts; it is never a model request.
      assert.equal(Object.hasOwn(profile, 'resolvedEffort'), false, id);
      assert.throws(() => createModelProfileBinding(profile), {
        name: 'TypeError',
        message: 'Only a candidate profile has a model binding.',
      });
    }
  }
  assert.equal(getModelProfile('review').roles.length, 1);
  assert.equal(ROLE_EFFORTS.knu_reviewer, 'xhigh');
});

test('allowed (role, model) pairs are the profile roles with their profile model', async () => {
  const { ALLOWED_ROLE_MODELS, isAllowedRoleModel, ROLE_EFFORTS } =
    await import('../../../agents/codex/model-profiles.mjs');
  const astra = BASELINE_CHILD_MODEL;
  const sol = getModelProfile('standard-read').model;
  const luna = getModelProfile('extract').model;
  assert.deepEqual(ALLOWED_ROLE_MODELS, {
    knu_explorer_medium: [astra],
    knu_explorer: [astra, sol],
    knu_explorer_xhigh: [astra, luna, sol],
    knu_researcher_medium: [astra],
    knu_researcher: [astra, sol],
    knu_researcher_xhigh: [astra, sol],
    knu_executor_medium: [astra],
    knu_executor: [astra, sol],
    knu_executor_xhigh: [astra, sol],
    knu_reviewer: [astra],
  });
  assert.deepEqual(Object.keys(ALLOWED_ROLE_MODELS), Object.keys(ROLE_EFFORTS));
  assert.ok(
    Object.isFrozen(ALLOWED_ROLE_MODELS) && Object.isFrozen(ALLOWED_ROLE_MODELS.knu_reviewer),
  );
  // The promotion ladder (failed row 1 → 6.1 Sol, rows 2~5 → Astra, same role) stays inside these pairs.
  for (const [profileId, next] of [
    ['extract', sol],
    ['standard-read', astra],
    ['elevated-read', astra],
    ['standard-build', astra],
    ['elevated-build', astra],
  ])
    for (const role of getModelProfile(profileId).roles)
      assert.equal(isAllowedRoleModel(role, next), true, `${profileId}:${role}`);
  for (const [role, model] of [
    ['knu_reviewer', sol],
    ['knu_explorer_medium', luna],
    ['knu_explorer', luna],
    ['knu_executor_medium', sol],
    ['knu_explorer', UNLISTED_MODEL],
    ['default', astra],
    ['constructor', astra],
    [undefined, astra],
  ])
    assert.equal(isAllowedRoleModel(role, model), false, `${role}:${model}`);
});
