import { fileURLToPath } from 'node:url';

import {
  assertStressTargetAllowed,
  resolveStressTargetGuardInputFromEnv,
} from '../safety/stress-target.guard.js';
import { createStressFixtureConfigFromEnv } from './stress-fixture.config.js';

export interface StressFixtureResetDryRunSummary {
  readonly mode: 'dry-run';
  readonly databaseMutation: false;
  readonly target: {
    readonly hostname: string;
    readonly stressEnv: string;
  };
  readonly marker: string;
  readonly resetScope: readonly string[];
  readonly nextStep: string;
}

export function buildStressFixtureResetDryRunSummary(
  env: NodeJS.ProcessEnv = process.env,
): StressFixtureResetDryRunSummary {
  const target = assertStressTargetAllowed(resolveStressTargetGuardInputFromEnv(env));
  const config = createStressFixtureConfigFromEnv(env);
  assertStressResetMarker(config.prefix);

  return {
    mode: 'dry-run',
    databaseMutation: false,
    target: {
      hostname: target.hostname,
      stressEnv: target.stressEnv,
    },
    marker: config.prefix,
    resetScope: [
      `User.id startsWith ${config.prefix}-user-`,
      `SeasonParticipant.id startsWith ${config.prefix}-participant-`,
      `SeasonParticipantProfile.id startsWith ${config.prefix}-profile-`,
      `Dormitory.id startsWith ${config.prefix}-dormitory-`,
      `Season.id equals ${config.seasonId}`,
    ],
    nextStep:
      'Phase 5 reset runner is intentionally dry-run only; later stress phases can attach guarded Prisma deletes to this marker-only scope.',
  };
}

export function assertStressResetMarker(marker: string) {
  if (!marker.includes('stress')) {
    throw new Error(
      'Stress reset marker must include "stress" to avoid real data reset by mistake.',
    );
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    console.log(JSON.stringify(buildStressFixtureResetDryRunSummary(), null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
