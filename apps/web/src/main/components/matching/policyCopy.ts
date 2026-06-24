import type { ActiveMatch } from '@/types/match';
import type { SeasonState } from '@/types/season';

export type PolicyTone = 'blue' | 'amber' | 'green' | 'slate';

export interface PolicyCopy {
  tone: PolicyTone;
  title: string;
  body: string;
}

export function getMatchingPolicyHint(params: {
  activeMatch: ActiveMatch | null;
  requestTab: 'sent' | 'received';
  sentPendingCount: number;
  receivedPendingCount: number;
  conversationsCount: number;
}): PolicyCopy | null {
  const { activeMatch, requestTab, sentPendingCount, receivedPendingCount, conversationsCount } =
    params;

  if (activeMatch?.cancelRequestedAt) {
    if (activeMatch.cancelRequestKind === 'MEMBER_LEAVE') {
      return {
        tone: 'amber',
        title: '멤버 이탈은 코어 2명 승인 후 적용돼요',
        body: 'C가 그룹을 떠나려면 A와 B가 모두 승인해야 A-B 그룹으로 복원됩니다.',
      };
    }
    return {
      tone: 'amber',
      title: '매칭 취소는 즉시 완료되지 않아요',
      body: '상대 승인 또는 3일 무응답 자동 승인 후 취소가 확정됩니다.',
    };
  }

  if (activeMatch?.kind === 'group' && activeMatch.groupStage === 'PAIR_OPEN') {
    return {
      tone: 'blue',
      title: '새 멤버는 코어 2명이 모두 승인해야 해요',
      body: 'A와 B가 각각 승인해야 C와의 새로운 그룹 대화가 열립니다.',
    };
  }

  if (activeMatch?.kind === 'group' && activeMatch.groupStage === 'GROUP_FORMING') {
    return {
      tone: 'blue',
      title: '3명이 모두 확정 완료를 눌러야 해요',
      body: '그룹 대화는 시작됐지만, 최종 3인 그룹이 되려면 전원이 확정해야 합니다.',
    };
  }

  if (activeMatch?.kind === 'group' && activeMatch.groupStage === 'GROUP_FINAL') {
    return {
      tone: 'green',
      title: '최종 3인 그룹 상태예요',
      body: '이제 추가 합류 요청은 받지 않고, 그룹 단위 관계만 유지됩니다.',
    };
  }

  if (conversationsCount > 0) {
    return {
      tone: 'blue',
      title: '확정 완료와 대화 종료는 동시에 선택할 수 없어요',
      body: '확정 완료를 누르면 종료 버튼이 잠기고, 취소 후 다시 종료할 수 있습니다.',
    };
  }

  if (requestTab === 'sent' && sentPendingCount > 0) {
    return {
      tone: 'amber',
      title: '같은 방향 요청은 시즌당 최대 3회예요',
      body: '거절되거나 만료된 상대에게는 같은 방향으로 다시 요청할 수 없습니다.',
    };
  }

  if (requestTab === 'received' && receivedPendingCount > 0) {
    return {
      tone: 'blue',
      title: '수락해야만 대화가 시작돼요',
      body: '받은 요청은 승인 후에만 대화 단계로 넘어가고, 일부 관계는 다자 승인까지 필요합니다.',
    };
  }

  return null;
}

/**
 * 상태별 순환 팁 배열 반환 (DynamicPolicyHintBanner용).
 * getMatchingPolicyHint()는 "현재 행동에 직결되는 컨텍스트 힌트" (단일),
 * getMatchingPolicyHints()는 "일반 정책 교육 팁" (순환 복수).
 */
