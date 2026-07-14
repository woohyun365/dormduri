import type { CurrentMatchingView } from '../../model/matching-view-model';
import type { MatchingRequestCommands } from '../requests/PairRequestSection';
import { PairRequestSection } from '../requests/PairRequestSection';
import { useMatchingRequestProfileDetail } from '../../hooks/useMatchingRequestProfileDetail';
import { MatchRequestProfileDialog } from '../../overlays/MatchRequestProfileDialog';
import type { MatchingRequestTab } from '../../components/MatchingSegmentTabs';

export function SeasonMatchingState({
  current,
  requestCommands,
  onNavigateChat,
  initialRequestTab,
}: {
  readonly current: CurrentMatchingView;
  readonly requestCommands: MatchingRequestCommands;
  readonly onNavigateChat?: () => void;
  readonly initialRequestTab?: MatchingRequestTab;
}) {
  const detail = useMatchingRequestProfileDetail();
  return (
    <>
      <section className="rounded-3xl border border-(--knu-border) bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-(--knu-primary)">매칭 진행 중</p>
        <h2 className="mt-1 text-xl font-bold text-(--knu-text-primary)">
          현재 요청을 확인해보세요
        </h2>
        <p className="mt-3 text-sm leading-6 text-(--knu-text-secondary)">
          보낸 요청 {current.requestSection.sent.length}건, 받은 요청 {current.receivedPendingCount}
          건을 확인할 수 있어요.
        </p>
        <div data-testid="matching-current-sections-slot">
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
