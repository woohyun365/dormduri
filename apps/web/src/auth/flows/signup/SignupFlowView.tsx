import type { ReactNode } from 'react';
import { AuthStepFrame, AuthStepProgress } from '@/auth/components';
import { SignupLayout } from './components/SignupLayout';
import { SignupSupportPanel } from './components/SignupSupportPanel';
import { SIGNUP_STEPS, SIGNUP_STEP_COUNT } from './model/signup-flow.types';

const SIGNUP_STEP_LABELS = SIGNUP_STEPS.map((step) => step.label);

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
      <AuthStepFrame
        progress={
          <AuthStepProgress
            ariaLabel="회원가입 진행 상태"
            currentStep={currentStep}
            totalSteps={SIGNUP_STEP_COUNT}
            stepLabels={SIGNUP_STEP_LABELS}
          />
        }
      >
        {children}
      </AuthStepFrame>
    </SignupLayout>
  );
}
