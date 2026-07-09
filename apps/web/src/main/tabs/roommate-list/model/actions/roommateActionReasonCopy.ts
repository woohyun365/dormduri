import type { RoommateApiError } from '../../api/roommateApiErrors';
import type {
  PublicTargetActionUnavailableReason,
  PublicProfileActionCapabilities,
} from '@repo/shared/profile/contract';
import type { MatchRequestSummary } from '@repo/shared/match/contract';
import type { ReportOptionalActionResult, ReportReason } from '@repo/shared/social-safety/report';

export type RoommateActionKind = 'block' | 'report' | 'matchRequest' | 'chat';

export interface RoommateActionSafeCopy {
  readonly title: string;
  readonly message: string;
}

export const ACTIVE_MATCH_ALREADY_EXISTS_MESSAGE =
  '상대가 매칭이 완료되어 매칭 요청을 보낼 수 없어요. 목록을 새로고침 후 다른 후보를 찾아보세요.';

const UNAVAILABLE_REASON_LABELS: Record<PublicTargetActionUnavailableReason, string> = {
  VIEWER_NOT_REGISTERED: '시즌 등록 후 요청할 수 있어요.',
  VIEWER_PROFILE_INCOMPLETE: '프로필 완성 후 요청할 수 있어요.',
  VIEWER_NOT_ASSIGNED: '건물 배정 후 요청할 수 있어요.',
  TARGET_NOT_PUBLIC: '목록 이후 상대 공개 상태가 바뀌었을 수 있어요.',
  DIFFERENT_DORMITORY: '다른 건물이라 새 요청 기능이 닫혔어요.',
  VIEWER_ALREADY_MATCHED: '이미 매칭되어 새 요청 기능이 닫혔어요.',
  TARGET_ALREADY_MATCHED: '상대의 매칭 상태가 바뀌어 새 요청 기능이 닫혔어요.',
  SEASON_NOT_ACTIONABLE: '지금은 새 요청 기능이 닫혀 있어요.',
  ROOM_SELECTION_CUTOFF: '호실 선택 마감 이후에는 요청할 수 없어요.',
  THREAD_READ_ONLY: '기존 대화가 읽기 전용 상태예요.',
  TARGET_DELETED_OR_DEIDENTIFIED: '상대 정보가 더 이상 제공되지 않아요.',
  SAFETY_OR_VISIBILITY_RESTRICTED: '서버 오류로 이용할 수 없어요. 목록을 새로고침해 주세요.',
  MATCH_REQUEST_DIRECTION_LIMIT_REACHED:
    '이번 시즌에는 해당 유저에게 더 이상 매칭 요청을 보낼 수 없어요',
};

const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  SEXUAL_HARASSMENT: '성희롱/성적 불쾌감',
  THREAT: '협박/위협',
  PERSONAL_INFO_EXPOSURE: '개인정보 노출',
  GENDER_IMPERSONATION: '성별 사칭',
  FALSE_PROFILE: '허위 프로필',
  SPAM_OR_AD: '스팸/광고',
  HATE_OR_DISCRIMINATION: '혐오/차별',
  OTHER: '기타',
};

const ACTION_GENERIC_ERROR: Record<RoommateActionKind, RoommateActionSafeCopy> = {
  block: {
    title: '차단을 완료하지 못했어요.',
    message: '상대 상태가 바뀌었을 수 있어요. 목록을 새로고침한 뒤 다시 확인해 주세요.',
  },
  report: {
    title: '신고를 접수하지 못했어요.',
    message: '신고 내용을 다시 확인하고 잠시 후 다시 시도해 주세요.',
  },
  matchRequest: {
    title: '매칭 요청을 보내지 못했어요.',
    message: '목록 이후 상대나 시즌 상태가 바뀌었을 수 있어요. 목록을 새로고침했어요.',
  },
  chat: {
    title: '대화 화면으로 이동하지 못했어요.',
    message: '대화 가능 상태가 바뀌었을 수 있어요. 잠시 후 다시 확인해 주세요.',
  },
};

