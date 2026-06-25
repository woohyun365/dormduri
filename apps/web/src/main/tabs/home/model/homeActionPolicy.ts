import type { SeasonState } from '@/types/season';

export type HomeQuickActionTarget =
  | 'list'
  | 'matching-current'
  | 'matching-history'
  | 'chat'
  | 'profile';

export type HomeQuickActionIcon =
  | 'users'
  | 'eye'
  | 'bar-chart'
  | 'history'
  | 'message-circle'
  | 'lock'
  | 'user';

export type HomeQuickActionColor = 'blue' | 'purple' | 'green' | 'orange';

export interface HomeQuickAction {
  icon: HomeQuickActionIcon;
  label: string;
  description: string;
  disabledReason?: string;
  color: HomeQuickActionColor;
  target: HomeQuickActionTarget;
  disabled?: boolean;
}

interface BuildHomeQuickActionsInput {
  seasonState: SeasonState;
  hasCurrentSeason?: boolean;
  canEnterRoommateSearch?: boolean;
  canStartChat?: boolean;
  canViewMatchHistory?: boolean;
}

export function buildHomeQuickActions({
  seasonState,
  hasCurrentSeason = true,
  canEnterRoommateSearch = seasonState !== 'OFF_SEASON',
  canStartChat = seasonState === 'SEASON_MATCHING',
  canViewMatchHistory = true,
}: BuildHomeQuickActionsInput): HomeQuickAction[] {
  if (!hasCurrentSeason) {
    return [
      historyAction(
        !canViewMatchHistory,
        !canViewMatchHistory ? '이전 시즌 기록을 아직 불러올 수 없어요.' : undefined,
      ),
      profileAction,
    ];
  }
  if (seasonState === 'SEASON_MATCHING') {
    return [
      {
        icon: canEnterRoommateSearch ? 'users' : 'lock',
        label: canEnterRoommateSearch ? '룸메 찾기' : '탐색 대기',
        description: canEnterRoommateSearch ? '룸메 탐색' : '등록·건물 확인',
        disabledReason: canEnterRoommateSearch
          ? undefined
          : '등록 완료와 건물 선택 조건을 만족해야 룸메 탐색이 열려요.',
        color: 'blue',
        target: 'list',
        disabled: canEnterRoommateSearch ? undefined : true,
      },
      {
        icon: 'bar-chart',
        label: '매칭 현황',
        description: '현황 확인',
        color: 'purple',
        target: 'matching-current',
      },
      {
        icon: canStartChat ? 'message-circle' : 'lock',
        label: canStartChat ? '채팅' : '채팅 대기',
        description: canStartChat ? '대화 보기' : '조건 충족 후',
        disabledReason: canStartChat
          ? undefined
          : '채팅은 등록 완료 후 정책 조건을 만족할 때 열려요.',
        color: 'green',
        target: 'chat',
        disabled: canStartChat ? undefined : true,
      },
      profileAction,
    ];
  }

  if (seasonState === 'SEASON_POST_MATCH') {
    return [
      {
        icon: 'bar-chart',
        label: '시즌 결과',
        description: '결과 확인',
        color: 'purple',
        target: 'matching-history',
      },
      {
        icon: 'history',
        label: '이전 기록',
        description: '지난 시즌',
        color: 'blue',
        target: 'matching-history',
      },
      {
        icon: canStartChat ? 'message-circle' : 'lock',
        label: canStartChat ? '채팅' : '과거 대화',
        description: canStartChat ? '대화 보기' : '기록 보기',
        disabledReason: canStartChat
          ? undefined
          : '마감 정리 기간에는 확정된 대화 예외가 없으면 채팅을 새로 열 수 없어요.',
        color: 'green',
        target: 'chat',
        disabled: canStartChat ? undefined : true,
      },
      profileAction,
    ];
  }

  if (seasonState === 'OFF_SEASON') {
    return [
      {
        icon: canEnterRoommateSearch ? 'eye' : 'lock',
        label: canEnterRoommateSearch ? '룸메 찾기' : '탐색 닫힘',
        description: canEnterRoommateSearch ? '미리보기' : '비시즌',
        disabledReason: canEnterRoommateSearch
          ? undefined
          : '비시즌에는 타인 탐색과 새 매칭 요청이 닫혀 있어요.',
        color: 'blue',
        target: 'list',
        disabled: canEnterRoommateSearch ? undefined : true,
      },
      historyAction(
        !canViewMatchHistory,
        !canViewMatchHistory ? '이전 시즌 기록을 아직 불러올 수 없어요.' : undefined,
      ),
      {
        icon: 'message-circle',
        label: '과거 대화',
        description: '기록 보기',
        disabledReason: '비시즌에는 새 대화 시작과 대화 쓰기가 닫혀 있어요.',
        color: 'green',
        target: 'chat',
        disabled: true,
      },
      profileAction,
    ];
  }

  return [
    {
      icon: canEnterRoommateSearch ? 'eye' : 'lock',
      label: canEnterRoommateSearch ? '룸메 찾기' : '탐색 대기',
      description: canEnterRoommateSearch ? '미리보기' : '등록 후',
      disabledReason: canEnterRoommateSearch
        ? undefined
        : '시즌 등록이 완료되어야 후보 요약을 확인할 수 있어요.',
      color: 'blue',
      target: 'list',
      disabled: canEnterRoommateSearch ? undefined : true,
    },
    {
      icon: 'history',
      label: '이전 기록',
      description: '지난 시즌',
      color: 'purple',
      target: 'matching-history',
    },
    {
      icon: 'lock',
      label: '채팅',
      description: '시즌 중 이용',
      disabledReason: '채팅은 등록 완료 후 정책 조건을 만족할 때 열려요.',
      color: 'green',
      target: 'chat',
      disabled: true,
    },
    profileAction,
  ];
}

function historyAction(disabled = false, disabledReason?: string): HomeQuickAction {
  return {
    icon: 'history',
    label: '이전 기록',
    description: disabled ? '준비 중' : '지난 시즌',
    disabledReason,
    color: 'purple',
    target: 'matching-history',
    disabled: disabled ? true : undefined,
  };
}

const profileAction: HomeQuickAction = {
  icon: 'user',
  label: '내 프로필',
  description: '확인·수정',
  color: 'orange',
  target: 'profile',
};
