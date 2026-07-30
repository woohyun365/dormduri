import type { ReactNode } from 'react';
import { AlertCircle, CheckCircle, Timer, WifiOff, type LucideIcon } from 'lucide-react';

export type LoginFeedbackVariant = 'error' | 'warning' | 'success' | 'connectivity';

interface LoginFeedbackStripProps {
  variant: LoginFeedbackVariant;
  title: string;
  description?: string;
  role: 'alert' | 'status';
  children?: ReactNode;
}

const FEEDBACK_PRESENTATION: Record<
  LoginFeedbackVariant,
  {
    Icon: LucideIcon;
    containerClassName: string;
    iconClassName: string;
    titleClassName: string;
    descriptionClassName: string;
  }
> = {
  error: {
    Icon: AlertCircle,
    containerClassName: 'border-rose-300 bg-rose-50/80',
    iconClassName: 'text-rose-500',
    titleClassName: 'text-rose-950',
    descriptionClassName: 'text-rose-700',
  },
  warning: {
    Icon: Timer,
    containerClassName: 'border-amber-300 bg-amber-50/80',
    iconClassName: 'text-amber-600',
    titleClassName: 'text-amber-950',
    descriptionClassName: 'text-amber-700',
  },
  success: {
    Icon: CheckCircle,
    containerClassName: 'border-emerald-300 bg-emerald-50/80',
    iconClassName: 'text-emerald-600',
    titleClassName: 'text-emerald-950',
    descriptionClassName: 'text-emerald-700',
  },
  connectivity: {
    Icon: WifiOff,
    containerClassName: 'border-rose-300 bg-rose-50/80',
    iconClassName: 'text-rose-500',
    titleClassName: 'text-rose-950',
    descriptionClassName: 'text-rose-700',
  },
};

export function LoginFeedbackStrip({
  variant,
  title,
  description,
  role,
  children,
}: LoginFeedbackStripProps) {
  const presentation = FEEDBACK_PRESENTATION[variant];
  const { Icon } = presentation;

  return (
    <div
      role={role}
      aria-live={role === 'status' ? 'polite' : undefined}
      data-variant={variant}
      className={`mb-5 flex items-start gap-2.5 rounded-r-xl border-l-2 px-3.5 py-3 ${presentation.containerClassName}`}
    >
      <Icon className={`mt-0.5 size-4 shrink-0 ${presentation.iconClassName}`} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-semibold ${presentation.titleClassName}`}>{title}</p>
        {description ? (
          <p className={`mt-1 text-xs ${presentation.descriptionClassName}`}>{description}</p>
        ) : null}
        {children}
      </div>
    </div>
  );
}
