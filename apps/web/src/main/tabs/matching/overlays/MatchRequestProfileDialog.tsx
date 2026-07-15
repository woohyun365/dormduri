import type { RoommateProfileDetailState } from '../../roommate-list/hooks/useRoommateProfileDetail';
import { MatchingProfileDialog } from './MatchingProfileDialog';

export function MatchRequestProfileDialog({
  state,
  onClose,
  onRetry,
}: {
  readonly state: RoommateProfileDetailState;
  readonly onClose: () => void;
  readonly onRetry: () => void;
}) {
  return (
    <MatchingProfileDialog
      state={state}
      title="요청 상대 프로필"
      onClose={onClose}
      onRetry={onRetry}
    />
  );
}
