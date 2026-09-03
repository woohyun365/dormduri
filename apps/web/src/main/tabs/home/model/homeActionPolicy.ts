import type { SeasonState } from '@repo/shared/season/runtime';

export type HomeQuickActionTarget =
  'list' | 'matching-current' | 'matching-history' | 'chat' | 'profile';

export type HomeQuickActionIcon =
  'users' | 'eye' | 'bar-chart' | 'history' | 'message-circle' | 'user';

export type HomeQuickActionColor = 'blue' | 'purple' | 'green' | 'orange';

export interface HomeQuickAction {
  icon: HomeQuickActionIcon;
  label: string;
  description: string;
  color: HomeQuickActionColor;
  target: HomeQuickActionTarget;
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
}: BuildHomeQuickActionsInput): HomeQuickAction[] {
  if (!hasCurrentSeason) {
    return [historyAction(), accountInfoAction];
  }
  if (seasonState === 'SEASON_MATCHING') {
    return [
      {
        icon: 'users',
        label: '룸메 찾기',
        description: canEnterRoommateSearch ? '룸메 탐색' : '탭에서 확인',
        color: 'blue',
        target: 'list',
      },
      {
        icon: 'bar-chart',
        label: '매칭 현황',
        description: '현황 확인',
        color: 'purple',
        target: 'matching-current',
      },
      {
        icon: 'message-circle',
        label: '채팅',
        description: canStartChat ? '대화 보기' : '탭에서 확인',
        color: 'green',
        target: 'chat',
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
        icon: 'message-circle',
        label: canStartChat ? '채팅' : '과거 대화',
        description: canStartChat ? '대화 보기' : '기록 보기',
        color: 'green',
        target: 'chat',
      },
      profileAction,
    ];
  }

  if (seasonState === 'OFF_SEASON') {
    return [historyAction(), accountInfoAction];
  }

  return [
    {
      icon: 'eye',
      label: '룸메 찾기',
      description: '후보 목록 확인',
      color: 'blue',
      target: 'list',
    },
    {
      icon: 'history',
      label: '이전 기록',
      description: '지난 활동 확인',
      color: 'purple',
      target: 'matching-history',
    },
    {
      icon: 'message-circle',
      label: '채팅',
      description: '대화 목록 확인',
      color: 'green',
      target: 'chat',
    },
    seasonProfileAction,
  ];
}

function historyAction(): HomeQuickAction {
  return {
    icon: 'history',
    label: '이전 기록',
    description: '지난 시즌',
    color: 'purple',
    target: 'matching-history',
  };
}

const profileAction: HomeQuickAction = {
  icon: 'user',
  label: '내 프로필',
  description: '확인·수정',
  color: 'orange',
  target: 'profile',
};

const seasonProfileAction: HomeQuickAction = {
  icon: 'user',
  label: '시즌 프로필',
  description: '기숙사·조건 설정',
  color: 'orange',
  target: 'profile',
};

const accountInfoAction: HomeQuickAction = {
  icon: 'user',
  label: '내 정보',
  description: '계정 확인',
  color: 'orange',
  target: 'profile',
};
