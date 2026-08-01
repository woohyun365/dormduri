'use client';

import { useState } from 'react';
import { SignupFlowView } from '@/auth/flows/signup/SignupFlowView';
import {
  StepEmailVerificationView,
  type StepEmailVerificationViewProps,
} from '@/auth/flows/signup/components/email-verification/StepEmailVerification';
import { AUTH_STORY_EMAIL } from '../auth-story-fixtures';
import { SIGNUP_FEEDBACK_COPY } from '@/auth/flows/signup/model/signup-feedback.copy';

const noop = () => undefined;

type EmailScenario =
  | 'request'
  | 'submitting'
  | 'code'
  | 'resendAvailable'
  | 'resending'
  | 'resendSuccess'
  | 'resendFailed'
  | 'verified'
  | 'invalidCode'
  | 'tooManyAttempts'
  | 'rateLimited'
  | 'requestNetworkUnavailable'
  | 'verificationNetworkUnavailable';

export function createEmailVerificationStoryState(
  scenario: EmailScenario,
): StepEmailVerificationViewProps['verification'] {
  const isCodeScenario =
    scenario === 'code' ||
    scenario === 'resendAvailable' ||
    scenario === 'resending' ||
    scenario === 'resendSuccess' ||
    scenario === 'resendFailed' ||
    scenario === 'invalidCode' ||
    scenario === 'tooManyAttempts' ||
    scenario === 'verificationNetworkUnavailable';
  return {
    verificationCode:
      scenario === 'invalidCode' ||
      scenario === 'tooManyAttempts' ||
      scenario === 'verificationNetworkUnavailable' ||
      scenario === 'resendFailed'
        ? '123456'
        : '',
    emailError: '',
    codeError: scenario === 'invalidCode' ? '인증 코드가 올바르지 않습니다.' : '',
    actionFeedback:
      scenario === 'resendSuccess'
        ? {
            variant: 'success',
            ...SIGNUP_FEEDBACK_COPY.email.resendSucceeded,
          }
        : scenario === 'resendFailed'
          ? {
              variant: 'error',
              title: SIGNUP_FEEDBACK_COPY.email.sendFailedTitle,
              description: '새 인증 코드를 보내지 못했어요. 다시 시도해 주세요.',
            }
          : scenario === 'rateLimited'
            ? {
                variant: 'warning',
                title: '잠시 후 다시 요청할 수 있어요',
              }
            : scenario === 'requestNetworkUnavailable'
              ? {
                  variant: 'connectivity',
                  title: '인증 코드를 보내지 못했어요',
                  description: SIGNUP_FEEDBACK_COPY.common.connectivity,
                }
              : scenario === 'verificationNetworkUnavailable'
                ? {
                    variant: 'connectivity',
                    title: '인증 코드를 확인하지 못했어요',
                    description: SIGNUP_FEEDBACK_COPY.common.connectivity,
                  }
                : scenario === 'tooManyAttempts'
                  ? {
                      variant: 'warning',
                      ...SIGNUP_FEEDBACK_COPY.common.verificationCodeUnavailable,
                    }
                  : null,
    isAttemptsExhausted: scenario === 'tooManyAttempts',
    isCodeSent: isCodeScenario,
    isSending: scenario === 'submitting' || scenario === 'resending',
    isVerifying: false,
    requestedEmail: isCodeScenario ? AUTH_STORY_EMAIL : '',
    isCountdownActive:
      isCodeScenario &&
      scenario !== 'tooManyAttempts' &&
      scenario !== 'resendAvailable' &&
      scenario !== 'resending' &&
      scenario !== 'resendFailed',
    countdown:
      scenario === 'tooManyAttempts' ||
      scenario === 'resendAvailable' ||
      scenario === 'resending' ||
      scenario === 'resendFailed'
        ? 0
        : 593,
    emailRetryAfterSeconds: scenario === 'rateLimited' ? 42 : 0,
    codeRetryAfterSeconds: 0,
    onSendCodeAction: noop,
    onVerifyCodeAction: noop,
    onCodeChangeAction: noop,
    onEmailChangeAction: noop,
  };
}

export function SignupEmailScenario({ scenario }: { scenario: EmailScenario }) {
  const [isFeedbackVisible, setIsFeedbackVisible] = useState(false);
  const isRequestActionScenario =
    scenario === 'rateLimited' || scenario === 'requestNetworkUnavailable';
  const isVerificationActionScenario =
    scenario === 'invalidCode' ||
    scenario === 'tooManyAttempts' ||
    scenario === 'verificationNetworkUnavailable';
  const visibleScenario =
    (isRequestActionScenario || isVerificationActionScenario) && !isFeedbackVisible
      ? isRequestActionScenario
        ? 'request'
        : 'code'
      : scenario;
  const verification = createEmailVerificationStoryState(visibleScenario);

  return (
    <SignupFlowView currentStep={1}>
      <StepEmailVerificationView
        email={AUTH_STORY_EMAIL}
        isVerified={scenario === 'verified'}
        onEmailChange={noop}
        onVerified={noop}
        onNext={noop}
        verification={{
          ...verification,
          verificationCode:
            isVerificationActionScenario && !isFeedbackVisible
              ? '123456'
              : verification.verificationCode,
          onSendCodeAction: () => setIsFeedbackVisible(true),
          onVerifyCodeAction: () => setIsFeedbackVisible(true),
        }}
      />
    </SignupFlowView>
  );
}
