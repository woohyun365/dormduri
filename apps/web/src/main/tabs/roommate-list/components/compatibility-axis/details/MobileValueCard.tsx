import type { ElementType, ReactNode } from 'react';

export function MobileValueCard({
  label,
  value,
  Icon,
  iconClassName,
  iconWrapperClassName,
  ariaLabel,
  className,
  children,
}: {
  readonly label: string;
  readonly value?: string;
  readonly Icon?: ElementType<{ className?: string; 'aria-hidden'?: boolean }>;
  readonly iconClassName?: string;
  readonly iconWrapperClassName?: string;
  readonly ariaLabel: string;
  readonly className?: string;
  readonly children?: ReactNode;
}) {
  return (
    <div
      className={`rounded-2xl border border-slate-100 bg-white px-3 py-3 shadow-sm ${className ?? ''}`}
      aria-label={ariaLabel}
    >
      <p className="text-[10px] font-extrabold leading-4 text-slate-500">{label}</p>
      <div className="mt-1 flex min-h-7 items-center">
        {children ?? (
          <div className="inline-flex min-w-0 items-start gap-1.5">
            {Icon ? (
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${iconWrapperClassName ?? 'bg-slate-50'}`}
                aria-hidden="true"
              >
                <Icon className={`h-3.5 w-3.5 ${iconClassName ?? 'text-slate-500'}`} />
              </span>
            ) : null}
            <span className="min-w-0 break-keep text-sm leading-5 font-extrabold whitespace-normal text-(--knu-text-primary)">
              {value}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
