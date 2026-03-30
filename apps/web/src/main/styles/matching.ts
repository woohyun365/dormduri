export type MatchingTone = 'emerald' | 'cobalt' | 'amber' | 'purple' | 'rose' | 'slate';

const TONE_STYLES: Record<
  MatchingTone,
  {
    border: string;
    rail: string;
    chip: string;
    panel: string;
    eyebrow: string;
    hero: string;
    button: string;
  }
> = {
  emerald: {
    border: 'border-green-200 shadow-sm',
    rail: 'from-green-500 to-emerald-400',
    chip: 'bg-green-50 text-green-700 border border-green-200',
    panel: 'bg-green-50 border border-green-200 text-green-950',
    eyebrow: 'text-green-700',
    hero: 'from-green-500 to-emerald-500',
    button: 'bg-[var(--knu-primary)] hover:bg-[var(--knu-primary-hover)]',
  },
  cobalt: {
    border: 'border-blue-200 shadow-sm',
    rail: 'from-blue-500 to-sky-400',
    chip: 'bg-blue-50 text-blue-700 border border-blue-200',
    panel: 'bg-blue-50 border border-blue-200 text-blue-950',
    eyebrow: 'text-blue-700',
    hero: 'from-[var(--knu-primary)] to-blue-600',
    button: 'bg-[var(--knu-primary)] hover:bg-[var(--knu-primary-hover)]',
  },
  amber: {
    border: 'border-amber-200 shadow-sm',
    rail: 'from-amber-500 to-yellow-300',
    chip: 'bg-amber-50 text-amber-700 border border-amber-200',
    panel: 'bg-amber-50 border border-amber-200 text-amber-950',
    eyebrow: 'text-amber-700',
    hero: 'from-amber-500 to-orange-500',
    button: 'bg-[var(--knu-primary)] hover:bg-[var(--knu-primary-hover)]',
  },
  purple: {
    border: 'border-purple-200 shadow-sm',
    rail: 'from-purple-500 to-fuchsia-400',
    chip: 'bg-purple-50 text-purple-700 border border-purple-200',
    panel: 'bg-purple-50 border border-purple-200 text-purple-950',
    eyebrow: 'text-purple-700',
    hero: 'from-purple-500 to-fuchsia-500',
    button: 'bg-[var(--knu-primary)] hover:bg-[var(--knu-primary-hover)]',
  },
  rose: {
    border: 'border-red-200 shadow-sm',
    rail: 'from-red-500 to-orange-400',
    chip: 'bg-rose-50 text-rose-700 border border-rose-200',
    panel: 'bg-rose-50 border border-rose-200 text-rose-950',
    eyebrow: 'text-rose-700',
    hero: 'from-rose-500 to-orange-500',
    button: 'bg-[var(--knu-primary)] hover:bg-[var(--knu-primary-hover)]',
  },
  slate: {
    border: 'border-[var(--knu-border)] shadow-sm',
    rail: 'from-slate-400 to-slate-200',
    chip: 'bg-slate-100 text-slate-700 border border-slate-200',
    panel: 'bg-[var(--knu-background-alt)] border border-[var(--knu-border)] text-slate-900',
    eyebrow: 'text-slate-600',
    hero: 'from-slate-500 to-slate-700',
    button: 'bg-[var(--knu-primary)] hover:bg-[var(--knu-primary-hover)]',
  },
};

export const matchingStageBackground = 'bg-[var(--knu-background-alt)]';

export const matchingCardShell = 'relative overflow-hidden rounded-2xl border-2 bg-white keep-all';
export const matchingHistoryCardBorder = 'border-gray-200';

export const matchingDisplayTitle = 'font-bold text-[var(--knu-text-primary)]';

export function matchingBorder(tone: MatchingTone): string {
  return TONE_STYLES[tone].border;
}

export function matchingChip(tone: MatchingTone): string {
  return `inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONE_STYLES[tone].chip}`;
}

export function matchingPanel(tone: MatchingTone, extra = ''): string {
  return `rounded-xl p-4 ${TONE_STYLES[tone].panel} ${extra}`.trim();
}

export function matchingEyebrow(tone: MatchingTone): string {
  return `text-xs font-semibold ${TONE_STYLES[tone].eyebrow}`;
}

export function matchingHero(tone: MatchingTone): string {
  return `bg-gradient-to-r ${TONE_STYLES[tone].hero}`;
}

export function matchingPrimaryAction(tone: MatchingTone): string {
  return `${TONE_STYLES[tone].button} text-white`;
}

export function matchingToneByScore(score: number): MatchingTone {
  if (score >= 85) return 'emerald';
  if (score >= 70) return 'cobalt';
  if (score >= 50) return 'amber';
  return 'slate';
}
