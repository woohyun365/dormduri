const DEFAULT_STEP_LABELS = [
  '학교 이메일',
  '필수 동의',
  '로그인 정보',
  '학교·기본 정보',
  '가입 완료',
] as const;

interface SignupProgressProps {
  currentStep: number;
  totalSteps?: number;
  stepLabels?: readonly string[];
}

function clampStep(currentStep: number, totalSteps: number) {
  return Math.min(Math.max(currentStep, 1), totalSteps);
}

export function SignupProgress({
  currentStep,
  totalSteps = DEFAULT_STEP_LABELS.length,
  stepLabels = DEFAULT_STEP_LABELS,
}: SignupProgressProps) {
  const safeCurrentStep = clampStep(currentStep, totalSteps);
  const currentLabel = stepLabels[safeCurrentStep - 1] ?? `단계 ${safeCurrentStep}`;
  const percent = Math.round((safeCurrentStep / totalSteps) * 100);
  const isComplete = safeCurrentStep === totalSteps;

  return (
    <section aria-label="회원가입 진행 상태" className="space-y-3 lg:hidden">
      <div className="flex items-center justify-between gap-4">
        <p
          className={`text-sm font-semibold ${
            isComplete ? 'text-emerald-700' : 'text-(--knu-text-primary)'
          }`}
        >
          {safeCurrentStep}/{totalSteps} · {currentLabel}
        </p>
        <span
          className={`text-xs font-medium ${
            isComplete ? 'text-emerald-700' : 'text-(--knu-text-tertiary)'
          }`}
        >
          {percent}%
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={`${currentLabel} 단계`}
        aria-valuemin={1}
        aria-valuemax={totalSteps}
        aria-valuenow={safeCurrentStep}
        className={`h-1.5 overflow-hidden rounded-full ${
          isComplete ? 'bg-emerald-100' : 'bg-slate-200'
        }`}
      >
        <div
          className={`h-full rounded-full transition-[width] duration-300 ${
            isComplete ? 'bg-emerald-500' : 'bg-(--knu-primary)'
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </section>
  );
}
