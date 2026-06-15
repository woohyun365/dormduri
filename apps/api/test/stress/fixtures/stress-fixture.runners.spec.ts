import { describe, expect, it } from 'vitest';

import {
  buildStressFixtureResetDryRunSummary,
  assertStressResetMarker,
} from './reset-stress-fixture.js';
import { buildStressFixtureSeedDryRunSummary } from './seed-stress-fixture.js';

describe('stress fixture dry-run runners', () => {
  it('keeps seed runner as guarded dry-run with redacted fixture summary', () => {
    const summary = buildStressFixtureSeedDryRunSummary({
      STRESS_TARGET_URL: 'http://127.0.0.1:4000',
      STRESS_FIXTURE_PREFIX: 'stress-runner',
      STRESS_COHORT_SIZE: '12',
      STRESS_LARGEST_COHORT_SIZE: '4',
    });

    expect(summary.mode).toBe('dry-run');
    expect(summary.databaseMutation).toBe(false);
    expect(summary.target).toEqual({ hostname: '127.0.0.1', stressEnv: 'local' });
    expect(summary.fixture.actorCount).toBe(12);
    expect(summary.fixture.cohorts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'largest-observed-237', size: 4 }),
        expect.objectContaining({ label: 'stress-expanded-946', size: 12 }),
      ]),
    );
    expect(JSON.stringify(summary)).not.toContain('@stress.example.invalid');
    expect(JSON.stringify(summary)).not.toContain('stress-runner-password');
    expect(JSON.stringify(summary)).not.toContain('stress-runner-access-token');
  });

  it('fails seed runner before planning when target is missing', () => {
    expect(() =>
      buildStressFixtureSeedDryRunSummary({
        STRESS_FIXTURE_PREFIX: 'stress-runner',
      }),
    ).toThrow('STRESS_TARGET_URL is required');
  });

  it('keeps reset runner scoped to stress marker only', () => {
    const summary = buildStressFixtureResetDryRunSummary({
      STRESS_TARGET_URL: 'http://127.0.0.1:4000',
      STRESS_FIXTURE_PREFIX: 'stress-runner',
      STRESS_SEASON_ID: 'stress-season-runner',
    });

    expect(summary.mode).toBe('dry-run');
    expect(summary.databaseMutation).toBe(false);
    expect(summary.marker).toBe('stress-runner');
    expect(summary.resetScope).toEqual([
      'User.id startsWith stress-runner-user-',
      'SeasonParticipant.id startsWith stress-runner-participant-',
      'SeasonParticipantProfile.id startsWith stress-runner-profile-',
      'Dormitory.id startsWith stress-runner-dormitory-',
      'Season.id equals stress-season-runner',
    ]);
  });

  it('rejects reset markers that do not contain the stress marker word', () => {
    expect(() => assertStressResetMarker('local-runner')).toThrow(
      'Stress reset marker must include "stress"',
    );
  });
});
