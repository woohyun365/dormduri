import { Chip } from '@/components/Chip';
import { getLifestyleLabel } from '@/constants/lifestyle';
import type { LifestyleData } from '@/types/lifestyle';

interface LifestyleChipSummaryProps {
  lifestyle: LifestyleData;
}

export function LifestyleChipSummary({ lifestyle }: LifestyleChipSummaryProps) {
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
      <Chip
        label={`🔊\u00A0${getLifestyleLabel('noiseSensitivity', lifestyle.noiseSensitivity)}`}
        variant="badge"
      />
    </div>
  );
}
