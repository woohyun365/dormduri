'use client';

import { SignupFlowView } from '@/auth/flows/signup/SignupFlowView';
import {
  StepEmailVerificationView,
  type StepEmailVerificationViewProps,
} from '@/auth/flows/signup/components/email-verification/StepEmailVerification';
import { AUTH_STORY_EMAIL } from '../auth-story-fixtures';

const noop = () => undefined;

type EmailScenario = 'request' | 'code' | 'verified' | 'invalidCode' | 'rateLimited';

export function createEmailVerificationStoryState(
  scenario: EmailScenario,
): StepEmailVerificationViewProps['verification'] {
  const isCodeScenario = scenario === 'code' || scenario === 'invalidCode';
  return {
    verificationCode: scenario === 'invalidCode' ? '123456' : '',
    emailError:
      scenario === 'rateLimited' ? '너무 잦은 요청이에요. 42초 후 다시 시도해주세요.' : '',
    codeError: scenario === 'invalidCode' ? '인증 코드가 올바르지 않습니다.' : '',
    isCodeSent: isCodeScenario,
    isSending: false,
    isVerifying: false,
    requestedEmail: isCodeScenario ? AUTH_STORY_EMAIL : '',
    isCountdownActive: isCodeScenario,
    countdown: 167,
    emailRetryAfterSeconds: scenario === 'rateLimited' ? 42 : 0,
    codeRetryAfterSeconds: 0,
    formatTime: () => '02:47',
    onSendCodeAction: noop,
    onVerifyCodeAction: noop,
    onCodeChangeAction: noop,
    onEmailChangeAction: noop,
  };
}

export function SignupEmailScenario({ scenario }: { scenario: EmailScenario }) {
  return (
    <SignupFlowView currentStep={1}>
      <StepEmailVerificationView
        email={AUTH_STORY_EMAIL}
        isVerified={scenario === 'verified'}
        onEmailChange={noop}
        onVerified={noop}
        onNext={noop}
        verification={createEmailVerificationStoryState(scenario)}
      />
    </SignupFlowView>
  );
}
