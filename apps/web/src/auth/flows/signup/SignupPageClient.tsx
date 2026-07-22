'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { StepEmailVerification } from './components/email-verification/StepEmailVerification';
import { LegalConsentStep, type LegalConsentData } from './components/LegalConsentStep';
import { AccountIdentityStep, type BasicInfoData } from './components/AccountIdentityStep';
import { SignupCompleteStep } from './components/SignupCompleteStep';
import { SignupLayout } from './components/SignupLayout';
import { SignupStepFrame } from './components/SignupStepFrame';
import { SignupProgress } from './components/SignupProgress';
import { SignupSkeleton } from './components/SignupSkeleton';
import { SignupGlobalAlert } from './components/SignupGlobalAlert';
import { authApi } from '@/auth/api';
import { createSignupRequest } from './model/signup-request.mapper';
import { useRedirectIfAuthenticated } from '@/auth/hooks';
import { focusAndScroll } from '@/auth/components/form/focusAndScroll';
import { useSignupDraftStorage } from './hooks/useSignupDraftStorage';
import { SIGNUP_DRAFT_STORAGE_KEY } from './model/signup-draft-storage';
import type { SignupDraftSnapshot } from './model/signup-draft.types';
import { SIGNUP_STEP_COUNT } from './model/signup-flow.types';

const TOTAL_STEPS = SIGNUP_STEP_COUNT;
const ACCOUNT_IDENTITY_STEP = 3;
const COMPLETE_STEP = SIGNUP_STEP_COUNT;

