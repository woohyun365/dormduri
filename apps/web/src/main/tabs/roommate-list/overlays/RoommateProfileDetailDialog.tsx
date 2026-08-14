import { BaseBottomSheet } from '@/main/components/overlays/BaseBottomSheet';
import { DetailError } from './profile-detail/ProfileDetailError';
import { DetailLoading } from './profile-detail/ProfileDetailLoading';
import { FullDetailContent, TombstoneDetailContent } from './profile-detail/ProfileDetailContent';
import type { RoommateProfileDetailState } from '../hooks/useRoommateProfileDetail';
import type { RoommateActionTargetSnapshot } from '../hooks/useRoommateActions';
import type { PublicProfileActionCapabilities } from '@repo/shared/profile/contract';
import type { PendingMatchRequestDirectActions } from './profile-detail/ProfileActionSummary';

interface RoommateProfileDetailDialogProps {
  readonly state: RoommateProfileDetailState;
  readonly suspended?: boolean;
  readonly title?: string;
  readonly historicalProfileLabel?: string;
  readonly onClose: () => void;
  readonly onRetry: () => void;
  readonly onRefreshList?: () => void;
  readonly errorTitle?: string;
  readonly errorMessage?: string;
  readonly showActionSummary?: boolean;
  readonly actionPendingTargetIds?: readonly string[];
  readonly onRequestMatch?: (target: RoommateActionTargetSnapshot) => void;
  readonly onBlock?: (target: RoommateActionTargetSnapshot) => void;
  readonly onReport?: (target: RoommateActionTargetSnapshot) => void;
  readonly onStartChat?: (target: RoommateActionTargetSnapshot) => void;
  readonly onOpenMatchingRequests?: () => void;
  readonly pendingRequestActions?: PendingMatchRequestDirectActions;
}

export function RoommateProfileDetailDialog({
  state,
  suspended = false,
  title = '룸메이트 상세 정보',
  historicalProfileLabel,
  onClose,
  onRetry,
  onRefreshList,
  errorTitle,
  errorMessage,
  showActionSummary = true,
  actionPendingTargetIds = [],
  onRequestMatch,
  onBlock,
  onReport,
  onStartChat,
  onOpenMatchingRequests,
  pendingRequestActions,
}: RoommateProfileDetailDialogProps) {
  return (
    <BaseBottomSheet
      isOpen={state.status !== 'closed'}
      onClose={onClose}
      title={title}
      interactionDisabled={suspended}
    >
      <div className="space-y-5 px-5 py-5">
        {state.status === 'loading' ? <DetailLoading nickname={state.target.nickname} /> : null}
        {state.status === 'error' ? (
          <DetailError
            retryable={state.error.retryable}
            onRetry={onRetry}
            onRefreshList={onRefreshList}
            title={errorTitle}
            message={errorMessage}
          />
        ) : null}
        {state.status === 'success' && state.profile.detailState === 'FULL' ? (
          <FullDetailContent
            profile={state.profile}
            actionCapabilities={mergeActionCapabilities(
              state.profile.actions,
              state.target.actions,
            )}
            historicalProfileLabel={historicalProfileLabel}
            showActionSummary={showActionSummary}
            pendingMatchRequest={state.target.pendingMatchRequest ?? null}
            dormitoryLabel={state.target.dormitoryLabel ?? null}
            actionPendingTargetIds={actionPendingTargetIds}
            onRequestMatch={onRequestMatch}
            onBlock={onBlock}
            onReport={onReport}
            onStartChat={onStartChat}
            onOpenMatchingRequests={onOpenMatchingRequests}
            pendingRequestActions={pendingRequestActions}
          />
        ) : null}
        {state.status === 'success' && state.profile.detailState === 'TOMBSTONE' ? (
          <TombstoneDetailContent profile={state.profile} onRefreshList={onRefreshList} />
        ) : null}
      </div>
    </BaseBottomSheet>
  );
}

function mergeActionCapabilities(
  detail: PublicProfileActionCapabilities,
  search: PublicProfileActionCapabilities | undefined,
): PublicProfileActionCapabilities {
  if (!search) return detail;

  return {
    canBookmark: detail.canBookmark && search.canBookmark,
    canRequestMatch: detail.canRequestMatch && search.canRequestMatch,
    canStartChat: detail.canStartChat && search.canStartChat,
    unavailableReasons: [...new Set([...detail.unavailableReasons, ...search.unavailableReasons])],
  };
}
