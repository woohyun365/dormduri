import { useEffect, useRef } from 'react';
import { CheckCircle } from 'lucide-react';
import { Button } from '@/components/Button';
import { focusAndScroll } from '@/utils/focus';

interface PasswordResetCompleteStepProps {
  onGoToLogin: () => void;
}

export function PasswordResetCompleteStep({ onGoToLogin }: PasswordResetCompleteStepProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    focusAndScroll(headingRef.current);
  }, []);

  return (
    <div className="space-y-6 py-8 text-center">
      <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
        <CheckCircle className="h-12 w-12 text-green-600" />
      </div>

      <div>
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="mb-3 text-2xl font-bold text-(--knu-text-primary) md:text-3xl"
        >
          비밀번호 재설정 완료
        </h2>
        <p className="keep-all text-lg leading-8 text-(--knu-text-secondary)">
          보안을 위해 기존 로그인 상태가 모두 종료되었어요. 새 비밀번호로 다시 로그인해주세요.
        </p>
      </div>

      <div className="rounded-2xl bg-(--knu-background-alt) p-4 text-sm leading-6 text-(--knu-text-secondary)">
        다른 기기에서 로그인 중이었다면 해당 세션도 함께 만료됩니다.
      </div>

      <div className="pt-2">
        <Button variant="primary" size="lg" fullWidth onClick={onGoToLogin}>
          로그인하러 가기
        </Button>
      </div>
    </div>
  );
}
