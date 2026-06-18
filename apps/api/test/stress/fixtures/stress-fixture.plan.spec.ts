import { describe, expect, it } from 'vitest';

import { createStressFixtureConfig } from './stress-fixture.config.js';
import { buildStressFixturePlan, buildStressFixtureSafeSummary } from './stress-fixture.plan.js';

describe('stress fixture plan', () => {
  it('builds a deterministic actor/cohort plan for the same config', () => {
    const config = createStressFixtureConfig({ prefix: 'stress-spec' });

    expect(buildStressFixturePlan(config)).toEqual(buildStressFixturePlan(config));
  });

  it('represents the largest observed cohort and the expanded stress cohort', () => {
    const plan = buildStressFixturePlan(createStressFixtureConfig({ prefix: 'stress-spec' }));

    expect(plan.actors).toHaveLength(946);
    expect(plan.cohorts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'largest-observed-237', size: 237 }),
        expect.objectContaining({ label: 'stress-expanded-946', size: 946 }),
      ]),
    );
    expect(plan.actors[0]?.cohortLabels).toContain('largest-observed-237');
    expect(plan.actors[945]?.cohortLabels).toEqual(['stress-expanded-946']);
  });

  it('keeps raw actor secrets out of the safe summary', () => {
    const plan = buildStressFixturePlan(createStressFixtureConfig({ prefix: 'stress-spec' }));
    const serializedSummary = JSON.stringify(buildStressFixtureSafeSummary(plan));

    expect(serializedSummary).not.toContain('@stress.example.invalid');
    expect(serializedSummary).not.toContain('stress-spec-password');
    expect(serializedSummary).not.toContain('stress-spec-access-token');
    expect(serializedSummary).not.toContain('stress_session=stress-spec-session');
    expect(serializedSummary).toContain('largest-observed-237');
    expect(serializedSummary).toContain('stress-expanded-946');
  });

  it('rejects a stress cohort smaller than the observed largest cohort', () => {
    expect(() =>
      createStressFixtureConfig({
        prefix: 'stress-spec',
        largestCohortSize: 237,
        stressCohortSize: 100,
      }),
    ).toThrow('stressCohortSize must be >= largestCohortSize');
  });
});
