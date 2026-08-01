'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AuthSessionUnavailableStatus } from '@/auth/components';
import { useRedirectIfAuthenticated } from '@/auth/hooks';
import { AcademicIdentityStep } from './components/AcademicIdentityStep';
import { AccountCredentialsStep } from './components/AccountCredentialsStep';
import { StepEmailVerification } from './components/email-verification/StepEmailVerification';
import { LegalConsentStep } from './components/LegalConsentStep';
import { SignupCompleteStep } from './components/SignupCompleteStep';
import { SignupExitConfirmationDialog } from './components/recovery/SignupExitConfirmationDialog';
import { SignupSkeleton } from './components/SignupSkeleton';
import { useSignupExitGuard } from './hooks/useSignupExitGuard';
import { useSignupFlow } from './hooks/useSignupFlow';
import { SIGNUP_FEEDBACK_COPY } from './model/signup-feedback.copy';
import { SIGNUP_EMAIL_PROOF_EXPIRED_NOTICE } from './model/signup-recovery-copy';
import { SignupFlowView } from './SignupFlowView';

export default function SignupPageClient() {
  const router = useRouter();
  const { isReadyToRender, sessionStatus, retrySession } = useRedirectIfAuthenticated();
  const flow = useSignupFlow();
  const hasMeaningfulProgress =
    flow.email.trim().length > 0 ||
    flow.legalConsent.agreeAge ||
    flow.legalConsent.agreeTerms ||
    flow.legalConsent.agreePersonalDataCollectionUse ||
    flow.basicInfo.nickname.trim().length > 0 ||
    flow.basicInfo.gender !== null ||
    flow.basicInfo.campus !== null ||
    flow.basicInfo.collegeCode !== null ||
    flow.basicInfo.birthYear !== null;

  const handleConfirmedExit = useCallback(() => {
    router.push('/');
  }, [router]);

  const exitGuard = useSignupExitGuard({
    shouldWarn: hasMeaningfulProgress && flow.state.currentStepId !== 'COMPLETE',
    onConfirmExit: handleConfirmedExit,
  });

  const retryableFailure = flow.state.failure?.kind === 'retryable' ? flow.state.failure : null;
  const verificationRecoveryNotice =
    flow.state.recoveryReason === 'EMAIL_PROOF_EXPIRED'
      ? SIGNUP_EMAIL_PROOF_EXPIRED_NOTICE
      : undefined;

  if (!isReadyToRender) {
    return <SignupSkeleton />;
  }

  return (
    <>
      <SignupFlowView
        currentStep={flow.progress.currentStep}
        onLogoClickAction={exitGuard.requestExit}
      >
        {sessionStatus === 'unavailable' && (
          <AuthSessionUnavailableStatus
            title={SIGNUP_FEEDBACK_COPY.sessionUnavailable.title}
            description={SIGNUP_FEEDBACK_COPY.sessionUnavailable.description}
            onRetryAction={retrySession}
            className="mb-4"
          />
        )}
        {flow.state.currentStepId === 'EMAIL_VERIFICATION' && (
          <StepEmailVerification
            key={flow.state.recoveryReason ?? 'signup-email-verification'}
            email={flow.email}
            onEmailChange={flow.actions.changeEmail}
            isVerified={flow.state.isEmailVerified}
            onVerified={flow.actions.completeEmailVerification}
            onNext={flow.actions.goNext}
            recoveryNotice={verificationRecoveryNotice}
            recoveryEmailError={flow.fieldErrors.email}
            onRecoveryErrorClear={flow.actions.clearFailure}
          />
        )}
        {flow.state.currentStepId === 'LEGAL_CONSENT' && (
          <LegalConsentStep
            legalConsent={flow.legalConsent}
            onLegalConsentChange={flow.actions.changeLegalConsent}
            onNext={flow.actions.goNext}
            onBack={flow.actions.goBack}
            refreshNonce={flow.state.legalRefreshNonce}
            requiresReconfirmation={flow.state.requiresLegalReconfirmation}
          />
        )}
        {flow.state.currentStepId === 'ACCOUNT_CREDENTIALS' && (
          <AccountCredentialsStep
            email={flow.email}
            accountData={flow.basicInfo}
            onAccountDataChange={flow.actions.changeBasicInfo}
            onNext={flow.actions.completeAccountCredentials}
            onBack={flow.actions.goBack}
            serverFieldErrors={{
              ...(flow.fieldErrors.nickname ? { nickname: flow.fieldErrors.nickname } : {}),
              ...(flow.fieldErrors.password ? { password: flow.fieldErrors.password } : {}),
            }}
            onServerErrorClear={flow.actions.clearFailure}
          />
        )}
        {flow.state.currentStepId === 'ACADEMIC_IDENTITY' && (
          <AcademicIdentityStep
            accountData={flow.basicInfo}
            onAccountDataChange={flow.actions.changeBasicInfo}
            onNext={flow.actions.submit}
            onBack={flow.actions.goBack}
            disabled={flow.isSubmitting}
            nextLabel={flow.isSubmitting ? '처리 중...' : '가입하기'}
            submissionError={retryableFailure?.message}
            serverFieldErrors={{
              ...(flow.fieldErrors.campus ? { campus: flow.fieldErrors.campus } : {}),
              ...(flow.fieldErrors.gender ? { gender: flow.fieldErrors.gender } : {}),
              ...(flow.fieldErrors.collegeCode
                ? { collegeCode: flow.fieldErrors.collegeCode }
                : {}),
              ...(flow.fieldErrors.birthYear ? { birthYear: flow.fieldErrors.birthYear } : {}),
            }}
            onServerErrorClear={flow.actions.clearFailure}
          />
        )}
        {flow.state.currentStepId === 'COMPLETE' && (
          <SignupCompleteStep
            nickname={flow.basicInfo.nickname}
            onGoToHome={() => router.replace('/main')}
          />
        )}
      </SignupFlowView>
      <SignupExitConfirmationDialog
        isOpen={exitGuard.isExitDialogOpen}
        onCancel={exitGuard.cancelExit}
        onConfirm={exitGuard.confirmExit}
      />
    </>
  );
}
