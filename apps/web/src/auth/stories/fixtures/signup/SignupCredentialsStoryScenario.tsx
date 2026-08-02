'use client';

import { useState } from 'react';
import type { SignupNicknameValidationResponse } from '@repo/shared/auth/response';
import { SignupFlowView } from '@/auth/flows/signup/SignupFlowView';
import { AccountCredentialsStep } from '@/auth/flows/signup/components/AccountCredentialsStep';
import type { SignupAccountData } from '@/auth/flows/signup/model/signup-account.types';
import type { ValidateSignupNicknameAction } from '@/auth/flows/signup/hooks/useSignupNicknameValidation';
import { AUTH_STORY_EMAIL, SIGNUP_BASIC_INFO } from '../auth-story-fixtures';
import { SignupNicknameRaceStoryScenario } from './SignupNicknameRaceStoryScenario';

const noop = () => undefined;

type AccountScenario =
  | 'unchecked'
  | 'checking'
  | 'availableKorean'
  | 'availableEnglish'
  | 'rejectedFormat'
  | 'rejectedMixedScript'
  | 'rejectedModeration'
  | 'rejectedTaken'
  | 'networkUnavailable'
  | 'expiredGrant'
  | 'staleEdited'
  | 'raceFinalSignup';

const NICKNAME_BY_SCENARIO: Record<AccountScenario, string> = {
  unchecked: '감자친구',
  checking: '감자친구',
  availableKorean: '감자친구',
  availableEnglish: 'niceguy',
  rejectedFormat: '감',
  rejectedMixedScript: '안녕hi',
  rejectedModeration: 'sex123',
  rejectedTaken: '감자친구',
  networkUnavailable: '감자친구',
  expiredGrant: '감자친구',
  staleEdited: '감자친구',
  raceFinalSignup: '감자친구',
};

const FAILURE_RESPONSES = {
  rejectedModeration: {
    success: false,
    code: 'AUTH_SIGNUP_NICKNAME_NOT_ALLOWED',
    error: '입력값을 다시 확인해 주세요.',
    userActionable: true,
    fieldErrors: { nickname: '닉네임에 사용할 수 없는 단어가 포함되어 있어요.' },
  },
  rejectedTaken: {
    success: false,
    code: 'AUTH_NICKNAME_ALREADY_TAKEN',
    error: '입력값을 다시 확인해 주세요.',
    userActionable: true,
    fieldErrors: { nickname: '이미 사용 중인 닉네임이에요.' },
  },
  expiredGrant: {
    success: false,
    code: 'AUTH_SIGNUP_EMAIL_VERIFICATION_REQUIRED',
    error: '학교 이메일 인증이 필요합니다.',
    userActionable: true,
  },
} satisfies Record<string, SignupNicknameValidationResponse>;

function createValidationAction(scenario: AccountScenario): ValidateSignupNicknameAction {
  if (scenario === 'checking') {
    return async () => new Promise<SignupNicknameValidationResponse>(() => undefined);
  }
  if (scenario === 'networkUnavailable') {
    return async () => {
      throw new Error('Storybook network unavailable');
    };
  }
  if (scenario in FAILURE_RESPONSES) {
    return async () => FAILURE_RESPONSES[scenario as keyof typeof FAILURE_RESPONSES];
  }
  return async ({ nickname }) => ({ success: true, nickname });
}

export function SignupCredentialsScenario({ scenario }: { scenario: AccountScenario }) {
  const [accountData, setAccountData] = useState<SignupAccountData>({
    ...SIGNUP_BASIC_INFO,
    nickname: NICKNAME_BY_SCENARIO[scenario],
    password: 'SafePassword123',
    passwordConfirm: 'SafePassword123',
  });

  if (scenario === 'raceFinalSignup') {
    return <SignupNicknameRaceStoryScenario />;
  }

  return (
    <SignupFlowView currentStep={3}>
      <AccountCredentialsStep
        email={AUTH_STORY_EMAIL}
        accountData={accountData}
        onAccountDataChange={setAccountData}
        onNext={noop}
        onBack={noop}
        validateSignupNicknameAction={createValidationAction(scenario)}
      />
    </SignupFlowView>
  );
}
