import { CheckCircle } from 'lucide-react';
import { Button } from '@/components/Button';

interface PasswordResetCompleteStepProps {
  onGoToLogin: () => void;
}

export function PasswordResetCompleteStep({ onGoToLogin }: PasswordResetCompleteStepProps) {
  return (
    <div className="space-y-6 py-8 text-center">
      <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
        <CheckCircle className="h-12 w-12 text-green-600" />
      </div>

      <div>
        <h2 className="mb-3 text-2xl font-bold text-[var(--knu-text-primary)] md:text-3xl">
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
