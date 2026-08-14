'use client';

import { SignupFlowView } from '@/auth/flows/signup/SignupFlowView';
import { SignupCompleteStep } from '@/auth/flows/signup/components/SignupCompleteStep';
import { AUTH_STORY_NICKNAME } from '../auth-story-fixtures';

const noop = () => undefined;

export function SignupCompleteScenario({
  nickname = AUTH_STORY_NICKNAME,
}: {
  nickname?: string;
} = {}) {
  return (
    <SignupFlowView currentStep={5} showServiceNotice={false}>
      <SignupCompleteStep nickname={nickname} onGoToHome={noop} />
    </SignupFlowView>
  );
}
