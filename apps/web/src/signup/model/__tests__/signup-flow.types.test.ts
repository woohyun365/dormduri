import { describe, expect, it } from 'vitest';
import {
  getNextSignupStep,
  getPreviousSignupStep,
  getSignupStepIndex,
  getSignupStepProgress,
  SIGNUP_STEP_COUNT,
  SIGNUP_STEPS,
} from '../signup-flow.types';

describe('signup flow step registry', () => {
  it('final account signup flow를 4단계로 고정한다', () => {
    expect(SIGNUP_STEP_COUNT).toBe(4);
    expect(SIGNUP_STEPS.map((step) => step.id)).toEqual([
      'EMAIL_VERIFICATION',
      'LEGAL_CONSENT',
      'ACCOUNT_IDENTITY',
      'COMPLETE',
    ]);
    expect(SIGNUP_STEPS.at(-1)).toMatchObject({ id: 'COMPLETE', isTerminal: true });
  });

  it('step order와 progress를 안정적으로 계산한다', () => {
    expect(getSignupStepIndex('EMAIL_VERIFICATION')).toBe(0);
    expect(getSignupStepIndex('ACCOUNT_IDENTITY')).toBe(2);
    expect(getSignupStepProgress('LEGAL_CONSENT')).toEqual({
      currentStep: 2,
      totalSteps: 4,
      percent: 50,
    });
  });

  it('next/back helper는 boundary에서 같은 step에 머문다', () => {
    expect(getNextSignupStep('EMAIL_VERIFICATION')).toBe('LEGAL_CONSENT');
    expect(getNextSignupStep('COMPLETE')).toBe('COMPLETE');
    expect(getPreviousSignupStep('COMPLETE')).toBe('ACCOUNT_IDENTITY');
    expect(getPreviousSignupStep('EMAIL_VERIFICATION')).toBe('EMAIL_VERIFICATION');
  });
});
