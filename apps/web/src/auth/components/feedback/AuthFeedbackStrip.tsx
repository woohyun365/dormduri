import type { ReactNode, Ref } from 'react';
import { AlertCircle, CheckCircle, Info, Timer, WifiOff, type LucideIcon } from 'lucide-react';

export type AuthFeedbackVariant = 'info' | 'error' | 'warning' | 'success' | 'connectivity';

interface AuthFeedbackStripProps {
  variant: AuthFeedbackVariant;
  title: string;
  description?: ReactNode;
  aside?: ReactNode;
  role?: 'alert' | 'status';
  titleRole?: 'alert' | 'status';
  titleRef?: Ref<HTMLParagraphElement>;
  titleTabIndex?: number;
  className?: string;
  testId?: string;
  children?: ReactNode;
}

const FEEDBACK_PRESENTATION: Record<
  AuthFeedbackVariant,
  {
    Icon: LucideIcon;
    containerClassName: string;
    iconClassName: string;
    titleClassName: string;
    descriptionClassName: string;
  }
> = {
  info: {
    Icon: Info,
    containerClassName: 'border-blue-300 bg-blue-50/80',
    iconClassName: 'text-blue-600',
    titleClassName: 'text-blue-950',
    descriptionClassName: 'text-blue-700',
  },
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

export function AuthFeedbackStrip({
  variant,
  title,
  description,
  aside,
  role,
  titleRole,
  titleRef,
  titleTabIndex,
  className,
  testId,
  children,
}: AuthFeedbackStripProps) {
  const presentation = FEEDBACK_PRESENTATION[variant];
  const { Icon } = presentation;

  return (
    <div
      role={role}
      aria-live={role === 'status' ? 'polite' : undefined}
      data-testid={testId}
      data-variant={variant}
      className={`flex items-start gap-2.5 rounded-r-xl border-l-2 px-3.5 py-3 ${presentation.containerClassName} ${className ?? ''}`}
    >
      <Icon className={`mt-0.5 size-4 shrink-0 ${presentation.iconClassName}`} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p
          ref={titleRef}
          role={titleRole}
          tabIndex={titleTabIndex}
          className={`text-sm font-semibold leading-5 ${presentation.titleClassName}`}
        >
          {title}
        </p>
        {description || aside ? (
          <div className="mt-1 flex items-start justify-between gap-3">
            {description ? (
              <p className={`min-w-0 text-xs leading-5 ${presentation.descriptionClassName}`}>
                {description}
              </p>
            ) : null}
            {aside}
          </div>
        ) : null}
        {children}
      </div>
    </div>
  );
}