const MATCH_REQUEST_ERROR_COPY: Record<string, RoommateActionSafeCopy> = {
  BFF_UPSTREAM_UNAVAILABLE: {
    title: '매칭 요청을 보내지 못했어요.',
    message: '연결이 원활하지 않아요. 잠시 후 다시 시도해 주세요.',
  },
  MATCH_REQUEST_TARGET_NOT_FOUND: {
    title: '매칭 요청을 보낼 수 없어요.',
    message: '상대가 시즌 등록을 철회하여 매칭 요청을 보낼 수 없어요.',
  },
  MATCH_REQUEST_NOT_ALLOWED: {
    title: '매칭 요청을 보낼 수 없어요.',
    message: '현재 상태에서는 매칭 요청을 보낼 수 없어요. 목록을 새로고침했어요.',
  },
  ACTIVE_MATCH_ALREADY_EXISTS: {
    title: '매칭 요청을 보낼 수 없어요.',
    message: ACTIVE_MATCH_ALREADY_EXISTS_MESSAGE,
  },
  MATCH_REQUEST_SELF_TARGET_NOT_ALLOWED: {
    title: '매칭 요청을 보낼 수 없어요.',
    message: '자기 자신에게는 매칭 요청을 보낼 수 없어요.',
  },
  MATCH_REQUEST_ALREADY_PENDING: {
    title: '매칭 요청을 보내지 못했어요.',
    message: '이미 매칭 요청을 보낸 상대에요. 매칭 탭에서 확인해주세요.',
  },
  MATCH_REQUEST_PENDING_LIMIT_REACHED: {
    title: '매칭 요청을 보내지 못했어요.',
    message: '진행 중인 요청을 먼저 확인한 뒤 다시 시도해 주세요.',
  },
  MATCH_REQUEST_DIRECTION_LIMIT_REACHED: {
    title: '매칭 요청을 보내지 못했어요.',
    message: '이번 시즌에는 해당 유저에게 더 이상 매칭 요청을 보낼 수 없어요',
  },
  MATCH_REQUEST_DIRECTION_COOLDOWN_ACTIVE: {
    title: '아직 다시 요청할 수 없어요.',
    message: '같은 상대에게는 잠시 기다린 뒤 다시 요청할 수 있어요.',
  },
  MATCH_REQUEST_NOTE_MODERATION_REJECTED: {
    title: '요청 메시지를 수정해 주세요.',
    message: '상대에게 보낼 메시지에 부적절한 표현이 있을 수 있어요. 문구를 조금 수정해 주세요.',
  },
};

const BLOCK_ERROR_COPY: Record<string, RoommateActionSafeCopy> = {
  BFF_UPSTREAM_UNAVAILABLE: {
    title: '차단을 완료하지 못했어요.',
    message: '잠시 후 다시 시도해 주세요.',
  },
  INVALID_BLOCK_TARGET: {
    title: '차단할 수 없는 상대예요.',
    message: '목록 이후 상대 상태가 바뀌었을 수 있어요. 최신 목록으로 다시 확인해 주세요.',
  },
  TARGET_NOT_BLOCKABLE: {
    title: '차단할 수 없는 상대예요.',
    message: '현재 공개 상태에서는 차단을 진행할 수 없어요. 최신 목록으로 다시 확인해 주세요.',
  },
  ACTIVE_MATCH_BLOCK_NOT_ALLOWED: {
    title: '현재 매칭 상대는 여기서 차단할 수 없어요.',
    message: '매칭이 성사된 상대 문제는 신고 또는 고객지원 안내를 이용해 주세요.',
  },
};

