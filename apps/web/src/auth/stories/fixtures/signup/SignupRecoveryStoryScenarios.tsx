'use client';

import { useState } from 'react';
import { SignupFlowView } from '@/auth/flows/signup/SignupFlowView';
import { AcademicIdentityStep } from '@/auth/flows/signup/components/AcademicIdentityStep';
import { StepEmailVerificationView } from '@/auth/flows/signup/components/email-verification/StepEmailVerification';
import { SignupExitConfirmationDialog } from '@/auth/flows/signup/components/recovery/SignupExitConfirmationDialog';
import { SIGNUP_EMAIL_PROOF_EXPIRED_NOTICE } from '@/auth/flows/signup/model/signup-recovery-copy';
import { AUTH_STORY_EMAIL, SIGNUP_BASIC_INFO } from '../auth-story-fixtures';
import { createEmailVerificationStoryState } from './SignupEmailStoryScenario';

const noop = () => undefined;

export function SignupExitRecoveryScenario() {
  const [isOpen, setIsOpen] = useState(false);

  const handleLogoClick = () => {
    setIsOpen(true);
    return false;
  };

  return (
    <>
      <SignupFlowView currentStep={1} onLogoClickAction={handleLogoClick}>
        <StepEmailVerificationView
          email={AUTH_STORY_EMAIL}
          isVerified
          onEmailChange={noop}
          onVerified={noop}
          onNext={noop}
          verification={createEmailVerificationStoryState('verified')}
        />
      </SignupFlowView>
      <SignupExitConfirmationDialog
        isOpen={isOpen}
        onCancel={() => setIsOpen(false)}
        onConfirm={() => setIsOpen(false)}
      />
    </>
  );
}

export function SignupReopenedBeforeProofExpiryScenario() {
  return (
    <SignupFlowView currentStep={1}>
      <StepEmailVerificationView
        email=""
        isVerified={false}
        onEmailChange={noop}
        onVerified={noop}
        onNext={noop}
        verification={createEmailVerificationStoryState('request')}
      />
    </SignupFlowView>
  );
}

export function SignupVerificationRecoveryScenario({
  scenario,
}: {
  scenario: 'expired' | 'codeSent';
}) {
  return (
    <SignupFlowView currentStep={1}>
      <StepEmailVerificationView
        email={AUTH_STORY_EMAIL}
        isVerified={false}
        onEmailChange={noop}
        onVerified={noop}
        onNext={noop}
        recoveryNotice={SIGNUP_EMAIL_PROOF_EXPIRED_NOTICE}
        verification={createEmailVerificationStoryState(
          scenario === 'codeSent' ? 'code' : 'request',
        )}
      />
    </SignupFlowView>
  );
}

export function SignupSubmissionRecoveryScenario({
  scenario,
}: {
  scenario: 'failed' | 'retrying';
}) {
  return (
    <SignupFlowView currentStep={4}>
      <AcademicIdentityStep
        accountData={SIGNUP_BASIC_INFO}
        onAccountDataChange={noop}
        onNext={noop}
        onBack={noop}
        disabled={scenario === 'retrying'}
        nextLabel={scenario === 'retrying' ? '처리 중...' : '가입하기'}
        submissionError={
          scenario === 'failed' ? '네트워크 연결을 확인하고 다시 시도해주세요.' : undefined
        }
      />
    </SignupFlowView>
  );
}
