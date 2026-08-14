import { ClipboardCheck, Handshake, RefreshCw, Search } from 'lucide-react';
import { PairMatchingEmptyState } from '@/main/tabs/matching/components/pair/PairMatchingEmptyState';

export type RoommateSearchStateSectionState =
  | { readonly kind: 'closed'; readonly message: string }
  | { readonly kind: 'error'; readonly message: string; readonly onRetry: () => void }
  | { readonly kind: 'loading' }
  | {
      readonly kind: 'empty';
      readonly title: string;
      readonly message: string;
      readonly tone?: 'neutral' | 'warning';
      readonly action?: {
        readonly label: string;
        readonly onClick: () => void;
      };
    };

const LOADING_SEARCH_MESSAGE = '룸메이트 목록을 불러오는 중이에요.';

interface RoommateSearchStateSectionProps {
  readonly state: RoommateSearchStateSectionState;
}

export function RoommateSearchStateSection({ state }: RoommateSearchStateSectionProps) {
  if (state.kind === 'closed') {
    return (
      <section role="status" className="min-w-0">
        <PairMatchingEmptyState
          icon={Handshake}
          title="현재는 비시즌입니다"
          description={
            <>
              <span className="block">새로운 룸메이트 탐색은 다음 시즌에 열려요.</span>
              <span className="mt-1 block">{state.message}</span>
            </>
          }
          tone="blue"
        />
      </section>
    );
  }

  if (state.kind === 'error') {
    return (
      <section
        role="alert"
        className="rounded-3xl border border-red-100 bg-white p-6 text-center shadow-sm"
      >
        <p className="text-sm font-semibold text-red-600">{state.message}</p>
        <button
          type="button"
          onClick={state.onRetry}
          className="mt-5 inline-flex items-center justify-center gap-2 rounded-2xl bg-(--knu-primary) px-4 py-3 text-sm font-semibold text-white transition hover:bg-(--knu-primary-hover)"
        >
          <RefreshCw className="h-4 w-4" />
          다시 시도
        </button>
      </section>
    );
  }

  if (state.kind === 'loading') {
    return (
      <section role="status" className="min-w-0">
        <div className="px-3 text-center">
          <p className="text-sm font-semibold text-(--knu-text-primary)">
            {LOADING_SEARCH_MESSAGE}
          </p>
          <p className="mt-2 text-xs leading-5 text-(--knu-text-secondary)">
            공개 가능한 요약 정보와 현재 시즌 상태를 확인하고 있어요.
          </p>
        </div>
        <div
          className="mt-5 grid gap-3"
          data-testid="roommate-search-loading-skeleton"
          aria-hidden="true"
        >
          {[0, 1, 2].map((index) => (
            <RoommateSearchLoadingSkeletonCard key={index} />
          ))}
        </div>
      </section>
    );
  }

  const isWarning = state.tone === 'warning';

  return (
    <section
      className={`rounded-3xl border p-6 text-center shadow-sm ${
        isWarning ? 'border-orange-200 bg-orange-50' : 'border-(--knu-border) bg-white'
      }`}
    >
      {isWarning ? (
        <ClipboardCheck className="mx-auto h-8 w-8 text-orange-500" />
      ) : (
        <Search className="mx-auto h-8 w-8 text-(--knu-text-tertiary)" />
      )}
      <p
        className={`mt-3 text-sm font-semibold ${
          isWarning ? 'text-orange-800' : 'text-(--knu-text-primary)'
        }`}
      >
        {state.title}
      </p>
      <p
        className={`mt-2 text-xs leading-5 ${
          isWarning ? 'text-orange-700' : 'text-(--knu-text-secondary)'
        }`}
      >
        {state.message}
      </p>
      {state.action ? (
        <button
          type="button"
          onClick={state.action.onClick}
          className={`mt-5 inline-flex items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold transition ${
            isWarning
              ? 'bg-orange-600 text-white hover:bg-orange-700'
              : 'bg-(--knu-primary) text-white hover:bg-(--knu-primary-hover)'
          }`}
        >
          {state.action.label}
        </button>
      ) : null}
    </section>
  );
}

function RoommateSearchLoadingSkeletonCard() {
  return (
    <div className="min-w-0 overflow-hidden rounded-2xl border-2 border-(--knu-border) bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-slate-200" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3.5 w-28 animate-pulse rounded-full bg-slate-200" />
            <div className="h-3 w-20 animate-pulse rounded-full bg-slate-100" />
          </div>
        </div>
        <div className="h-7 w-16 animate-pulse rounded-full bg-slate-100" />
      </div>
      <div className="mt-4 flex flex-wrap gap-1.5">
        <div className="h-6 w-16 animate-pulse rounded-full bg-slate-100" />
        <div className="h-6 w-20 animate-pulse rounded-full bg-slate-100" />
        <div className="h-6 w-24 animate-pulse rounded-full bg-slate-100" />
      </div>
      <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2">
        <div className="h-3 w-full animate-pulse rounded-full bg-slate-200" />
        <div className="mt-2 h-3 w-2/3 animate-pulse rounded-full bg-slate-100" />
      </div>
    </div>
  );
}
