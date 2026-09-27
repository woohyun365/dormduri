import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync, renameSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import test from 'node:test';
import { discoverPlans, readPlan, assessPlanContinuation } from '../agents/common/plan-store.mjs';

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'neutral-plans-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const put = (path, text = '- Plan ID: task-one\n- Status: active\n') => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  };
  return { root, put };
}

test('missing common root is explicit, never reads legacy runtime or creates files', (t) => {
  const { root, put } = fixture(t);
  put('.omx/plans/legacy.md');
  assert.deepEqual(discoverPlans(root), { plans: [], issues: ['missing-root'], complete: false });
  assert.equal(readPlan(root, '.plans/absent.md').state, 'missing');
});

test('discovery ignores navigation, nested support and terminal plans; explicit support can resume', (t) => {
  const { root, put } = fixture(t);
  put('.plans/README.md');
  put('.plans/current.md');
  put('.plans/supporting/detail.md', '# Design detail without a separate lifecycle\n');
  put('.plans/supporting/child.md', '- Plan ID: child\n- Status: active\n');
  put('.plans/cancelled/old.md', '- Plan ID: old\n- Status: active\n');
  put('.plans/ended.md', '- Plan ID: ended\n- Status: completed\n');
  assert.deepEqual(
    discoverPlans(root).plans.map((p) => p.path),
    ['.plans/current.md'],
  );
  assert.equal(readPlan(root, '.plans/supporting/child.md').state, 'active');
  assert.equal(readPlan(root, '.plans/cancelled/old.md').state, 'archived');
  assert.equal(readPlan(root, '.plans/ended.md').state, 'terminal');
  assert.equal(readPlan(root, '.plans/README.md').state, 'navigation');
});

test('path boundary rejects root, nested symlinks, traversal and absolute/foreign paths', (t) => {
  const { root, put } = fixture(t);
  put('.plans/ok.md');
  put('outside.md');
  symlinkSync(join(root, 'outside.md'), join(root, '.plans/link.md'));
  symlinkSync(root, join(root, '.plans/directory'));
  for (const path of [
    '.plans/../outside.md',
    join(root, '.plans/ok.md'),
    '.omx/plans/ok.md',
    '.plans/link.md',
    '.plans/directory/outside.md',
    '.plans//ok.md',
    '.plans/./ok.md',
  ])
    assert.equal(readPlan(root, path).state, 'unsafe', path);
  const other = fixture(t);
  other.put('store/ok.md');
  symlinkSync(join(other.root, 'store'), join(other.root, '.plans'));
  assert.equal(readPlan(other.root, '.plans/ok.md').state, 'unsafe');
});

test('duplicate IDs fail closed, moved pointers remain missing without archive fallback', (t) => {
  const { root, put } = fixture(t);
  put('.plans/one.md');
  put('.plans/supporting/two.md');
  assert.equal(readPlan(root, '.plans/one.md').state, 'ambiguous');
  assert.equal(discoverPlans(root).plans.length, 0);
  rmSync(join(root, '.plans/supporting/two.md'));
  renameSync(join(root, '.plans/one.md'), join(root, '.plans/moved.md'));
  assert.equal(readPlan(root, '.plans/one.md').state, 'missing');
  assert.equal(readPlan(root, '.plans/moved.md').state, 'active');
});

test('metadata is bounded and top-level; invalid/duplicate declarations cannot be inferred from prose', (t) => {
  const { root, put } = fixture(t);
  for (const [name, text] of Object.entries({
    body: '# Plan\n## Work\n- Plan ID: body\n- Status: active',
    fence: '```\n- Plan ID: fence\n- Status: active\n```',
    conflict: '- Plan ID: conflict\n- Status: active\n- Status: done',
    unknown: '- Plan ID: unknown\n- Status: perhaps',
    tooBig: 'a'.repeat(65537),
  })) {
    put(`.plans/${name}.md`, text);
    assert.equal(readPlan(root, `.plans/${name}.md`).state, 'unknown', name);
  }
});

