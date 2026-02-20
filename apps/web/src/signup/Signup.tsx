'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SignupHeader } from './components/SignupHeader';
import { ProgressBar } from './components/ProgressBar';
import { StepEmailVerification } from './components/StepEmailVerification';
import { StepTermsAgreement, type TermsData } from './components/StepTermsAgreement';
import { StepBasicInfo, type BasicInfoData } from './components/StepBasicInfo';
import { StepLifestyleProfile, type LifestyleData } from './components/StepLifestyleProfile';
import { StepComplete } from './components/StepComplete';

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

  const handleNext = () => setCurrentStep((prev) => prev + 1);
  const handleBack = () => setCurrentStep((prev) => Math.max(1, prev - 1));
  const handleGoToHome = () => router.push('/');

  return (
    <div className="min-h-screen bg-white">
      <SignupHeader showBack={currentStep > 1 && currentStep < TOTAL_STEPS} onBack={handleBack} />

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
          <StepLifestyleProfile
            lifestyle={lifestyle}
            onLifestyleChange={setLifestyle}
            onNext={handleNext}
            onBack={handleBack}
          />
        )}
        {currentStep === 5 && (
          <StepComplete nickname={basicInfo.nickname} onGoToHome={handleGoToHome} />
        )}
      </main>
    </div>
  );
}
