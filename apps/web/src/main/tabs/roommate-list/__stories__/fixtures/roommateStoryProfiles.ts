import type { MatchRequestActionResponse, MatchRequestSummary } from '@repo/shared/match/contract';
import {
  buildPublicProfileCompatibility,
  calcViewerMatchScore,
} from '@repo/shared/profile/compatibility-scoring';
import type {
  PublicProfile,
  PublicProfileActionCapabilities,
  PublicProfileCompatibility,
  PublicProfileCompatibilityAxis,
  PublicProfileCompatibilityAxisId,
  PublicProfileCompatibilityBucket,
  PublicProfileCompatibilityDimension,
  PublicProfileFullDetail,
  PublicProfileTombstone,
  PublicTargetRelation,
  PublicTargetResultRead,
} from '@repo/shared/profile/contract';
import type { LifestyleData } from '@repo/shared/lifestyle';
import type { RoommateSearchSummary } from '@repo/shared/roommate-search/contract';
import type { BookmarkListResponse } from '@repo/shared/social-safety/bookmark';
import type { CreateBlockResponse } from '@repo/shared/social-safety/block';
import type { CreateReportResponse } from '@repo/shared/social-safety/report';
import {
  ACTIONABLE_ACTIONS,
  DIRECTION_LIMIT_REACHED_ACTIONS,
  FULL_EXPOSURE,
  GENERAL_RELATION,
  ISO_NOW,
  NO_RESULT_READ,
  SAFETY_RESTRICTED_ACTIONS,
  SEASON_OPEN_SAME_DORMITORY_ACTIONS,
  SUMMARY_ONLY_ACTIONS,
  SUMMARY_ONLY_EXPOSURE,
  TARGET_BLOCKED,
  TARGET_CAMPUS,
  TARGET_ERROR,
  TARGET_FULL_COMPATIBILITY_DASOM,
  TARGET_FULL_COMPATIBILITY_MINJU,
  TARGET_FULL_COMPATIBILITY_MINSEO,
  TARGET_FULL_COMPATIBILITY_RAHEE,
  TARGET_FULL_COMPATIBILITY_SEOYUN,
  TARGET_FULL_COMPATIBILITY_SUA,
  TARGET_FULL_COMPATIBILITY_YUJIN,
  TARGET_HAYOON,
  TARGET_JIWOO,
  TARGET_TOMBSTONE,
  TARGET_VIEWER_ALREADY_MATCHED,
  TOMBSTONE_ACTIONS,
  VIEWER_ALREADY_MATCHED_ACTIONS,
  TOMBSTONE_EXPOSURE,
  createSummary,
  fullCompatibilityViewerLifestyle,
  StorySummaryFactCombination,
} from './roommateStoryBuilders';

export const JIWOO_TWO_LINE_INTRO =
  '아침에는 조용히 준비하고 밤에는 불을 일찍 끄는 편이에요. 시험 기간에는 서로 방해되지 않도록 조명과 알람 시간을 미리 맞추고, 평소에는 주 2회 정도 청소 루틴을 정해 깔끔한 방 분위기를 유지하고 싶어요. 늦은 시간에는 이어폰을 사용하고, 과제나 동아리 일정이 늦어질 때는 미리 공유해서 서로 놀라지 않게 지내고 싶어요. 주말에는 가볍게 카페나 도서관에 가는 편이라 방에서는 조용히 쉬는 시간을 존중해 줄 룸메이트를 찾고 있어요.';

