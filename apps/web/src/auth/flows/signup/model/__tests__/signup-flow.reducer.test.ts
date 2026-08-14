import { describe, expect, it } from 'vitest';
import {
  initialSignupFlowState,
  signupFlowReducer,
  type SignupFlowState,
} from '../signup-flow.reducer';

const VERIFIED_AT = '2026-07-27T00:00:00.000Z';

function reduce(actions: Parameters<typeof signupFlowReducer>[1][]): SignupFlowState {
  return actions.reduce(signupFlowReducer, initialSignupFlowState);
}

describe('signupFlowReducer', () => {
  it('next/back으로 final 5-step flow를 이동한다', () => {
    const legal = signupFlowReducer(initialSignupFlowState, { type: 'GO_NEXT' });
    const credentials = signupFlowReducer(legal, { type: 'GO_NEXT' });
    const academic = signupFlowReducer(credentials, { type: 'GO_NEXT' });
    const backToCredentials = signupFlowReducer(academic, { type: 'GO_BACK' });

    expect(legal.currentStepId).toBe('LEGAL_CONSENT');
    expect(credentials.currentStepId).toBe('ACCOUNT_CREDENTIALS');
    expect(academic.currentStepId).toBe('ACADEMIC_IDENTITY');
    expect(backToCredentials.currentStepId).toBe('ACCOUNT_CREDENTIALS');
  });

  it('인증 proof 만료는 이메일 단계로 초기화하고 만료 진입 사유를 보존한다', () => {
    const academic = reduce([{ type: 'GO_NEXT' }, { type: 'GO_NEXT' }, { type: 'GO_NEXT' }]);
    const expired = signupFlowReducer(academic, { type: 'EMAIL_PROOF_EXPIRED' });

    expect(expired).toMatchObject({
      currentStepId: 'EMAIL_VERIFICATION',
      isEmailVerified: false,
      emailVerifiedAt: null,
      recoveryReason: 'EMAIL_PROOF_EXPIRED',
      submitStatus: 'idle',
      failure: null,
    });
  });

  it('field failure는 해당 입력 단계와 필드 오류로 복구한다', () => {
    const state = signupFlowReducer(initialSignupFlowState, {
      type: 'SUBMIT_FAILED',
      failure: {
        kind: 'field_error',
        code: 'AUTH_NICKNAME_ALREADY_TAKEN',
        message: '이미 사용 중인 닉네임입니다.',
        targetStepId: 'ACCOUNT_CREDENTIALS',
        fieldErrors: { nickname: '이미 사용 중인 닉네임입니다.' },
      },
    });

    expect(state).toMatchObject({
      currentStepId: 'ACCOUNT_CREDENTIALS',
      submitStatus: 'failed',
      failure: {
        kind: 'field_error',
        fieldErrors: { nickname: '이미 사용 중인 닉네임입니다.' },
      },
    });
  });

  it('email field failure는 기존 인증 proof를 폐기하고 이메일 단계에서 다시 시작한다', () => {
    const verified = signupFlowReducer(initialSignupFlowState, {
      type: 'EMAIL_VERIFIED',
      verifiedAt: VERIFIED_AT,
    });
    const failed = signupFlowReducer(verified, {
      type: 'SUBMIT_FAILED',
      failure: {
        kind: 'field_error',
        code: 'AUTH_EMAIL_ALREADY_REGISTERED',
        message: '이미 가입된 이메일입니다.',
        targetStepId: 'EMAIL_VERIFICATION',
        fieldErrors: { email: '이미 가입된 이메일입니다.' },
      },
    });

    expect(failed).toMatchObject({
      currentStepId: 'EMAIL_VERIFICATION',
      isEmailVerified: false,
      emailVerifiedAt: null,
    });
  });

  it('legal stale이면 약관 단계로 이동하고 재확인 상태를 구조화한다', () => {
    const state = reduce([
      { type: 'GO_NEXT' },
      { type: 'GO_NEXT' },
      { type: 'LEGAL_ACCEPTANCES_STALE' },
    ]);

    expect(state.currentStepId).toBe('LEGAL_CONSENT');
    expect(state.requiresLegalReconfirmation).toBe(true);
    expect(state.legalRefreshNonce).toBe(1);
    expect(state.submitStatus).toBe('idle');
  });

  it('complete 이후 back/next/submit failure는 no-op이고 reset만 허용한다', () => {
    const complete = signupFlowReducer(initialSignupFlowState, { type: 'SUBMIT_SUCCEEDED' });
    const afterBack = signupFlowReducer(complete, { type: 'GO_BACK' });
    const afterNext = signupFlowReducer(afterBack, { type: 'GO_NEXT' });
    const afterFailure = signupFlowReducer(afterNext, {
      type: 'SUBMIT_FAILED',
      failure: {
        kind: 'retryable',
        code: 'UNKNOWN',
        message: 'failed',
      },
    });

    expect(afterFailure).toEqual(complete);
    expect(signupFlowReducer(complete, { type: 'RESET_FLOW' })).toEqual(initialSignupFlowState);
  });
});
