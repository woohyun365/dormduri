import type { ComponentProps } from 'react';
import { getCollegeCatalog } from '@repo/shared/college';
import { getFallbackLegalDocumentsBundle } from '@/legal/api/legal-documents-bundle.api';
import type { LoginFlowView } from '@/auth/flows/login/LoginFlowView';
import type { PasswordResetFlowView } from '@/auth/flows/password-reset/PasswordResetFlowView';
import type { SignupAccountData } from '@/auth/flows/signup/model/signup-account.types';
import type { LegalConsentData } from '@/auth/flows/signup/components/LegalConsentStep';

export const AUTH_STORY_EMAIL = 'student@kangwon.ac.kr';
export const AUTH_STORY_NICKNAME = '다정한강원대친구';

const noop = () => undefined;
const successfulAction = async () => ({ success: true });

export const LOGIN_STORY_BASE_ARGS = {
  isReadyToRender: true,
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
} satisfies ComponentProps<typeof LoginFlowView>;

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