export const jiwooSummary = createSummary({
  id: TARGET_JIWOO,
  nickname: '지우',
  intro: JIWOO_TWO_LINE_INTRO,
  exposure: FULL_EXPOSURE,
  actions: ACTIONABLE_ACTIONS,
  matchScore: 92,
  detailContext: 'story-detail-context-jiwoo',
});
export const scoreCalculationFailedSummary = createSummary({
  id: TARGET_JIWOO,
  nickname: '지우',
  intro: '아침형이고 조용한 방 분위기를 좋아해요.',
  exposure: { ...FULL_EXPOSURE, scoreVisible: false },
  actions: ACTIONABLE_ACTIONS,
  detailContext: 'story-detail-context-jiwoo-score-unavailable',
});
export const emptyIntroSummary = createSummary({
  id: 'story-roommate-empty-intro',
  nickname: '무소개',
  intro: '',
  exposure: FULL_EXPOSURE,
  actions: ACTIONABLE_ACTIONS,
  matchScore: 81,
  detailContext: 'story-detail-context-empty-intro',
});
export const hayoonSummary = createSummary({
  id: TARGET_HAYOON,
  nickname: '하윤',
  intro: '청소 주기를 미리 맞춰두는 편이에요.',
  exposure: FULL_EXPOSURE,
  actions: ACTIONABLE_ACTIONS,
  matchScore: 85,
  bookmarked: true,
  detailContext: 'story-detail-context-hayoon',
  sleepHabit: 'TALKING',
});
export const seasonOpenChattingSummary = createSummary({
  id: 'story-roommate-open-chatting',
  nickname: '오픈대화중',
  intro: '시즌 오픈 기간에 이미 대화를 시작한 같은 건물 후보예요.',
  exposure: FULL_EXPOSURE,
  actions: SEASON_OPEN_SAME_DORMITORY_ACTIONS,
  matchScore: 84,
  detailContext: 'story-detail-context-open-chatting',
  activeChatThread: {
    id: 'story-chat-thread-open',
    threadKind: 'DIRECT',
    status: 'OPEN',
    lastMessageAt: '2026-07-06T05:00:00.000Z',
  },
});
export const seasonMatchingChattingSummary = createSummary({
  id: 'story-roommate-matching-chatting',
  nickname: '매칭대화중',
  intro: '매칭 기간에 생활패턴을 확인하며 대화 중인 후보예요.',
  exposure: FULL_EXPOSURE,
  actions: ACTIONABLE_ACTIONS,
  matchScore: 83,
  detailContext: 'story-detail-context-matching-chatting',
  activeChatThread: {
    id: 'story-chat-thread-matching',
    threadKind: 'DIRECT',
    status: 'OPEN',
    lastMessageAt: '2026-07-06T05:30:00.000Z',
  },
});
export const sentPendingRequestSummary = createSummary({
  id: 'story-roommate-sent-pending',
  nickname: '보낸요청',
  intro: '이미 보낸 매칭 요청의 응답을 기다리는 후보예요.',
  exposure: FULL_EXPOSURE,
  actions: ACTIONABLE_ACTIONS,
  matchScore: 82,
  detailContext: 'story-detail-context-sent-pending',
  pendingMatchRequest: {
    id: 'story-match-request-sent',
    direction: 'SENT',
    createdAt: ISO_NOW,
    expiresAt: '2026-07-11T03:00:00.000Z',
  },
});
export const receivedPendingRequestSummary = createSummary({
  id: 'story-roommate-received-pending',
  nickname: '받은요청',
  intro: '상대가 먼저 보낸 매칭 요청을 매칭 탭에서 확인할 수 있어요.',
  exposure: FULL_EXPOSURE,
  actions: ACTIONABLE_ACTIONS,
  matchScore: 79,
  detailContext: 'story-detail-context-received-pending',
  pendingMatchRequest: {
    id: 'story-match-request-received',
    direction: 'RECEIVED',
    createdAt: ISO_NOW,
    expiresAt: '2026-07-11T03:00:00.000Z',
  },
});
export const directionLimitReachedSummary = createSummary({
  id: 'story-roommate-direction-limit',
  nickname: '횟수초과',
  intro:
    '이번 시즌에 이미 여러 번 요청했던 후보예요. 대화는 가능하지만 새 매칭 요청은 닫혀 있어요.',
  exposure: FULL_EXPOSURE,
  actions: DIRECTION_LIMIT_REACHED_ACTIONS,
  matchScore: 76,
  detailContext: 'story-detail-context-direction-limit',
  sleepHabit: 'SNORING',
});
export const campusPreviewSummary = createSummary({
  id: TARGET_CAMPUS,
  nickname: '캠퍼스 미리보기',
  intro: '다른 건물 후보는 요약 정보만 확인할 수 있어요.',
  exposure: SUMMARY_ONLY_EXPOSURE,
  actions: SUMMARY_ONLY_ACTIONS,
  smokingBehavior: null,
  sleepHabit: null,
});
export const viewerAlreadyMatchedSummary = createSummary({
  id: TARGET_VIEWER_ALREADY_MATCHED,
  nickname: '새 후보 제한',
  intro: '이미 매칭이 확정된 상태라 새 후보의 상세 비교와 매칭 요청은 닫혀 있어요.',
  exposure: SUMMARY_ONLY_EXPOSURE,
  actions: VIEWER_ALREADY_MATCHED_ACTIONS,
  smokingBehavior: 'NO',
  sleepHabit: 'NONE',
  relationshipStyle: 'CASUAL',
});
export const tombstoneSummary = createSummary({
  id: TARGET_TOMBSTONE,
  nickname: '하린',
  intro: '상세를 여는 사이 시즌 참여 상태가 바뀔 수 있어요.',
  exposure: FULL_EXPOSURE,
  actions: ACTIONABLE_ACTIONS,
  matchScore: 91,
  detailContext: 'story-detail-context-tombstone',
});
export const errorSummary = createSummary({
  id: TARGET_ERROR,
  nickname: '민서',
  intro: '상세 요청이 서버에서 다시 확인되는 예시예요.',
  exposure: FULL_EXPOSURE,
  actions: ACTIONABLE_ACTIONS,
  matchScore: 86,
  detailContext: 'story-detail-context-hidden',
});
export const blockedUserSummary = createSummary({
  id: TARGET_BLOCKED,
  nickname: '숨김 처리된 후보',
  intro: '서버 오류로 이 후보와의 새 행동은 잠시 닫혀 있어요.',
  exposure: { ...SUMMARY_ONLY_EXPOSURE, listSummaryVisible: true },
  actions: SAFETY_RESTRICTED_ACTIONS,
  smokingBehavior: null,
  sleepHabit: null,
  relationshipStyle: null,
});