export default function SignupPageClient() {
  const router = useRouter();
  const { isReadyToRender } = useRedirectIfAuthenticated();

  const [currentStep, setCurrentStep] = useState(1);

  const [email, setEmail] = useState('');
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [legalConsent, setLegalConsent] = useState<LegalConsentData>({
    agreeAge: false,
    agreeTerms: false,
    agreePersonalDataCollectionUse: false,
  });
  const [basicInfo, setBasicInfo] = useState<BasicInfoData>({
    nickname: '',
    password: '',
    passwordConfirm: '',
    gender: null,
    campus: null,
    collegeCode: null,
    birthYear: null,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [legalNotice, setLegalNotice] = useState('');
  const [legalRefreshNonce, setLegalRefreshNonce] = useState(0);
  const [resumeStepAfterVerification, setResumeStepAfterVerification] = useState<number | null>(
    null,
  );

  const submitErrorRef = useRef<HTMLDivElement | null>(null);

  const handleDraftRestore = useCallback((draft: SignupDraftSnapshot) => {
    setCurrentStep(draft.legacyCurrentStep);
    if (draft.email) setEmail(draft.email);
    if (draft.isEmailVerified) setIsEmailVerified(true);
    setLegalConsent({
      agreeAge: draft.terms.agreeAge,
      agreeTerms: draft.terms.agreeTerms,
      agreePersonalDataCollectionUse: draft.terms.agreePersonalDataCollectionUse,
      ...(draft.terms.legalAcceptances ? { legalAcceptances: draft.terms.legalAcceptances } : {}),
      ...(draft.terms.legalBundleSource
        ? { legalBundleSource: draft.terms.legalBundleSource }
        : {}),
    });
    setBasicInfo((prev) => ({
      ...prev,
      nickname: draft.nickname,
      gender: draft.gender,
      campus: draft.campus,
      collegeCode: draft.collegeCode ?? null,
      birthYear: draft.birthYear ?? null,
    }));
  }, []);

  const { isRestored } = useSignupDraftStorage({
    currentStep,
    email,
    isEmailVerified,
    terms: legalConsent,
    nickname: basicInfo.nickname,
    gender: basicInfo.gender,
    campus: basicInfo.campus,
    collegeCode: basicInfo.collegeCode,
    birthYear: basicInfo.birthYear,
    shouldClear: currentStep >= TOTAL_STEPS,
    onRestore: handleDraftRestore,
  });

  useEffect(() => {
    if (!submitError) return;
    focusAndScroll(submitErrorRef.current);
  }, [submitError]);

  const isVerificationExpiredError = submitError === '이메일 인증을 먼저 완료해주세요.';

  const handleNext = () => {
    setCurrentStep((prev) => prev + 1);
    window.scrollTo(0, 0);
  };
  const handleBack = () => {
    setCurrentStep((prev) => Math.max(1, prev - 1));
    window.scrollTo(0, 0);
  };
  const handleGoToHome = () => router.replace('/main');

  const handleEmailVerified = () => {
    setIsEmailVerified(true);
    if (resumeStepAfterVerification) {
      setSubmitError('');
      setCurrentStep(resumeStepAfterVerification);
      setResumeStepAfterVerification(null);
      window.scrollTo(0, 0);
    }
  };

  const handleRestartEmailVerification = () => {
    setSubmitError('');
    setIsEmailVerified(false);
    setResumeStepAfterVerification(ACCOUNT_IDENTITY_STEP);
    setCurrentStep(1);
    window.scrollTo(0, 0);
  };

  const handleLegalConsentChange = useCallback((nextConsent: LegalConsentData) => {
    setLegalConsent(nextConsent);
    if (
      nextConsent.agreeAge ||
      nextConsent.agreeTerms ||
      nextConsent.agreePersonalDataCollectionUse
    ) {
      setLegalNotice('');
    }
  }, []);

  const handleLegalAcceptancesStale = () => {
    setLegalConsent({
      agreeAge: false,
      agreeTerms: false,
      agreePersonalDataCollectionUse: false,
    });
    setLegalNotice(
      '약관 또는 개인정보 동의 내용이 변경되었습니다. 최신 내용을 다시 확인하고 필수 항목에 다시 동의해주세요.',
    );
    setLegalRefreshNonce((prev) => prev + 1);
    setCurrentStep(2);
    window.scrollTo(0, 0);
  };

  const handleSignupSubmit = async (nextBasicInfo = basicInfo) => {
    if (!legalConsent.legalAcceptances) {
      handleLegalAcceptancesStale();
      return;
    }

    setBasicInfo(nextBasicInfo);
    setIsSubmitting(true);
    setSubmitError('');
    try {
      const signupRequest = createSignupRequest({
        email,
        password: nextBasicInfo.password,
        nickname: nextBasicInfo.nickname,
        gender: nextBasicInfo.gender!,
        campus: nextBasicInfo.campus!,
        collegeCode: nextBasicInfo.collegeCode!,
        birthYear: nextBasicInfo.birthYear!,
        legalAcceptances: legalConsent.legalAcceptances,
      });
      const result = await authApi.signup(signupRequest);
      if (result.success) {
        setCurrentStep(COMPLETE_STEP);
      } else if (result.code === 'AUTH_LEGAL_ACCEPTANCE_STALE') {
        handleLegalAcceptancesStale();
      } else {
        setSubmitError(result.error ?? '회원가입에 실패했습니다. 다시 시도해주세요.');
      }
    } catch {
      setSubmitError('네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isReadyToRender || !isRestored) {
    return <SignupSkeleton />;
  }

  return (
    <SignupLayout
      showServiceNotice={currentStep < TOTAL_STEPS}
      onLogoClick={() => {
        const hasProgress = isEmailVerified || basicInfo.nickname || basicInfo.password;
        if (hasProgress && currentStep < TOTAL_STEPS) {
          const confirmed = confirm('입력한 내용이 모두 사라집니다. 나가시겠습니까?');
          if (!confirmed) return false;
        }
        try {
          sessionStorage.removeItem(SIGNUP_DRAFT_STORAGE_KEY);
        } catch {
          /* ignore */
        }
        return true;
      }}
    >
      <SignupStepFrame
        progress={
          currentStep < TOTAL_STEPS ? (
            <SignupProgress currentStep={currentStep} totalSteps={TOTAL_STEPS} />
          ) : undefined
        }
        alert={
          currentStep === ACCOUNT_IDENTITY_STEP && submitError ? (
            <SignupGlobalAlert
              ref={submitErrorRef}
              message={submitError}
              isVerificationExpiredError={isVerificationExpiredError}
              isSubmitting={isSubmitting}
              onRestartEmailVerification={handleRestartEmailVerification}
              onRetry={() => handleSignupSubmit()}
            />
          ) : undefined
        }
      >
        {currentStep === 1 && (
          <StepEmailVerification
            email={email}
            onEmailChange={(nextEmail) => {
              setEmail(nextEmail);
              if (resumeStepAfterVerification !== null) {
                setResumeStepAfterVerification(null);
              }
            }}
            isVerified={isEmailVerified}
            onVerified={handleEmailVerified}
            onNext={handleNext}
          />
        )}
        {currentStep === 2 && (
          <LegalConsentStep
            legalConsent={legalConsent}
            onLegalConsentChange={handleLegalConsentChange}
            onNext={handleNext}
            onBack={handleBack}
            refreshNonce={legalRefreshNonce}
            notice={legalNotice}
          />
        )}
        {currentStep === 3 && (
          <>
            <AccountIdentityStep
              email={email}
              basicInfo={basicInfo}
              onBasicInfoChange={setBasicInfo}
              onNext={handleSignupSubmit}
              onBack={handleBack}
              disabled={isSubmitting}
              nextLabel={isSubmitting ? '처리 중...' : '가입하기'}
            />
          </>
        )}
        {currentStep === 4 && (
          <SignupCompleteStep nickname={basicInfo.nickname} onGoToHome={handleGoToHome} />
        )}
      </SignupStepFrame>
    </SignupLayout>
  );
}
