import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import {
  parseContextContract,
  parsePriorityPointer,
  validateContextContract,
} from '../agents/session-contract.mjs';

const repoRoot = resolve(import.meta.dirname, '../..');

test('tracked fixture satisfies the bounded resume contract used by local checkpoints', () => {
  const source = readFileSync(
    resolve(repoRoot, 'scripts/ci/fixtures/session-context.valid.md'),
    'utf8',
  );
  const result = parseContextContract(source);

  assert.equal(result.valid, true, result.errors.join('\n'));
});

test('priority pointer stays compact and points to a bounded context snapshot', () => {
  const pointer = JSON.stringify({
    task: 'agent-guidance-phase7',
    branch: 'issue/example',
    head: 'de2e1be8',
    contextPath: '.omx/context/agent-guidance-phase7-20260813T013053Z.md',
    nextAction: 'Implement Phase 7-2.',
    blocker: null,
  });
  const result = parsePriorityPointer(pointer);

  assert.equal(result.valid, true, result.errors.join('\n'));
  assert.ok(Buffer.byteLength(pointer) <= 500);
});

test('checkpoint validation rejects forbidden, malformed, and expired state', () => {
  const base = {
    schemaVersion: 1,
    taskSlug: 'agent-guidance',
    objective: 'Resume safely',
    latestUserRequest: 'Continue the active phase',
    branch: 'issue/example',
    head: 'de2e1be8',
    workingTreeSummary: [],
    activePlan: '.omx/plans/example.md',
    currentPhase: 'Phase 1',
    planStatus: 'in-progress',
    completed: [],
    nextActions: [],
    blockers: [],
    decisions: [],
    rejectedAlternatives: [],
    relevantFiles: [],
    doNotTouch: [],
    verification: [],
    knownFailures: [],
    createdAt: '2026-08-13T00:00:00Z',
    expiresAt: '2026-08-14T00:00:00Z',
  };

  assert.equal(
    validateContextContract({ ...base, token: 'forbidden' }, new Date('2026-08-13T01:00:00Z'))
      .valid,
    false,
  );
  assert.equal(
    validateContextContract({ ...base, completed: 'done' }, new Date('2026-08-13T01:00:00Z')).valid,
    false,
  );
  assert.equal(validateContextContract({ ...base }, new Date('2026-08-15T01:00:00Z')).valid, false);
});
