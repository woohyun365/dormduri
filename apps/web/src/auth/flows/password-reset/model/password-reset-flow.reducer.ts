import type { PasswordResetFlowAction, PasswordResetFlowState } from './password-reset-flow.types';

export const initialPasswordResetFlowState: PasswordResetFlowState = {
  step: 'email',
  operation: 'idle',
  email: '',
};

function emailEntryState(email: string): PasswordResetFlowState {
  return {
    step: 'email',
    operation: 'idle',
    email,
  };
}

export function passwordResetFlowReducer(
  state: PasswordResetFlowState,
  action: PasswordResetFlowAction,
): PasswordResetFlowState {
  switch (action.type) {
    case 'emailChanged':
      return emailEntryState(action.email);

    case 'sendCodeStarted':
      if (state.step === 'email') {
        return { ...state, operation: 'submitting' };
      }
      if (state.step === 'verification') {
        return { ...state, operation: 'resending' };
      }
      return state;

    case 'sendCodeSucceeded':
      if (state.step !== 'email' && state.step !== 'verification') {
        return state;
      }
      return {
        step: 'verification',
        operation: 'idle',
        email: action.email,
        verificationCode: '',
        codeExpiresAt: action.codeExpiresAt,
      };

    case 'sendCodeFailed':
      if (state.step !== 'email' && state.step !== 'verification') {
        return state;
      }
      return { ...state, operation: 'idle' };

    case 'verificationCodeChanged':
      if (state.step !== 'verification') {
        return state;
      }
      return { ...state, verificationCode: action.verificationCode };

    case 'verifyCodeStarted':
      if (state.step !== 'verification') {
        return state;
      }
      return { ...state, operation: 'verifying' };

    case 'verifyCodeSucceeded':
      if (state.step !== 'verification') {
        return state;
      }
      return {
        step: 'verified',
        operation: 'idle',
        email: state.email,
        grantExpiresAt: action.grantExpiresAt,
      };

    case 'verifyCodeFailed':
      if (state.step !== 'verification') {
        return state;
      }
      return { ...state, operation: 'idle' };

    case 'continueAfterVerification':
      if (state.step !== 'verified') {
        return state;
      }
      return {
        step: 'newPassword',
        operation: 'idle',
        email: state.email,
        newPassword: '',
        confirmPassword: '',
        grantExpiresAt: state.grantExpiresAt,
      };

    case 'newPasswordChanged':
      if (state.step !== 'newPassword') {
        return state;
      }
      return { ...state, newPassword: action.newPassword };

    case 'confirmPasswordChanged':
      if (state.step !== 'newPassword') {
        return state;
      }
      return { ...state, confirmPassword: action.confirmPassword };

    case 'resetPasswordStarted':
      if (state.step !== 'newPassword') {
        return state;
      }
      return { ...state, operation: 'submitting' };

    case 'resetPasswordSucceeded':
      if (state.step !== 'newPassword') {
        return state;
      }
      return { step: 'complete', operation: 'idle' };

    case 'resetPasswordFailed':
      if (state.step !== 'newPassword') {
        return state;
      }
      return { ...state, operation: 'idle' };

    case 'backToEmail':
      if (state.step !== 'verification') {
        return state;
      }
      return emailEntryState(state.email);

    case 'restartEmailEntry':
      if (state.step === 'complete') {
        return initialPasswordResetFlowState;
      }
      return emailEntryState(state.email);

    default:
      return state;
  }
}
