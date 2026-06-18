import { describe, expect, it } from 'vitest';

import {
  getStressRedactedPlaceholder,
  redactStressFixtureSecrets,
} from '../safety/stress-secret-redaction.js';
import { STRESS_FIXTURE_APPLY_VALUE } from './stress-fixture.apply-guard.js';
import { buildStressActorTokenArtifact } from './stress-fixture.auth-tokens.js';

describe('stress fixture auth token artifact', () => {
  it('logs in bounded stress actors and keeps raw tokens redactable', async () => {
    const artifact = await buildStressActorTokenArtifact(
      {
        STRESS_TARGET_URL: 'http://127.0.0.1:4000',
        STRESS_FIXTURE_APPLY: STRESS_FIXTURE_APPLY_VALUE,
        STRESS_FIXTURE_PREFIX: 'stress-token',
        STRESS_LARGEST_COHORT_SIZE: '4',
        STRESS_COHORT_SIZE: '12',
        STRESS_TOKEN_ACTOR_LIMIT: '3',
      },
      ({ email }) => Promise.resolve(`token-for-${email}`),
    );

    expect(artifact.actors).toHaveLength(3);
    expect(artifact.actors[0]).toMatchObject({
      actorId: 'stress-token-actor-0001',
      targetUserId: 'stress-token-user-0002',
    });
    expect(JSON.stringify(redactStressFixtureSecrets(artifact))).toContain(
      getStressRedactedPlaceholder(),
    );
    expect(JSON.stringify(redactStressFixtureSecrets(artifact))).not.toContain('token-for-');
  });
});
