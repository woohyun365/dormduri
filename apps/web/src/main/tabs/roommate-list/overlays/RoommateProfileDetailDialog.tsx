import { BaseBottomSheet } from '@/components/BaseBottomSheet';
import { DetailError } from './profile-detail/ProfileDetailError';
import { DetailLoading } from './profile-detail/ProfileDetailLoading';
import { FullDetailContent, TombstoneDetailContent } from './profile-detail/ProfileDetailContent';
import type { RoommateProfileDetailState } from '../hooks/useRoommateProfileDetail';
import type { RoommateActionTargetSnapshot } from '../hooks/useRoommateActions';
import type { LifestyleData } from '@/types/lifestyle';

interface RoommateProfileDetailDialogProps {
  readonly state: RoommateProfileDetailState;
  readonly viewerLifestyle: LifestyleData;
  readonly onClose: () => void;
  readonly onRetry: () => void;
  readonly onRefreshList: () => void;
  readonly actionPendingTargetIds?: readonly string[];
  readonly onRequestMatch?: (target: RoommateActionTargetSnapshot) => void;
  readonly onBlock?: (target: RoommateActionTargetSnapshot) => void;
  readonly onReport?: (target: RoommateActionTargetSnapshot) => void;
  readonly onStartChat?: (target: RoommateActionTargetSnapshot) => void;
  readonly onOpenMatchingRequests?: () => void;
}

export function RoommateProfileDetailDialog({
  state,
  onClose,
  onRetry,
  onRefreshList,
  actionPendingTargetIds = [],
  onRequestMatch,
  onBlock,
  onReport,
  onStartChat,
  onOpenMatchingRequests,
}: RoommateProfileDetailDialogProps) {
  return (
    <BaseBottomSheet
      isOpen={state.status !== 'closed'}
      onClose={onClose}
      title="룸메이트 상세 정보"
    >
      <div className="space-y-5 px-5 py-5">
        {state.status === 'loading' ? <DetailLoading nickname={state.target.nickname} /> : null}
        {state.status === 'error' ? (
          <DetailError
            retryable={state.error.retryable}
            onRetry={onRetry}
            onRefreshList={onRefreshList}
          />
        ) : null}
        {state.status === 'success' && state.profile.detailState === 'FULL' ? (
          <FullDetailContent
            profile={state.profile}
            pendingMatchRequest={state.target.pendingMatchRequest ?? null}
            dormitoryLabel={state.target.dormitoryLabel ?? null}
            actionPendingTargetIds={actionPendingTargetIds}
            onRequestMatch={onRequestMatch}
            onBlock={onBlock}
            onReport={onReport}
            onStartChat={onStartChat}
            onOpenMatchingRequests={onOpenMatchingRequests}
          />
        ) : null}
        {state.status === 'success' && state.profile.detailState === 'TOMBSTONE' ? (
          <TombstoneDetailContent profile={state.profile} onRefreshList={onRefreshList} />
        ) : null}
      </div>
    </BaseBottomSheet>
  );
}
