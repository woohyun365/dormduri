'use client';

import { useState } from 'react';
import { SignupFlowView } from '@/auth/flows/signup/SignupFlowView';
import { AccountCredentialsStep } from '@/auth/flows/signup/components/AccountCredentialsStep';
import type { SignupAccountData } from '@/auth/flows/signup/model/signup-account.types';
import { AUTH_STORY_EMAIL, SIGNUP_BASIC_INFO } from '../auth-story-fixtures';

const noop = () => undefined;

type AccountScenario =
  | 'default'
  | 'englishAllowed'
  | 'mixedScript'
  | 'moderationRejected'
  | 'validation'
  | 'nicknameConflict'
  | 'networkUnavailable'
  | 'submitting';

export function SignupCredentialsScenario({ scenario }: { scenario: AccountScenario }) {
  const initialInfo: SignupAccountData = {
    ...SIGNUP_BASIC_INFO,
    nickname:
      scenario === 'validation'
        ? ''
        : scenario === 'englishAllowed'
          ? 'niceguy'
          : scenario === 'mixedScript'
            ? '안녕hi'
            : scenario === 'moderationRejected'
              ? 'sex123'
              : SIGNUP_BASIC_INFO.nickname,
    password:
      scenario === 'networkUnavailable' || scenario === 'submitting' ? 'SafePassword123' : '',
    passwordConfirm:
      scenario === 'networkUnavailable' || scenario === 'submitting' ? 'SafePassword123' : '',
  };
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
        validateSignupNicknameAction={
          scenario === 'networkUnavailable'
            ? async () => {
                throw new Error('Storybook network unavailable');
              }
            : async ({ nickname }) => ({ success: true, nickname })
        }
        serverFieldErrors={
          scenario === 'nicknameConflict'
            ? { nickname: '이미 사용 중인 닉네임입니다.' }
            : scenario === 'moderationRejected'
              ? {
                  nickname: '닉네임에 사용할 수 없는 단어가 포함되어 있어요.',
                }
              : undefined
        }
      />
    </SignupFlowView>
  );
}
