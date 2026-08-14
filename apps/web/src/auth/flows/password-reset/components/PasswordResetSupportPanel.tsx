import { AuthServiceNotice, AuthSupportPanel } from '@/auth/components';
import { PASSWORD_RESET_COPY } from '../model/password-reset-copy';

const PASSWORD_RESET_STEPS = [
  { id: 1, order: 1, label: PASSWORD_RESET_COPY.support.steps[0] },
  { id: 2, order: 2, label: PASSWORD_RESET_COPY.support.steps[1] },
] as const;

const SUPPORT_CONTENT = {
  1: PASSWORD_RESET_COPY.support.email,
  2: PASSWORD_RESET_COPY.support.password,
} as const;

interface PasswordResetSupportPanelProps {
  currentStep: number;
  isComplete: boolean;
}

export function PasswordResetSupportPanel({
  currentStep,
  isComplete,
}: PasswordResetSupportPanelProps) {
  const safeStep = Math.min(Math.max(currentStep, 1), PASSWORD_RESET_STEPS.length);
  const content = SUPPORT_CONTENT[safeStep as keyof typeof SUPPORT_CONTENT];

  return (
    <AuthSupportPanel
      eyebrow={PASSWORD_RESET_COPY.support.eyebrow}
      titleId="password-reset-help-title"
      title={isComplete ? PASSWORD_RESET_COPY.support.complete.title : content.title}
      description={
        isComplete ? PASSWORD_RESET_COPY.support.complete.description : content.description
      }
      steps={PASSWORD_RESET_STEPS}
      currentStep={safeStep}
      isComplete={isComplete}
      navigationLabel={PASSWORD_RESET_COPY.progressLabel}
      footer={<AuthServiceNotice className="border-t border-(--knu-border) pt-5 text-left" />}
    />
  );
}