export function getMatchingPolicyHints(params: {
  seasonState: SeasonState;
  activeMatch: ActiveMatch | null;
  sentPendingCount: number;
  receivedPendingCount: number;
  conversationsCount: number;
  daysUntilEnd: number;
}): PolicyCopy[] {
  const { seasonState, activeMatch, sentPendingCount, receivedPendingCount, conversationsCount } =
    params;
  const hints: PolicyCopy[] = [];

  // --- OFF_SEASON ---
  if (seasonState === 'OFF_SEASON') {
    hints.push(
      {
        tone: 'slate',
        title: '지금은 비시즌이라 매칭할 수 없어요',
        body: '다음 시즌 전까지 프로필을 정리해 보세요.',
      },
      {
        tone: 'blue',
        title: '이전 시즌 매칭 이력은 볼 수 있어요',
        body: '과거 이력은 언제든 확인할 수 있어요.',
      },
    );
    return hints;
  }

  // --- SEASON_OPEN ---
  if (seasonState === 'SEASON_OPEN') {
    hints.push(
      {
        tone: 'blue',
        title: '지금은 프로필 작성과 탐색만 할 수 있어요',
        body: '매칭 요청은 아직 보낼 수 없어요.',
      },
      {
        tone: 'green',
        title: '지금은 프로필을 수정할 수 있어요',
        body: '매칭 시작 전 생활패턴을 확인해 주세요.',
      },
      {
        tone: 'blue',
        title: '관심 있는 상대를 미리 북마크할 수 있어요',
        body: '매칭 시작 후 더 빠르게 요청할 수 있어요.',
      },
    );
    return hints;
  }

  // --- SEASON_POST_MATCH ---
  if (seasonState === 'SEASON_POST_MATCH') {
    hints.push(
      {
        tone: 'green',
        title: '이번 시즌 매칭 결과를 확인할 수 있어요',
        body: '새 요청은 닫혔지만 이전 대화와 매칭 이력은 확인할 수 있어요.',
      },
      {
        tone: 'slate',
        title: '다음 시즌 전까지 프로필을 정리해 보세요',
        body: '다음 시즌이 열리면 새로운 탐색과 요청을 다시 시작할 수 있어요.',
      },
    );
    return hints;
  }

  // --- SEASON_MATCHING ---

  // ACTIVE 상태
  if (activeMatch && !activeMatch.cancelRequestedAt) {
    hints.push(
      {
        tone: 'green',
        title: '호실 선택은 학교 시스템에서 해야 해요',
        body: '매칭 확정 후 학교 시스템에서 진행해 주세요.',
      },
      {
        tone: 'amber',
        title: '매칭 취소는 상대 확인이 필요해요',
        body: '상대가 3일간 응답하지 않으면 자동 승인돼요.',
      },
      {
        tone: 'amber',
        title: '매칭을 취소하면 다시 연결할 수 없어요',
        body: '취소한 상대와는 다시 매칭할 수 없어요.',
      },
    );
    return hints;
  }

  if (activeMatch?.cancelRequestedAt) {
    hints.push(
      {
        tone: 'amber',
        title: '매칭 취소는 상대 확인이 필요해요',
        body: '상대가 3일간 응답하지 않으면 자동 승인돼요.',
      },
      {
        tone: 'amber',
        title: '매칭을 취소하면 다시 연결할 수 없어요',
        body: '취소한 상대와는 다시 매칭할 수 없어요.',
      },
    );
    return hints;
  }

  // 대화 중
  if (conversationsCount > 0) {
    hints.push(
      {
        tone: 'blue',
        title: '대화가 서로 잘 맞는다면 확정해보세요',
        body: '확정 전에는 상대도 다른 대화를 이어갈 수 있어요.',
      },
      {
        tone: 'amber',
        title: '대화를 종료하면 다시 연결할 수 없어요',
        body: '종료한 상대와는 다시 대화할 수 없어요.',
      },
      {
        tone: 'blue',
        title: '두 사람 모두 매칭을 확정해야 매칭돼요',
        body: '서로 충분한 대화를 통해 매칭을 확정해보세요.',
      },
      {
        tone: 'amber',
        title: '대화는 수락 후 7일간 유지돼요',
        body: '7일이 지나면 대화가 자동 종료돼요.',
      },
    );
  }

  // 보낸 요청
  if (sentPendingCount > 0) {
    hints.push(
      {
        tone: 'blue',
        title: '생활패턴이 맞는 상대에게 요청을 보내보세요',
        body: '동시에 보낼 수 있는 요청은 3건까지예요.',
      },
      {
        tone: 'amber',
        title: '상대가 거절한 요청은 다시 보낼 수 없어요',
        body: '요청을 거절한 상대에게 다시 요청할 수 없어요.',
      },
    );
  }

  // 받은 요청
  if (receivedPendingCount > 0) {
    hints.push(
      {
        tone: 'blue',
        title: '받은 요청을 수락하면 대화가 시작돼요',
        body: '수락한 뒤부터 대화 단계로 넘어가요.',
      },
      {
        tone: 'amber',
        title: '받은 요청은 5일 안에 응답해야 해요',
        body: '응답하지 않으면 받은 요청이 자동 종료돼요.',
      },
    );
  }

  // 아무 활동 없음
  if (
    hints.length === 0 ||
    (conversationsCount === 0 && sentPendingCount === 0 && receivedPendingCount === 0)
  ) {
    hints.push(
      {
        tone: 'blue',
        title: '최대 3명에게 요청할 수 있어요',
        body: '동시에 보낼 수 있는 요청은 3건까지예요.',
      },
      {
        tone: 'amber',
        title: '상대가 5일 내 응답하지 않으면 종료돼요',
        body: '내가 보낸 요청은 5일 뒤 자동 종료돼요.',
      },
      {
        tone: 'slate',
        title: '시즌 중에는 프로필을 수정할 수 없어요',
        body: '생활패턴은 매칭 시작 후 잠겨요.',
      },
    );
  }

  return hints;
}

