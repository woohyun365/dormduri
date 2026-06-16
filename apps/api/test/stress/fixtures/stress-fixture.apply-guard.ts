import {
  assertStressTargetAllowed,
  resolveStressTargetGuardInputFromEnv,
  type StressTargetGuardResult,
} from '../safety/stress-target.guard.js';

export const STRESS_FIXTURE_APPLY_VALUE = 'I_UNDERSTAND_STAGING_FIXTURE' as const;

export class StressFixtureApplyGuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StressFixtureApplyGuardError';
  }
}

export interface StressFixtureApplyGuardResult {
  readonly target: StressTargetGuardResult;
  readonly applyEnabled: true;
}

export function isStressFixtureApplyRequested(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.STRESS_FIXTURE_APPLY === STRESS_FIXTURE_APPLY_VALUE;
}

export function assertStressFixtureApplyAllowed(
  env: NodeJS.ProcessEnv = process.env,
): StressFixtureApplyGuardResult {
  const target = assertStressTargetAllowed(resolveStressTargetGuardInputFromEnv(env));

  if (!isStressFixtureApplyRequested(env)) {
    throw new StressFixtureApplyGuardError(
      `STRESS_FIXTURE_APPLY=${STRESS_FIXTURE_APPLY_VALUE} is required before stress fixture DB mutation.`,
    );
  }

  if (target.stressEnv === 'production' || target.productionOverride) {
    throw new StressFixtureApplyGuardError(
      'Stress fixture DB mutation is disabled for production targets, even when stress production override is present.',
    );
  }

  return {
    target,
    applyEnabled: true,
  };
}