export const SEASON_OPEN_CAMPUS_BE_FIXTURE_CANDIDATES = [
  ['operated-female', '테스트춘천여'],
  ['home-e2e-open', '오픈시즌홈'],
  ['home-e2e-postmatch', '마감시즌홈'],
  ['home-e2e-yeji-01', '예지홈01'],
  ['home-e2e-yeji-02', '예지홈02'],
  ['home-e2e-yeji-03', '예지홈03'],
  ['home-e2e-yeji-04', '예지홈04'],
  ['home-e2e-yeji-05', '예지홈05'],
  ['home-e2e-yeji-06', '예지홈06'],
  ['home-e2e-yeji-07', '예지홈07'],
  ['home-e2e-yeji-08', '예지홈08'],
  ['home-e2e-yeji-09', '예지홈09'],
  ['home-e2e-yeji-10', '예지홈10'],
  ['home-e2e-saerom-02', '새롬홈02'],
  ['home-e2e-saerom-04', '새롬홈04'],
  ['home-e2e-saerom-06', '새롬홈06'],
  ['home-e2e-saerom-08', '새롬홈08'],
  ['home-e2e-saerom-10', '새롬홈10'],
  ['home-e2e-irum-02', '이룸홈02'],
  ['home-e2e-irum-04', '이룸홈04'],
  ['home-e2e-irum-06', '이룸홈06'],
  ['home-e2e-irum-08', '이룸홈08'],
  ['home-e2e-daon-02', '다온홈02'],
  ['home-e2e-daon-04', '다온홈04'],
] as const;

export const SEASON_OPEN_SAME_DORMITORY_BE_FIXTURE_CANDIDATES =
  SEASON_OPEN_CAMPUS_BE_FIXTURE_CANDIDATES.filter(
    ([fixtureKey]) =>
      fixtureKey.includes('yeji') ||
      fixtureKey === 'operated-female' ||
      fixtureKey === 'home-e2e-open',
  );

export const SEASON_OPEN_SUMMARY_FACT_COMBINATIONS = [
  { smokingBehavior: 'NO', sleepHabit: 'NONE', relationshipStyle: 'CASUAL' },
  { smokingBehavior: 'YES', sleepHabit: 'TALKING', relationshipStyle: 'CLOSE' },
  { smokingBehavior: 'E_CIG', sleepHabit: 'SNORING', relationshipStyle: 'CASUAL' },
  { smokingBehavior: 'NO', sleepHabit: 'GRINDING', relationshipStyle: 'CLOSE' },
] as const satisfies readonly StorySummaryFactCombination[];

export const SEASON_OPEN_SAME_DORMITORY_STORY_NICKNAMES = [
  '가온',
  '나래',
  '다솜',
  '라희',
  '민재',
  '서윤',
  '아린',
  '유진',
  '지우',
  '하람',
  '해솔',
  '희원',
] as const;

export const SEASON_OPEN_SAME_DORMITORY_STORY_SCORES = [
  96, 85, 88, 50, 84, 35, 91, 70, 58, 77, 54, 43,
] as const;

export const seasonOpenCampusPreviewSummaries = SEASON_OPEN_CAMPUS_BE_FIXTURE_CANDIDATES.map(
  ([fixtureKey, nickname], index) => {
    const factCombination =
      SEASON_OPEN_SUMMARY_FACT_COMBINATIONS[index % SEASON_OPEN_SUMMARY_FACT_COMBINATIONS.length]!;

    return createSummary({
      id: `story-roommate-${fixtureKey}`,
      nickname,
      intro:
        index % 2 === 0
          ? `${nickname}님의 공개 요약을 먼저 확인해 보세요. 같은 건물 후보가 아니면 상세 비교는 열리지 않아요.`
          : `${nickname}님은 시즌 등록을 마친 공개 후보예요. 생활패턴 상세는 정책에 맞는 범위에서만 볼 수 있어요.`,
      exposure: SUMMARY_ONLY_EXPOSURE,
      actions: SUMMARY_ONLY_ACTIONS,
      smokingBehavior: factCombination.smokingBehavior,
      sleepHabit: factCombination.sleepHabit,
      relationshipStyle: factCombination.relationshipStyle,
    });
  },
);

export const seasonOpenSameDormitorySummaries =
  SEASON_OPEN_SAME_DORMITORY_BE_FIXTURE_CANDIDATES.map(([fixtureKey, fallbackNickname], index) => {
    const factCombination =
      SEASON_OPEN_SUMMARY_FACT_COMBINATIONS[
        (index + 1) % SEASON_OPEN_SUMMARY_FACT_COMBINATIONS.length
      ]!;
    const nickname = SEASON_OPEN_SAME_DORMITORY_STORY_NICKNAMES[index] ?? fallbackNickname;
    const matchScore = SEASON_OPEN_SAME_DORMITORY_STORY_SCORES[index] ?? Math.max(30, 96 - index);

    return createSummary({
      id: `story-roommate-${fixtureKey}`,
      nickname,
      intro:
        index % 2 === 0
          ? `${nickname}님과 생활패턴과 원하는 조건을 자세히 비교할 수 있어요.`
          : `${nickname}님과 먼저 대화해 보고, 관심 목록에 저장해 다시 확인할 수 있어요.`,
      exposure: FULL_EXPOSURE,
      actions: SEASON_OPEN_SAME_DORMITORY_ACTIONS,
      matchScore,
      bookmarked: index === 1,
      detailContext: `story-detail-context-${fixtureKey}`,
      smokingBehavior: factCombination.smokingBehavior,
      sleepHabit: factCombination.sleepHabit,
      relationshipStyle: factCombination.relationshipStyle,
    });
  });

export const seasonMatchingSameDormitorySummaries = seasonOpenSameDormitorySummaries.map(
  (summary, index) => ({
    ...summary,
    actions: ACTIONABLE_ACTIONS,
    profileSummary: {
      ...summary.profileSummary,
      intro:
        index % 2 === 0
          ? `${summary.profileSummary.nickname}님은 지금 매칭 요청과 대화가 가능한 같은 건물 후보예요.`
          : `${summary.profileSummary.nickname}님과 생활패턴을 비교하고, 매칭 요청을 보낼 수 있어요.`,
    },
  }),
);

