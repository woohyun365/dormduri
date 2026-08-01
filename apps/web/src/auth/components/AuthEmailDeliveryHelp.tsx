import { ChevronRight, CircleHelp } from 'lucide-react';

interface AuthEmailDeliveryHelpProps {
  onChangeEmailAction: () => void;
}

export function AuthEmailDeliveryHelp({ onChangeEmailAction }: AuthEmailDeliveryHelpProps) {
  return (
    <section
      aria-label="인증 메일 도움말"
      className="flex items-start gap-2.5 px-1 py-1 text-slate-600"
    >
      <span
        className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500"
        aria-hidden="true"
      >
        <CircleHelp className="size-3.5" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-5 text-slate-800">인증 메일이 보이지 않나요?</p>
        <p className="mt-0.5 text-xs leading-5 text-slate-500">
          스팸함에도 없다면 이메일 주소를 확인해 주세요.
        </p>
        <button
          type="button"
          onClick={onChangeEmailAction}
          className="mt-0.5 inline-flex items-center rounded-md text-xs font-semibold leading-5 text-(--knu-primary) underline-offset-4 transition-colors hover:text-(--knu-primary-hover) hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--knu-primary)"
        >
          이메일 다시 입력
          <ChevronRight className="size-3.5" aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
