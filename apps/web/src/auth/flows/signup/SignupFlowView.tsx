import type { ReactNode } from 'react';
import { SignupLayout } from './components/SignupLayout';
import { SignupProgress } from './components/SignupProgress';
import { SignupStepFrame } from './components/SignupStepFrame';
import { SignupSupportPanel } from './components/SignupSupportPanel';
import { SIGNUP_STEP_COUNT } from './model/signup-flow.types';

interface SignupFlowViewProps {
  currentStep: number;
  children: ReactNode;
  showServiceNotice?: boolean;
  onLogoClickAction?: () => boolean;
}

export function SignupFlowView({
  currentStep,
  children,
  showServiceNotice = currentStep < SIGNUP_STEP_COUNT,
  onLogoClickAction,
}: SignupFlowViewProps) {
  return (
    <SignupLayout
      showServiceNotice={showServiceNotice}
      onLogoClick={onLogoClickAction}
      supportPanel={
        <SignupSupportPanel currentStep={currentStep} showServiceNotice={showServiceNotice} />
      }
    >
      <SignupStepFrame
        progress={<SignupProgress currentStep={currentStep} totalSteps={SIGNUP_STEP_COUNT} />}
      >
        {children}
      </SignupStepFrame>
    </SignupLayout>
  );
}
