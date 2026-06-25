import { describe, expect, it } from 'vitest';
import {
  initialPasswordResetFlowState,
  passwordResetFlowReducer,
} from '../password-reset-flow.reducer';

function reduce(actions: Parameters<typeof passwordResetFlowReducer>[1][]) {
  return actions.reduce(passwordResetFlowReducer, initialPasswordResetFlowState);
}

describe('passwordResetFlowReducer', () => {
  it('send success 후 verification 단계 진입에 필요한 requestedEmail을 보존한다', () => {
    const state = reduce([
      { type: 'emailChanged', email: 'test@kangwon.ac.kr' },
      { type: 'sendCodeStarted' },
      { type: 'sendCodeSucceeded', email: 'test@kangwon.ac.kr' },
      { type: 'enterVerification' },
    ]);

    expect(state).toMatchObject({
      step: 'verification',
      email: 'test@kangwon.ac.kr',
      requestedEmail: 'test@kangwon.ac.kr',
      isSendingCode: false,
    });
  });

  it('verify success 시 verificationCode를 지우고 새 비밀번호 단계로 이동한다', () => {
    const state = reduce([
      { type: 'emailChanged', email: 'test@kangwon.ac.kr' },
      { type: 'sendCodeSucceeded', email: 'test@kangwon.ac.kr' },
      { type: 'enterVerification' },
      { type: 'verificationCodeChanged', verificationCode: '123456' },
      { type: 'verifyCodeStarted' },
      { type: 'verifyCodeSucceeded' },
    ]);

    expect(state.step).toBe('newPassword');
    expect(state.verificationCode).toBe('');
    expect(state.isVerifyingCode).toBe(false);
  });

  it('reset success 시 password fields를 지우고 complete 단계로 이동한다', () => {
    const state = reduce([
      { type: 'emailChanged', email: 'test@kangwon.ac.kr' },
      { type: 'sendCodeSucceeded', email: 'test@kangwon.ac.kr' },
      { type: 'enterVerification' },
      { type: 'verifyCodeSucceeded' },
      { type: 'newPasswordChanged', newPassword: 'Test1234' },
      { type: 'confirmPasswordChanged', confirmPassword: 'Test1234' },
      { type: 'resetPasswordStarted' },
      { type: 'resetPasswordSucceeded' },
    ]);

    expect(state.step).toBe('complete');
    expect(state.newPassword).toBe('');
    expect(state.confirmPassword).toBe('');
    expect(state.verificationCode).toBe('');
    expect(state.isResettingPassword).toBe(false);
  });

  it('email 변경과 restart는 민감 입력값과 requestedEmail을 제거한다', () => {
    const dirtyState = reduce([
      { type: 'emailChanged', email: 'first@kangwon.ac.kr' },
      { type: 'sendCodeSucceeded', email: 'first@kangwon.ac.kr' },
      { type: 'enterVerification' },
      { type: 'verificationCodeChanged', verificationCode: '123456' },
      { type: 'verifyCodeSucceeded' },
      { type: 'newPasswordChanged', newPassword: 'Test1234' },
      { type: 'confirmPasswordChanged', confirmPassword: 'Test1234' },
    ]);

    const changed = passwordResetFlowReducer(dirtyState, {
      type: 'emailChanged',
      email: 'next@kangwon.ac.kr',
    });

    expect(changed).toMatchObject({
      step: 'email',
      email: 'next@kangwon.ac.kr',
      requestedEmail: '',
      verificationCode: '',
      newPassword: '',
      confirmPassword: '',
    });

    const restarted = passwordResetFlowReducer(dirtyState, { type: 'restartEmailEntry' });
    expect(restarted).toMatchObject({
      step: 'email',
      requestedEmail: '',
      verificationCode: '',
      newPassword: '',
      confirmPassword: '',
    });
    expect(restarted.email).toBe('first@kangwon.ac.kr');
  });
});
