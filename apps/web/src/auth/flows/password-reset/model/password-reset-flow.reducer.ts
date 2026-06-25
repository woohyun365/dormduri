import type { PasswordResetFlowAction, PasswordResetFlowState } from './password-reset-flow.types';

export const initialPasswordResetFlowState: PasswordResetFlowState = {
  step: 'email',
  email: '',
  requestedEmail: '',
  verificationCode: '',
  newPassword: '',
  confirmPassword: '',
  isSendingCode: false,
  isVerifyingCode: false,
  isResettingPassword: false,
};

function clearSensitiveFields(state: PasswordResetFlowState): PasswordResetFlowState {
  return {
    ...state,
    verificationCode: '',
    newPassword: '',
    confirmPassword: '',
  };
}

function clearPendingFlags(state: PasswordResetFlowState): PasswordResetFlowState {
  return {
    ...state,
    isSendingCode: false,
    isVerifyingCode: false,
    isResettingPassword: false,
  };
}

export function passwordResetFlowReducer(
  state: PasswordResetFlowState,
  action: PasswordResetFlowAction,
): PasswordResetFlowState {
  switch (action.type) {
    case 'emailChanged':
      return {
        ...clearPendingFlags(clearSensitiveFields(state)),
        step: 'email',
        email: action.email,
        requestedEmail: '',
      };

    case 'sendCodeStarted':
      return {
        ...state,
        isSendingCode: true,
      };

    case 'sendCodeSucceeded':
      return {
        ...state,
        requestedEmail: action.email,
        isSendingCode: false,
      };

    case 'sendCodeFailed':
      return {
        ...state,
        isSendingCode: false,
      };

    case 'enterVerification':
      return {
        ...state,
        step: 'verification',
      };

    case 'verificationCodeChanged':
      return {
        ...state,
        verificationCode: action.verificationCode,
      };

    case 'verifyCodeStarted':
      return {
        ...state,
        isVerifyingCode: true,
      };

    case 'verifyCodeSucceeded':
      return {
        ...state,
        step: 'newPassword',
        verificationCode: '',
        isVerifyingCode: false,
      };

    case 'verifyCodeFailed':
      return {
        ...state,
        isVerifyingCode: false,
      };

    case 'newPasswordChanged':
      return {
        ...state,
        newPassword: action.newPassword,
      };

    case 'confirmPasswordChanged':
      return {
        ...state,
        confirmPassword: action.confirmPassword,
      };

    case 'resetPasswordStarted':
      return {
        ...state,
        isResettingPassword: true,
      };

    case 'resetPasswordSucceeded':
      return {
        ...state,
        step: 'complete',
        verificationCode: '',
        newPassword: '',
        confirmPassword: '',
        isResettingPassword: false,
      };

    case 'resetPasswordFailed':
      return {
        ...state,
        isResettingPassword: false,
      };

    case 'backToEmail':
      return {
        ...clearSensitiveFields(state),
        step: 'email',
        isVerifyingCode: false,
        isResettingPassword: false,
      };

    case 'backToVerification':
      return {
        ...state,
        step: 'verification',
        newPassword: '',
        confirmPassword: '',
        isResettingPassword: false,
      };

    case 'restartEmailEntry':
      return {
        ...initialPasswordResetFlowState,
        email: state.email,
      };

    default:
      return state;
  }
}
