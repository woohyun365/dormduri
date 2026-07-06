import { RefreshCw, Search } from 'lucide-react';

export type RoommateSearchStateSectionState =
  | { readonly kind: 'closed'; readonly message: string }
  | { readonly kind: 'error'; readonly message: string; readonly onRetry: () => void }
  | { readonly kind: 'loading' }
  | { readonly kind: 'empty'; readonly title: string; readonly message: string };

const LOADING_SEARCH_MESSAGE = '룸메이트 목록을 불러오는 중이에요.';

interface RoommateSearchStateSectionProps {
  readonly state: RoommateSearchStateSectionState;
}

export function RoommateSearchStateSection({ state }: RoommateSearchStateSectionProps) {
  if (state.kind === 'closed') {
    return (
      <section
        role="status"
        className="mt-5 rounded-3xl border border-[var(--knu-border)] bg-white p-6 text-center shadow-sm"
      >
        <Search className="mx-auto h-8 w-8 text-[var(--knu-text-tertiary)]" />
        <p className="mt-3 text-sm font-semibold text-[var(--knu-text-primary)]">{state.message}</p>
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
          className="mt-5 inline-flex items-center justify-center gap-2 rounded-2xl bg-[var(--knu-primary)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--knu-primary-dark)]"
        >
          <RefreshCw className="h-4 w-4" />
          다시 시도
        </button>
      </section>
    );
  }

  if (state.kind === 'loading') {
    return (
      <section
        role="status"
        className="rounded-3xl border border-[var(--knu-border)] bg-white p-6 text-center shadow-sm"
      >
        <p className="text-sm font-semibold text-[var(--knu-text-primary)]">
          {LOADING_SEARCH_MESSAGE}
        </p>
        <p className="mt-2 text-xs leading-5 text-[var(--knu-text-secondary)]">
          공개 가능한 요약 정보와 시즌 정책을 확인하고 있어요.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-[var(--knu-border)] bg-white p-6 text-center shadow-sm">
      <Search className="mx-auto h-8 w-8 text-[var(--knu-text-tertiary)]" />
      <p className="mt-3 text-sm font-semibold text-[var(--knu-text-primary)]">{state.title}</p>
      <p className="mt-2 text-xs leading-5 text-[var(--knu-text-secondary)]">{state.message}</p>
    </section>
  );
}
