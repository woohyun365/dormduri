import type { ElementType } from 'react';

export type TwoLaneSupportLevel = 'match' | 'partial' | 'outside';

export interface TwoLaneOption<TId extends string> {
  readonly id: TId;
  readonly label: string;
  readonly Icon: ElementType<{ className?: string; 'aria-hidden'?: boolean }>;
}

export function TwoLaneOptionItem<TId extends string>({
  option,
  active,
  supportLevel,
}: {
  readonly option: TwoLaneOption<TId>;
  readonly active: boolean;
  readonly supportLevel: TwoLaneSupportLevel;
}) {
  const Icon = option.Icon;
  const inRange = supportLevel !== 'outside';
  const itemClassName = active
    ? 'border-sky-300 bg-sky-50/90 text-sky-900 shadow-sm ring-1 ring-sky-200'
    : inRange
      ? 'border-indigo-100 bg-white/85 text-slate-700'
      : 'border-slate-100 bg-slate-50/70 text-slate-500';
  const iconClassName = active
    ? 'bg-white text-sky-700 ring-1 ring-sky-100'
    : 'bg-white/80 text-slate-400';

  return (
    <li
      className={`flex min-w-0 items-start gap-2 rounded-xl border px-2.5 py-2 ${itemClassName}`}
      aria-current={active ? 'true' : undefined}
    >
      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${iconClassName}`}
        aria-hidden="true"
      >
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="min-w-0 flex-1 break-keep text-[11px] leading-4 font-extrabold whitespace-normal">
        {option.label}
      </span>
      {active ? (
        <span className="ml-auto hidden shrink-0 rounded-full border border-sky-100 bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-700 min-[361px]:inline-flex">
          상대
        </span>
      ) : null}
    </li>
  );
}
