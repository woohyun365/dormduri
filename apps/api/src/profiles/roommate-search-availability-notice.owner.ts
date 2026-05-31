import type {
  RoommateSearchAvailabilityNotice,
  RoommateSearchSummary,
} from '@repo/shared/roommate-search-contract';
import { isParticipantRegistered } from '../season-participants/season-participant-policy.js';
import type { VisibleProfileViewerContext } from './visible-profile-owner.js';

export function buildRoommateSearchAvailabilityNotices(input: {
  viewerContext: VisibleProfileViewerContext;
  summaries: RoommateSearchSummary[];
  matchedTargetsExcluded: boolean;
  filterResultEmpty: boolean;
}): RoommateSearchAvailabilityNotice[] {
  const notices = new Map<string, RoommateSearchAvailabilityNotice>();
  const add = (notice: RoommateSearchAvailabilityNotice) => notices.set(notice.code, notice);

  if (input.matchedTargetsExcluded) {
    add({
      code: 'MATCHED_TARGETS_EXCLUDED',
      severity: 'INFO',
      message: '이미 매칭이 완료된 사용자는 신규 후보 목록에서 제외됩니다.',
    });
  }

  if (input.summaries.some((item) => item.actions.canBookmark || item.actions.canRequestMatch)) {
    add({
      code: 'DISCOVERY_ACTIONABLE_ONLY',
      severity: 'INFO',
      message: '룸메이트 찾기는 현재 신규 후보 탐색 기준으로 정렬됩니다.',
    });
  }

  if (
    !isParticipantRegistered(input.viewerContext.viewerParticipant) ||
    !input.viewerContext.viewerHasOperatedAssignedDormitory
  ) {
    add({
      code: 'SCOPE_RESTRICTED_BY_VIEWER_STATE',
      severity: 'INFO',
      message: '현재 등록 또는 기숙사 배정 상태에 따라 사용할 수 있는 검색 범위가 제한됩니다.',
    });
  }

  if (input.viewerContext.serviceState.seasonState === 'SEASON_POST_MATCH') {
    add({
      code: 'POST_MATCH_ACTION_CLOSED',
      severity: 'INFO',
      message: '포스트매치 기간에는 신규 매칭/채팅 action이 닫힙니다.',
    });
  }

  if (input.summaries.some((item) => !item.exposure.canViewFull)) {
    add({
      code: 'DETAIL_UNAVAILABLE_BY_POLICY',
      severity: 'INFO',
      message:
        '일부 사용자는 summary만 볼 수 있으며 상세 화면에서는 정책 안내가 표시될 수 있습니다.',
    });
  }

  if (input.filterResultEmpty) {
    add({
      code: 'FILTER_RESULT_EMPTY',
      severity: 'INFO',
      message: '조건에 맞는 룸메이트 후보가 없습니다.',
    });
  }

  return [...notices.values()];
}