export function getMatchRequestHelperCopy(params: {
  direction: 'sent' | 'received';
  requestKind?: 'PERSONAL' | 'GROUP_CONV_JOIN';
  isUrgent: boolean;
  approvalCount: number;
  approvalTotal: number;
}): string {
  const { direction, requestKind, isUrgent, approvalCount, approvalTotal } = params;

  if (direction === 'sent' && requestKind === 'GROUP_CONV_JOIN') {
    return '그룹 내부 승인 진행 상황은 개인에게 공개되지 않습니다.';
  }

  if (direction === 'sent') {
    return '같은 방향 요청은 시즌당 최대 3회까지 보낼 수 있어요.';
  }

  if (requestKind === 'GROUP_CONV_JOIN') {
    return `코어 ${approvalTotal}명 모두 승인해야 새로운 C 대화가 열립니다. 현재 ${approvalCount}/${approvalTotal} 승인됐어요.`;
  }

  if (isUrgent) {
    return '만료 전에 답변하지 않으면 요청이 자동 종료됩니다.';
  }

  return '수락 후에만 대화가 시작되며, 이후 확정/종료 정책이 적용됩니다.';
}

export function getConversationHelperCopy(params: {
  confirmApprovalCount: number;
  confirmApprovalTotal: number;
  viewerConfirmed: boolean;
  partnerConfirmed: boolean;
}): string {
  const { confirmApprovalCount, confirmApprovalTotal, viewerConfirmed, partnerConfirmed } = params;

  if (viewerConfirmed) {
    return '내 확정 완료가 기록되어 대화 종료는 잠겨 있어요. 필요하면 확정 완료를 취소하세요.';
  }

  if (partnerConfirmed) {
    return '상대가 먼저 확정 완료를 눌렀어요. 나도 눌러야 최종 적용됩니다.';
  }

  if (confirmApprovalCount > 0) {
    return `현재 ${confirmApprovalCount}/${confirmApprovalTotal}명이 확정 완료를 눌렀어요. 모두 눌러야 최종 확정됩니다.`;
  }

  return '대화 종료 후에는 같은 상대와 다시 연결할 수 없습니다.';
}

export function getActiveMatchHelperCopy(params: {
  activeMatch: ActiveMatch | null;
  cancelPending: boolean;
  cancelRequestedByCurrentUser: boolean;
}): string {
  const { activeMatch, cancelPending, cancelRequestedByCurrentUser } = params;

  if (!cancelPending) {
    return activeMatch?.kind === 'group'
      ? '그룹 상태에서는 관계가 개인이 아니라 그룹 단위로 유지됩니다.'
      : '추가 요청은 중단되고, 이 조합은 과거 이력으로만 남게 됩니다.';
  }

  if (activeMatch?.cancelRequestKind === 'MEMBER_LEAVE') {
    return cancelRequestedByCurrentUser
      ? '그룹 이탈 요청이 기록됐어요. 코어 2명이 모두 승인하면 A-B 그룹으로 복원됩니다.'
      : '멤버 이탈 요청이 도착했어요. 코어 2명이 모두 승인해야 A-B 그룹으로 복원됩니다.';
  }

  return cancelRequestedByCurrentUser
    ? '내 취소 요청이 기록됐어요. 상대 승인 또는 3일 무응답 후 해제됩니다.'
    : '상대가 취소를 요청했어요. 승인하면 즉시 해제되고, 무응답이면 3일 후 자동 승인됩니다.';
}

export function getGroupCoreHelperCopy(params: {
  stage?: 'PAIR_OPEN' | 'PAIR_FINAL' | 'GROUP_FORMING' | 'GROUP_FINAL';
  role?: 'group_core' | 'group_candidate' | null;
  finalApprovalCount: number;
  finalApprovalTotal: number;
}): string {
  const { stage, role, finalApprovalCount, finalApprovalTotal } = params;

  if (stage === 'PAIR_OPEN') {
    return '그룹은 개인에게 먼저 신청할 수 없고, 개인이 그룹에 합류 요청을 보내는 흐름만 허용됩니다.';
  }

  if (stage === 'GROUP_FORMING') {
    return role === 'group_candidate'
      ? `코어와 후보를 포함한 ${finalApprovalTotal}명 모두 확정해야 최종 3인 그룹이 됩니다.`
      : `현재 ${finalApprovalCount}/${finalApprovalTotal}명이 확정 완료를 눌렀어요.`;
  }

  if (stage === 'GROUP_FINAL') {
    return role === 'group_candidate'
      ? '후보가 그룹을 떠나려면 코어 2명의 동의가 필요합니다.'
      : '후보 이탈 요청이 오면 코어 2명이 모두 승인해야 A-B 그룹으로 복원됩니다.';
  }

  return '그룹 상태 정책을 확인하세요.';
}
