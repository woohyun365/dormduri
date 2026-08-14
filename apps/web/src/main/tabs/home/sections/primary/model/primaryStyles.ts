import type {
  PrimaryDeadlineTone,
  PrimaryInsight,
  PrimaryNotice,
  PrimaryTaskStepStatus,
  PrimaryTone,
} from './primaryTypes';

export const PRIMARY_HEADER_TONE = {
  surface: 'bg-linear-to-r from-blue-50 to-purple-50',
  border: 'border-blue-200',
  status: 'bg-green-500',
  icon: 'text-(--knu-primary)',
  accent: 'text-(--knu-primary)',
} satisfies {
  surface: string;
  border: string;
  status: string;
  icon: string;
  accent: string;
};

export const TONE_STYLES: Record<
  PrimaryTone,
  {
    surface: string;
    border: string;
    status: string;
    icon: string;
    accent: string;
  }
> = {
  blue: PRIMARY_HEADER_TONE,
  green: {
    surface: 'bg-linear-to-r from-green-50 to-emerald-50',
    border: 'border-green-200',
    status: 'bg-green-500',
    icon: 'text-green-600',
    accent: 'text-green-700',
  },
  amber: {
    surface: 'bg-linear-to-r from-amber-50 to-yellow-50',
    border: 'border-amber-200',
    status: 'bg-amber-500',
    icon: 'text-amber-600',
    accent: 'text-amber-800',
  },
  purple: {
    surface: 'bg-linear-to-r from-purple-50 to-blue-50',
    border: 'border-purple-200',
    status: 'bg-purple-500',
    icon: 'text-purple-600',
    accent: 'text-purple-700',
  },
  cyan: {
    surface: 'bg-cyan-50',
    border: 'border-cyan-300',
    status: 'bg-cyan-600',
    icon: 'text-cyan-700',
    accent: 'text-cyan-800',
  },
  red: {
    surface: 'bg-linear-to-r from-red-50 to-orange-50',
    border: 'border-red-200',
    status: 'bg-red-500',
    icon: 'text-red-600',
    accent: 'text-red-700',
  },
  openRequired: {
    surface: 'bg-linear-to-r from-slate-50 via-sky-50 to-cyan-50',
    border: 'border-sky-200',
    status: 'bg-sky-500',
    icon: 'text-sky-600',
    accent: 'text-sky-700',
  },
  openPrep: {
    surface: 'bg-linear-to-r from-sky-50 via-cyan-50 to-blue-50',
    border: 'border-cyan-200',
    status: 'bg-cyan-500',
    icon: 'text-cyan-600',
    accent: 'text-cyan-700',
  },
  slate: {
    surface: 'bg-linear-to-r from-slate-100 via-zinc-50 to-stone-100',
    border: 'border-slate-300',
    status: 'bg-slate-500',
    icon: 'text-slate-600',
    accent: 'text-slate-700',
  },
};

export const DEADLINE_TONE_STYLES: Record<
  PrimaryDeadlineTone,
  {
    fill: string;
    text: string;
    badge: string;
    panel: string;
  }
> = {
  normal: {
    fill: 'bg-blue-500',
    text: 'text-blue-700',
    badge: 'bg-blue-500',
    panel: 'border-blue-100 bg-blue-50/55',
  },
  warning: {
    fill: 'bg-amber-500',
    text: 'text-amber-700',
    badge: 'bg-amber-500',
    panel: 'border-amber-100 bg-amber-50/55',
  },
  critical: {
    fill: 'bg-red-500',
    text: 'text-red-700',
    badge: 'bg-red-500',
    panel: 'border-red-100 bg-red-50/55',
  },
  closed: {
    fill: 'bg-slate-500',
    text: 'text-slate-700',
    badge: 'bg-slate-500',
    panel: 'border-slate-200 bg-slate-50/80',
  },
};

export const PRIMARY_INSIGHT_TONE_CLASS_NAMES: Record<
  NonNullable<PrimaryInsight['tone']>,
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
    cell: 'backdrop-blur-md rounded-xl border border-indigo-200 bg-indigo-50/85 p-3 shadow-sm',
    icon: 'text-indigo-600',
    value: 'text-indigo-900',
  },
  matchedResult: {
    cell: 'backdrop-blur-md rounded-xl border border-emerald-200 bg-emerald-50/90 p-3 shadow-sm',
    icon: 'text-emerald-600',
    value: 'text-emerald-900',
  },
};

export const TASK_STEP_STATUS_COPY: Record<
  PrimaryTaskStepStatus,
  {
    label: string;
    className: string;
    dotClassName: string;
  }
> = {
  complete: {
    label: '완료',
    className: 'bg-green-50 text-green-700 ring-green-100',
    dotClassName: 'bg-green-500',
  },
  actionable: {
    label: '필요',
    className: 'bg-amber-50 text-amber-700 ring-amber-100',
    dotClassName: 'bg-amber-500',
  },
  locked: {
    label: '대기',
    className: 'bg-slate-50 text-slate-600 ring-slate-100',
    dotClassName: 'bg-slate-400',
  },
  blocked: {
    label: '보류',
    className: 'bg-amber-50 text-amber-700 ring-amber-100',
    dotClassName: 'bg-amber-500',
  },
};

export const NOTICE_TONE_CLASS_NAME: Record<PrimaryNotice['tone'], string> = {
  info: 'border-white/70 bg-white/70 text-slate-700',
  warning: 'border-white/70 bg-white/70 text-slate-700',
  success: 'border-white/70 bg-white/70 text-slate-700',
};

export const NOTICE_ICON_CLASS_NAME: Record<PrimaryNotice['tone'], string> = {
  info: 'text-blue-600',
  warning: 'text-amber-600',
  success: 'text-green-600',
};

export const TASK_STEP_CARD_CLASS_NAME: Record<PrimaryTaskStepStatus, string> = {
  complete: 'border-white/75 bg-white/80 shadow-slate-200/50',
  actionable: 'border-white/75 bg-white/80 shadow-slate-200/55',
  locked: 'border-white/65 bg-white/60 shadow-slate-200/40',
  blocked: 'border-amber-200/70 bg-white/80 shadow-amber-100/40',
};
