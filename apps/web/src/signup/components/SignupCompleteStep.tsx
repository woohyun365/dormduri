import { useEffect } from 'react';
import { Button } from '@/components/Button';
import { CheckCircle, Info } from 'lucide-react';

interface SignupCompleteStepProps {
  nickname: string;
  onGoToHome: () => void;
}

export function SignupCompleteStep({ nickname, onGoToHome }: SignupCompleteStepProps) {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="space-y-6 py-8 text-center">
      <div className="mx-auto mb-4 flex size-20 items-center justify-center rounded-full bg-green-100">
        <CheckCircle className="size-12 text-green-600" />
      </div>

      <div>
        <h2 className="mb-3 text-2xl font-bold text-(--knu-text-primary) md:text-3xl">
          계정 생성 완료!
        </h2>
        <p className="text-lg text-(--knu-text-secondary)">
          <strong>{nickname}</strong>님, 이제 메인에서 현재 시즌 상태를 확인할 수 있어요
        </p>
      </div>

      <section
        className="rounded-3xl border border-blue-100 bg-blue-50/70 p-5 text-left"
        aria-labelledby="signup-service-intro-title"
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-(--knu-primary) shadow-sm">
            <Info className="size-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <h3
                id="signup-service-intro-title"
                className="text-base font-semibold text-(--knu-text-primary)"
              >
                서비스 시작 전 알아두기
              </h3>
              <p className="mt-1 keep-all text-sm leading-6 text-(--knu-text-secondary)">
                가입은 계정 준비까지 완료된 상태예요. 생활패턴, 원하는 룸메 조건, 기숙사 선택은 시즌
                화면에서 따로 진행합니다.
              </p>
            </div>

            <ul className="space-y-1.5 text-sm leading-6 text-(--knu-text-secondary)">
              <li>• 시즌 오픈 또는 매칭 기간에는 시즌 프로필과 기숙사 선택을 준비해요.</li>
              <li>
                • 비시즌에는 아직 프로필 작성이 열리지 않을 수 있어요. 메인에서 다음 시즌 안내와 내
                정보를 먼저 확인해주세요.
              </li>
              <li>• 후보 탐색, 대화, 매칭 요청은 시즌 상태와 등록 완료 여부에 따라 열려요.</li>
            </ul>
          </div>
        </div>
      </section>

      <div className="space-y-4 rounded-2xl bg-(--knu-background-alt) p-6 text-left">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-(--knu-primary)">
            <span className="text-sm font-bold text-white">1</span>
          </div>
          <div>
            <h4 className="mb-1 font-semibold text-(--knu-text-primary)">현재 시즌 확인하기</h4>
            <p className="text-sm text-(--knu-text-secondary)">
              메인에서 시즌이 열려 있는지, 지금 준비할 수 있는 항목이 무엇인지 확인해요
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-(--knu-primary)">
            <span className="text-sm font-bold text-white">2</span>
          </div>
          <div>
            <h4 className="mb-1 font-semibold text-(--knu-text-primary)">시즌 프로필 준비하기</h4>
            <p className="text-sm text-(--knu-text-secondary)">
              시즌이 열리면 생활패턴과 원하는 룸메 조건을 등록 화면에서 입력해요
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-(--knu-primary)">
            <span className="text-sm font-bold text-white">3</span>
          </div>
          <div>
            <h4 className="mb-1 font-semibold text-(--knu-text-primary)">
              기숙사 선택 후 룸메 찾기
            </h4>
            <p className="text-sm text-(--knu-text-secondary)">
              등록이 완료되면 후보를 확인하고 대화하거나 매칭 요청을 보낼 수 있어요
            </p>
          </div>
        </div>
      </div>

      <div className="pt-4">
        <Button variant="primary" size="lg" fullWidth onClick={onGoToHome}>
          메인에서 시즌 상태 확인하기
        </Button>
      </div>
    </div>
  );
}
