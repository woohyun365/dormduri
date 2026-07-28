import { Check } from 'lucide-react';
import { AuthServiceNotice } from '@/auth/components';
import { SIGNUP_STEPS } from '../model/signup-flow.types';

const SUPPORT_CONTENT = {
  1: {
    title: '학교 이메일을 확인해요',
    description: '인증 코드를 보내드려요. 메일함과 스팸함을 확인해 주세요.',
  },
  2: {
    title: '가입 전 필수 내용을 확인해요',
    description: '이용약관과 개인정보 수집·이용 내용을 확인해 주세요.',
  },
  3: {
    title: '로그인 정보를 만들어요',
    description: '서비스에서 사용할 닉네임과 비밀번호를 입력해요.',
  },
  4: {
    title: '기본 정보를 확인해요',
    description: '캠퍼스와 단과대 등 서비스 이용에 필요한 정보를 선택해요.',
  },
  5: {
    title: '가입을 마쳤어요',
    description: '메인에서 지금 이용할 수 있는 기능을 확인해요.',
  },
} as const;

interface SignupSupportPanelProps {
  currentStep: number;
  showServiceNotice: boolean;
}

export function SignupSupportPanel({ currentStep, showServiceNotice }: SignupSupportPanelProps) {
  const safeCurrentStep = Math.min(Math.max(currentStep, 1), SIGNUP_STEPS.length);
  const content =
    SUPPORT_CONTENT[safeCurrentStep as keyof typeof SUPPORT_CONTENT] ?? SUPPORT_CONTENT[1];
  const isFlowComplete = safeCurrentStep === SIGNUP_STEPS.length;

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-(--knu-primary)">
          회원가입
        </p>
        <h2
          id="signup-help-title"
          className="mt-5 keep-all text-2xl font-bold leading-tight text-(--knu-text-primary)"
        >
          {content.title}
        </h2>
        <p className="mt-3 keep-all text-sm leading-6 text-(--knu-text-secondary)">
          {content.description}
        </p>
      </div>

      <nav aria-label="회원가입 진행 단계">
        <ol
          className={`relative space-y-1 before:absolute before:bottom-4 before:left-3 before:top-4 before:w-px ${
            isFlowComplete ? 'before:bg-emerald-200' : 'before:bg-slate-200'
          }`}
        >
          {SIGNUP_STEPS.map((step) => {
            const isCurrent = !isFlowComplete && step.order === safeCurrentStep;
            const isComplete = isFlowComplete || step.order < safeCurrentStep;

            return (
              <li
                key={step.id}
                aria-current={isCurrent ? 'step' : undefined}
                className={`relative flex min-h-11 items-center gap-3 rounded-xl px-1 py-2 ${
                  isCurrent ? 'bg-(--knu-primary-light)' : ''
                }`}
              >
                <span
                  className={`relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    isCurrent
                      ? 'bg-(--knu-primary) text-white'
                      : isComplete
                        ? isFlowComplete
                          ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'border border-indigo-200 bg-indigo-50 text-indigo-700'
                        : 'border border-slate-300 bg-(--knu-background-alt) text-slate-500'
                  }`}
                >
                  {isComplete ? <Check className="size-3.5" aria-hidden="true" /> : step.order}
                </span>
                <span
                  className={`text-sm ${
                    isCurrent
                      ? 'font-semibold text-(--knu-text-primary)'
                      : 'font-medium text-(--knu-text-secondary)'
                  }`}
                >
                  {step.label}
                </span>
              </li>
            );
          })}
        </ol>
      </nav>

      {showServiceNotice && (
        <AuthServiceNotice className="border-t border-(--knu-border) pt-5 text-left" />
      )}
    </div>
  );
}
