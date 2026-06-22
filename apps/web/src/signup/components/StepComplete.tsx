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
      <div className="size-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <CheckCircle className="size-12 text-green-600" />
      </div>

      <div>
        <h2 className="text-2xl md:text-3xl font-bold text-(--knu-text-primary) mb-3">
          계정 생성 완료!
        </h2>
        <p className="text-lg text-(--knu-text-secondary)">
          <strong>{nickname}</strong>님, KNU 룸메에 오신 것을 환영합니다
        </p>
      </div>

      <div className="bg-(--knu-background-alt) rounded-2xl p-6 text-left space-y-4">
        <div className="flex items-start gap-3">
          <div className="size-6 bg-(--knu-primary) rounded-full flex items-center justify-center shrink-0 mt-0.5">
            <span className="text-white text-sm font-bold">1</span>
          </div>
          <div>
            <h4 className="font-semibold text-(--knu-text-primary) mb-1">시즌 프로필 준비하기</h4>
            <p className="text-sm text-(--knu-text-secondary)">
              생활패턴과 원하는 룸메 조건은 시즌 등록 화면에서 입력해요
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div className="size-6 bg-(--knu-primary) rounded-full flex items-center justify-center shrink-0 mt-0.5">
            <span className="text-white text-sm font-bold">2</span>
          </div>
          <div>
            <h4 className="font-semibold text-(--knu-text-primary) mb-1">기숙사 선택 확인하기</h4>
            <p className="text-sm text-(--knu-text-secondary)">
              시즌 등록 시 사용할 기숙사 선택 정보를 먼저 저장할 수 있어요
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div className="size-6 bg-(--knu-primary) rounded-full flex items-center justify-center shrink-0 mt-0.5">
            <span className="text-white text-sm font-bold">3</span>
          </div>
          <div>
            <h4 className="font-semibold text-(--knu-text-primary) mb-1">시즌에서 룸메 찾기</h4>
            <p className="text-sm text-(--knu-text-secondary)">
              등록이 완료되면 후보를 확인하고 대화하거나 매칭 요청을 보낼 수 있어요
            </p>
          </div>
        </div>
      </div>

      <div className="pt-4">
        <Button variant="primary" size="lg" fullWidth onClick={onGoToHome}>
          메인으로 이동
        </Button>
      </div>
    </div>
  );
}
