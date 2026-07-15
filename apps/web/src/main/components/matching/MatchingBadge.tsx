'use client';

import { Lock, Sparkles } from 'lucide-react';
import { matchingToneByScore } from '@/main/styles/matching';

interface MatchingBadgeProps {
  score: number;
  partial?: boolean;
  gated?: boolean;
  size?: 'sm' | 'lg';
}

export function MatchingBadge({
  score,
  partial = false,
  gated = false,
  size = 'sm',
}: MatchingBadgeProps) {
  const sizeClass =
    size === 'lg'
      ? 'rounded-[18px] px-3.5 py-2.5 text-sm min-w-[92px]'
      : 'rounded-[16px] px-3 py-2 text-xs min-w-[80px]';

  if (gated) {
    return (
      <div
        className={`inline-flex items-center justify-center gap-1.5 ${sizeClass} border border-slate-200 bg-slate-100 font-bold text-slate-500`}
      >
        <Lock className="h-3.5 w-3.5" />
        <span className="select-none blur-[1.8px]">88%</span>
      </div>
    );
  }

  const tone = matchingToneByScore(score);
  const toneClass =
    tone === 'emerald'
      ? 'border-green-200 bg-green-100 text-green-700'
      : tone === 'cobalt'
        ? 'border-blue-200 bg-blue-100 text-blue-700'
        : tone === 'amber'
          ? 'border-amber-200 bg-amber-50 text-amber-700'
          : 'border-slate-200 bg-slate-100 text-slate-700';

  return (
    <div
      className={`inline-flex items-center justify-center gap-1.5 border ${sizeClass} font-bold ${toneClass}`}
    >
      {tone === 'emerald' && <Sparkles className="h-3.5 w-3.5 text-green-600" />}
      <span>{score}%</span>
      {partial && (
        <span
          className={
            tone === 'emerald' || tone === 'cobalt'
              ? 'text-[10px] font-semibold text-current/80'
              : 'text-[10px] font-semibold text-current'
          }
        >
          (!)
        </span>
      )}
    </div>
  );
}
