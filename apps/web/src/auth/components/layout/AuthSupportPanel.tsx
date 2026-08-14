import type { Key, ReactNode } from 'react';
import { Check } from 'lucide-react';

export interface AuthSupportStep {
  id: Key;
  label: string;
  order: number;
}

interface AuthSupportPanelProps {
  eyebrow: string;
  titleId: string;
  title: string;
  description: string;
  steps: readonly AuthSupportStep[];
  currentStep: number;
  isComplete: boolean;
  navigationLabel: string;
  footer?: ReactNode;
}

export function AuthSupportPanel({
  eyebrow,
  titleId,
  title,
  description,
  steps,
  currentStep,
  isComplete,
  navigationLabel,
  footer,
}: AuthSupportPanelProps) {
  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-(--knu-primary)">
          {eyebrow}
        </p>
        <h2
          id={titleId}
          className="mt-5 keep-all text-2xl font-bold leading-tight text-(--knu-text-primary)"
        >
          {title}
        </h2>
        <p className="mt-3 keep-all text-sm leading-6 text-(--knu-text-secondary)">{description}</p>
      </div>

      <nav aria-label={navigationLabel}>
        <ol
          className={`relative space-y-1 before:absolute before:bottom-4 before:left-3 before:top-4 before:w-px ${
            isComplete ? 'before:bg-emerald-200' : 'before:bg-slate-200'
          }`}
        >
          {steps.map((step) => {
            const isCurrent = !isComplete && step.order === currentStep;
            const isDone = isComplete || step.order < currentStep;

            return (
              <li
                key={step.id}
                aria-current={isCurrent ? 'step' : undefined}
                className={`relative flex min-h-11 items-center gap-3 rounded-xl px-1 py-2 ${
                  isCurrent ? 'bg-(--knu-primary-light)' : ''
                }`}
              >
                <span
                  className={`relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    isCurrent
                      ? 'bg-(--knu-primary) text-white'
                      : isDone
                        ? isComplete
                          ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'border border-indigo-200 bg-indigo-50 text-indigo-700'
                        : 'border border-slate-300 bg-(--knu-background-alt) text-slate-500'
                  }`}
                >
                  {isDone ? <Check className="size-3.5" aria-hidden="true" /> : step.order}
                </span>
                <span
                  className={`text-sm ${
                    isCurrent
                      ? 'font-semibold text-(--knu-text-primary)'
                      : 'font-medium text-(--knu-text-secondary)'
                  }`}
                >
                  {step.label}
                </span>
              </li>
            );
          })}
        </ol>
      </nav>

      {footer}
    </div>
  );
}
