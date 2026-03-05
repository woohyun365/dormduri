'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthHeader } from '@/components/AuthHeader';
import { ProgressBar } from '@/components/form/ProgressBar';
import { StepEmailVerification } from './components/StepEmailVerification';
import { StepTermsAgreement, type TermsData } from './components/StepTermsAgreement';
import { StepBasicInfo, type BasicInfoData } from './components/StepBasicInfo';
import { StepLifestyleProfile } from './components/StepLifestyleProfile';
import type { LifestyleData } from '@/types/lifestyle';
import { StepComplete } from './components/StepComplete';
import { authApi } from '@/api/auth';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/Button';

const TOTAL_STEPS = 5;

export default function Signup() {
  const router = useRouter();
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
  });
  const [intro, setIntro] = useState('');
  const [lifestyle, setLifestyle] = useState<LifestyleData>({
    smoker: null,
    sleepHabit: null,
    indoorEating: null,
    bedtime: null,
    wakeTime: null,
    noiseSensitivity: null,
    cleanliness: null,
    relationshipStyle: null,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const handleNext = () => setCurrentStep((prev) => prev + 1);
  const handleBack = () => setCurrentStep((prev) => Math.max(1, prev - 1));
  const handleGoToHome = () => router.push('/main');

  const handleLifestyleNext = async () => {
    setIsSubmitting(true);
    setSubmitError('');
    try {
      const result = await authApi.signup({
        email,
        password: basicInfo.password,
        nickname: basicInfo.nickname,
      });
      if (result.success) {
        setCurrentStep(TOTAL_STEPS);
      } else {
        setSubmitError(result.error ?? '회원가입에 실패했습니다. 다시 시도해주세요.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <AuthHeader showBack={currentStep > 1 && currentStep < TOTAL_STEPS} onBack={handleBack} />

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
          <>
            {submitError && (
              <div className="mb-6 p-4 bg-red-50 border-2 border-red-200 rounded-xl flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-red-900 font-medium mb-3">{submitError}</p>
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={handleLifestyleNext}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? '처리 중...' : '다시 시도'}
                  </Button>
                </div>
              </div>
            )}
            <StepLifestyleProfile
              lifestyle={lifestyle}
              onLifestyleChange={setLifestyle}
              intro={intro}
              onIntroChange={setIntro}
              onNext={isSubmitting ? () => {} : handleLifestyleNext}
              onBack={handleBack}
            />
          </>
        )}
        {currentStep === 5 && (
          <StepComplete nickname={basicInfo.nickname} onGoToHome={handleGoToHome} />
        )}
      </main>
    </div>
  );
}
