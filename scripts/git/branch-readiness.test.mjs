import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  assessBranchReadiness,
  collectBranchEvidence,
  normalizeDeclaration,
} from './branch-readiness.mjs';

const fixtureUrl = new URL('./fixtures/branch-readiness-cases.json', import.meta.url);
const fixtures = JSON.parse(readFileSync(fixtureUrl, 'utf8'));

for (const fixture of fixtures) {
  test(`assesses ${fixture.name} by semantic evidence rather than size`, () => {
    const assessment = assessBranchReadiness(fixture);
    assert.equal(assessment.recommendation, fixture.expected);
    assert.equal(assessment.valid, fixture.expectedValid ?? true);
  });
}

test('keeps the verdict stable when only commit-count context changes', () => {
  const declaration = {
    outcome: '한 계약을 검증한다',
    acceptance: ['contract test'],
    nonScope: ['독립 기능'],
    semantic: { independentOutcomes: 1 },
  };
  const evidence = { changedPaths: ['apps/api/src/a.ts'], selectedLanes: ['api'] };

  const oneCommit = assessBranchReadiness({
    declaration,
    evidence: { ...evidence, stats: { commitCountContext: 1 } },
  });
  const manyCommits = assessBranchReadiness({
    declaration,
    evidence: { ...evidence, stats: { commitCountContext: 120 } },
  });

  assert.equal(oneCommit.recommendation, manyCommits.recommendation);
  assert.equal(oneCommit.decisionSource, manyCommits.decisionSource);
});

test('requires a model-mediated audit when several product lanes lack shared acceptance', () => {
  const assessment = assessBranchReadiness({
    evidence: {
      changedPaths: ['apps/web/src/a.ts', 'apps/api/src/a.ts'],
      selectedLanes: ['web', 'api'],
    },
    declaration: {
      outcome: '한 사용자 흐름을 수정한다',
      acceptance: ['flow test'],
      nonScope: ['인프라'],
    },
  });

  assert.equal(assessment.recommendation, 'scope-audit-required');
  assert.equal(assessment.decisionSource, 'model-mediated');
  assert.ok(assessment.reasons.some((reason) => reason.code === 'MULTI_LANE_ACCEPTANCE_REVIEW'));
});

test('does not let doNotTouch declarations hide an already committed branch change', () => {
  const assessment = assessBranchReadiness({
    evidence: {
      changedPaths: ['DESIGN.md'],
      selectedLanes: ['repoPolicy'],
      workingTree: { doNotTouchConflicts: ['DESIGN.md'] },
    },
    declaration: {
      outcome: 'tracked guidance를 수정한다',
      acceptance: ['policy test'],
      nonScope: ['사용자 소유 visual draft'],
      doNotTouch: ['DESIGN.md'],
    },
  });

  assert.equal(assessment.recommendation, 'scope-audit-required');
  assert.ok(assessment.reasons.some((reason) => reason.code === 'COMMITTED_DO_NOT_TOUCH_CONFLICT'));
});

test('normalizes explicit owner dispositions without guessing them from paths', () => {
  const declaration = normalizeDeclaration({
    ownerDisposition: {
      requiredCurrent: ['공개 contract producer'],
      independentFollowUp: [{ summary: '인접 UI 개선', issue: '#12' }],
    },
  });

  assert.deepEqual(declaration.ownerDisposition.requiredCurrent, [
    { summary: '공개 contract producer', issue: '' },
  ]);
  assert.deepEqual(declaration.ownerDisposition.independentFollowUp, [
    { summary: '인접 UI 개선', issue: '#12' },
  ]);
});

function git(cwd, args) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

test('collects dirty-branch evidence without changing the index or working tree', () => {
  const root = mkdtempSync(join(tmpdir(), 'knu-branch-readiness-'));
  try {
    git(root, ['init', '-b', 'dev']);
    git(root, ['config', 'user.name', 'Branch Readiness Test']);
    git(root, ['config', 'user.email', 'branch-readiness@example.com']);
    writeFileSync(join(root, 'README.md'), '# baseline\n');
    git(root, ['add', 'README.md']);
    git(root, ['commit', '-m', 'test: baseline']);
    git(root, ['branch', '-M', 'dev']);
    git(root, ['switch', '-c', 'feat/test']);
    writeFileSync(join(root, 'README.md'), '# changed\n');
    writeFileSync(join(root, 'untracked.md'), 'one\ntwo\n');

    const before = git(root, ['status', '--porcelain=v2']);
    const evidence = collectBranchEvidence({
      base: 'dev',
      cwd: root,
      declaration: { doNotTouch: [] },
    });
    const after = git(root, ['status', '--porcelain=v2']);

    assert.equal(after, before);
    assert.deepEqual(evidence.changedPaths, ['README.md', 'untracked.md']);
    assert.equal(evidence.workingTree.dirty, true);
    assert.equal(evidence.stats.additions, 3);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('fails closed with an actionable message when the requested base is absent', () => {
  assert.throws(
    () => collectBranchEvidence({ base: 'origin/missing', cwd: process.cwd() }),
    /git fetch origin dev/u,
  );
});
