import { describe, expect, it } from 'vitest';

import {
  assertStressTargetAllowed,
  evaluateStressTarget,
  STRESS_PRODUCTION_OVERRIDE_VALUE,
  StressTargetGuardError,
} from './stress-target.guard.js';

describe('stress target guard', () => {
  it('allows localhost targets by default', () => {
    const target = assertStressTargetAllowed({ targetUrl: 'http://127.0.0.1:4000' });

    expect(target.hostname).toBe('127.0.0.1');
    expect(target.isLocalTarget).toBe(true);
    expect(target.productionOverride).toBe(false);
  });

  it('allows staging targets only when host is explicitly allowlisted', () => {
    const target = assertStressTargetAllowed({
      targetUrl: 'https://staging-api.knu-roommate.internal',
      stressEnv: 'staging',
      allowedHosts: 'staging-api.knu-roommate.internal',
    });

    expect(target.stressEnv).toBe('staging');
    expect(target.isExplicitlyAllowedHost).toBe(true);
  });

  it('rejects production-like public hosts without explicit override', () => {
    const result = evaluateStressTarget({
      targetUrl: 'https://api.knu-roommate.example',
      stressEnv: 'staging',
    });

    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.reason).toContain('production-like');
    }
  });

  it('rejects NODE_ENV production even for localhost unless override is explicit', () => {
    expect(() =>
      assertStressTargetAllowed({
        targetUrl: 'http://localhost:4000',
        nodeEnv: 'production',
      }),
    ).toThrow(StressTargetGuardError);
  });

  it('allows approved production override and surfaces a warning', () => {
    const target = assertStressTargetAllowed({
      targetUrl: 'https://api.knu-roommate.example',
      stressEnv: 'production',
      allowProduction: STRESS_PRODUCTION_OVERRIDE_VALUE,
    });

    expect(target.productionOverride).toBe(true);
    expect(target.warnings).toHaveLength(1);
  });
});
