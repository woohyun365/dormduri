import type { SeasonContextValue } from '@/main/contexts/SeasonContext';
import type { ActiveMatch, MatchRequest, PastSeasonData } from '@/types/match';
import type { RoommateProfile, UserProfile } from '@/types/profile';

/**
 * Legacy MatchingTab이 timer를 계산하는 기준 시각입니다.
 * Storybook preview의 beforeEach가 `Date.now()`를 이 값으로 고정합니다.
 */
export const MATCHING_BASELINE_NOW = '2026-07-14T12:00:00.000Z';

export interface MatchingTabStoryScenario {
  key: string;
  title: string;
  description: string;
  seasonContext: SeasonContextValue;
  user: UserProfile;
  matchRequests: MatchRequest[];
  activeMatch: ActiveMatch | null;
  profiles: Omit<RoommateProfile, 'matchScore'>[];
  pastSeasons: PastSeasonData[];
  initialSection?: 'current' | 'past';
  initialRequestTab?: 'sent' | 'received';
  viewportHint: string;
}

const lifestyle = {
  bedtime: '22_24',
  wakeTime: '07_08',
  sleepHabit: 'NONE',
  sleepEnvironment: 'QUIET',
  screenUsage: 'NONE',
  noiseSensitivity: 'NORMAL',
  smokingBehavior: 'NO',
  indoorEating: 'SNACK',
  phoneBehavior: 'SOMETIMES',
  earphoneUsage: 'MOSTLY',
  cleanLevel: 'WEEKLY_1_2',
  drinkingFrequency: 'SOMETIMES',
  relationshipStyle: 'CASUAL',
  temperatureSensitivity: 'NORMAL',
  smokingTolerance: 'E_CIG_OK',
  phoneTolerance: 'BRIEF_OK',
  earphoneExpectation: 'LOW_VOLUME_OK',
  sleepEnvPreference: 'SPEAKER_OK',
  screenTolerance: 'SCREEN_OK',
  indoorEatingTolerance: 'CLEAN_OK',
  cleanExpectation: 'BASIC',
  drinkingTolerance: 'LOW_ONLY',
} as UserProfile['lifestyle'];

const user: UserProfile = {
  id: 'baseline-user',
  nickname: '나',
  gender: 'M',
  campus: 'CHUNCHEON',
  dormitoryId: 'toegye',
  lifestyle,
  intro: '차분한 생활 리듬을 선호해요.',
  messageToRoommate: '서로 배려하며 지내고 싶어요.',
  additional: { college: null, grade: null, mbti: 'ISTJ', birthYear: null },
};

const profiles: Omit<RoommateProfile, 'matchScore'>[] = [
  {
    id: 'baseline-partner',
    nickname: '도윤',
    gender: 'M',
    campus: 'CHUNCHEON',
    dormitoryId: 'toegye',
    lifestyle,
    intro: '규칙적인 생활을 하고 있어요.',
    messageToRoommate: '조용한 방을 함께 만들고 싶어요.',
    additional: { college: null, grade: null, mbti: 'ISFJ', birthYear: null },
  },
  {
    id: 'baseline-candidate',
    nickname: '민수',
    gender: 'M',
    campus: 'CHUNCHEON',
    dormitoryId: 'toegye',
    lifestyle,
    intro: '청결한 공간을 좋아해요.',
    messageToRoommate: '편하게 이야기해요.',
    additional: { college: null, grade: null, mbti: 'INTP', birthYear: null },
  },
  {
    id: 'baseline-core-a',
    nickname: '준호',
    gender: 'M',
    campus: 'CHUNCHEON',
    dormitoryId: 'toegye',
    lifestyle,
    intro: '그룹 생활을 준비하고 있어요.',
    messageToRoommate: null,
    additional: { college: null, grade: null, mbti: 'ENTJ', birthYear: null },
  },
  {
    id: 'baseline-core-b',
    nickname: '현우',
    gender: 'M',
    campus: 'CHUNCHEON',
    dormitoryId: 'toegye',
    lifestyle,
    intro: '생활 규칙을 중요하게 생각해요.',
    messageToRoommate: null,
    additional: { college: null, grade: null, mbti: 'INFJ', birthYear: null },
  },
];

