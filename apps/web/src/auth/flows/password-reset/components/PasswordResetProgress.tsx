import { ProgressBar } from '@/components/form/ProgressBar';

interface PasswordResetProgressProps {
  currentStep: number;
}

export function PasswordResetProgress({ currentStep }: PasswordResetProgressProps) {
  return (
    <div className="mb-5 md:mb-7">
      <ProgressBar currentStep={currentStep} totalSteps={3} />
    </div>
  );
}
