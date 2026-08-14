import { TASK_STEP_CARD_CLASS_NAME, TASK_STEP_STATUS_COPY } from './model/primaryStyles';
import type { PrimaryTaskStep } from './model/primaryTypes';

export function PrimaryTaskStepCard({
  step,
  emphasis = false,
}: {
  step: PrimaryTaskStep;
  emphasis?: boolean;
}) {
  const status = TASK_STEP_STATUS_COPY[step.status];

  return (
    <li
      className={`relative h-full overflow-hidden rounded-xl border p-3 shadow-sm backdrop-blur-sm ${TASK_STEP_CARD_CLASS_NAME[step.status]} ${
        emphasis ? 'bg-white/90 ring-1 ring-white/85' : ''
      }`}
    >
      <span
        className={`absolute inset-y-3 left-0 w-1 rounded-r-full ${status.dotClassName}`}
        aria-hidden="true"
      />
      <div className="flex items-center justify-between gap-2 pl-1">
        <span className="flex min-w-0 items-center gap-2">
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${status.dotClassName}`}
            aria-hidden="true"
          />
          <span className="truncate text-xs font-bold text-(--knu-text-primary)">{step.label}</span>
        </span>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ${status.className}`}
        >
          {step.statusLabel ?? status.label}
        </span>
      </div>
      {step.helper && (
        <p className="mt-1.5 pl-1 text-[11px] leading-relaxed text-(--knu-text-tertiary)">
          {step.helper}
        </p>
      )}
    </li>
  );
}
