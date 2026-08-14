'use client';

import { useState } from 'react';
import { SignupFlowView } from '@/auth/flows/signup/SignupFlowView';
import { AcademicIdentityStep } from '@/auth/flows/signup/components/AcademicIdentityStep';
import type { SignupAccountData } from '@/auth/flows/signup/model/signup-account.types';
import { SIGNUP_BASIC_INFO } from '../auth-story-fixtures';

const noop = () => undefined;

type AcademicScenario = 'default' | 'samcheok' | 'dogye' | 'validation' | 'submitting';

export function SignupAcademicScenario({ scenario }: { scenario: AcademicScenario }) {
  const initialInfo: SignupAccountData =
    scenario === 'submitting'
      ? SIGNUP_BASIC_INFO
      : scenario === 'samcheok'
        ? {
            ...SIGNUP_BASIC_INFO,
            gender: null,
            campus: 'SAMCHEOK',
            collegeCode: null,
            birthYear: null,
          }
        : scenario === 'dogye'
          ? {
              ...SIGNUP_BASIC_INFO,
              gender: null,
              campus: 'DOGYE',
              collegeCode: null,
              birthYear: null,
            }
          : {
              ...SIGNUP_BASIC_INFO,
              gender: null,
              campus: null,
              collegeCode: null,
              birthYear: null,
            };
  const [basicInfo, setBasicInfo] = useState<SignupAccountData>(initialInfo);

  return (
    <SignupFlowView currentStep={4}>
      <AcademicIdentityStep
        accountData={basicInfo}
        onAccountDataChange={setBasicInfo}
        onNext={noop}
        onBack={noop}
        disabled={scenario === 'submitting'}
        nextLabel={scenario === 'submitting' ? '처리 중...' : '가입하기'}
      />
    </SignupFlowView>
  );
}
