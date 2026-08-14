import type { RoommateProfileDetailState } from '../../roommate-list/hooks/useRoommateProfileDetail';
import { RoommateProfileDetailDialog } from '../../roommate-list/overlays/RoommateProfileDetailDialog';

export function MatchingProfileDialog({
  state,
  title,
  onClose,
  onRetry,
}: {
  readonly state: RoommateProfileDetailState;
  readonly title: string;
  readonly onClose: () => void;
  readonly onRetry: () => void;
}) {
  return (
    <RoommateProfileDetailDialog
      state={state}
      title={title}
      onClose={onClose}
      onRetry={onRetry}
      errorTitle="프로필을 확인하지 못했어요."
      errorMessage="공개 상태가 변경되었을 수 있어요."
      showActionSummary={false}
    />
  );
}
