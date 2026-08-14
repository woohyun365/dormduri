'use client';

import { useState } from 'react';
import { SignupFlowView } from '@/auth/flows/signup/SignupFlowView';
import { AcademicIdentityStep } from '@/auth/flows/signup/components/AcademicIdentityStep';
import { AccountCredentialsStep } from '@/auth/flows/signup/components/AccountCredentialsStep';
import {
  LegalConsentStep,
  type LegalConsentData,
} from '@/auth/flows/signup/components/LegalConsentStep';
import type { SignupAccountData } from '@/auth/flows/signup/model/signup-account.types';
import {
  AUTH_STORY_EMAIL,
  SIGNUP_BASIC_INFO,
  SIGNUP_LEGAL_BUNDLE,
  SIGNUP_LEGAL_CONSENT,
} from '../auth-story-fixtures';

const NICKNAME_CONFLICT_MESSAGE = '이미 사용 중인 닉네임이에요.';
const LEGAL_DOCUMENTS_RESULT = {
  source: 'api' as const,
  bundle: SIGNUP_LEGAL_BUNDLE,
};

export function SignupNicknameRaceStoryScenario() {
  const [currentStep, setCurrentStep] = useState<'legal' | 'credentials' | 'academic'>('academic');
  const [nicknameError, setNicknameError] = useState('');
  const [legalConsent, setLegalConsent] = useState<LegalConsentData>(SIGNUP_LEGAL_CONSENT);
  const [accountData, setAccountData] = useState<SignupAccountData>({
    ...SIGNUP_BASIC_INFO,
    nickname: '감자친구',
    password: 'SafePassword123',
    passwordConfirm: 'SafePassword123',
  });

  if (currentStep === 'academic') {
    return (
      <SignupFlowView currentStep={4}>
        <AcademicIdentityStep
          accountData={accountData}
          onAccountDataChange={setAccountData}
          onNext={(nextAccountData) => {
            setAccountData(nextAccountData);
            setNicknameError(NICKNAME_CONFLICT_MESSAGE);
            setCurrentStep('credentials');
          }}
          onBack={() => undefined}
          nextLabel="가입하기"
        />
      </SignupFlowView>
    );
  }

  if (currentStep === 'legal') {
    return (
      <SignupFlowView currentStep={2}>
        <LegalConsentStep
          legalConsent={legalConsent}
          onLegalConsentChange={setLegalConsent}
          onNext={() => setCurrentStep('credentials')}
          onBack={() => undefined}
          legalDocumentsResult={LEGAL_DOCUMENTS_RESULT}
        />
      </SignupFlowView>
    );
  }

  return (
    <SignupFlowView currentStep={3}>
      <AccountCredentialsStep
        email={AUTH_STORY_EMAIL}
        accountData={accountData}
        onAccountDataChange={setAccountData}
        onNext={() => undefined}
        onBack={() => setCurrentStep('legal')}
        validateSignupNicknameAction={async ({ nickname }) => ({ success: true, nickname })}
        serverFieldErrors={nicknameError ? { nickname: nicknameError } : undefined}
        onServerErrorClear={() => setNicknameError('')}
      />
    </SignupFlowView>
  );
}