export function createPublicProfileFull(input: {
  id: string;
  nickname: string;
  intro: string;
  matchScore?: number;
  scoreVisible?: boolean;
  actions?: PublicProfileActionCapabilities;
  relation?: PublicTargetRelation;
  resultRead?: PublicTargetResultRead;
  additional?: Partial<PublicProfileFullDetail['additional']>;
  gender?: PublicProfileFullDetail['gender'];
  campus?: PublicProfileFullDetail['campus'];
  lifestyle?: Partial<PublicProfileFullDetail['lifestyle']>;
  compatibility?: PublicProfileCompatibility;
}): PublicProfileFullDetail {
  const scoreVisible = input.scoreVisible ?? typeof input.matchScore === 'number';
  const compatibility =
    input.compatibility ??
    (typeof input.matchScore === 'number'
      ? createDefaultPublicProfileCompatibility(input.matchScore)
      : null);

  return {
    id: input.id,
    detailState: 'FULL',
    sourceProfile: 'SEASON_PARTICIPANT_PROFILE',
    relation: input.relation ?? GENERAL_RELATION,
    exposure: {
      listSummaryVisible: true,
      detailViewable: true,
      canViewFull: true,
      scoreVisible,
    },
    actions: input.actions ?? ACTIONABLE_ACTIONS,
    resultRead: input.resultRead ?? NO_RESULT_READ,
    nickname: input.nickname,
    intro: input.intro,
    additional: {
      college: 'CHUNCHEON_IT',
      grade: '3',
      mbti: 'INFJ',
      birthYear: 2002,
      ...input.additional,
    },
    gender: input.gender ?? 'F',
    campus: input.campus ?? 'CHUNCHEON',
    lifestyle: {
      bedtime: '22_24',
      wakeTime: '07_08',
      sleepHabit: 'NONE',
      sleepEnvironment: 'QUIET',
      screenUsage: 'NONE',
      noiseSensitivity: 'SENSITIVE',
      smokingBehavior: 'NO',
      indoorEating: 'SNACK',
      phoneBehavior: 'RARELY',
      earphoneUsage: 'ALWAYS',
      cleanLevel: 'WEEKLY_3_UP',
      relationshipStyle: 'CASUAL',
      temperatureSensitivity: 'NORMAL',
      ...input.lifestyle,
    },
    ...(typeof input.matchScore === 'number' ? { matchScore: input.matchScore } : {}),
    ...(scoreVisible && compatibility ? { compatibility } : {}),
  };
}

export const COMPATIBILITY_DIMENSION_AXIS_IDS = {
  SMOKING: ['SMOKING'],
  SLEEP_RHYTHM: ['BEDTIME', 'WAKE_TIME'],
  SLEEP_HABIT: ['SLEEP_HABIT'],
  SLEEP_ENVIRONMENT: ['SCREEN_USAGE', 'SLEEP_ENVIRONMENT'],
  DEVICE_USAGE: ['PHONE', 'EARPHONE'],
  CLEAN_SPACE: ['CLEAN_LEVEL', 'INDOOR_EATING'],
  TEMPERATURE: ['TEMPERATURE'],
  RELATIONSHIP_STYLE: ['RELATIONSHIP'],
} as const satisfies Record<
  PublicProfileCompatibilityDimension['id'],
  readonly PublicProfileCompatibilityAxisId[]
>;

export const FULL_COMPATIBILITY_VIEWER_CONDITION_FIXTURE = {
  SMOKING: '전담까지는 OK',
  BEDTIME: '24~02시',
  WAKE_TIME: '수업에 따라 유동적',
  SLEEP_HABIT: '보통',
  SLEEP_ENVIRONMENT: '작은 소리는 괜찮아요',
  SCREEN_USAGE: '밝기 낮추면 괜찮아요',
  TEMPERATURE: '보통',
  PHONE: '가끔·짧게는 괜찮아요',
  EARPHONE: '작게 틀면 괜찮아요',
  CLEAN_LEVEL: '눈에 띄면 정리하면 괜찮아요',
  INDOOR_EATING: '환기·정리 잘하면 OK',
  RELATIONSHIP: '친하게 지내요',
} as const satisfies Record<PublicProfileCompatibilityAxisId, string>;

export const DEFAULT_FULL_COMPATIBILITY_TARGET_TEXT = {
  SMOKING: '비흡연',
  BEDTIME: '22~24시 사이에 잠들어요',
  WAKE_TIME: '7~8시에 일어나요',
  SLEEP_HABIT: '잠버릇 없음',
  SLEEP_ENVIRONMENT: '잘 때 전자기기 소리를 틀지 않아요',
  SCREEN_USAGE: '잠들 때 화면을 거의 보지 않아요',
  TEMPERATURE: '온도 민감도는 보통이에요',
  PHONE: '실내 통화는 거의 하지 않아요',
  EARPHONE: '늦은 시간에는 이어폰을 사용해요',
  CLEAN_LEVEL: '주 3회 이상 정리해요',
  INDOOR_EATING: '간단한 간식만 먹어요',
  RELATIONSHIP: '각자 생활하되 필요한 건 이야기해요',
} as const satisfies Record<PublicProfileCompatibilityAxisId, string>;

