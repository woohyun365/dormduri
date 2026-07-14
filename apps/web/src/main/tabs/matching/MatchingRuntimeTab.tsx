'use client';

import { useEffect, useRef, useState } from 'react';
import { MatchingTabSkeleton } from './MatchingTabSkeleton';
import { toMatchingApiErrorMessage } from './api/matching.api';
import { matchCapabilityReasonCopy } from './model/matching-action-capability';
import { toMatchingViewState } from './model/matching-view-model';
import { useMatchingOverview } from './hooks/useMatchingOverview';
import { SeasonStateRenderer } from './sections/SeasonStateRenderer';

export function MatchingRuntimeTab({
  viewerId: _viewerId,
  onBadgeCountChange,
}: {
  readonly viewerId: string;
  readonly onBadgeCountChange?: (count: number) => void;
}) {
  const overview = useMatchingOverview();
  const view = toMatchingViewState({
    overview: overview.data,
    error: overview.error,
    loading: overview.loading,
  });
  const previousActiveId = useRef<string | null>(null);
  const initializedActiveId = useRef(false);
  const [celebration, setCelebration] = useState<string | null>(null);
  const receivedCount = view.kind === 'season-matching' ? view.current.receivedPendingCount : 0;
  useEffect(() => onBadgeCountChange?.(receivedCount), [onBadgeCountChange, receivedCount]);
  useEffect(() => {
    const activeId = overview.data?.activeMatch?.id ?? null;
    if (initializedActiveId.current && previousActiveId.current === null && activeId !== null) {
      setCelebration(overview.data?.activeMatch?.counterpartNickname ?? '새 룸메이트');
    }
    initializedActiveId.current = true;
    previousActiveId.current = activeId;
  }, [overview.data?.activeMatch]);

  if (view.kind === 'loading') return <MatchingTabSkeleton />;
  if (view.kind === 'error')
    return (
      <MatchingRuntimeFeedback
        message={toMatchingApiErrorMessage(view.error.code)}
        onRetry={overview.refresh}
      />
    );
  if (view.kind === 'unavailable')
    return <MatchingRuntimeFeedback message={matchCapabilityReasonCopy(view.reason)} />;
  return (
    <MatchingRuntimeContent
      state={view}
      celebration={celebration}
      onCloseCelebration={() => setCelebration(null)}
    />
  );
}

function MatchingRuntimeContent({
  state,
  celebration,
  onCloseCelebration,
}: {
  readonly state: Exclude<
    ReturnType<typeof toMatchingViewState>,
    { kind: 'loading' | 'error' | 'unavailable' }
  >;
  readonly celebration: string | null;
  readonly onCloseCelebration: () => void;
}) {
  return (
    <>
      <SeasonStateRenderer state={state} />
      {celebration && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="매칭 완료"
          className="fixed inset-0 grid place-items-center bg-black/40 p-4"
        >
          <div className="rounded-xl bg-white p-6 text-center">
            <h2 className="text-lg font-bold">매칭이 완료되었어요</h2>
            <p className="mt-2">{celebration}님과 룸메이트가 되었어요.</p>
            <button type="button" className="mt-4 underline" onClick={onCloseCelebration}>
              확인
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function MatchingRuntimeFeedback({
  message,
  onRetry,
}: {
  readonly message: string;
  readonly onRetry?: () => Promise<void>;
}) {
  return (
    <section aria-labelledby="matching-runtime-heading" className="p-4">
      <h1 id="matching-runtime-heading" tabIndex={-1} className="text-xl font-bold">
        매칭 현황
      </h1>
      <p className="mt-3">{message}</p>
      {onRetry && (
        <button type="button" className="mt-4 underline" onClick={() => void onRetry()}>
          다시 시도
        </button>
      )}
    </section>
  );
}
