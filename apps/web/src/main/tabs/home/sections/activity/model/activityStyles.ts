import type { StaticActivityMetric, StaticActivityTone } from './activityTypes';

export function getStaticActivityButtonClassName(
  variant: 'primary' | 'secondary',
  tone: StaticActivityTone,
): string {
  if (variant === 'secondary') {
    if (tone === 'openRegistered') {
      return 'border-amber-200 bg-amber-50/70 text-amber-800 hover:bg-amber-100/80';
    }
    if (tone === 'openReady' || tone === 'openRequired') {
      return 'border-sky-200 bg-sky-50 text-sky-900 hover:bg-sky-100';
    }
    return 'border-(--knu-border) bg-white text-(--knu-text-primary) hover:bg-(--knu-background-alt)';
  }

  if (tone === 'openRegistered') {
    return 'border-cyan-500 bg-cyan-500 text-white hover:bg-cyan-600';
  }
  if (tone === 'openReady') {
    return 'border-emerald-300 bg-emerald-100 text-emerald-900 hover:bg-emerald-200';
  }
  if (tone === 'openRequired') {
    return 'border-sky-600 bg-sky-600 text-white hover:bg-sky-700';
  }
  return 'border-(--knu-border) bg-(--knu-background-alt) text-(--knu-text-primary) hover:bg-gray-100';
}

export const STATIC_ACTIVITY_TONE_CLASS_NAMES: Record<
  StaticActivityTone,
  { section: string; eyebrow: string; iconBox: string }
> = {
  default: {
    section: '',
    eyebrow: 'text-(--knu-primary)',
    iconBox: 'bg-blue-50 text-(--knu-primary)',
  },
  openRequired: {
    section: 'border-sky-100 bg-sky-50 shadow-sm',
    eyebrow: 'text-sky-700',
    iconBox: 'bg-white text-sky-600 ring-1 ring-sky-100',
  },
  openReady: {
    section: 'border-blue-100 bg-blue-50 shadow-sm',
    eyebrow: 'text-sky-800',
    iconBox: 'bg-white text-sky-700 ring-1 ring-blue-100',
  },
  openRegistered: {
    section: 'border-cyan-100 bg-cyan-50 shadow-sm',
    eyebrow: 'text-cyan-700',
    iconBox: 'bg-white text-cyan-700 ring-1 ring-cyan-100',
  },
  openWaiting: {
    section: 'border-slate-200 bg-slate-50 shadow-sm',
    eyebrow: 'text-slate-700',
    iconBox: 'bg-white text-slate-600 ring-1 ring-slate-200',
  },
  postMatch: {
    section: 'border-purple-100 bg-purple-50/70 shadow-sm',
    eyebrow: 'text-purple-700',
    iconBox: 'bg-white text-purple-700 ring-1 ring-purple-100',
  },
  postMatchMatched: {
    section: 'border-emerald-100 bg-emerald-50/80 shadow-sm',
    eyebrow: 'text-emerald-700',
    iconBox: 'bg-white text-emerald-700 ring-1 ring-emerald-100',
  },
};

export const STATIC_ACTIVITY_METRIC_CLASS_NAMES: Record<
  NonNullable<StaticActivityMetric['tone']>,
  { cell: string; icon: string; value: string }
> = {
  neutral: {
    cell: 'backdrop-blur-md rounded-xl border border-slate-200 bg-slate-50/85 p-3 shadow-sm',
    icon: 'text-slate-500',
    value: 'text-slate-800',
  },
  participant: {
    cell: 'backdrop-blur-md rounded-xl border border-cyan-200 bg-cyan-50/90 p-3 shadow-sm',
    icon: 'text-cyan-600',
    value: 'text-cyan-900',
  },
  buildingOpen: {
    cell: 'backdrop-blur-md rounded-xl border border-blue-200/70 bg-blue-50/80 p-3 shadow-sm',
    icon: 'text-blue-600',
    value: 'text-blue-900',
  },
  buildingLocked: {
    cell: 'backdrop-blur-md rounded-xl border border-blue-200/70 bg-blue-50/80 p-3 shadow-sm',
    icon: 'text-blue-600',
    value: 'text-blue-900',
  },
  matchSuccess: {
    cell: 'backdrop-blur-md rounded-xl border border-emerald-200 bg-emerald-50/85 p-3 shadow-sm',
    icon: 'text-emerald-600',
    value: 'text-emerald-900',
  },
  result: {
    cell: 'backdrop-blur-md rounded-xl border border-purple-200 bg-purple-50/80 p-3 shadow-sm',
    icon: 'text-purple-600',
    value: 'text-purple-900',
  },
};
