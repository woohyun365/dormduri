import type { CurrentMatchingView } from '../../model/matching-view-model';
import type { MatchingRequestCommands } from '../requests/PairRequestSection';
import { PairRequestSection } from '../requests/PairRequestSection';
import { useMatchingRequestProfileDetail } from '../../hooks/useMatchingRequestProfileDetail';
import { MatchRequestProfileDialog } from '../../overlays/MatchRequestProfileDialog';
import type { MatchingRequestTab } from '../../components/MatchingSegmentTabs';
import { ActiveMatchSection, type MatchingActiveCommands } from '../active/ActiveMatchSection';
import { PairMatchingFlowTipCard } from '../../components/pair/PairMatchingFlowTipCard';
import { CurrentMatchActivitySection } from './CurrentMatchActivitySection';
import { useRoommateActions } from '../../../roommate-list/hooks/useRoommateActions';
import { RoommateBlockDialog } from '../../../roommate-list/overlays/RoommateBlockDialog';
import { RoommateReportDialog } from '../../../roommate-list/overlays/RoommateReportDialog';
import { RoommateActionReceiptDialog } from '../../../roommate-list/overlays/RoommateActionReceiptDialog';
import {
  actionDialogErrorMessage,
  isActionDialogSubmitting,
} from '../../../roommate-list/model/actions/roommateActionDialogState';
import { getDialogReceipt } from '../../../roommate-list/components/search/RoommateSearchFeedback';

const noRefresh = async () => undefined;

export function SeasonMatchingState({
  current,
  requestCommands,
  activeCommands,
  activeActionError,
  unmatchCompletion,
  onDismissActiveActionError,
  onDismissUnmatchCompletion,
  onNavigateChat,
  onRefreshOverview,
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
  readonly onRefreshOverview?: () => Promise<void>;
  readonly initialRequestTab?: MatchingRequestTab;
}) {
  const detail = useMatchingRequestProfileDetail();
  const safetyActions = useRoommateActions({
    onRefreshSearch: onRefreshOverview ?? noRefresh,
    onRefreshBookmarks: noRefresh,
    onRefreshDetail: async () => detail.retry(),
    onCloseDetail: detail.close,
  });
  return (
    <>
      <section className="min-w-0">
        <h2 className="sr-only">
          {current.activeMatch
            ? '확정 매칭과 활동 이력을 확인해보세요'
            : '현재 요청을 확인해보세요'}
        </h2>
        <div className="grid items-start gap-5 md:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.8fr)]">
          <div className="order-last min-w-0 md:order-first">
            {unmatchCompletion ? (
              <div
                role="status"
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
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
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-950"
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
                  roomSelectionDate={current.roomSelectionDate}
                  seasonEndDate={current.seasonEndDate}
                  onDismissActionError={onDismissActiveActionError}
                  onNavigateChat={onNavigateChat}
                />
              ) : null}
              {!current.activeMatch ? (
                <PairRequestSection
                  section={current.requestSection}
                  serverNow={current.serverNow}
                  roomSelectionDate={current.roomSelectionDate}
                  commands={requestCommands}
                  onOpenProfile={detail.open}
                  initialTab={initialRequestTab}
                />
              ) : null}
              <CurrentMatchActivitySection items={current.activity} />
            </div>
          </div>
          <aside
            className="order-first min-w-0 md:sticky md:top-[calc(var(--matching-sticky-stack-height,224px)_+_1.25rem)] md:order-last"
            aria-label="2인실 매칭 안내"
          >
            <PairMatchingFlowTipCard
              requestLimit={current.requestSection.quota.limit}
              matched={Boolean(current.activeMatch)}
            />
          </aside>
        </div>
      </section>
      <MatchRequestProfileDialog
        state={detail}
        suspended={safetyActions.activeDialog.kind !== 'closed'}
        request={detail.request}
        commands={requestCommands}
        onClose={detail.close}
        onRetry={detail.retry}
        actionPendingTargetIds={safetyActions.pendingTargetUserIds}
        onBlock={safetyActions.openBlockDialog}
        onReport={safetyActions.openReportDialog}
      />
      <RoommateBlockDialog
        state={safetyActions.activeDialog}
        submitting={isActionDialogSubmitting(safetyActions)}
        errorMessage={actionDialogErrorMessage(safetyActions, 'block')}
        onClose={safetyActions.closeDialog}
        onSubmit={(input) => void safetyActions.submitBlock(input)}
      />
      <RoommateReportDialog
        state={safetyActions.activeDialog}
        submitting={isActionDialogSubmitting(safetyActions)}
        errorMessage={actionDialogErrorMessage(safetyActions, 'report')}
        onClose={safetyActions.closeDialog}
        onSubmit={(input) => void safetyActions.submitReport(input)}
      />
      <RoommateActionReceiptDialog
        receipt={getDialogReceipt(safetyActions.lastReceipt)}
        onDismiss={safetyActions.dismissFeedback}
      />
    </>
  );
}
