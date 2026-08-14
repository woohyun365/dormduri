import type { ReactNode } from 'react';
import {
  AuthResponsiveFrame,
  AuthServiceNotice,
  AuthStepFrame,
  AuthStepProgress,
} from '@/auth/components';
import { PasswordResetSupportPanel } from './PasswordResetSupportPanel';
import { PASSWORD_RESET_COPY } from '../model/password-reset-copy';

interface PasswordResetLayoutProps {
  children: ReactNode;
  currentStep: number;
  showBack: boolean;
  showProgress: boolean;
  onBack: () => void;
}

export function PasswordResetLayout({
  children,
  currentStep,
  showBack,
  showProgress,
  onBack,
}: PasswordResetLayoutProps) {
  return (
    <AuthResponsiveFrame
      supportPanelLabelledBy="password-reset-help-title"
      contentLabelledBy="password-reset-title"
      supportPanelTestId="password-reset-help-panel"
      showBack={showBack}
      onBackAction={onBack}
      align="start"
      stickySupportPanel
      supportPanelVariant="rail"
      contentWidth="lg"
      supportPanel={
        <PasswordResetSupportPanel currentStep={currentStep} isComplete={!showProgress} />
      }
    >
      <h1 id="password-reset-title" className="sr-only">
        {PASSWORD_RESET_COPY.pageTitle}
      </h1>

      <AuthStepFrame
        testId="password-reset-flow-card"
        progress={
          showProgress ? (
            <AuthStepProgress
              ariaLabel={PASSWORD_RESET_COPY.progressLabel}
              currentStep={currentStep}
              totalSteps={PASSWORD_RESET_COPY.support.steps.length}
              stepLabels={PASSWORD_RESET_COPY.support.steps}
            />
          ) : undefined
        }
      >
        <div data-testid="password-reset-form-stack">{children}</div>
      </AuthStepFrame>

      <AuthServiceNotice className="mt-6 text-center lg:hidden" />
    </AuthResponsiveFrame>
  );
}
