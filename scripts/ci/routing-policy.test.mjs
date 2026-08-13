import assert from 'node:assert/strict';
import test from 'node:test';

import { selectAgentRoute } from '../agents/routing-policy.mjs';

test('routes independent lanes to the minimum sufficient installed role effort', () => {
  assert.deepEqual(selectAgentRoute({ taskKind: 'lookup' }), {
    spawn: true,
    role: 'explore',
    effort: 'low',
    execution: 'bounded-child',
    reason: 'Independent lookup lane with a verified role route.',
  });
  assert.equal(selectAgentRoute({ taskKind: 'implementation' }).effort, 'medium');
  assert.equal(selectAgentRoute({ taskKind: 'test' }).role, 'test-engineer');
  assert.equal(selectAgentRoute({ taskKind: 'research' }).effort, 'high');
  assert.equal(selectAgentRoute({ taskKind: 'verification' }).role, 'verifier');
  assert.equal(selectAgentRoute({ taskKind: 'architecture', risk: 'critical' }).effort, 'xhigh');
});

test('falls back without fabricating roles for dependent or unsupported lanes', () => {
  const dependent = selectAgentRoute({ taskKind: 'implementation', independent: false });
  const unsupported = selectAgentRoute({
    taskKind: 'research',
    roleRoutingAvailable: false,
  });

  assert.equal(dependent.spawn, false);
  assert.equal(dependent.execution, 'single-sequential');
  assert.equal(unsupported.spawn, false);
  assert.equal(unsupported.role, null);
});

test('never routes a child to max or ultra effort', () => {
  for (const taskKind of [
    'lookup',
    'implementation',
    'test',
    'research',
    'verification',
    'architecture',
  ]) {
    const route = selectAgentRoute({ taskKind, risk: 'critical' });
    assert.notEqual(route.effort, 'max');
    assert.notEqual(route.effort, 'ultra');
  }
});
