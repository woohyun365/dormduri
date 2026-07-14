'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { MatchingViewState } from './model/matching-view-model';
import type {
  MatchingSeasonShell,
  MatchingShellConsistency,
} from './model/matching-shell-consistency';
import { MatchingTabError } from './layout/MatchingTabError';
import { MatchingTabHeader } from './layout/MatchingTabHeader';
import { MatchingTabLayout } from './layout/MatchingTabLayout';
import { MatchingPolicyRail } from './layout/MatchingPolicyRail';
import { MatchingTabSkeleton } from './layout/MatchingTabSkeleton';
import { toMatchingApiErrorMessage } from './api/matching.api';
import { useMatchingOverview } from './hooks/useMatchingOverview';
import { matchCapabilityReasonCopy } from './model/matching-action-capability';
import { resolveMatchingShellConsistency } from './model/matching-shell-consistency';
import { toMatchingViewState } from './model/matching-view-model';
import { SeasonStateRenderer } from './sections/SeasonStateRenderer';
import { MatchingUnavailableState } from './sections/system/MatchingUnavailableState';

export interface MatchingTabProps {
  readonly viewerId: string;
  readonly seasonShell: MatchingSeasonShell;
  readonly onBadgeCountChange?: (count: number) => void;
}

export default function MatchingTab({
  viewerId,
  seasonShell,
  onBadgeCountChange,
}: MatchingTabProps) {
  const identityKey = `${viewerId}:${seasonShell.id ?? 'none'}:${seasonShell.state ?? 'none'}`;
  return (
    <MatchingTabRuntime
      key={identityKey}
      identityKey={identityKey}
      seasonShell={seasonShell}
      onBadgeCountChange={onBadgeCountChange}
    />
  );
}

function MatchingTabRuntime({
  identityKey,
  seasonShell,
  onBadgeCountChange,
}: {
  readonly identityKey: string;
  readonly seasonShell: MatchingSeasonShell;
  readonly onBadgeCountChange?: (count: number) => void;
}) {
  const overview = useMatchingOverview({ identityKey });
  const view = toMatchingViewState({
    overview: overview.data,
    error: overview.error,
    loading: overview.loading,
  });
  const previousActiveId = useRef<string | null>(null);
  const initializedActiveId = useRef(false);
  const headingFocused = useRef(false);
  const [celebration, setCelebration] = useState<string | null>(null);
  const [mismatchCount, setMismatchCount] = useState(0);

  const consistency = useMemo<MatchingShellConsistency | null>(() => {
    if (!overview.data) return null;
    return resolveMatchingShellConsistency({
      shell: seasonShell,
      overview: overview.data.season,
      consecutiveMismatchCount: mismatchCount,
    });
  }, [mismatchCount, overview.data, seasonShell]);

  useEffect(() => {
    if (view.kind === 'loading' || headingFocused.current) return;
    document.getElementById('matching-tab-heading')?.focus({ preventScroll: true });
    headingFocused.current = true;
  }, [view.kind]);

  useEffect(() => {
    let active = true;
    if (!consistency) return;
    if (consistency.kind === 'consistent') {
      if (mismatchCount !== 0) {
        queueMicrotask(() => {
          if (active) setMismatchCount(0);
        });
      }
      return () => {
        active = false;
      };
    }
    if (consistency.kind === 'transitioning') {
      queueMicrotask(() => {
        if (!active) return;
        setMismatchCount(consistency.nextMismatchCount);
        void overview.refresh();
      });
    }
    return () => {
      active = false;
    };
  }, [consistency, mismatchCount, overview]);

  const receivedCount =
    consistency?.kind === 'consistent' && view.kind === 'season-matching'
      ? view.current.receivedPendingCount
      : 0;
  useEffect(() => onBadgeCountChange?.(receivedCount), [onBadgeCountChange, receivedCount]);

  useEffect(() => {
    if (consistency?.kind !== 'consistent') return;
    const activeId = overview.data?.activeMatch?.id ?? null;
    if (initializedActiveId.current && previousActiveId.current === null && activeId !== null) {
      const nickname = overview.data?.activeMatch?.counterpartNickname ?? '새 룸메이트';
      queueMicrotask(() => setCelebration(nickname));
    }
    initializedActiveId.current = true;
    previousActiveId.current = activeId;
  }, [consistency?.kind, overview.data?.activeMatch]);

  return (
    <MatchingTabView
      state={view}
      consistency={consistency}
      celebration={celebration}
      onCloseCelebration={() => setCelebration(null)}
      onRetry={overview.refresh}
    />
  );
}

export function MatchingTabView({
  state,
  consistency = null,
  celebration = null,
  onCloseCelebration,
  onRetry,
}: {
  readonly state: MatchingViewState;
  readonly consistency?: MatchingShellConsistency | null;
  readonly celebration?: string | null;
  readonly onCloseCelebration?: () => void;
  readonly onRetry?: () => Promise<void>;
}) {
  if (state.kind === 'loading') return <MatchingTabSkeleton />;

  let content;
  if (state.kind === 'error') {
    content = (
      <MatchingTabError message={toMatchingApiErrorMessage(state.error.code)} onRetry={onRetry} />
    );
  } else if (state.kind === 'unavailable') {
    content = <MatchingUnavailableState message={matchCapabilityReasonCopy(state.reason)} />;
  } else if (consistency?.kind === 'transitioning') {
    content = (
      <MatchingUnavailableState message="시즌 전환을 확인하고 있어요. 잠시만 기다려주세요." />
    );
  } else if (consistency?.kind === 'mismatch') {
    content = (
      <MatchingTabError
        message="홈과 매칭의 시즌 정보가 달라 최신 상태를 다시 확인해야 해요."
        onRetry={onRetry}
      />
    );
  } else {
    content = <SeasonStateRenderer state={state} />;
  }

  return (
    <>
      <MatchingTabLayout header={<MatchingTabHeader />} rail={<MatchingPolicyRail />}>
        {content}
      </MatchingTabLayout>
      {celebration && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="매칭 완료"
          className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
        >
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-xl">
            <h2 className="text-lg font-bold text-(--knu-text-primary)">매칭이 완료되었어요</h2>
            <p className="mt-2 text-sm leading-6 text-(--knu-text-secondary)">
              {celebration}님과 룸메이트가 되었어요.
            </p>
            <button
              type="button"
              className="mt-5 min-h-11 rounded-2xl bg-(--knu-primary) px-5 py-2 text-sm font-semibold text-white"
              onClick={onCloseCelebration}
            >
              확인
            </button>
          </div>
        </div>
      )}
    </>
  );
}
