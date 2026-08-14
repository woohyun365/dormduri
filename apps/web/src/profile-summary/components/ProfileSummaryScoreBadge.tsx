import { getMatchScoreColor } from '../model/matchScorePresentation';

interface ProfileSummaryScoreBadgeProps {
  readonly score: number;
  readonly label?: string;
}

export function ProfileSummaryScoreBadge({
  score,
  label = `매칭점수 ${score}점`,
}: ProfileSummaryScoreBadgeProps) {
  return (
    <span
      className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${getMatchScoreColor(score)}`}
      aria-label={label}
    >
      {label}
    </span>
  );
}
