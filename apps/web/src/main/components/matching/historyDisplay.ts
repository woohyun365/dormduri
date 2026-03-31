import type { CardPill, StatusIndicator } from './MatchingCompactCard';
import type { HistoryItemData, HistoryResolvedBy, HistoryStage, MatchRequest } from '@/types/match';

const STAGE_PILL_CLASS: Record<HistoryStage, string> = {
  SENT_REQUEST: 'bg-blue-50 text-blue-700 border border-blue-200',
  RECEIVED_REQUEST: 'bg-purple-50 text-purple-700 border border-purple-200',
  CONVERSATION: 'bg-green-50 text-green-600 border border-green-200',
  MATCH: 'bg-teal-50 text-teal-700 border border-teal-200',
};

const STAGE_PILL_LABEL: Record<HistoryStage, string> = {
  SENT_REQUEST: '보낸 요청',
  RECEIVED_REQUEST: '받은 요청',
  CONVERSATION: '대화 단계',
  MATCH: '확정 이후',
};

export interface HistoryVisualMeta {
  status: StatusIndicator;
  stagePill?: CardPill;
  borderColor?: string;
}

function stagePill(stage?: HistoryStage): CardPill | undefined {
  if (!stage) return undefined;
  return {
    label: STAGE_PILL_LABEL[stage],
    className: STAGE_PILL_CLASS[stage],
  };
}

function resolveActor(
  resolvedBy: string | 'system' | null | undefined,
  currentUserId: string,
): HistoryResolvedBy {
  if (!resolvedBy || resolvedBy === 'system') return 'system';
  return resolvedBy === currentUserId ? 'self' : 'other';
}

function labelForStatus(
  status: MatchRequest['status'],
  stage: HistoryStage,
  actor: HistoryResolvedBy,
): string {
  switch (status) {
    case 'EXPIRED':
      return stage === 'RECEIVED_REQUEST'
        ? '답변하지 않아 종료됐어요'
        : '상대 답변이 없어 종료됐어요';
    case 'REJECTED':
      return stage === 'RECEIVED_REQUEST' ? '받은 요청을 거절했어요' : '상대가 요청을 거절했어요';
    case 'CANCELLED':
      if (actor === 'self') return '보낸 요청을 취소했어요';
      if (actor === 'other') return '상대가 요청을 취소했어요';
      return '요청이 자동 취소됐어요';
    case 'CONVERSATION_ENDED':
      if (actor === 'self') return '대화를 직접 종료했어요';
      return '상대가 대화를 종료했어요';
    case 'UNMATCHED':
      return '확정 후 매칭이 해제됐어요';
    default:
      return status;
  }
}

function toneForStatus(status: MatchRequest['status']): StatusIndicator {
  switch (status) {
    case 'EXPIRED':
      return {
        label: '상대 답변이 없어 종료됐어요',
        color: 'text-slate-600',
        dotColor: 'bg-slate-400',
      };
    case 'REJECTED':
      return {
        label: '상대가 요청을 거절했어요',
        color: 'text-slate-600',
        dotColor: 'bg-slate-400',
      };
    case 'CANCELLED':
      return {
        label: '보낸 요청을 취소했어요',
        color: 'text-slate-600',
        dotColor: 'bg-slate-400',
      };
    case 'CONVERSATION_ENDED':
      return {
        label: '대화를 직접 종료했어요',
        color: 'text-slate-600',
        dotColor: 'bg-slate-400',
      };
    case 'UNMATCHED':
      return {
        label: '확정 후 매칭이 해제됐어요',
        color: 'text-rose-700',
        dotColor: 'bg-rose-500',
      };
    default:
      return { label: String(status), color: 'text-gray-500', dotColor: 'bg-gray-400' };
  }
}

export function getRepeatedCancelledVisualMeta(
  context: 'SENT_REQUEST' | 'RECEIVED_REQUEST',
  count: number,
): HistoryVisualMeta {
  return {
    status: {
      label:
        context === 'SENT_REQUEST'
          ? `보낸 요청을 ${count}회 취소했어요`
          : `상대가 ${count}회 요청을 취소했어요`,
      color: 'text-slate-600',
      dotColor: 'bg-slate-400',
    },
    stagePill: stagePill(context),
  };
}

export function getCurrentHistoryVisualMeta(
  request: MatchRequest,
  currentUserId: string,
): HistoryVisualMeta {
  const stage: HistoryStage =
    request.status === 'CONVERSATION_ENDED'
      ? 'CONVERSATION'
      : request.status === 'UNMATCHED'
        ? 'MATCH'
        : request.fromUserId === currentUserId
          ? 'SENT_REQUEST'
          : 'RECEIVED_REQUEST';
  const actor = resolveActor(request.resolvedBy, currentUserId);
  const base = toneForStatus(request.status);

  return {
    status: {
      ...base,
      label: labelForStatus(request.status, stage, actor),
    },
    stagePill: stagePill(stage),
    borderColor: request.status === 'UNMATCHED' ? 'border-rose-200' : undefined,
  };
}

export function getPastHistoryVisualMeta(item: HistoryItemData): HistoryVisualMeta {
  // 그룹 ��류 불발
  if (item.groupType === 'group_conv_join_failed') {
    return {
      status: {
        label: '그룹 합류가 불발됐어요',
        color: 'text-slate-600',
        dotColor: 'bg-slate-400',
      },
      stagePill: {
        label: '합류 불발',
        className: 'bg-slate-100 text-slate-600 border border-slate-200',
      },
    };
  }

  if (!('status' in item)) {
    if (item.preset === 'MATCHED_SUCCESS') {
      const groupLabel =
        item.groupType === 'group_final'
          ? '3인 매칭 성사'
          : item.groupType === 'pair_final'
            ? '2인 매칭 성사'
            : '매칭 성사';
      return {
        status: {
          label: '최종 룸메이트로 정해졌어요',
          color: 'text-green-700',
          dotColor: 'bg-green-500',
        },
        stagePill: {
          label: groupLabel,
          className: 'bg-green-600 text-white border border-green-600',
        },
        borderColor: 'border-green-200',
      };
    }

    if (item.preset === 'RECEIVED_CANCELLED') {
      return {
        status: {
          label: '상대가 요청을 취소했어요',
          color: 'text-slate-600',
          dotColor: 'bg-slate-400',
        },
        stagePill: stagePill('RECEIVED_REQUEST'),
      };
    }

    return {
      status: {
        label: '확정 후 매칭이 해제됐어요',
        color: 'text-rose-700',
        dotColor: 'bg-rose-500',
      },
      stagePill: stagePill('MATCH'),
      borderColor: 'border-rose-200',
    };
  }

  const stage =
    item.stage ??
    (item.status === 'CONVERSATION_ENDED'
      ? 'CONVERSATION'
      : item.status === 'UNMATCHED'
        ? 'MATCH'
        : 'SENT_REQUEST');
  const actor = item.resolvedBy ?? 'system';
  const base = toneForStatus(item.status);

  return {
    status: {
      ...base,
      label: labelForStatus(item.status, stage, actor),
    },
    stagePill: stagePill(stage),
    borderColor: item.status === 'UNMATCHED' ? 'border-rose-200' : undefined,
  };
}