const pastSeasons: PastSeasonData[] = [
  {
    id: '2025-2',
    name: '2025년 2학기',
    dormitoryIdSnapshot: 'toegye',
    matchResult: 'no_match',
    receivedCount: 2,
    sentCount: 1,
    chatCount: 1,
    history: [],
  },
];

function seasonContext(
  state: SeasonContextValue['state'],
  overrides: Partial<SeasonContextValue> = {},
): SeasonContextValue {
  return {
    season: { name: '2026년 2학기', roomSelectionDate: '2026-07-21' },
    state,
    isOpen: state === 'SEASON_OPEN',
    isMatching: state === 'SEASON_MATCHING',
    daysUntilEnd: state === 'OFF_SEASON' ? 0 : 7,
    ...overrides,
  };
}

function request(overrides: Partial<MatchRequest>): MatchRequest {
  return {
    id: 'baseline-request',
    fromUserId: user.id,
    toUserId: 'baseline-partner',
    status: 'PENDING',
    message: '생활 패턴이 잘 맞는 것 같아요.',
    createdAt: '2026-07-14T09:00:00.000Z',
    expiresAt: '2026-07-19T12:00:00.000Z',
    rejectedAt: null,
    acceptedAt: null,
    resolvedAt: null,
    ...overrides,
  };
}

const activeRequest = request({
  id: 'baseline-active-request',
  status: 'ACTIVE',
  acceptedAt: '2026-07-12T12:00:00.000Z',
});

const activePair: ActiveMatch = {
  matchId: 'baseline-active-match',
  partnerUserId: 'baseline-partner',
  partnerNickname: '도윤',
  partnerDormitoryId: 'toegye',
  matchScore: 84,
  scoreType: 'full',
  matchedAt: '2026-07-12T12:00:00.000Z',
  cancelRequestedAt: null,
  cancelRequestedBy: null,
  kind: 'pair',
};

const activeGroupCore: ActiveMatch = {
  matchId: 'baseline-group-match',
  partnerUserId: 'baseline-partner',
  partnerNickname: '도윤',
  partnerDormitoryId: 'toegye',
  matchScore: 84,
  scoreType: 'full',
  matchedAt: '2026-07-12T12:00:00.000Z',
  cancelRequestedAt: null,
  cancelRequestedBy: null,
  kind: 'group',
  groupRole: 'group_core',
  groupStage: 'PAIR_OPEN',
  groupCapacity: 3,
  groupMemberCount: 2,
  groupMembers: [
    { userId: user.id, nickname: user.nickname },
    { userId: 'baseline-partner', nickname: '도윤' },
  ],
};

const defaultScenario = {
  user,
  profiles,
  pastSeasons,
  viewportHint: '320px, 360px, 390px, 430px, 1280px, 1440px에서 current UI를 비교합니다.',
};

