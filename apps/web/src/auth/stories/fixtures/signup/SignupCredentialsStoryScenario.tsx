'use client';

import { useState } from 'react';
import { SignupFlowView } from '@/auth/flows/signup/SignupFlowView';
import { AccountCredentialsStep } from '@/auth/flows/signup/components/AccountCredentialsStep';
import type { SignupAccountData } from '@/auth/flows/signup/model/signup-account.types';
import { AUTH_STORY_EMAIL, SIGNUP_BASIC_INFO } from '../auth-story-fixtures';

const noop = () => undefined;

type AccountScenario = 'default' | 'validation' | 'nicknameConflict' | 'submitting';

export function SignupCredentialsScenario({ scenario }: { scenario: AccountScenario }) {
  const initialInfo: SignupAccountData =
    scenario === 'validation'
      ? {
          nickname: '',
          password: '',
          passwordConfirm: '',
          gender: null,
          campus: null,
          collegeCode: null,
          birthYear: null,
        }
      : SIGNUP_BASIC_INFO;
  const [basicInfo, setBasicInfo] = useState<SignupAccountData>(initialInfo);

  return (
    <SignupFlowView currentStep={3}>
      <AccountCredentialsStep
        email={AUTH_STORY_EMAIL}
        accountData={basicInfo}
        onAccountDataChange={setBasicInfo}
        onNext={noop}
        onBack={noop}
        disabled={scenario === 'submitting'}
        serverFieldErrors={
          scenario === 'nicknameConflict' ? { nickname: '이미 사용 중인 닉네임입니다.' } : undefined
        }
      />
    </SignupFlowView>
  );
}
