import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import { runFreshSessionSmoke } from '../agents/fresh-session-smoke.mjs';

const repoRoot = resolve(import.meta.dirname, '../..');
const smokeScript = resolve(repoRoot, 'scripts/agents/fresh-session-smoke.mjs');
const staleHandoffNames = [
  'frontend-feature-refactor-plan-authoring-handoff.md',
  'backend-feature-refactor-plan-authoring-handoff.md',
  'infrastructure-feature-refactor-plan-authoring-handoff.md',
];
const retiredWorkflowTokens = [
  '$' + 'ralph',
  '$' + 'ultrawork',
  '$' + 'pipeline',
  'autoresearch' + '-goal',
  'prometheus' + '-strict',
];
const textExtensions = new Set([
  '.js',
  '.json',
  '.jsx',
  '.md',
  '.mjs',
  '.mts',
  '.sh',
  '.ts',
  '.tsx',
  '.toml',
  '.yaml',
  '.yml',
]);

test('generic bootstrap discovers the tracked repository guidance chain', () => {
  const report = runFreshSessionSmoke();
  const tracked = new Set(trackedPaths());

  assert.equal(report.discovery.canonical, true);
  assert.deepEqual(report.discovery.order, [
    'current-request',
    'AGENTS.md',
    'minimum-relevant-workflow-guide',
    'current-code-contract-test-evidence',
  ]);
  for (const path of report.discovery.entryPoints) assert.ok(tracked.has(path), path);
  assert.deepEqual(report.boundaries, {
    readsLocalResumeState: false,
    readsIgnoredPlan: false,
    invokesChild: false,
    mutatesWorkspace: false,
  });
});

test('fresh direct, Analyze, and Plan routes retain their distinct authority', () => {
  const { scenarios } = runFreshSessionSmoke();

  assert.deepEqual(
    pick(scenarios.direct, ['intent', 'authorizedAction', 'delegation', 'dispatch', 'childCount']),
    {
      intent: 'answer',
      authorizedAction: 'answer',
      delegation: 'direct',
      dispatch: 'leader-direct',
      childCount: 0,
    },
  );
  assert.deepEqual(
    pick(scenarios.singleDomain, ['intent', 'authorizedAction', 'recommendedPath']),
    { intent: 'plan', authorizedAction: 'produce-plan', recommendedPath: 'sequential' },
  );
  assert.ok(
    scenarios.singleDomain.selectedGuides.includes(
      'docs/development/agent-workflows/plan-authoring/frontend.md',
    ),
  );
  assert.equal(scenarios.unavailableRoleRouting.intent, 'analyze');
  assert.equal(scenarios.unavailableRoleRouting.authorizedAction, 'produce-analysis');
});

test('single-domain planning selects one owner while mixed evidence fails closed', () => {
  const { singleDomain, mixedDomain } = runFreshSessionSmoke().scenarios;

  assert.deepEqual(singleDomain.selectedGuides, [
    'docs/development/agent-workflows/plan-authoring/core.md',
    'docs/development/agent-workflows/plan-authoring/frontend.md',
    'docs/development/agent-workflows/plan-authoring/cross-cutting/security-privacy.md',
  ]);
  assert.ok(
    mixedDomain.gaps.some(
      (gap) =>
        gap.startsWith('primary-domain-conflict:') &&
        gap.includes('frontend') &&
        gap.includes('backend'),
    ),
  );
  assert.equal(mixedDomain.delegation, 'single-sequential');
  assert.equal(mixedDomain.dispatch, 'leader-sequential');
  assert.equal(mixedDomain.childCount, 0);
});

test('unavailable role routing never fabricates a child role', () => {
  const scenario = runFreshSessionSmoke().scenarios.unavailableRoleRouting;

  assert.equal(scenario.delegation, 'bounded-lanes');
  assert.equal(scenario.dispatch, 'leader-sequential');
  assert.equal(scenario.childCount, 0);
  assert.deepEqual(scenario.routedRoles, []);
  assert.match(scenario.dispatchReason, /cannot honor every selected child route safely/u);
});

test('fresh routing ignores lexical escalation and changes effort only from current evidence', () => {
  const { routingEvidence } = runFreshSessionSmoke();

  assert.deepEqual(routingEvidence.keywordOnly, {
    effort: 'high',
    role: 'knu_explorer',
    childCount: 1,
  });
  assert.deepEqual(routingEvidence.sameRequest.efforts, ['medium', 'high', 'xhigh']);
  assert.deepEqual(routingEvidence.sameRequest.roles, [
    'knu_explorer',
    'knu_explorer',
    'knu_explorer',
  ]);
  assert.deepEqual(routingEvidence.sameRequest.childCounts, [1, 1, 1]);
  assert.equal(routingEvidence.parentEffortClaimed, false);
});

test('a clean process produces the same smoke result without OMX or Codex session state', () => {
  const result = spawnSync(process.execPath, [smokeScript, '--json'], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: {
      HOME: '/tmp/knu-roommate-empty-home',
      LANG: 'C.UTF-8',
      PATH: process.env.PATH,
    },
  });

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), runFreshSessionSmoke());

  const source = readFileSync(smokeScript, 'utf8');
  assert.doesNotMatch(source, /\.omx\/(?:context|notepad|plans|project-memory|state)/u);
  assert.doesNotMatch(source, /process\.env/u);
});

test('tracked guidance and runtime code no longer reference obsolete authoring handoffs', () => {
  const violations = trackedPaths()
    .filter((path) => path !== 'scripts/ci/agent-intake-fresh-session.test.mjs')
    .filter((path) => textExtensions.has(extname(path)))
    .flatMap((path) => {
      const source = readFileSync(resolve(repoRoot, path), 'utf8');
      return staleHandoffNames
        .filter((name) => source.includes(name))
        .map((name) => `${path}: ${name}`);
    });

  assert.deepEqual(violations, []);
});

test('tracked guidance no longer routes to retired user workflows', () => {
  const scannedPaths = trackedPaths()
    .filter((path) => path !== 'scripts/ci/agent-intake-fresh-session.test.mjs')
    .filter(
      (path) =>
        path === 'AGENTS.md' ||
        path.startsWith('.codex/') ||
        path.startsWith('docs/') ||
        path.startsWith('scripts/'),
    )
    .filter((path) => textExtensions.has(extname(path)));
  const violations = scannedPaths.flatMap((path) => {
    const source = readFileSync(resolve(repoRoot, path), 'utf8');
    return retiredWorkflowTokens
      .filter((token) => source.includes(token))
      .map((token) => `${path}: ${token}`);
  });

  assert.ok(scannedPaths.includes('.codex/agents/knu_reviewer.toml'));
  assert.deepEqual(violations, []);
});

function trackedPaths() {
  const result = spawnSync('git', ['ls-files', '-z'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr || 'git ls-files failed');
  return result.stdout.split('\0').filter(Boolean);
}

function pick(value, fields) {
  return Object.fromEntries(fields.map((field) => [field, value[field]]));
}
