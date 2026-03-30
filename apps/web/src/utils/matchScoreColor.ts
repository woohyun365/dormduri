import { MATCH_SCORE_THRESHOLDS } from '@/constants/ui';

export function getMatchScoreColor(score: number): string {
  if (score >= MATCH_SCORE_THRESHOLDS.excellent) return 'text-green-600 bg-green-100';
  if (score >= MATCH_SCORE_THRESHOLDS.good) return 'text-blue-600 bg-blue-100';
  if (score >= MATCH_SCORE_THRESHOLDS.fair) return 'text-amber-600 bg-amber-50';
  return 'text-[var(--knu-text-secondary)] bg-[var(--knu-background-alt)]';
}
