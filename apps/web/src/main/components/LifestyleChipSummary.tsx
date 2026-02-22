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
      <Chip label={`🚬 ${getLifestyleLabel('smoker', lifestyle.smoker)}`} variant="badge" />
      <Chip label={`🕐 취침 ${getLifestyleLabel('bedtime', lifestyle.bedtime)}`} variant="badge" />
      <Chip
        label={`✨ ${getLifestyleLabel('cleanliness', lifestyle.cleanliness)}`}
        variant="badge"
      />
      {mbti && <Chip label={`🧠 ${mbti}`} variant="badge" />}
    </div>
  );
}
