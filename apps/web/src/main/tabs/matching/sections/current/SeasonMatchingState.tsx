import type { CurrentMatchingView } from '../../model/matching-view-model';
import type { MatchingRequestCommands } from '../requests/PairRequestSection';
import { PairRequestSection } from '../requests/PairRequestSection';
import { useMatchingRequestProfileDetail } from '../../hooks/useMatchingRequestProfileDetail';
import { MatchRequestProfileDialog } from '../../overlays/MatchRequestProfileDialog';
import type { MatchingRequestTab } from '../../components/MatchingSegmentTabs';
import { ActiveMatchSection, type MatchingActiveCommands } from '../active/ActiveMatchSection';

export function SeasonMatchingState({
  current,
  requestCommands,
  activeCommands,
  activeActionError,
  unmatchCompletion,
  onDismissActiveActionError,
  onDismissUnmatchCompletion,
  onNavigateChat,
  initialRequestTab,
}: {
  readonly current: CurrentMatchingView;
  readonly requestCommands: MatchingRequestCommands;
  readonly activeCommands: MatchingActiveCommands;
  readonly activeActionError?: string | null;
  readonly unmatchCompletion?: string | null;
  readonly onDismissActiveActionError?: () => void;
  readonly onDismissUnmatchCompletion?: () => void;
  readonly onNavigateChat?: () => void;
  readonly initialRequestTab?: MatchingRequestTab;
}) {
  const detail = useMatchingRequestProfileDetail();
  return (
    <>
      <section className="rounded-3xl border border-(--knu-border) bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-(--knu-primary)">매칭 진행 중</p>
        <h2 className="mt-1 text-xl font-bold text-(--knu-text-primary)">
          {current.activeMatch ? '확정 매칭과 요청을 확인해보세요' : '현재 요청을 확인해보세요'}
        </h2>
        <p className="mt-3 text-sm leading-6 text-(--knu-text-secondary)">
          보낸 요청 {current.requestSection.sent.length}건, 받은 요청 {current.receivedPendingCount}
          건을 확인할 수 있어요.
        </p>
        {unmatchCompletion ? (
          <div
            role="status"
            className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
          >
            <span>{unmatchCompletion}</span>
            {onDismissUnmatchCompletion ? (
              <button
                type="button"
                className="min-h-11 px-3 font-semibold underline underline-offset-4"
                onClick={onDismissUnmatchCompletion}
              >
                닫기
              </button>
            ) : null}
          </div>
        ) : null}
        {!current.activeMatch && activeActionError ? (
          <div
            role="alert"
            className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-950"
          >
            <span>{activeActionError}</span>
            {onDismissActiveActionError ? (
              <button
                type="button"
                className="min-h-11 px-3 font-semibold underline underline-offset-4"
                onClick={onDismissActiveActionError}
              >
                닫기
              </button>
            ) : null}
          </div>
        ) : null}
        <div data-testid="matching-current-sections-slot">
          {current.activeMatch ? (
            <ActiveMatchSection
              activeMatch={current.activeMatch}
              readOnly={false}
              commands={activeCommands}
              actionError={activeActionError}
              onDismissActionError={onDismissActiveActionError}
              onNavigateChat={onNavigateChat}
            />
          ) : null}
          <PairRequestSection
            section={current.requestSection}
            serverNow={current.serverNow}
            roomSelectionDate={current.roomSelectionDate}
            commands={requestCommands}
            onOpenProfile={detail.open}
            onNavigateChat={onNavigateChat}
            initialTab={initialRequestTab}
          />
        </div>
      </section>
      <MatchRequestProfileDialog state={detail} onClose={detail.close} onRetry={detail.retry} />
    </>
  );
}
