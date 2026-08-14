import { describe, expect, it } from 'vitest';
import {
  initialPasswordResetFlowState,
  passwordResetFlowReducer,
} from '../password-reset-flow.reducer';
import type { PasswordResetFlowAction } from '../password-reset-flow.types';

const CODE_EXPIRES_AT = Date.parse('2026-07-31T04:00:00.000Z');
const GRANT_EXPIRES_AT = Date.parse('2026-07-31T04:15:00.000Z');

function reduce(actions: PasswordResetFlowAction[]) {
  return actions.reduce(passwordResetFlowReducer, initialPasswordResetFlowState);
}

describe('passwordResetFlowReducer', () => {
  it('code request 성공은 임의 중간 상태 없이 verification 단계로 전환한다', () => {
    const state = reduce([
      { type: 'emailChanged', email: 'test@kangwon.ac.kr' },
      { type: 'sendCodeStarted' },
      {
        type: 'sendCodeSucceeded',
        email: 'test@kangwon.ac.kr',
        codeExpiresAt: CODE_EXPIRES_AT,
      },
    ]);

    expect(state).toEqual({
      step: 'verification',
      operation: 'idle',
      email: 'test@kangwon.ac.kr',
      verificationCode: '',
      codeExpiresAt: CODE_EXPIRES_AT,
    });
  });

  it('code 확인 성공은 인증 코드를 제거하고 사용자 진행을 기다리는 verified 상태로 이동한다', () => {
    const state = reduce([
      { type: 'emailChanged', email: 'test@kangwon.ac.kr' },
      {
        type: 'sendCodeSucceeded',
        email: 'test@kangwon.ac.kr',
        codeExpiresAt: CODE_EXPIRES_AT,
      },
      { type: 'verificationCodeChanged', verificationCode: '123456' },
      { type: 'verifyCodeStarted' },
      { type: 'verifyCodeSucceeded', grantExpiresAt: GRANT_EXPIRES_AT },
    ]);

    expect(state).toEqual({
      step: 'verified',
      operation: 'idle',
      email: 'test@kangwon.ac.kr',
      grantExpiresAt: GRANT_EXPIRES_AT,
    });
    expect('verificationCode' in state).toBe(false);
  });

  it('verified 상태에서 사용자 진행 action이 있어야 새 비밀번호 단계로 이동한다', () => {
    const verifiedState = reduce([
      { type: 'emailChanged', email: 'test@kangwon.ac.kr' },
      {
        type: 'sendCodeSucceeded',
        email: 'test@kangwon.ac.kr',
        codeExpiresAt: CODE_EXPIRES_AT,
      },
      { type: 'verifyCodeSucceeded', grantExpiresAt: GRANT_EXPIRES_AT },
    ]);

    expect(passwordResetFlowReducer(verifiedState, { type: 'continueAfterVerification' })).toEqual({
      step: 'newPassword',
      operation: 'idle',
      email: 'test@kangwon.ac.kr',
      newPassword: '',
      confirmPassword: '',
      grantExpiresAt: GRANT_EXPIRES_AT,
    });
  });

  it('reset 성공은 민감 입력을 제거한 complete 상태로 전환한다', () => {
    const state = reduce([
      { type: 'emailChanged', email: 'test@kangwon.ac.kr' },
      {
        type: 'sendCodeSucceeded',
        email: 'test@kangwon.ac.kr',
        codeExpiresAt: CODE_EXPIRES_AT,
      },
      { type: 'verifyCodeSucceeded', grantExpiresAt: GRANT_EXPIRES_AT },
      { type: 'continueAfterVerification' },
      { type: 'newPasswordChanged', newPassword: 'Test1234' },
      { type: 'confirmPasswordChanged', confirmPassword: 'Test1234' },
      { type: 'resetPasswordStarted' },
      { type: 'resetPasswordSucceeded' },
    ]);

    expect(state).toEqual({ step: 'complete', operation: 'idle' });
  });

  it('email 변경과 restart는 단계별 민감 입력을 구조에서 제거한다', () => {
    const dirtyState = reduce([
      { type: 'emailChanged', email: 'first@kangwon.ac.kr' },
      {
        type: 'sendCodeSucceeded',
        email: 'first@kangwon.ac.kr',
        codeExpiresAt: CODE_EXPIRES_AT,
      },
      { type: 'verifyCodeSucceeded', grantExpiresAt: GRANT_EXPIRES_AT },
      { type: 'continueAfterVerification' },
      { type: 'newPasswordChanged', newPassword: 'Test1234' },
      { type: 'confirmPasswordChanged', confirmPassword: 'Test1234' },
    ]);

    expect(
      passwordResetFlowReducer(dirtyState, {
        type: 'emailChanged',
        email: 'next@kangwon.ac.kr',
      }),
    ).toEqual({
      step: 'email',
      operation: 'idle',
      email: 'next@kangwon.ac.kr',
    });

    expect(passwordResetFlowReducer(dirtyState, { type: 'restartEmailEntry' })).toEqual({
      step: 'email',
      operation: 'idle',
      email: 'first@kangwon.ac.kr',
    });
  });

  it('새 비밀번호 단계에서는 일반 뒤로가기 action으로 인증 단계에 돌아가지 않는다', () => {
    const state = reduce([
      { type: 'emailChanged', email: 'test@kangwon.ac.kr' },
      {
        type: 'sendCodeSucceeded',
        email: 'test@kangwon.ac.kr',
        codeExpiresAt: CODE_EXPIRES_AT,
      },
      { type: 'verifyCodeSucceeded', grantExpiresAt: GRANT_EXPIRES_AT },
      { type: 'continueAfterVerification' },
    ]);

    expect(passwordResetFlowReducer(state, { type: 'backToEmail' })).toBe(state);
  });
});
