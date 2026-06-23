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
  color: HomeQuickActionColor;
  target: HomeQuickActionTarget;
  disabled?: boolean;
}

interface BuildHomeQuickActionsInput {
  seasonState: SeasonState;
  canStartChat?: boolean;
}

export function buildHomeQuickActions({
  seasonState,
  canStartChat = seasonState === 'SEASON_MATCHING',
}: BuildHomeQuickActionsInput): HomeQuickAction[] {
  if (seasonState === 'SEASON_MATCHING') {
    return [
      {
        icon: 'users',
        label: '룸메 찾기',
        description: '룸메 탐색',
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
        description: '대화 보기',
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
        icon: canStartChat ? 'message-circle' : 'lock',
        label: canStartChat ? '채팅' : '과거 대화',
        description: canStartChat ? '대화 보기' : '기록 보기',
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
        icon: 'eye',
        label: '룸메 찾기',
        description: '미리보기',
        color: 'blue',
        target: 'list',
      },
      {
        icon: 'history',
        label: '이전 기록',
        description: '지난 시즌',
        color: 'purple',
        target: 'matching-history',
      },
      {
        icon: 'message-circle',
        label: '과거 대화',
        description: '기록 보기',
        color: 'green',
        target: 'chat',
        disabled: true,
      },
      profileAction,
    ];
  }

  return [
    {
      icon: 'eye',
      label: '룸메 찾기',
      description: '미리보기',
      color: 'blue',
      target: 'list',
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
      color: 'green',
      target: 'chat',
      disabled: true,
    },
    profileAction,
  ];
}

const profileAction: HomeQuickAction = {
  icon: 'user',
  label: '내 프로필',
  description: '확인·수정',
  color: 'orange',
  target: 'profile',
};
