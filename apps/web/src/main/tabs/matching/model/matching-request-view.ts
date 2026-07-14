import type {
  MatchActionDisabledReason,
  MatchRequestStatus,
  MatchRequestWithActions,
  RequestDirection,
} from '@repo/shared/match/contract';
import {
  getDisabledReasonDescriptionId,
  matchActionDisabledReasonCopy,
} from './matching-action-capability';

export const MATCHING_SENT_REQUEST_LIMIT = 3;

export interface MatchingRequestActionsView {
  readonly canAccept: boolean;
  readonly canReject: boolean;
  readonly canCancel: boolean;
  readonly disabledReason: MatchActionDisabledReason | null;
  readonly disabledReasonCopy: string | null;
  readonly disabledReasonDescriptionId: string | null;
}

export interface MatchingRequestCardView {
  readonly id: string;
  readonly counterpartUserId: string;
  readonly direction: RequestDirection;
  readonly presentation: 'pending' | 'terminal';
  readonly nickname: string;
  readonly intro: string;
  readonly note: string | null;
  readonly score: number | null;
  readonly scoreHiddenCopy: string | null;
  readonly detailEntryToken: string | null;
  readonly canStartChat: boolean;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly statusLabel: string;
  readonly actions: MatchingRequestActionsView;
}

export interface MatchingRequestSectionView {
  readonly quota: { readonly used: number; readonly limit: number; readonly remaining: number };
  readonly sent: readonly MatchingRequestCardView[];
  readonly received: readonly MatchingRequestCardView[];
}

function requestStatusLabel(status: MatchRequestStatus): string {
  switch (status) {
    case 'PENDING':
      return '응답 대기';
    case 'ACCEPTED':
      return '수락됨';
    case 'REJECTED':
      return '거절됨';
    case 'CANCELLED_BY_REQUESTER':
      return '취소됨';
    case 'CANCELLED_BY_SYSTEM':
      return '요청 종료';
    case 'EXPIRED':
      return '기간 만료';
  }
}

function toRequestCardView(request: MatchRequestWithActions): MatchingRequestCardView {
  const pending = request.status === 'PENDING';
  const disabledReason = pending ? request.actions.disabledReason : null;
  const scoreVisible = request.counterpartSummary.exposure.scoreVisible;
  const score = scoreVisible ? (request.counterpartSummary.matchScore ?? null) : null;
  const detailVisible = request.counterpartSummary.exposure.detailViewable;

  return {
    id: request.id,
    counterpartUserId: request.counterpartUserId,
    direction: request.direction,
    presentation: pending ? 'pending' : 'terminal',
    nickname: request.counterpartSummary.profileSummary.nickname.trim() || '사용자',
    intro: request.counterpartSummary.profileSummary.intro.trim(),
    note: request.note?.trim() || null,
    score,
    scoreHiddenCopy:
      score !== null
        ? null
        : scoreVisible
          ? '매칭 점수를 확인할 수 없어요.'
          : '현재 정책에서는 매칭 점수가 공개되지 않아요.',
    detailEntryToken: detailVisible
      ? request.counterpartSummary.detailEntryToken?.trim() || null
      : null,
    canStartChat: request.counterpartSummary.actions.canStartChat,
    createdAt: request.createdAt,
    expiresAt: request.expiresAt,
    statusLabel: requestStatusLabel(request.status),
    actions: {
      canAccept: request.actions.canAccept,
      canReject: request.actions.canReject,
      canCancel: request.actions.canCancel,
      disabledReason,
      disabledReasonCopy: disabledReason ? matchActionDisabledReasonCopy(disabledReason) : null,
      disabledReasonDescriptionId: disabledReason
        ? getDisabledReasonDescriptionId({ actionId: request.id, reason: disabledReason })
        : null,
    },
  };
}

export function toMatchingRequestSectionView(input: {
  readonly sentRequests: readonly MatchRequestWithActions[];
  readonly receivedRequests: readonly MatchRequestWithActions[];
}): MatchingRequestSectionView {
  const sent = input.sentRequests.map(toRequestCardView);
  const received = input.receivedRequests.map(toRequestCardView);
  const used = sent.filter((request) => request.presentation === 'pending').length;

  return {
    quota: {
      used,
      limit: MATCHING_SENT_REQUEST_LIMIT,
      remaining: Math.max(0, MATCHING_SENT_REQUEST_LIMIT - used),
    },
    sent,
    received,
  };
}
