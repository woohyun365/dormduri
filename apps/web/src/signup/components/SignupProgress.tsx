const DEFAULT_STEP_LABELS = [
  '학교 이메일 인증',
  '필수 동의 확인',
  '계정 정보 입력',
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
  const percentage = Math.round((safeCurrentStep / totalSteps) * 100);
  const currentLabel = stepLabels[safeCurrentStep - 1] ?? `단계 ${safeCurrentStep}`;

  return (
    <section aria-label="회원가입 진행 상태" className="space-y-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-(--knu-primary)">
            회원가입 진행
          </p>
          <p className="mt-1 text-sm font-semibold text-(--knu-text-primary)">
            단계 {safeCurrentStep}/{totalSteps}
          </p>
          <p className="text-sm text-(--knu-text-secondary)">현재 단계: {currentLabel}</p>
        </div>
        <span className="text-sm font-semibold text-(--knu-text-secondary)" aria-hidden="true">
          {percentage}%
        </span>
      </div>

      <div
        role="progressbar"
        aria-label="회원가입 진행률"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percentage}
        className="h-2 w-full overflow-hidden rounded-full bg-gray-200"
      >
        <div
          className="h-full rounded-full bg-(--knu-primary) transition-all duration-300 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>

      <ol aria-label="회원가입 진행 단계" className="grid grid-cols-4 gap-2 text-center">
        {stepLabels.slice(0, totalSteps).map((label, index) => {
          const step = index + 1;
          const isCurrent = step === safeCurrentStep;
          const isComplete = step < safeCurrentStep;

          return (
            <li
              key={label}
              aria-current={isCurrent ? 'step' : undefined}
              className="flex flex-col items-center gap-1 text-[11px] font-medium text-(--knu-text-secondary) sm:text-xs"
            >
              <span
                className={
                  isCurrent || isComplete
                    ? 'flex size-7 items-center justify-center rounded-full bg-(--knu-primary) text-xs font-bold text-white'
                    : 'flex size-7 items-center justify-center rounded-full bg-(--knu-background-alt) text-xs font-bold text-(--knu-text-tertiary)'
                }
              >
                {step}
              </span>
              <span className={isCurrent ? 'text-(--knu-text-primary)' : undefined}>{label}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
