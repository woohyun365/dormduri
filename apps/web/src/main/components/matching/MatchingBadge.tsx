'use client';

import { Lock } from 'lucide-react';

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
  const sizeClass = size === 'lg' ? 'px-3.5 py-2 text-sm' : 'px-3 py-1.5 text-xs';

  if (gated) {
    return (
      <div
        className={`inline-flex items-center gap-1.5 ${sizeClass} rounded-lg font-bold bg-gray-100 text-gray-600`}
      >
        <Lock className="w-3.5 h-3.5" />
        <span className="blur-sm select-none">88%</span>
      </div>
    );
  }

  const getScoreColor = (s: number) => {
    if (s >= 85) return 'bg-green-100 text-green-700';
    if (s >= 70) return 'bg-blue-100 text-blue-700';
    if (s >= 50) return 'bg-amber-100 text-amber-700';
    return 'bg-gray-100 text-gray-600';
  };

  return (
    <div
      className={`inline-flex items-center gap-1.5 ${sizeClass} rounded-lg font-bold ${getScoreColor(score)}`}
    >
      <span>{score}%</span>
      {partial && <span className="text-amber-600">(!)</span>}
    </div>
  );
}
