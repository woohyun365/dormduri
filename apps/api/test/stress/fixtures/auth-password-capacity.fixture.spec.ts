import { describe, expect, it } from 'vitest';

import { createStressFixtureConfigFromEnv } from './stress-fixture.config.js';
import { buildStressFixturePlan } from './stress-fixture.plan.js';
import { buildAuthPasswordCapacityArtifact } from './auth-password-capacity.fixture.js';
import { redactStressFixtureSecrets } from '../safety/stress-secret-redaction.js';
import { buildPrismaSessionOptions } from '../../../src/platform/database/prisma.service.js';

const env = {
  STRESS_FIXTURE_PREFIX: 'capacity-test',
  STRESS_CAMPUS_CODE: 'CHUNCHEON',
  STRESS_SEASON_ID: 'capacity-season',
  STRESS_LARGEST_COHORT_SIZE: '8',
  STRESS_COHORT_SIZE: '12',
  STRESS_DORMITORY_COUNT: '2',
  STRESS_ROOM_TYPE: '2',
};

describe('auth password capacity fixture', () => {
  it('uses the product UTC PostgreSQL session boundary for expiring fixture rows', () => {
    expect(buildPrismaSessionOptions('public')).toContain('timezone=UTC');
  });

  it('partitions seeded actors so reset/change do not contaminate login pools', () => {
    const plan = buildStressFixturePlan(createStressFixtureConfigFromEnv(env));
    const artifact = buildAuthPasswordCapacityArtifact(
      plan.actors,
      plan.marker,
      new Date('2026-08-04T00:00:00.000Z'),
      16,
    );
    const loginIndexes = new Set([
      ...artifact.loginSuccess.map((entry) => entry.index),
      ...artifact.loginFailure.map((entry) => entry.index),
    ]);
    const mutationIndexes = new Set([
      ...artifact.reset.map((entry) => entry.index),
      ...artifact.change.map((entry) => entry.index),
    ]);

    expect(artifact.signup).toHaveLength(16);
    expect(artifact.loginSuccess.length).toBeGreaterThan(0);
    expect(artifact.loginFailure.length).toBeGreaterThan(0);
    expect(artifact.readTraffic).toHaveLength(artifact.loginSuccess.length);
    expect([...mutationIndexes].every((index) => !loginIndexes.has(index))).toBe(true);
  });

  it('uses purpose-bound grants and opaque sessions without exposing them in safe summaries', () => {
    const plan = buildStressFixturePlan(createStressFixtureConfigFromEnv(env));
    const artifact = buildAuthPasswordCapacityArtifact(plan.actors, plan.marker);
    const serialized = JSON.stringify(redactStressFixtureSecrets(artifact));

    expect(artifact.signup[0]?.verificationGrant).toMatch(/^v1\..+\.[A-Za-z0-9_-]{43}$/u);
    expect(artifact.reset[0]?.verificationGrant).toMatch(/^v1\..+\.[A-Za-z0-9_-]{43}$/u);
    expect(artifact.change[0]?.accessToken).toMatch(/^v1\..+\.[A-Za-z0-9_-]{43}$/u);
    expect(artifact.readTraffic[0]?.accessToken).toMatch(/^v1\..+\.[A-Za-z0-9_-]{43}$/u);
    expect(serialized).not.toContain(artifact.signup[0]?.verificationGrant ?? 'missing');
    expect(serialized).not.toContain(artifact.reset[0]?.verificationGrant ?? 'missing');
    expect(serialized).not.toContain(artifact.change[0]?.accessToken ?? 'missing');
    expect(serialized).not.toContain(artifact.readTraffic[0]?.accessToken ?? 'missing');
    expect(serialized).not.toContain(artifact.signup[0]?.password ?? 'missing');
  });
});
