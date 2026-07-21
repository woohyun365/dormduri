import { BaseBottomSheet } from '@/main/components/overlays/BaseBottomSheet';
import { MatchHistoryDetailContent } from '../../history';
import type { MatchHistoryDetailState } from '../../hooks/useMatchHistoryCounterpartDetail';

export function HistoryEntryDialog({
  state,
  onClose,
  onRetry,
}: {
  readonly state: MatchHistoryDetailState;
  readonly onClose: () => void;
  readonly onRetry: () => void;
}) {
  return (
    <BaseBottomSheet
      isOpen={state.status !== 'closed'}
      onClose={onClose}
      title="과거 매칭 상대 프로필"
    >
      <div className="px-5 py-6">
        <MatchHistoryDetailContent
          profile={state.profile}
          loading={state.status === 'loading'}
          error={state.error}
          onRetry={onRetry}
        />
      </div>
    </BaseBottomSheet>
  );
}
