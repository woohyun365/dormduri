import { Button } from '@/components/Button';

interface StepNavigationProps {
  onBack: () => void;
  onNext: () => void;
  nextLabel?: string;
}

export function StepNavigation({ onBack, onNext, nextLabel = '다음 단계' }: StepNavigationProps) {
  return (
    <div className="flex gap-3 pt-4">
      <Button variant="outline" size="lg" fullWidth onClick={onBack}>
        이전
      </Button>
      <Button variant="primary" size="lg" fullWidth onClick={onNext}>
        {nextLabel}
      </Button>
    </div>
  );
}
