import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LEGAL_ACCEPTANCE_STALE_NOTICE,
  initialSignupFlowState,
  signupFlowReducer,
  type SignupFlowState,
} from '../signup-flow.reducer';

function reduce(actions: Parameters<typeof signupFlowReducer>[1][]): SignupFlowState {
  return actions.reduce(signupFlowReducer, initialSignupFlowState);
}

describe('signupFlowReducer', () => {
  it('next/back으로 final 4-step flow를 이동한다', () => {
    const legal = signupFlowReducer(initialSignupFlowState, { type: 'GO_NEXT' });
    const account = signupFlowReducer(legal, { type: 'GO_NEXT' });
    const backToLegal = signupFlowReducer(account, { type: 'GO_BACK' });

    expect(legal.currentStepId).toBe('LEGAL_CONSENT');
    expect(account.currentStepId).toBe('ACCOUNT_IDENTITY');
    expect(backToLegal.currentStepId).toBe('LEGAL_CONSENT');
  });

  it('email 인증 만료 시 인증 단계로 돌아가고 resume target을 보존한다', () => {
    const state = reduce([
      { type: 'GO_NEXT' },
      { type: 'GO_NEXT' },
      { type: 'EMAIL_VERIFICATION_EXPIRED', resumeStepId: 'ACCOUNT_IDENTITY' },
    ]);

    expect(state).toMatchObject({
      currentStepId: 'EMAIL_VERIFICATION',
      isEmailVerified: false,
      resumeStepAfterVerification: 'ACCOUNT_IDENTITY',
      submitStatus: 'failed',
      submitError: '이메일 인증을 먼저 완료해주세요.',
    });

    const verified = signupFlowReducer(state, { type: 'EMAIL_VERIFIED' });
    expect(verified.currentStepId).toBe('ACCOUNT_IDENTITY');
    expect(verified.resumeStepAfterVerification).toBeNull();
    expect(verified.submitError).toBe('');
  });

  it('legal stale이면 약관 단계로 이동하고 refresh nonce를 증가시킨다', () => {
    const state = reduce([
      { type: 'GO_NEXT' },
      { type: 'GO_NEXT' },
      { type: 'LEGAL_ACCEPTANCES_STALE' },
    ]);

    expect(state.currentStepId).toBe('LEGAL_CONSENT');
    expect(state.legalNotice).toBe(DEFAULT_LEGAL_ACCEPTANCE_STALE_NOTICE);
    expect(state.legalRefreshNonce).toBe(1);
    expect(state.submitStatus).toBe('idle');
  });

  it('complete 이후 back/next/submit failure는 no-op이고 reset만 허용한다', () => {
    const complete = signupFlowReducer(initialSignupFlowState, { type: 'SUBMIT_SUCCEEDED' });
    const afterBack = signupFlowReducer(complete, { type: 'GO_BACK' });
    const afterNext = signupFlowReducer(afterBack, { type: 'GO_NEXT' });
    const afterFailure = signupFlowReducer(afterNext, { type: 'SUBMIT_FAILED', error: 'failed' });

    expect(afterFailure).toEqual(complete);
    expect(signupFlowReducer(complete, { type: 'RESET_FLOW' })).toEqual(initialSignupFlowState);
  });
});