test('resume selection never grants write/host authority; source mismatch and terminal states block', (t) => {
  const { root, put } = fixture(t);
  put('.plans/current.md');
  const plan = readPlan(root, '.plans/current.md');
  const snapshot = { branch: 'work', head: 'a'.repeat(40), diffHash: 'b'.repeat(64) };
  const input = {
    plan,
    mode: 'resume',
    explicitlySelected: true,
    expectedPlanId: 'task-one',
    checkpointSnapshot: snapshot,
    currentSnapshot: snapshot,
  };
  assert.equal(assessPlanContinuation(input).decision, 'candidate');
  for (const delta of [
    { mode: 'fresh' },
    { explicitlySelected: false },
    { expectedPlanId: 'other' },
    { checkpointSnapshot: null },
    { currentSnapshot: { ...snapshot, diffHash: 'c'.repeat(64) } },
    { plan: { ...plan, state: 'terminal' } },
  ])
    assert.notEqual(assessPlanContinuation({ ...input, ...delta }).decision, 'candidate');
  assert.equal(assessPlanContinuation(input).grantsExecutionAuthority, false);
});

test('unknown lifecycle is not active and archival terminal aliases remain explicit', (t) => {
  const { root, put } = fixture(t);
  for (const status of ['paused', 'blocked', 'proposed', 'superseded', 'cancelled']) {
    put(`.plans/${status}.md`, `- Plan ID: ${status}\n- Status: ${status}\n`);
    assert.notEqual(readPlan(root, `.plans/${status}.md`).state, 'active');
  }
  assert.deepEqual(discoverPlans(root).plans, []);
});

test('implementation-ready is an active candidate and duplicate discovery exposes its ambiguity', (t) => {
  const { root, put } = fixture(t);
  put('.plans/ready.md', '- Plan ID: ready\n- Status: implementation-ready\n');
  assert.equal(readPlan(root, '.plans/ready.md').state, 'active');
  assert.equal(discoverPlans(root).plans.length, 1);
  put('.plans/copy.md', '- Plan ID: ready\n- Status: active\n');
  assert.ok(discoverPlans(root).issues.includes('duplicate-plan-id'));
  assert.equal(discoverPlans(root).complete, false);
});

test('a bounded partial inventory never certifies unique active resume', (t) => {
  const { root, put } = fixture(t);
  put('.plans/current.md');
  for (let i = 0; i < 513; i++) put(`.plans/supporting/detail-${i}.md`, '# Supporting notes\n');
  const inventory = discoverPlans(root);
  assert.equal(inventory.complete, false);
  assert.ok(inventory.issues.includes('candidate-limit'));
  assert.equal(readPlan(root, '.plans/current.md').state, 'unknown');
});

test('fenced and indented examples never become active plan metadata', (t) => {
  const { root, put } = fixture(t);
  for (const [name, text] of Object.entries({
    nested: '# Supporting example\n````\n```md\n- Plan ID: example\n- Status: active\n```\n````\n',
    shortClose: '~~~~\n~~~\n- Plan ID: example\n- Status: active\n~~~~\n',
    invalidClose: '```md\n```still-code\n- Plan ID: example\n- Status: active\n```\n',
    indented: '    - Plan ID: example\n    - Status: active\n',
  })) {
    put(`.plans/${name}.md`, text);
    assert.equal(readPlan(root, `.plans/${name}.md`).state, 'unknown', name);
  }
  assert.deepEqual(discoverPlans(root).plans, []);
  put(
    '.plans/actual.md',
    '````md\n- Plan ID: ignored\n- Status: cancelled\n`````\n- Plan ID: actual\n- Status: active\n',
  );
  assert.equal(readPlan(root, '.plans/actual.md').state, 'active');
});

test('explicit malformed metadata reports an incomplete inventory but supporting prose does not', (t) => {
  const { root, put } = fixture(t);
  put('.plans/current.md');
  put('.plans/supporting/detail.md', '# Supporting detail without metadata\n');
  assert.equal(discoverPlans(root).complete, true);
  for (const status of ['perhaps', 'constructor', '__proto__']) {
    put('.plans/unclear.md', `- Plan ID: unclear\n- Status: ${status}\n`);
    assert.equal(readPlan(root, '.plans/unclear.md').state, 'unknown');
    assert.ok(discoverPlans(root).issues.includes('metadata-unknown'));
    assert.equal(discoverPlans(root).complete, false);
    assert.equal(readPlan(root, '.plans/current.md').state, 'unknown');
  }
});
