export type MatchScoreTone = 'excellent' | 'good' | 'fair' | 'low';

const MATCH_SCORE_THRESHOLDS = {
  excellent: 85,
  good: 70,
  fair: 50,
} as const;

const MATCH_SCORE_TONE_CLASS: Record<MatchScoreTone, string> = {
  excellent: 'text-green-600 bg-green-100',
  good: 'text-blue-600 bg-blue-100',
  fair: 'text-sky-600 bg-sky-100',
  low: 'text-(--knu-text-secondary) bg-slate-200',
};

export function getMatchScoreTone(score: number): MatchScoreTone {
  if (score >= MATCH_SCORE_THRESHOLDS.excellent) return 'excellent';
  if (score >= MATCH_SCORE_THRESHOLDS.good) return 'good';
  if (score >= MATCH_SCORE_THRESHOLDS.fair) return 'fair';
  return 'low';
}

export function getMatchScoreColor(score: number): string {
  return MATCH_SCORE_TONE_CLASS[getMatchScoreTone(score)];
}
