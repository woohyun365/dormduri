import { fileURLToPath } from 'node:url';

import { redactStressFixtureSecrets } from '../safety/stress-secret-redaction.js';
import {
  assertStressTargetAllowed,
  resolveStressTargetGuardInputFromEnv,
} from '../safety/stress-target.guard.js';
import {
  assertStressFixtureApplyAllowed,
  isStressFixtureApplyRequested,
} from './stress-fixture.apply-guard.js';
import { createStressFixtureConfigFromEnv } from './stress-fixture.config.js';
import {
  createStressFixturePrismaClient,
  resetStressFixture,
  type StressFixtureResetSummary as AppliedStressFixtureResetSummary,
} from './stress-fixture.materializer.js';
import { buildStressFixturePlan } from './stress-fixture.plan.js';

export type StressFixtureResetSummary =
  | StressFixtureResetDryRunSummary
  | AppliedStressFixtureResetSummary;

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
      `ReportCase.id startsWith ${config.prefix}`,
      `SupportTicket.id startsWith ${config.prefix}`,
      `ConversationThread.id startsWith ${config.prefix}`,
      `MatchRequest.id startsWith ${config.prefix}`,
      `UserBookmark.id startsWith ${config.prefix}`,
      `User.id startsWith ${config.prefix}-user-`,
      `SeasonParticipant.id startsWith ${config.prefix}-participant-`,
      `SeasonParticipantProfile.participantId startsWith ${config.prefix}-participant-`,
      `Dormitory.id startsWith ${config.prefix}-dormitory-`,
      `Season.id equals ${config.seasonId}`,
    ],
    nextStep:
      'Set STRESS_FIXTURE_APPLY=I_UNDERSTAND_STAGING_FIXTURE for local/staging-only marker reset. Production fixture DB mutation remains disabled.',
  };
}

export async function runStressFixtureReset(
  env: NodeJS.ProcessEnv = process.env,
): Promise<StressFixtureResetSummary> {
  if (!isStressFixtureApplyRequested(env)) {
    return buildStressFixtureResetDryRunSummary(env);
  }

  assertStressFixtureApplyAllowed(env);
  const plan = buildStressFixturePlan(createStressFixtureConfigFromEnv(env));
  const prisma = createStressFixturePrismaClient(env);

  try {
    return await resetStressFixture(prisma.client, plan);
  } finally {
    await prisma.disconnect();
  }
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
    const summary = await runStressFixtureReset();
    console.log(JSON.stringify(redactStressFixtureSecrets(summary), null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
