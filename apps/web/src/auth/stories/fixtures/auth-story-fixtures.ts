import type { ComponentProps } from 'react';
import { getCollegeCatalog } from '@repo/shared/college';
import { getFallbackLegalDocumentsBundle } from '@/legal/api/legal-documents-bundle.api';
import type { LoginFlowView } from '@/auth/flows/login/LoginFlowView';
import {
  mapLoginResponseToErrorState,
  mapLoginThrownErrorToErrorState,
} from '@/auth/flows/login/model/login-result.mapper';
import type { LoginUiErrorState } from '@/auth/flows/login/model/login-form.types';
import type { PasswordResetFlowView } from '@/auth/flows/password-reset/PasswordResetFlowView';
import type { SignupAccountData } from '@/auth/flows/signup/model/signup-account.types';
import type { LegalConsentData } from '@/auth/flows/signup/components/LegalConsentStep';

export const AUTH_STORY_EMAIL = 'student@kangwon.ac.kr';
export const AUTH_STORY_NICKNAME = '다정한강원대친구';

const noop = () => undefined;
const successfulAction = async () => ({ success: true });

export const LOGIN_STORY_BASE_ARGS = {
  sessionTransitionState: null,
  isSessionUnavailable: false,
  values: {
    email: AUTH_STORY_EMAIL,
    password: '',
    rememberMe: false,
  },
  fieldErrors: {},
  uiError: null,
  routeStatus: null,
  isSubmitting: false,
  isRedirecting: false,
  isLocked: false,
  isSubmitDisabled: false,
  cooldownLabel: '',
  lastInvalidField: null,
  invalidSubmitCount: 0,
  onEmailChangeAction: noop,
  onPasswordChangeAction: noop,
  onRememberMeChangeAction: noop,
  onPasswordResetAction: noop,
  onSignupAction: noop,
  onSubmitAction: (event) => event.preventDefault(),
  onRetrySessionAction: noop,
} satisfies ComponentProps<typeof LoginFlowView>;

function requireLoginStoryError(error: LoginUiErrorState | null): LoginUiErrorState {
  if (!error) {
    throw new Error('Login failure story에는 error state가 필요합니다.');
  }
  return error;
}

export const LOGIN_STORY_ERRORS = {
  invalidCredentials: requireLoginStoryError(
    mapLoginResponseToErrorState({ success: false }, AUTH_STORY_EMAIL),
  ),
  locked: requireLoginStoryError(
    mapLoginResponseToErrorState(
      {
        success: false,
        locked: true,
        remainingSeconds: 284,
        error: '로그인 시도가 반복되어 잠시 로그인이 제한됐어요.',
      },
      AUTH_STORY_EMAIL,
    ),
  ),
  throttled: requireLoginStoryError(
    mapLoginResponseToErrorState(
      {
        success: false,
        retryAfterSeconds: 42,
      },
      AUTH_STORY_EMAIL,
    ),
  ),
  network: mapLoginThrownErrorToErrorState(),
  serverUnavailable: requireLoginStoryError(
    mapLoginResponseToErrorState(
      {
        success: false,
        code: 'AUTH_SERVICE_UNAVAILABLE',
      },
      AUTH_STORY_EMAIL,
    ),
  ),
} satisfies Record<string, LoginUiErrorState>;

export const PASSWORD_RESET_STORY_BASE_ARGS = {
  state: {
    step: 'email',
    email: AUTH_STORY_EMAIL,
    requestedEmail: '',
    verificationCode: '',
    newPassword: '',
    confirmPassword: '',
    isSendingCode: false,
    isVerifyingCode: false,
    isResettingPassword: false,
  },
  stepNumber: 1,
  countdown: {
    countdown: 180,
    isActive: true,
    formatTime: () => '03:00',
  },
  status: null,
  isAuthenticated: false,
  onBackAction: noop,
  onRestartAction: noop,
  onEmailChangeAction: noop,
  onSendCodeAction: noop,
  onGoToLoginAction: noop,
  onVerificationCodeChangeAction: noop,
  onVerifyCodeAction: successfulAction,
  onNewPasswordChangeAction: noop,
  onConfirmPasswordChangeAction: noop,
  onResetPasswordAction: successfulAction,
  onGoToLoginAfterResetAction: noop,
} satisfies ComponentProps<typeof PasswordResetFlowView>;

export const SIGNUP_LEGAL_BUNDLE = getFallbackLegalDocumentsBundle();

export const SIGNUP_LEGAL_ACCEPTANCES = {
  termsVersionId: SIGNUP_LEGAL_BUNDLE.termsOfService.id,
  personalDataConsentVersionId: SIGNUP_LEGAL_BUNDLE.personalDataCollectionUseConsent.id,
  ageNoticeVersionId: SIGNUP_LEGAL_BUNDLE.age14OrAboveNotice.id,
  privacyPolicyVersionIdShown: SIGNUP_LEGAL_BUNDLE.privacyPolicy.id,
};

export const SIGNUP_LEGAL_CONSENT = {
  agreeAge: true,
  agreeTerms: true,
  agreePersonalDataCollectionUse: true,
  legalAcceptances: SIGNUP_LEGAL_ACCEPTANCES,
  legalBundleSource: 'api',
} satisfies LegalConsentData;

export const SIGNUP_BASIC_INFO = {
  nickname: AUTH_STORY_NICKNAME,
  password: '',
  passwordConfirm: '',
  gender: 'M',
  campus: 'CHUNCHEON',
  collegeCode: getCollegeCatalog('CHUNCHEON')[0]?.code ?? null,
  birthYear: new Date().getFullYear() - 22,
} satisfies SignupAccountData;
