import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { CalendarDays, CheckCircle, UsersRound } from 'lucide-react';

const NEXT_STEPS = [
  {
    title: '현재 시즌 확인',
    description: '일정을 확인하고, 시즌에 맞춰 준비해요.',
    icon: CalendarDays,
  },
  {
    title: '시즌에 맞춰 시작',
    description: '일정에 맞춰 시즌 프로필을 등록하고, 룸메를 탐색해요.',
    icon: UsersRound,
  },
] as const;

interface SignupCompleteStepProps {
  nickname: string;
  onGoToHome: () => void;
}

export function SignupCompleteStep({ nickname, onGoToHome }: SignupCompleteStepProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
    headingRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <div className="space-y-6 py-3 text-center sm:py-7">
      <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-emerald-50 sm:size-18">
        <CheckCircle className="size-9 text-emerald-600 sm:size-10" aria-hidden="true" />
      </div>

      <div>
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="text-2xl font-bold text-(--knu-text-primary) outline-none md:text-3xl"
        >
          가입을 마쳤어요
        </h2>
        <p className="mt-3 flex flex-col items-center gap-1 keep-all text-base leading-6 text-(--knu-text-secondary)">
          <strong className="font-semibold text-(--knu-text-primary)">
            {nickname}님, 이제 시작해볼까요?
          </strong>
        </p>
      </div>

      <section
        className="rounded-2xl bg-(--knu-background-alt) p-4 text-left sm:p-5"
        aria-labelledby="signup-next-steps-title"
      >
        <h3
          id="signup-next-steps-title"
          className="text-sm font-semibold text-(--knu-text-primary)"
        >
          메인에서 이어서 준비해요
        </h3>

        <ul className="mt-3 divide-y divide-(--knu-border)">
          {NEXT_STEPS.map((step) => {
            const Icon = step.icon;
            return (
              <li key={step.title} className="flex items-center gap-3 py-3 first:pt-1 last:pb-1">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white text-(--knu-primary)">
                  <Icon className="size-4.5" aria-hidden="true" />
                </span>
                <div>
                  <h4 className="text-sm font-semibold text-(--knu-text-primary)">{step.title}</h4>
                  <p className="mt-0.5 keep-all text-xs leading-5 text-(--knu-text-secondary) sm:text-sm">
                    {step.description}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="pt-1">
        <Button variant="primary" size="lg" fullWidth onClick={onGoToHome}>
          메인으로 이동
        </Button>
      </div>
    </div>
  );
}
