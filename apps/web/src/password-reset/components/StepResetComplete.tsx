import { Button } from '@/components/Button';
import { CheckCircle } from 'lucide-react';

interface StepResetCompleteProps {
  onGoToLogin: () => void;
}

export function StepResetComplete({ onGoToLogin }: StepResetCompleteProps) {
  return (
    <div className="text-center space-y-6 py-8">
      <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <CheckCircle className="w-12 h-12 text-green-600" />
      </div>

      <div>
        <h2 className="text-2xl md:text-3xl font-bold text-[var(--knu-text-primary)] mb-3">
          비밀번호 재설정 완료
        </h2>
        <p className="text-lg text-[var(--knu-text-secondary)]">새로운 비밀번호로 로그인해주세요</p>
      </div>

      <div className="pt-4">
        <Button variant="primary" size="lg" fullWidth onClick={onGoToLogin}>
          로그인하러 가기
        </Button>
      </div>
    </div>
  );
}