export function createDefaultPublicProfileCompatibility(
  overallScore: number,
): PublicProfileCompatibility {
  return createStoryCompatibility({
    overallScore,
    dimensions: [
      createStoryDimension('SMOKING', 100, 'HIGH'),
      createStoryDimension('SLEEP_RHYTHM', 88, 'HIGH'),
      createStoryDimension('SLEEP_HABIT', 95, 'HIGH'),
      createStoryDimension('SLEEP_ENVIRONMENT', 62, 'MEDIUM'),
      createStoryDimension('DEVICE_USAGE', 86, 'HIGH'),
      createStoryDimension('CLEAN_SPACE', 78, 'HIGH'),
      createStoryDimension('TEMPERATURE', 76, 'HIGH'),
      createStoryDimension('RELATIONSHIP_STYLE', 82, 'HIGH'),
    ],
    axes: [
      createStoryAxis('SMOKING', 100, 'HIGH', '비흡연'),
      createStoryAxis('BEDTIME', 86, 'HIGH', '22~24시 사이에 잠들어요'),
      createStoryAxis('WAKE_TIME', 90, 'HIGH', '7~8시에 일어나요'),
      createStoryAxis('SLEEP_HABIT', 95, 'HIGH', '잠버릇 없음'),
      createStoryAxis('SLEEP_ENVIRONMENT', 82, 'HIGH', '잘 때 전자기기 소리를 틀지 않아요'),
      createStoryAxis('SCREEN_USAGE', 42, 'LOW', '잠들 때 화면을 켜는 편이에요'),
      createStoryAxis('TEMPERATURE', 76, 'HIGH', '온도 민감도는 보통이에요'),
      createStoryAxis('PHONE', 86, 'HIGH', '실내 통화를 거의 하지 않아요'),
      createStoryAxis('EARPHONE', 86, 'HIGH', '늦은 시간에는 이어폰을 사용해요'),
      createStoryAxis('CLEAN_LEVEL', 78, 'HIGH', '눈에 띄면 바로 정리해요'),
      createStoryAxis('INDOOR_EATING', 78, 'HIGH', '간단한 간식은 방에서 먹어요'),
      createStoryAxis('RELATIONSHIP', 82, 'HIGH', '각자 생활하되 필요한 건 이야기해요'),
    ],
  });
}

export function createStoryCompatibility(input: {
  overallScore: number;
  dimensions: readonly PublicProfileCompatibilityDimension[];
  axes: readonly PublicProfileCompatibilityAxis[];
}): PublicProfileCompatibility {
  return {
    overallScore: input.overallScore,
    dimensions: [...input.dimensions],
    axes: [...input.axes],
    hiddenAxisNotices: [{ code: 'DRINKING_EXCLUDED_BY_POLICY' }],
  };
}

export function createStoryDimension(
  id: PublicProfileCompatibilityDimension['id'],
  score: number,
  bucket: PublicProfileCompatibilityBucket,
): PublicProfileCompatibilityDimension {
  return { id, score, bucket, axisIds: [...COMPATIBILITY_DIMENSION_AXIS_IDS[id]] };
}

export function createStoryAxis(
  id: PublicProfileCompatibilityAxisId,
  score: number | null,
  bucket: PublicProfileCompatibilityBucket,
  targetText: string = DEFAULT_FULL_COMPATIBILITY_TARGET_TEXT[id],
): PublicProfileCompatibilityAxis {
  return {
    id,
    score,
    bucket,
    comparison: {
      targetText,
      viewerText: FULL_COMPATIBILITY_VIEWER_CONDITION_FIXTURE[id],
    },
  };
}

export type FullCompatibilityTargetFixture = {
  readonly id: string;
  readonly nickname: string;
  readonly intro: string;
  readonly matchScore: number;
  readonly compatibility: PublicProfileCompatibility;
  readonly additional?: Partial<PublicProfileFullDetail['additional']>;
  readonly lifestyle: Partial<PublicProfileFullDetail['lifestyle']>;
  readonly scoringLifestyle: LifestyleData;
  readonly smokingBehavior: RoommateSearchSummary['profileSummary']['smokingBehavior'];
  readonly sleepHabit: RoommateSearchSummary['profileSummary']['sleepHabit'];
  readonly relationshipStyle: RoommateSearchSummary['profileSummary']['relationshipStyle'];
};

export const PUBLIC_PROFILE_DETAIL_LIFESTYLE_FIELDS = [
  'bedtime',
  'wakeTime',
  'sleepHabit',
  'sleepEnvironment',
  'screenUsage',
  'noiseSensitivity',
  'smokingBehavior',
  'indoorEating',
  'phoneBehavior',
  'earphoneUsage',
  'cleanLevel',
  'relationshipStyle',
  'temperatureSensitivity',
] as const satisfies readonly (keyof PublicProfileFullDetail['lifestyle'])[];

export function createFullCompatibilityScoringLifestyle(
  overrides: Partial<LifestyleData>,
): LifestyleData {
  return {
    ...fullCompatibilityViewerLifestyle,
    drinkingFrequency: 'NONE',
    ...overrides,
  };
}

export function pickPublicProfileDetailLifestyle(
  lifestyle: LifestyleData,
): Partial<PublicProfileFullDetail['lifestyle']> {
  return Object.fromEntries(
    PUBLIC_PROFILE_DETAIL_LIFESTYLE_FIELDS.map((field) => [field, lifestyle[field]]),
  ) as Partial<PublicProfileFullDetail['lifestyle']>;
}

