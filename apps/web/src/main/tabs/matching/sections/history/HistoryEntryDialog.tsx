import type { MatchHistoryDetailState } from '../../hooks/useMatchHistoryCounterpartDetail';
import { createRoommateApiError } from '../../../roommate-list/api/roommateApiErrors';
import type { RoommateProfileDetailState } from '../../../roommate-list/hooks/useRoommateProfileDetail';
import { RoommateProfileDetailDialog } from '../../../roommate-list/overlays/RoommateProfileDetailDialog';

export function HistoryEntryDialog({
  state,
  onClose,
  onRetry,
}: {
  readonly state: MatchHistoryDetailState;
  readonly onClose: () => void;
  readonly onRetry: () => void;
}) {
  const roommateState = toRoommateProfileDetailState(state);
  const unavailable =
    state.status === 'error' && state.error.code === 'MATCHING_HISTORY_DETAIL_UNAVAILABLE';

  return (
    <RoommateProfileDetailDialog
      state={roommateState}
      title="상대 시즌 프로필"
      historicalProfileLabel={state.status === 'closed' ? undefined : state.target.seasonName}
      onClose={onClose}
      onRetry={onRetry}
      errorTitle={unavailable ? '과거 상대 프로필을 확인할 수 없어요.' : undefined}
      errorMessage={
        unavailable ? '이 기록은 정책상 더 이상 상세 정보를 제공하지 않아요.' : undefined
      }
    />
  );
}

function toRoommateProfileDetailState(state: MatchHistoryDetailState): RoommateProfileDetailState {
  if (state.status === 'closed') {
    return { status: 'closed', target: null, profile: null, error: null };
  }

  const target = {
    targetUserId: state.status === 'success' ? state.profile.id : `history:${state.entryId}`,
    nickname: state.target.nickname,
    detailEntryToken: state.entryId,
    pendingMatchRequest: null,
    dormitoryLabel: null,
  } as const;

  if (state.status === 'loading') {
    return { status: 'loading', target, profile: null, error: null };
  }

  if (state.status === 'success') {
    return { status: 'success', target, profile: state.profile, error: null };
  }

  return {
    status: 'error',
    target,
    profile: null,
    error: createRoommateApiError({
      code:
        state.error.code === 'MATCHING_HISTORY_DETAIL_UNAVAILABLE'
          ? 'PROFILE_NOT_VISIBLE'
          : state.error.code === 'MATCHING_API_RESPONSE_INVALID'
            ? 'ROOMMATE_PROFILE_DETAIL_SCHEMA_INVALID'
            : 'ROOMMATE_PROFILE_DETAIL_NETWORK_ERROR',
      status: state.error.status,
    }),
  };
}
