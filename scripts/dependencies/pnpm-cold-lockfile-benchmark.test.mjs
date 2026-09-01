import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

import {
  applyExactMutations,
  buildBenchmarkSummary,
  parseBenchmarkFixture,
  parseTimeMetrics,
  selectCandidate,
} from './pnpm-cold-lockfile-benchmark.mjs';

const fixture = parseBenchmarkFixture(
  JSON.parse(
    readFileSync(
      resolve('scripts/dependencies/fixtures/pnpm-cold-lockfile-benchmark.json'),
      'utf8',
    ),
  ),
);

test('benchmark fixture freezes the Mend lockfile command and three pnpm 11 candidates', () => {
  assert.deepEqual(fixture.versions, ['11.7.0', '11.15.1', '11.24.0']);
  assert.deepEqual(fixture.command, [
    'install',
    '--lockfile-only',
    '--recursive',
    '--ignore-scripts',
    '--ignore-pnpmfile',
  ]);
  assert.equal(fixture.trialCount, 1);
  assert.ok(fixture.mutations.every(({ file }) => file === 'pnpm-workspace.yaml'));
});

test('disposable workload mutations fail closed on stale or ambiguous input', () => {
  const root = mkdtempSync(join(tmpdir(), 'knu-pnpm-mutation-'));
  try {
    mkdirSync(root, { recursive: true });
    writeFileSync(join(root, 'pnpm-workspace.yaml'), 'catalog:\n  eslint: 9.39.5\n');
    assert.deepEqual(
      applyExactMutations({
        workspace: root,
        mutations: [
          {
            file: 'pnpm-workspace.yaml',
            from: '  eslint: 9.39.5',
            to: '  eslint: 9.39.4',
          },
        ],
      }),
      ['pnpm-workspace.yaml'],
    );
    assert.match(readFileSync(join(root, 'pnpm-workspace.yaml'), 'utf8'), /eslint: 9\.39\.4/u);
    assert.throws(
      () =>
        applyExactMutations({
          workspace: root,
          mutations: [
            {
              file: 'pnpm-workspace.yaml',
              from: '  eslint: 9.39.5',
              to: '  eslint: 9.39.4',
            },
          ],
        }),
      /exactly one benchmark target/u,
    );
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});

test('time parsers normalize macOS bytes and GNU kilobytes', () => {
  assert.deepEqual(parseTimeMetrics('  123456  maximum resident set size\n', 'darwin'), {
    peakRssBytes: 123456,
    source: '/usr/bin/time -l',
  });
  assert.deepEqual(parseTimeMetrics('Maximum resident set size (kbytes): 2048\n', 'linux'), {
    peakRssBytes: 2_097_152,
    source: '/usr/bin/time -v',
  });
});

test('candidate selection promotes latest only when it passes without fix-floor regression', () => {
  const summaries = {
    '11.7.0': { successfulTrials: 1, medianPeakRssBytes: 1_000 },
    '11.15.1': { successfulTrials: 1, medianPeakRssBytes: 700 },
    '11.24.0': { successfulTrials: 1, medianPeakRssBytes: 720 },
  };
  assert.deepEqual(
    selectCandidate({
      baselineVersion: '11.7.0',
      fixFloorVersion: '11.15.1',
      latestVersion: '11.24.0',
      summaries,
    }),
    {
      decision: 'promote',
      selectedVersion: '11.24.0',
      reason: 'latest-passes-and-reduces-local-cold-peak-rss',
      regressionLimit: 771,
    },
  );
  summaries['11.24.0'].medianPeakRssBytes = 800;
  assert.equal(
    selectCandidate({
      baselineVersion: '11.7.0',
      fixFloorVersion: '11.15.1',
      latestVersion: '11.24.0',
      summaries,
    }).decision,
    'no-go',
  );
});

test('benchmark summary keeps local process-boundary evidence explicit', () => {
  const trials = fixture.versions.map((version, index) => ({
    version,
    trial: 1,
    exitCode: 0,
    elapsedMs: 1000 + index,
    peakRssBytes: 1_000_000 - index * 100_000,
  }));
  const summary = buildBenchmarkSummary({
    fixture,
    trials,
    generatedAt: '2026-09-01T00:00:00.000Z',
    sourceSha: 'a'.repeat(40),
  });
  assert.equal(summary.coldRun, true);
  assert.match(summary.processBoundary, /not the parent Mend Renovate process tree/u);
  assert.equal(summary.selection.selectedVersion, '11.24.0');
});
