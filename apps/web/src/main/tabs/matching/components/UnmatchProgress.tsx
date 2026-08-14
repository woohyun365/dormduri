import { Check, Circle, MessageCircle } from 'lucide-react';
import type { MatchingActiveUnmatchView } from '../model/matching-active-view';

export function UnmatchProgress({ progress }: { readonly progress: MatchingActiveUnmatchView }) {
  const waitingForMe = progress.state === 'WAITING_FOR_ME';
  const title = waitingForMe
    ? '내 동의가 필요해요.'
    : progress.state === 'WAITING_FOR_COUNTERPART'
      ? '상대 동의를 기다리고 있어요.'
      : '매칭 해제 상태';

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold text-(--knu-text-primary)">{title}</p>
        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-700 ring-1 ring-slate-200">
          동의 {progress.progressText}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2" aria-label="매칭 해제 동의 상태">
        <ConsentState
          label="나"
          complete={progress.state === 'WAITING_FOR_COUNTERPART' || progress.state === 'COMPLETED'}
          waitingLabel="동의 필요"
        />
        <ConsentState
          label="상대"
          complete={progress.state === 'WAITING_FOR_ME' || progress.state === 'COMPLETED'}
          waitingLabel="응답 대기"
        />
      </div>
      {progress.state === 'WAITING_FOR_ME' || progress.state === 'WAITING_FOR_COUNTERPART' ? (
        <ConversationGuide waitingForMe={waitingForMe} />
      ) : null}
    </div>
  );
}

function ConsentState({
  label,
  complete,
  waitingLabel,
}: {
  readonly label: string;
  readonly complete: boolean;
  readonly waitingLabel: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-xl bg-white/80 px-2.5 py-2 ring-1 ring-slate-100">
      <span
        className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${
          complete ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
        }`}
      >
        {complete ? (
          <Check className="h-3.5 w-3.5" aria-hidden />
        ) : (
          <Circle className="h-3 w-3" aria-hidden />
        )}
      </span>
      <span className="min-w-0">
        <span className="block text-[10px] font-bold text-slate-500">{label}</span>
        <span className="block truncate text-[11px] font-black text-slate-700">
          {complete ? '동의 완료' : waitingLabel}
        </span>
      </span>
    </div>
  );
}

function ConversationGuide({ waitingForMe }: { readonly waitingForMe: boolean }) {
  return (
    <div className="mt-3 flex items-start gap-2.5 border-t border-slate-200/80 px-1 pt-3">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-600">
        <MessageCircle className="h-3.5 w-3.5" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-black text-slate-800">
          {waitingForMe ? '상대의 이유를 먼저 들어보세요.' : '상대에게 이유를 설명해 주세요.'}
        </p>
        <p className="mt-1 text-xs leading-5 text-slate-600 keep-all">
          {waitingForMe
            ? '서로 충분히 대화한 뒤 매칭 해제 동의 여부를 결정해보세요.'
            : '해제가 필요한 이유를 설명하고 양해를 구한 뒤 진행해보세요.'}
        </p>
      </div>
    </div>
  );
}