export function createFullCompatibilityTargetFixture(input: {
  readonly id: string;
  readonly nickname: string;
  readonly intro: string;
  readonly scoringLifestyle: LifestyleData;
  readonly additional?: Partial<PublicProfileFullDetail['additional']>;
}): FullCompatibilityTargetFixture {
  const compatibility = buildPublicProfileCompatibility(
    fullCompatibilityViewerLifestyle,
    input.scoringLifestyle,
  );
  const matchScore = calcViewerMatchScore(fullCompatibilityViewerLifestyle, input.scoringLifestyle);

  if (matchScore !== compatibility.overallScore) {
    throw new Error(`Full compatibility fixture score mismatch: ${input.id}`);
  }

  return {
    id: input.id,
    nickname: input.nickname,
    intro: input.intro,
    matchScore: compatibility.overallScore,
    compatibility,
    ...(input.additional ? { additional: input.additional } : {}),
    lifestyle: pickPublicProfileDetailLifestyle(input.scoringLifestyle),
    scoringLifestyle: input.scoringLifestyle,
    smokingBehavior: input.scoringLifestyle.smokingBehavior,
    sleepHabit: input.scoringLifestyle.sleepHabit,
    relationshipStyle: input.scoringLifestyle.relationshipStyle,
  };
}

export const FULL_COMPATIBILITY_TARGET_FIXTURES: readonly FullCompatibilityTargetFixture[] = [
  createFullCompatibilityTargetFixture({
    id: TARGET_JIWOO,
    nickname: '지우',
    intro: JIWOO_TWO_LINE_INTRO,
    scoringLifestyle: createFullCompatibilityScoringLifestyle({
      wakeTime: 'AFTER_10',
      sleepHabit: 'NONE',
      sleepEnvironment: 'QUIET',
      screenUsage: 'NONE',
      phoneBehavior: 'RARELY',
      earphoneUsage: 'ALWAYS',
      indoorEating: 'RARELY',
      cleanLevel: 'WEEKLY_3_UP',
    }),
    additional: { college: 'CHUNCHEON_IT', grade: '3', mbti: 'INFJ', birthYear: 2002 },
  }),

  createFullCompatibilityTargetFixture({
    id: TARGET_FULL_COMPATIBILITY_SUA,
    nickname: '수아',
    intro: '화면은 끄고 이어폰으로 음악을 듣는 조합이에요.',
    scoringLifestyle: createFullCompatibilityScoringLifestyle({
      bedtime: 'BEFORE_22',
      wakeTime: 'FLEXIBLE',
      sleepHabit: 'TALKING',
      sleepEnvironment: 'EARPHONE',
      screenUsage: 'AUDIO',
      smokingBehavior: 'E_CIG',
      indoorEating: 'SNACK',
      phoneBehavior: 'SOMETIMES',
      earphoneUsage: 'MOSTLY',
      cleanLevel: 'WEEKLY_3_UP',
      drinkingFrequency: 'NONE',
      relationshipStyle: 'CASUAL',
      temperatureSensitivity: 'NORMAL',
    }),
    additional: { college: 'CHUNCHEON_IT', grade: '2', mbti: 'ENFJ', birthYear: 2004 },
  }),
  createFullCompatibilityTargetFixture({
    id: TARGET_HAYOON,
    nickname: '하윤',
    intro: '통화는 거의 없고 영상 소리는 주로 스피커를 작게 쓰는 조합이에요.',
    scoringLifestyle: createFullCompatibilityScoringLifestyle({
      bedtime: '22_24',
      wakeTime: '07_08',
      sleepHabit: 'GRINDING',
      sleepEnvironment: 'LOW_SPEAKER',
      screenUsage: 'AUDIO',
      smokingBehavior: 'NO',
      indoorEating: 'MEAL',
      phoneBehavior: 'RARELY',
      earphoneUsage: 'MOSTLY_SPEAKER',
      cleanLevel: 'WEEKLY_3_UP',
      drinkingFrequency: 'NONE',
      relationshipStyle: 'CLOSE',
      temperatureSensitivity: 'NORMAL',
    }),
    additional: { college: 'CHUNCHEON_BUSINESS', grade: '2', mbti: 'ISFJ', birthYear: 2003 },
  }),
  createFullCompatibilityTargetFixture({
    id: TARGET_FULL_COMPATIBILITY_DASOM,
    nickname: '다솜',
    intro: '가끔 실내 통화를 하고 영상 소리는 주로 스피커를 작게 쓰는 조합이에요.',
    scoringLifestyle: createFullCompatibilityScoringLifestyle({
      bedtime: '22_24',
      wakeTime: 'FLEXIBLE',
      sleepHabit: 'SNORING',
      sleepEnvironment: 'QUIET',
      screenUsage: 'SCREEN',
      smokingBehavior: 'E_CIG',
      indoorEating: 'RARELY',
      phoneBehavior: 'SOMETIMES',
      earphoneUsage: 'MOSTLY_SPEAKER',
      cleanLevel: 'WEEKLY_1_2',
      drinkingFrequency: 'OFTEN',
      relationshipStyle: 'CASUAL',
      temperatureSensitivity: 'COLD',
    }),
    additional: {
      college: 'CHUNCHEON_ARTS_ENGINEERING',
      grade: '4+',
      mbti: 'ENTP',
      birthYear: 2001,
    },
  }),
  createFullCompatibilityTargetFixture({
    id: TARGET_FULL_COMPATIBILITY_RAHEE,
    nickname: '라희',
    intro: '실내 통화는 거의 없지만 영상 소리를 항상 스피커로 듣는 조합이에요.',
    scoringLifestyle: createFullCompatibilityScoringLifestyle({
      bedtime: '24_02',
      wakeTime: '08_09',
      sleepHabit: 'NONE',
      sleepEnvironment: 'EARPHONE',
      screenUsage: 'SCREEN',
      smokingBehavior: 'YES',
      indoorEating: 'SNACK',
      phoneBehavior: 'RARELY',
      earphoneUsage: 'ALWAYS_SPEAKER',
      cleanLevel: 'WEEKLY_1_2',
      drinkingFrequency: 'OFTEN',
      relationshipStyle: 'CLOSE',
      temperatureSensitivity: 'HOT',
    }),
    additional: { college: 'CHUNCHEON_SOCIAL_SCIENCES', grade: '1', mbti: 'INTJ', birthYear: 2006 },
  }),
  createFullCompatibilityTargetFixture({
    id: TARGET_FULL_COMPATIBILITY_YUJIN,
    nickname: '유진',
    intro: '실내 통화는 자주 하지만 영상 소리는 항상 이어폰으로 듣는 조합이에요.',
    scoringLifestyle: createFullCompatibilityScoringLifestyle({
      bedtime: '24_02',
      wakeTime: 'FLEXIBLE',
      sleepHabit: 'TALKING',
      sleepEnvironment: 'LOW_SPEAKER',
      screenUsage: 'SCREEN',
      smokingBehavior: 'YES',
      indoorEating: 'MEAL',
      phoneBehavior: 'OFTEN',
      earphoneUsage: 'ALWAYS',
      cleanLevel: 'WEEKLY_1_2',
      drinkingFrequency: 'RARELY',
      relationshipStyle: 'CLOSE',
      temperatureSensitivity: 'NORMAL',
    }),
    additional: {
      college: 'CHUNCHEON_NATURAL_SCIENCES',
      grade: '3',
      mbti: 'INTP',
      birthYear: 2002,
    },
  }),
  createFullCompatibilityTargetFixture({
    id: TARGET_FULL_COMPATIBILITY_MINSEO,
    nickname: '민서',
    intro: '화면을 보면서 스피커를 작게 트는 조합이에요.',
    scoringLifestyle: createFullCompatibilityScoringLifestyle({
      bedtime: 'AFTER_02',
      wakeTime: '09_10',
      sleepHabit: 'GRINDING',
      sleepEnvironment: 'LOW_SPEAKER',
      screenUsage: 'SCREEN',
      smokingBehavior: 'YES',
      indoorEating: 'RARELY',
      phoneBehavior: 'OFTEN',
      earphoneUsage: 'MOSTLY_SPEAKER',
      cleanLevel: 'WHEN_DIRTY',
      drinkingFrequency: 'SOMETIMES',
      relationshipStyle: 'CLOSE',
      temperatureSensitivity: 'NORMAL',
    }),
    additional: { college: 'CHUNCHEON_HUMANITIES', grade: '2', mbti: 'ENFP', birthYear: 2004 },
  }),
  createFullCompatibilityTargetFixture({
    id: TARGET_FULL_COMPATIBILITY_SEOYUN,
    nickname: '서윤',
    intro: '화면 빛과 스피커 소리가 함께 있어 가장 조율이 필요한 조합이에요.',
    scoringLifestyle: createFullCompatibilityScoringLifestyle({
      bedtime: 'AFTER_02',
      wakeTime: 'AFTER_10',
      sleepHabit: 'SNORING',
      sleepEnvironment: 'LOW_SPEAKER',
      screenUsage: 'SCREEN',
      smokingBehavior: 'YES',
      indoorEating: 'MEAL',
      phoneBehavior: 'OFTEN',
      earphoneUsage: 'ALWAYS_SPEAKER',
      cleanLevel: 'WHEN_DIRTY',
      drinkingFrequency: 'SOMETIMES',
      relationshipStyle: 'CLOSE',
      temperatureSensitivity: 'HOT',
    }),
    additional: {
      college: 'CHUNCHEON_GLOBAL_FUTURE_CONVERGENCE',
      grade: '1',
      mbti: 'ESFP',
      birthYear: 2006,
    },
  }),
  createFullCompatibilityTargetFixture({
    id: TARGET_FULL_COMPATIBILITY_MINJU,
    nickname: '민주',
    intro: '보편적인 생활 기준에 가까운 후보로, 화면과 소리 사용을 함께 비교해 볼 수 있어요.',
    scoringLifestyle: createFullCompatibilityScoringLifestyle({
      smokingBehavior: 'NO',
      drinkingFrequency: 'SOMETIMES',
      sleepHabit: 'NONE',
      phoneBehavior: 'SOMETIMES',
      earphoneUsage: 'MOSTLY_SPEAKER',
      sleepEnvironment: 'LOW_SPEAKER',
      screenUsage: 'SCREEN',
      cleanLevel: 'WEEKLY_1_2',
      indoorEatingTolerance: 'CLEAN_OK',
      bedtime: '24_02',
      wakeTime: 'FLEXIBLE',
      temperatureSensitivity: 'NORMAL',
      relationshipStyle: 'CLOSE',
    }),
    additional: { college: 'CHUNCHEON_BUSINESS', grade: '3', mbti: 'ESFJ', birthYear: 2003 },
  }),
];

