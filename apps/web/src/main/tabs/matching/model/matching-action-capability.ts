import type { MatchActionDisabledReason, MatchCapabilityReason } from '@repo/shared/match/contract';

export function matchCapabilityReasonCopy(reason: MatchCapabilityReason): string {
  switch (reason) {
    case 'CAMPUS_NOT_OPERATED':
      return '현재 캠퍼스에서는 매칭을 운영하지 않아요.';
    case 'VIEWER_NOT_REGISTERED':
      return '시즌 참여 등록 후에 이용 가능해요.';
    case 'VIEWER_DEREGISTERED':
      return '이번 시즌 참여를 취소한 상태예요.';
    case 'SEASON_NOT_ACTIONABLE':
      return '현재 시즌에는 매칭을 이용할 수 없어요.';
    case 'SAFETY_OR_VISIBILITY_RESTRICTED':
      return '현재 상태에서는 매칭 정보를 이용할 수 없어요.';
  }
}

export function matchActionDisabledReasonCopy(reason: MatchActionDisabledReason): string {
  switch (reason) {
    case 'SEASON_NOT_ACTIONABLE':
      return '현재 시즌에는 이 작업을 할 수 없어요.';
    case 'ROOM_SELECTION_CUTOFF':
      return '기숙사 선택 마감 이후에는 이 작업을 할 수 없어요.';
    case 'REQUEST_EXPIRED':
      return '요청 유효 시간이 지나 처리할 수 없어요.';
    case 'REQUEST_ALREADY_RESOLVED':
      return '이미 처리된 요청이에요. 최신 상태를 확인해주세요.';
    case 'MATCH_PRECONDITION_FAILED':
      return '매칭 조건이 변경되어 이 작업을 할 수 없어요.';
    case 'ACTIVE_MATCH_NOT_ACTIONABLE':
      return '현재 매칭 관계에서는 이 작업을 할 수 없어요.';
    case 'UNMATCH_ALREADY_PENDING':
      return '이미 매칭 해제 요청이 진행 중이에요.';
    case 'TARGET_UNAVAILABLE':
      return '상대의 현재 상태로는 이 작업을 할 수 없어요.';
  }
}

export function getDisabledReasonDescriptionId(input: {
  readonly actionId: string;
  readonly reason: MatchActionDisabledReason;
}): string {
  return `matching-action-${input.actionId}-reason-${input.reason.toLowerCase()}`;
}
