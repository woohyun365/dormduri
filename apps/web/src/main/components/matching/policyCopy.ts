import type { ActiveMatch } from '@/types/match';

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
    if (activeMatch.cancelRequestKind === 'CANDIDATE_LEAVE') {
      return {
        tone: 'amber',
        title: '후보 이탈은 코어 2명 승인 후 적용돼요',
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

export function getMatchRequestHelperCopy(params: {
  direction: 'sent' | 'received';
  requestKind?: 'PERSONAL' | 'GROUP_JOIN';
  isUrgent: boolean;
  approvalCount: number;
  approvalTotal: number;
}): string {
  const { direction, requestKind, isUrgent, approvalCount, approvalTotal } = params;

  if (direction === 'sent' && requestKind === 'GROUP_JOIN') {
    return '그룹 내부 승인 진행 상황은 개인에게 공개되지 않습니다.';
  }

  if (direction === 'sent') {
    return '같은 방향 요청은 시즌당 최대 3회까지 보낼 수 있어요.';
  }

  if (requestKind === 'GROUP_JOIN') {
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

  if (activeMatch?.cancelRequestKind === 'CANDIDATE_LEAVE') {
    return cancelRequestedByCurrentUser
      ? '그룹 이탈 요청이 기록됐어요. 코어 2명이 모두 승인하면 A-B 그룹으로 복원됩니다.'
      : '후보 이탈 요청이 도착했어요. 코어 2명이 모두 승인해야 A-B 그룹으로 복원됩니다.';
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