export function createPublicProfileTombstone(input: {
  id: string;
  displayName: string;
  message: string;
}): PublicProfileTombstone {
  return {
    id: input.id,
    detailState: 'TOMBSTONE',
    relation: GENERAL_RELATION,
    exposure: TOMBSTONE_EXPOSURE,
    actions: TOMBSTONE_ACTIONS,
    resultRead: NO_RESULT_READ,
    tombstone: {
      reason: 'TARGET_NO_LONGER_DISCOVERABLE',
      displayName: input.displayName,
      message: input.message,
    },
  };
}

export const defaultProfiles: Readonly<Record<string, PublicProfile>> = {
  [TARGET_JIWOO]: createPublicProfileFull({
    id: TARGET_JIWOO,
    nickname: '지우',
    intro: JIWOO_TWO_LINE_INTRO,
    matchScore: 92,
  }),
  [TARGET_HAYOON]: createPublicProfileFull({
    id: TARGET_HAYOON,
    nickname: '하윤',
    intro: '청소 주기를 미리 맞춰두는 편이에요.',
    matchScore: 85,
  }),
  [TARGET_TOMBSTONE]: createPublicProfileTombstone({
    id: TARGET_TOMBSTONE,
    displayName: '하린',
    message: '상대가 시즌 참여를 철회해 프로필을 볼 수 없어요.',
  }),
};

