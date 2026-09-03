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
  materializeStressFixture,
  type StressFixtureMaterializationSummary,
} from './stress-fixture.materializer.js';
import { buildStressFixturePlan, buildStressFixtureSafeSummary } from './stress-fixture.plan.js';

export type StressFixtureSeedSummary =
  StressFixtureSeedDryRunSummary | StressFixtureMaterializationSummary;

export interface StressFixtureSeedDryRunSummary {
  readonly mode: 'dry-run';
  readonly databaseMutation: false;
  readonly target: {
    readonly hostname: string;
    readonly stressEnv: string;
  };
  readonly fixture: ReturnType<typeof buildStressFixtureSafeSummary>;
  readonly nextStep: string;
}

export function buildStressFixtureSeedDryRunSummary(
  env: NodeJS.ProcessEnv = process.env,
): StressFixtureSeedDryRunSummary {
  const target = assertStressTargetAllowed(resolveStressTargetGuardInputFromEnv(env));
  const plan = buildStressFixturePlan(createStressFixtureConfigFromEnv(env));

  return {
    mode: 'dry-run',
    databaseMutation: false,
    target: {
      hostname: target.hostname,
      stressEnv: target.stressEnv,
    },
    fixture: buildStressFixtureSafeSummary(plan),
    nextStep:
      'Set STRESS_FIXTURE_APPLY=I_UNDERSTAND_STAGING_FIXTURE for local/staging-only DB materialization. Production fixture DB mutation remains disabled.',
  };
}

export async function runStressFixtureSeed(
  env: NodeJS.ProcessEnv = process.env,
): Promise<StressFixtureSeedSummary> {
  if (!isStressFixtureApplyRequested(env)) {
    return buildStressFixtureSeedDryRunSummary(env);
  }

  assertStressFixtureApplyAllowed(env);
  const plan = buildStressFixturePlan(createStressFixtureConfigFromEnv(env));
  const prisma = createStressFixturePrismaClient(env);

  try {
    return await materializeStressFixture(prisma.client, plan, { now: new Date() });
  } finally {
    await prisma.disconnect();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const summary = await runStressFixtureSeed();
    console.log(JSON.stringify(redactStressFixtureSecrets(summary), null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
