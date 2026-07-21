import { Chip } from '@/components/ui/Chip';
import { formatLifestyleOptionLabel } from '@repo/shared/lifestyle';
import type { LifestyleData } from '@/types/lifestyle';

interface LifestyleChipSummaryProps {
  lifestyle: LifestyleData;
}

export function LifestyleChipSummary({ lifestyle }: LifestyleChipSummaryProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <Chip
        label={`🚬\u00A0${formatLifestyleOptionLabel('smokingBehavior', lifestyle.smokingBehavior)}`}
        variant="badge"
      />
      <Chip
        label={`🕐\u00A0취침 ${formatLifestyleOptionLabel('bedtime', lifestyle.bedtime)}`}
        variant="badge"
      />
      <Chip
        label={`✨\u00A0${formatLifestyleOptionLabel('cleanLevel', lifestyle.cleanLevel)}`}
        variant="badge"
      />
      <Chip
        label={`🔊\u00A0${formatLifestyleOptionLabel('noiseSensitivity', lifestyle.noiseSensitivity)}`}
        variant="badge"
      />
    </div>
  );
}
