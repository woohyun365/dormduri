import { useEffect } from 'react';
import { Button } from '@/components/Button';
import { CheckCircle } from 'lucide-react';

interface StepCompleteProps {
  nickname: string;
  onGoToHome: () => void;
}

export function StepComplete({ nickname, onGoToHome }: StepCompleteProps) {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="text-center space-y-6 py-8">
      <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <CheckCircle className="w-12 h-12 text-green-600" />
      </div>

      <div>
        <h2 className="text-2xl md:text-3xl font-bold text-[var(--knu-text-primary)] mb-3">
          회원가입 완료!
        </h2>
        <p className="text-lg text-[var(--knu-text-secondary)]">
          <strong>{nickname}</strong>님, 환영합니다
        </p>
      </div>

      <div className="bg-[var(--knu-background-alt)] rounded-2xl p-6 text-left space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-6 h-6 bg-[var(--knu-primary)] rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
            <span className="text-white text-sm font-bold">1</span>
          </div>
          <div>
            <h4 className="font-semibold text-[var(--knu-text-primary)] mb-1">프로필 완성하기</h4>
            <p className="text-sm text-[var(--knu-text-secondary)]">
              설정한 생활 패턴 정보는 언제든 수정할 수 있어요
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div className="w-6 h-6 bg-[var(--knu-primary)] rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
            <span className="text-white text-sm font-bold">2</span>
          </div>
          <div>
            <h4 className="font-semibold text-[var(--knu-text-primary)] mb-1">룸메 탐색하기</h4>
            <p className="text-sm text-[var(--knu-text-secondary)]">
              필터를 활용해 나와 맞는 룸메 후보를 찾아보세요
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div className="w-6 h-6 bg-[var(--knu-primary)] rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
            <span className="text-white text-sm font-bold">3</span>
          </div>
          <div>
            <h4 className="font-semibold text-[var(--knu-text-primary)] mb-1">시즌에 매칭하기</h4>
            <p className="text-sm text-[var(--knu-text-secondary)]">
              1~2월, 7~8월 시즌에 매칭 요청을 보낼 수 있어요
            </p>
          </div>
        </div>
      </div>

      <div className="pt-4">
        <Button variant="primary" size="lg" fullWidth onClick={onGoToHome}>
          룸메 찾으러 가기
        </Button>
      </div>
    </div>
  );
}