export const fullCompatibilitySummaries = FULL_COMPATIBILITY_TARGET_FIXTURES.map((target, index) =>
  createSummary({
    id: target.id,
    nickname: target.nickname,
    intro: target.intro,
    exposure: FULL_EXPOSURE,
    actions: ACTIONABLE_ACTIONS,
    matchScore: target.matchScore,
    bookmarked: index === 1,
    detailContext: `story-detail-context-full-compatibility-${index + 1}`,
    ...(target.smokingBehavior ? { smokingBehavior: target.smokingBehavior } : {}),
    ...(target.sleepHabit ? { sleepHabit: target.sleepHabit } : {}),
    ...(target.relationshipStyle ? { relationshipStyle: target.relationshipStyle } : {}),
  }),
);

export const fullCompatibilityProfileByTargetUserId: Readonly<Record<string, PublicProfile>> = {
  ...defaultProfiles,
  ...Object.fromEntries(
    FULL_COMPATIBILITY_TARGET_FIXTURES.map((target) => [
      target.id,
      createPublicProfileFull({
        id: target.id,
        nickname: target.nickname,
        intro: target.intro,
        matchScore: target.matchScore,
        ...(target.additional ? { additional: target.additional } : {}),
        lifestyle: target.lifestyle,
        compatibility: target.compatibility,
      }),
    ]),
  ),
};

export const seasonOpenProfileByTargetUserId: Readonly<Record<string, PublicProfile>> = {
  ...defaultProfiles,
  ...Object.fromEntries(
    [...seasonOpenSameDormitorySummaries, seasonOpenChattingSummary].map((summary) => [
      summary.id,
      createPublicProfileFull({
        id: summary.id,
        nickname: summary.profileSummary.nickname,
        intro: summary.profileSummary.intro ?? '같은 건물 후보 상세 정보예요.',
        matchScore: summary.matchScore,
        actions: SEASON_OPEN_SAME_DORMITORY_ACTIONS,
      }),
    ]),
  ),
};

export const seasonMatchingProfileByTargetUserId: Readonly<Record<string, PublicProfile>> = {
  ...defaultProfiles,
  ...Object.fromEntries(
    [
      ...seasonMatchingSameDormitorySummaries,
      seasonMatchingChattingSummary,
      sentPendingRequestSummary,
      receivedPendingRequestSummary,
      directionLimitReachedSummary,
    ].map((summary) => [
      summary.id,
      createPublicProfileFull({
        id: summary.id,
        nickname: summary.profileSummary.nickname,
        intro: summary.profileSummary.intro ?? '매칭 기간 같은 건물 후보 상세 정보예요.',
        matchScore: summary.matchScore,
        actions: summary.actions,
      }),
    ]),
  ),
};

export const bookmarksEmpty: BookmarkListResponse = {
  sort: 'RECENT',
  items: [],
  pageInfo: { hasNextPage: false, nextCursor: null },
  emptyState: { code: 'NO_BOOKMARKS' },
  serverTime: ISO_NOW,
};

export function createMatchRequestActionResponse(): MatchRequestActionResponse {
  const request: MatchRequestSummary = {
    id: 'story-match-request-1',
    seasonId: 'season-2026-02',
    direction: 'SENT',
    counterpartUserId: TARGET_JIWOO,
    counterpartParticipantId: `participant-${TARGET_JIWOO}`,
    counterpartSummary: jiwooSummary,
    status: 'PENDING',
    note: null,
    createdAt: ISO_NOW,
    expiresAt: '2026-07-13T03:00:00.000Z',
    terminalAt: null,
    acceptedAt: null,
    terminalReason: null,
  };
  return { request, activeMatch: null };
}

export function createBlockResponse(targetUserId: string): CreateBlockResponse {
  return {
    block: {
      id: `story-block-${targetUserId}`,
      blockedUserId: targetUserId,
      blockedAt: ISO_NOW,
      note: null,
    },
    created: true,
    listMetadata: { serverTime: ISO_NOW },
  };
}

export function createReportResponse(optionalBlock: boolean): CreateReportResponse {
  return {
    report: {
      id: 'story-report-1',
      targetType: 'PROFILE',
      reason: 'FALSE_PROFILE',
      receivedAt: ISO_NOW,
      status: 'RECEIVED',
    },
    received: true,
    optionalActionResult: optionalBlock
      ? { action: 'BLOCK_TARGET', status: 'SUCCEEDED', code: null }
      : null,
  };
}