const REPORT_ERROR_COPY: Record<string, RoommateActionSafeCopy> = {
  BFF_UPSTREAM_UNAVAILABLE: {
    title: '신고를 접수하지 못했어요.',
    message: '잠시 후 다시 시도해 주세요.',
  },
  ROOMMATE_ACTION_NETWORK_ERROR: {
    title: '신고를 접수하지 못했어요.',
    message: '잠시 후 다시 시도해 주세요.',
  },
  INVALID_REPORT_REQUEST: {
    title: '신고 내용을 다시 확인해 주세요.',
    message: '신고 사유와 허위 신고 안내 동의를 확인한 뒤 다시 접수해 주세요.',
  },
  REPORT_TARGET_NOT_REPORTABLE: {
    title: '신고할 수 없는 대상이에요.',
    message: '목록 이후 상대 공개 상태가 바뀌었을 수 있어요. 최신 목록으로 다시 확인해 주세요.',
  },
  REPORT_TARGET_NOT_SUPPORTED: {
    title: '아직 지원하지 않는 신고 대상이에요.',
    message: '이 화면에서는 프로필 신고만 접수할 수 있어요.',
  },
};

export function formatTargetActionUnavailableReason(
  reason: PublicTargetActionUnavailableReason,
): string {
  return UNAVAILABLE_REASON_LABELS[reason];
}

export function buildPrimaryActionCopy(actions: PublicProfileActionCapabilities): string {
  if (actions.canRequestMatch) return '매칭 요청 가능한 상대예요.';
  if (actions.unavailableReasons.includes('MATCH_REQUEST_DIRECTION_LIMIT_REACHED')) {
    return formatTargetActionUnavailableReason('MATCH_REQUEST_DIRECTION_LIMIT_REACHED');
  }
  if (actions.canStartChat) return '대화 가능한 상대예요.';
  const primaryReason = actions.unavailableReasons[0];
  return primaryReason
    ? formatTargetActionUnavailableReason(primaryReason)
    : '현재 가능한 추가 행동이 없어요.';
}

export function reportReasonLabel(reason: ReportReason): string {
  return REPORT_REASON_LABELS[reason];
}

export function getReportReasonOptions(): readonly { value: ReportReason; label: string }[] {
  return (Object.keys(REPORT_REASON_LABELS) as ReportReason[]).map((value) => ({
    value,
    label: REPORT_REASON_LABELS[value],
  }));
}

export function reportOptionalActionResultCopy(
  result: ReportOptionalActionResult | null | undefined,
): string | null {
  if (!result) return null;
  if (result.status === 'SUCCEEDED') return '신고와 함께 차단도 반영했어요.';
  if (result.status === 'SKIPPED') return '신고는 접수됐고 차단은 별도로 반영하지 않았어요.';
  return '신고는 접수됐지만 차단은 완료하지 못했어요. 필요하면 다시 시도해 주세요.';
}

export function matchRequestSuccessCopy(request: MatchRequestSummary): RoommateActionSafeCopy {
  const expiresAt = new Date(request.expiresAt);
  const expiresLabel = Number.isNaN(expiresAt.getTime())
    ? '정책상 정해진 기한'
    : expiresAt.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
  return {
    title: '매칭 요청을 보냈어요.',
    message: `상대가 수락하면 바로 매칭이 확정돼요.\n요청은 ${expiresLabel}까지 유효해요.`,
  };
}

export function formatRoommateActionError(
  error: Pick<RoommateApiError, 'code' | 'message'> | { readonly code?: string } | null,
  actionKind: RoommateActionKind,
): RoommateActionSafeCopy {
  const code = typeof error?.code === 'string' ? error.code : null;
  if (actionKind === 'matchRequest' && code && MATCH_REQUEST_ERROR_COPY[code]) {
    return MATCH_REQUEST_ERROR_COPY[code];
  }
  if (actionKind === 'block' && code && BLOCK_ERROR_COPY[code]) {
    return BLOCK_ERROR_COPY[code];
  }
  if (actionKind === 'report' && code && REPORT_ERROR_COPY[code]) {
    return REPORT_ERROR_COPY[code];
  }
  return ACTION_GENERIC_ERROR[actionKind];
}
