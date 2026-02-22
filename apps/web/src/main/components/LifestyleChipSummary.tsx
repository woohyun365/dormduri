import { Chip } from '@/components/Chip';
import { getLifestyleLabel } from '@/constants/lifestyle';
import type { LifestyleData } from '@/types/lifestyle';

interface LifestyleChipSummaryProps {
  lifestyle: LifestyleData;
  mbti?: string | null;
}

export function LifestyleChipSummary({ lifestyle, mbti }: LifestyleChipSummaryProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <Chip label={`🚬\u00A0${getLifestyleLabel('smoker', lifestyle.smoker)}`} variant="badge" />
      <Chip
        label={`🕐\u00A0취침 ${getLifestyleLabel('bedtime', lifestyle.bedtime)}`}
        variant="badge"
      />
      <Chip
        label={`✨\u00A0${getLifestyleLabel('cleanliness', lifestyle.cleanliness)}`}
        variant="badge"
      />
      {mbti && <Chip label={`🧠\u00A0${mbti}`} variant="badge" />}
    </div>
  );
}
