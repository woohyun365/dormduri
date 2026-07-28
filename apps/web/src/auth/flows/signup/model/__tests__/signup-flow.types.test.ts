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
  it('서로 다른 입력 책임을 분리한 5단계 flow를 고정한다', () => {
    expect(SIGNUP_STEP_COUNT).toBe(5);
    expect(SIGNUP_STEPS.map((step) => step.id)).toEqual([
      'EMAIL_VERIFICATION',
      'LEGAL_CONSENT',
      'ACCOUNT_CREDENTIALS',
      'ACADEMIC_IDENTITY',
      'COMPLETE',
    ]);
    expect(SIGNUP_STEPS.at(-1)).toMatchObject({ id: 'COMPLETE', isTerminal: true });
  });

  it('step order와 progress를 안정적으로 계산한다', () => {
    expect(getSignupStepIndex('EMAIL_VERIFICATION')).toBe(0);
    expect(getSignupStepIndex('ACCOUNT_CREDENTIALS')).toBe(2);
    expect(getSignupStepIndex('ACADEMIC_IDENTITY')).toBe(3);
    expect(getSignupStepProgress('LEGAL_CONSENT')).toEqual({
      currentStep: 2,
      totalSteps: 5,
      percent: 40,
    });
  });

  it('next/back helper는 boundary에서 같은 step에 머문다', () => {
    expect(getNextSignupStep('EMAIL_VERIFICATION')).toBe('LEGAL_CONSENT');
    expect(getNextSignupStep('COMPLETE')).toBe('COMPLETE');
    expect(getPreviousSignupStep('COMPLETE')).toBe('ACADEMIC_IDENTITY');
    expect(getPreviousSignupStep('EMAIL_VERIFICATION')).toBe('EMAIL_VERIFICATION');
  });
});
