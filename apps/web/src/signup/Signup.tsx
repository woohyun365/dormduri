'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthHeader } from '@/components/AuthHeader';
import { ProgressBar } from '@/components/form/ProgressBar';
import { StepEmailVerification } from './components/email-verification/StepEmailVerification';
import { StepTermsAgreement, type TermsData } from './components/StepTermsAgreement';
import { StepBasicInfo, type BasicInfoData } from './components/StepBasicInfo';
import { StepSleepPattern } from './components/StepSleepPattern';
import { StepLivingPattern } from './components/StepLivingPattern';
import { StepRoommateConditions } from './components/StepRoommateConditions';
import type { LifestyleData } from '@/types/lifestyle';
import { StepComplete } from './components/StepComplete';
import { authApi } from '@/api/auth';
import { useRedirectIfAuthenticated } from '@/hooks/useRedirectIfAuthenticated';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/Button';
import Link from 'next/link';

const TOTAL_STEPS = 7;
const STORAGE_KEY = 'signup-draft';

export default function Signup() {
  const router = useRouter();
  const { isReadyToRender } = useRedirectIfAuthenticated();

  const [currentStep, setCurrentStep] = useState(1);

  const [email, setEmail] = useState('');
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [terms, setTerms] = useState<TermsData>({
    agreeAge: false,
    agreeTerms: false,
    agreePrivacy: false,
  });
  const [basicInfo, setBasicInfo] = useState<BasicInfoData>({
    nickname: '',
    password: '',
    passwordConfirm: '',
    gender: null,
    campus: null,
  });
  const [intro, setIntro] = useState('');
  const [lifestyle, setLifestyle] = useState<LifestyleData>({
    bedtime: null,
    wakeTime: null,
    sleepHabit: null,
    sleepEnvironment: null,
    screenUsage: null,
    noiseSensitivity: null,
    smokingBehavior: null,
    indoorEating: null,
    phoneBehavior: null,
    earphoneUsage: null,
    cleanLevel: null,
    drinkingFrequency: null,
    relationshipStyle: null,
    temperatureSensitivity: null,
    smokingTolerance: null,
    phoneTolerance: null,
    earphoneExpectation: null,
    sleepEnvPreference: null,
    screenTolerance: null,
    indoorEatingTolerance: null,
    cleanExpectation: null,
    drinkingTolerance: null,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const [isRestored, setIsRestored] = useState(false);

  // Restore from sessionStorage on mount
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const draft = JSON.parse(raw);
        let step = draft.currentStep ?? 1;
        if (step > 3) step = 3;
        if (step > 1 && !draft.isEmailVerified) step = 1;
        setCurrentStep(step);
        if (draft.email) setEmail(draft.email);
        if (draft.isEmailVerified) setIsEmailVerified(true);
        if (draft.terms) setTerms(draft.terms);
        setBasicInfo((prev) => ({
          ...prev,
          nickname: draft.nickname ?? '',
          gender: draft.gender ?? null,
          campus: draft.campus ?? null,
        }));
        if (draft.intro) setIntro(draft.intro);
        if (draft.lifestyle) setLifestyle(draft.lifestyle);
      }
    } catch {
      // Corrupted data — ignore
    }
    setIsRestored(true);
  }, []);

  // Save to sessionStorage on state changes
  useEffect(() => {
    if (!isRestored) return;
    if (currentStep >= TOTAL_STEPS) {
      try {
        sessionStorage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
      return;
    }
    try {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          currentStep,
          email,
          isEmailVerified,
          terms,
          nickname: basicInfo.nickname,
          gender: basicInfo.gender,
          campus: basicInfo.campus,
          intro,
          lifestyle,
        }),
      );
    } catch {
      // Storage full or unavailable
    }
  }, [isRestored, currentStep, email, isEmailVerified, terms, basicInfo, intro, lifestyle]);

  // Prevent mobile pull-to-refresh on body (scroll container)
  useEffect(() => {
    document.body.style.overscrollBehaviorY = 'none';
    return () => {
      document.body.style.overscrollBehaviorY = '';
    };
  }, []);

  const handleNext = () => {
    setCurrentStep((prev) => prev + 1);
    window.scrollTo(0, 0);
  };
  const handleBack = () => {
    setCurrentStep((prev) => Math.max(1, prev - 1));
    window.scrollTo(0, 0);
  };
  const handleGoToHome = () => router.replace('/');

  const handleSignupSubmit = async () => {
    setIsSubmitting(true);
    setSubmitError('');
    try {
      const result = await authApi.signup({
        email,
        password: basicInfo.password,
        nickname: basicInfo.nickname,
        gender: basicInfo.gender!,
        campus: basicInfo.campus!,
        lifestyle,
        intro,
      });
      if (result.success) {
        setCurrentStep(7);
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
    return <div className="min-h-screen bg-white" />;
  }

  return (
    <div className="min-h-screen bg-white">
      <AuthHeader
        onLogoClick={() => {
          const hasProgress = isEmailVerified || basicInfo.nickname || basicInfo.password;
          if (hasProgress && currentStep < TOTAL_STEPS) {
            const confirmed = confirm('입력한 내용이 모두 사라집니다. 나가시겠습니까?');
            if (!confirmed) return false;
          }
          try {
            sessionStorage.removeItem(STORAGE_KEY);
          } catch {
            /* ignore */
          }
          return true;
        }}
      />

      {currentStep < TOTAL_STEPS && (
        <div className="bg-amber-50 border-b border-amber-200 px-5 py-2 text-center">
          <p className="text-xs text-amber-800 keep-all">
            본 서비스는 강원대학교 공식 서비스가 아닌 독립 운영 서비스입니다.{' '}
            <Link href="/terms" className="underline font-medium">
              자세히 보기
            </Link>
          </p>
        </div>
      )}

      <main className="mx-auto max-w-2xl px-5 py-8">
        {currentStep < TOTAL_STEPS && (
          <div className="mb-8">
            <ProgressBar currentStep={currentStep} totalSteps={TOTAL_STEPS} />
          </div>
        )}

        {currentStep === 1 && (
          <StepEmailVerification
            email={email}
            onEmailChange={setEmail}
            isVerified={isEmailVerified}
            onVerified={() => setIsEmailVerified(true)}
            onNext={handleNext}
          />
        )}
        {currentStep === 2 && (
          <StepTermsAgreement
            terms={terms}
            onTermsChange={setTerms}
            onNext={handleNext}
            onBack={handleBack}
          />
        )}
        {currentStep === 3 && (
          <StepBasicInfo
            email={email}
            basicInfo={basicInfo}
            onBasicInfoChange={setBasicInfo}
            onNext={handleNext}
            onBack={handleBack}
          />
        )}
        {currentStep === 4 && (
          <StepSleepPattern
            lifestyle={lifestyle}
            onUpdate={(field, value) => setLifestyle((prev) => ({ ...prev, [field]: value }))}
            onNext={handleNext}
            onBack={handleBack}
          />
        )}
        {currentStep === 5 && (
          <StepLivingPattern
            lifestyle={lifestyle}
            onUpdate={(field, value) => setLifestyle((prev) => ({ ...prev, [field]: value }))}
            onNext={handleNext}
            onBack={handleBack}
          />
        )}
        {currentStep === 6 && (
          <>
            {submitError && (
              <div className="mb-6 p-4 bg-red-50 border-2 border-red-200 rounded-xl flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-red-900 font-medium mb-3">{submitError}</p>
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={handleSignupSubmit}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? '처리 중...' : '다시 시도'}
                  </Button>
                </div>
              </div>
            )}
            <StepRoommateConditions
              lifestyle={lifestyle}
              onUpdate={(field, value) => setLifestyle((prev) => ({ ...prev, [field]: value }))}
              intro={intro}
              onIntroChange={setIntro}
              onNext={handleSignupSubmit}
              onBack={handleBack}
              disabled={isSubmitting}
            />
          </>
        )}
        {currentStep === 7 && (
          <StepComplete nickname={basicInfo.nickname} onGoToHome={handleGoToHome} />
        )}
      </main>
    </div>
  );
}
