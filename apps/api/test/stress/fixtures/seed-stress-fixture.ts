import { fileURLToPath } from 'node:url';

import {
  assertStressTargetAllowed,
  resolveStressTargetGuardInputFromEnv,
} from '../safety/stress-target.guard.js';
import { createStressFixtureConfigFromEnv } from './stress-fixture.config.js';
import { buildStressFixturePlan, buildStressFixtureSafeSummary } from './stress-fixture.plan.js';

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
      'Phase 5 seed runner is intentionally dry-run only; later stress phases can attach guarded Prisma writes to this deterministic plan.',
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    console.log(JSON.stringify(buildStressFixtureSeedDryRunSummary(), null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