export const matchingTabStoryScenarios = {
  offSeasonCurrent: {
    ...defaultScenario,
    key: 'off-season-current',
    title: 'OFF_SEASON · 현재 시즌 안내',
    description:
      '공식 `OFF_SEASON` fixture에서 현재 legacy tab이 노출하는 안내를 고정합니다. 과거 이력은 별도 탭으로 유지됩니다.',
    seasonContext: seasonContext('OFF_SEASON'),
    matchRequests: [],
    activeMatch: null,
  },
  seasonOpenCurrent: {
    ...defaultScenario,
    key: 'season-open-current',
    title: 'SEASON_OPEN · 탐색 안내',
    description:
      '공식 `SEASON_OPEN` fixture에서 요청 전 탐색 CTA와 legacy policy banner를 고정합니다.',
    seasonContext: seasonContext('SEASON_OPEN'),
    matchRequests: [],
    activeMatch: null,
  },
  seasonMatchingEmpty: {
    ...defaultScenario,
    key: 'season-matching-empty',
    title: 'SEASON_MATCHING · 활동 없음',
    description: '매칭 기간이지만 현재 요청·대화·활성 매칭이 없는 legacy empty state입니다.',
    seasonContext: seasonContext('SEASON_MATCHING'),
    matchRequests: [],
    activeMatch: null,
  },
  seasonMatchingSent: {
    ...defaultScenario,
    key: 'season-matching-sent',
    title: 'SEASON_MATCHING · 보낸 요청',
    description: '고정 시각을 기준으로 아직 만료되지 않은 보낸 요청과 취소 동선을 고정합니다.',
    seasonContext: seasonContext('SEASON_MATCHING'),
    matchRequests: [request({ id: 'baseline-sent-request' })],
    activeMatch: null,
    initialRequestTab: 'sent' as const,
  },
  seasonMatchingReceived: {
    ...defaultScenario,
    key: 'season-matching-received',
    title: 'SEASON_MATCHING · 받은 요청',
    description: '수락/거절, 정렬, 더보기 메뉴가 있는 현재 요청 관리 surface를 고정합니다.',
    seasonContext: seasonContext('SEASON_MATCHING'),
    matchRequests: [
      request({
        id: 'baseline-received-request',
        fromUserId: 'baseline-candidate',
        toUserId: user.id,
        message: '함께 지내고 싶어요.',
        expiresAt: '2026-07-15T00:00:00.000Z',
      }),
    ],
    activeMatch: null,
    initialRequestTab: 'received' as const,
  },
  seasonMatchingActive: {
    ...defaultScenario,
    key: 'season-matching-active',
    title: 'SEASON_MATCHING · 활성 매칭',
    description: '현재 2인 ACTIVE 카드와 프로필/매칭 취소 요청 동선을 고정합니다.',
    seasonContext: seasonContext('SEASON_MATCHING'),
    matchRequests: [activeRequest],
    activeMatch: activePair,
  },
  seasonMatchingUnmatchPending: {
    ...defaultScenario,
    key: 'season-matching-unmatch-pending',
    title: 'SEASON_MATCHING · 매칭 취소 대기',
    description: '상대의 매칭 취소 요청이 도착한 current legacy active state를 고정합니다.',
    seasonContext: seasonContext('SEASON_MATCHING'),
    matchRequests: [activeRequest],
    activeMatch: {
      ...activePair,
      cancelRequestedAt: '2026-07-14T10:00:00.000Z',
      cancelRequestedBy: 'baseline-partner',
    },
  },
  seasonMatchingGroupLegacy: {
    ...defaultScenario,
    key: 'season-matching-group-legacy',
    title: 'SEASON_MATCHING · 3인실 그룹 legacy',
    description:
      '현재 PAIR_OPEN 그룹 코어가 받는 합류 요청 UI입니다. 이는 Phase 11 이후의 최종 group contract가 아닌 legacy baseline입니다.',
    seasonContext: seasonContext('SEASON_MATCHING'),
    matchRequests: [
      request({
        id: 'baseline-group-request',
        fromUserId: 'baseline-candidate',
        toUserId: user.id,
        requestKind: 'GROUP_CONV_JOIN',
        groupTargetUserIds: [user.id, 'baseline-partner'],
        approvalUserIds: [],
        message: '두 분과 함께 3인실에 합류하고 싶어요.',
      }),
    ],
    activeMatch: activeGroupCore,
    initialRequestTab: 'received' as const,
  },
  seasonPostMatchActive: {
    ...defaultScenario,
    key: 'season-post-match-active',
    title: 'POST_MATCH 사용자 라벨 → SEASON_POST_MATCH · 활성 결과',
    description:
      '사용자-facing POST_MATCH 라벨은 canonical `SEASON_POST_MATCH` fixture로만 매핑합니다. 이 story는 정책 준수 화면이 아니라 현재 legacy 렌더링 증거입니다.',
    seasonContext: seasonContext('SEASON_POST_MATCH', { daysUntilEnd: 0 }),
    matchRequests: [activeRequest],
    activeMatch: activePair,
  },
} satisfies Record<string, MatchingTabStoryScenario>;
