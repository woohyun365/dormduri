import type { MatchHistoryResponse } from '@repo/shared/match/contract';
import type {
  PublicProfileFullDetail,
  PublicProfileTombstone,
} from '@repo/shared/profile/contract';
import type {
  PreviousSeasonProfileResponse,
  SeasonProfileDraftResponse,
} from '@repo/shared/season/participation';

export const homeProfileDetailLifestyle = {
  bedtime: '22_24',
  wakeTime: '07_08',
  sleepHabit: 'NONE',
  sleepEnvironment: 'QUIET',
  screenUsage: 'NONE',
  noiseSensitivity: 'NORMAL',
  smokingBehavior: 'NO',
  indoorEating: 'SNACK',
  phoneBehavior: 'SOMETIMES',
  earphoneUsage: 'ALWAYS',
  cleanLevel: 'WEEKLY_1_2',
  drinkingFrequency: 'RARELY',
  relationshipStyle: 'CLOSE',
  temperatureSensitivity: 'NORMAL',
  smokingTolerance: 'NO_ONLY',
  phoneTolerance: 'BRIEF_OK',
  earphoneExpectation: 'MUST',
  sleepEnvPreference: 'NO_SPEAKER',
  screenTolerance: 'LOW_OK',
  indoorEatingTolerance: 'CLEAN_OK',
  cleanExpectation: 'BASIC',
  drinkingTolerance: 'LOW_ONLY',
} as const;

export function createSeasonProfileDraftResponse(
  overrides: Partial<SeasonProfileDraftResponse> = {},
): SeasonProfileDraftResponse {
  return {
    participantId: 'participant-1',
    seasonId: 'season-2026-2',
    state: 'REGISTRATION_FINALIZED',
    lifestyle: homeProfileDetailLifestyle,
    intro: '조용한 생활을 선호하고 정리 습관을 중요하게 생각해요.',
    additional: { grade: '2', mbti: 'INTJ' },
    completion: {
      profileCompletionRequired: false,
      dormitorySelectionRequired: false,
      registrationUnavailable: false,
      registrationUnavailableReasons: [],
    },
    draftWritable: false,
    ...overrides,
  };
}

export function createPreviousSeasonProfileResponse(
  overrides: Partial<Extract<PreviousSeasonProfileResponse, { detailState: 'FULL' }>> = {},
): PreviousSeasonProfileResponse {
  return {
    detailState: 'FULL',
    participantId: 'participant-previous-1',
    seasonId: 'season-2026-1',
    seasonName: '2026년 1학기',
    dormitoryId: 'dasan',
    dormitoryName: '다산관',
    state: 'REGISTRATION_FINALIZED',
    lifestyle: homeProfileDetailLifestyle,
    intro: '직전 시즌에는 조용한 생활과 깔끔한 정리를 중요하게 봤어요.',
    additional: { grade: '2', mbti: 'INTJ' },
    completion: {
      profileCompletionRequired: false,
      dormitorySelectionRequired: false,
      registrationUnavailable: false,
      registrationUnavailableReasons: [],
    },
    draftWritable: false,
    registeredAt: '2026-03-29T00:00:00.000Z',
    profileSnapshotAt: '2026-03-29T00:00:00.000Z',
    ...overrides,
  };
}

export function createPublicProfileFull(
  overrides: Partial<PublicProfileFullDetail> = {},
): PublicProfileFullDetail {
  return {
    id: 'user-2',
    detailState: 'FULL',
    sourceProfile: 'SEASON_PARTICIPANT_PROFILE',
    relation: { type: 'MATCHED_PARTNER' },
    exposure: {
      listSummaryVisible: true,
      detailViewable: true,
      canViewFull: true,
      scoreVisible: true,
    },
    actions: {
      canBookmark: false,
      canRequestMatch: false,
      canStartChat: true,
      unavailableReasons: ['VIEWER_ALREADY_MATCHED'],
    },
    resultRead: {
      resultReadable: true,
      context: 'CURRENT_MATCHED_PARTNER',
    },
    nickname: '감자친구',
    intro: '아침형 생활패턴이고 조용한 방을 선호해요.',
    additional: { college: 'IT', grade: '3', mbti: 'ENFJ', birthYear: 2004 },
    gender: 'F',
    campus: 'CHUNCHEON',
    lifestyle: {
      bedtime: '22_24',
      wakeTime: '07_08',
      sleepHabit: 'NONE',
      sleepEnvironment: 'QUIET',
      screenUsage: 'NONE',
      noiseSensitivity: 'NORMAL',
      smokingBehavior: 'NO',
      indoorEating: 'SNACK',
      phoneBehavior: 'SOMETIMES',
      earphoneUsage: 'ALWAYS',
      cleanLevel: 'WEEKLY_1_2',
      relationshipStyle: 'CLOSE',
      temperatureSensitivity: 'NORMAL',
    },
    matchScore: 92,
    compatibility: {
      overallScore: 92,
      dimensions: [
        { id: 'SMOKING', score: 100, bucket: 'HIGH', axisIds: ['SMOKING'] },
        { id: 'SLEEP_RHYTHM', score: 90, bucket: 'HIGH', axisIds: ['BEDTIME', 'WAKE_TIME'] },
        { id: 'SLEEP_HABIT', score: 40, bucket: 'LOW', axisIds: ['SLEEP_HABIT'] },
        {
          id: 'SLEEP_ENVIRONMENT',
          score: 40,
          bucket: 'LOW',
          axisIds: ['SCREEN_USAGE', 'SLEEP_ENVIRONMENT'],
        },
        { id: 'DEVICE_USAGE', score: 86, bucket: 'HIGH', axisIds: ['PHONE', 'EARPHONE'] },
        {
          id: 'CLEAN_SPACE',
          score: 50,
          bucket: 'MEDIUM',
          axisIds: ['CLEAN_LEVEL', 'INDOOR_EATING'],
        },
        { id: 'TEMPERATURE', score: 100, bucket: 'HIGH', axisIds: ['TEMPERATURE'] },
        { id: 'RELATIONSHIP_STYLE', score: 82, bucket: 'HIGH', axisIds: ['RELATIONSHIP'] },
      ],
      axes: [
        {
          id: 'SMOKING',
          score: 100,
          bucket: 'HIGH',
          comparison: { targetText: '비흡연', viewerText: '비흡연자가 좋아요' },
        },
        {
          id: 'BEDTIME',
          score: 100,
          bucket: 'HIGH',
          comparison: { targetText: '22~24시', viewerText: '22~24시' },
        },
        {
          id: 'WAKE_TIME',
          score: 75,
          bucket: 'HIGH',
          comparison: { targetText: '7~8시', viewerText: '7~8시' },
        },
        {
          id: 'SLEEP_HABIT',
          score: 40,
          bucket: 'LOW',
          comparison: { targetText: '코골이', viewerText: '보통' },
        },
        {
          id: 'SCREEN_USAGE',
          score: 40,
          bucket: 'LOW',
          comparison: {
            targetText: '잠들 때 화면을 켜는 편이에요',
            viewerText: '잘 때 화면은 안 켰으면 좋겠어요',
          },
        },
        {
          id: 'SLEEP_ENVIRONMENT',
          score: 40,
          bucket: 'LOW',
          comparison: {
            targetText: '스피커로 작게 틀어요',
            viewerText: '잘 때 스피커는 껐으면 좋겠어요',
          },
        },
        {
          id: 'PHONE',
          score: 86,
          bucket: 'HIGH',
          comparison: { targetText: '가끔 해요', viewerText: '가끔·짧게는 괜찮아요' },
        },
        {
          id: 'EARPHONE',
          score: 86,
          bucket: 'HIGH',
          comparison: {
            targetText: '항상 이어폰',
            viewerText: '소리는 이어폰으로 들어줬으면 좋겠어요',
          },
        },
        {
          id: 'CLEAN_LEVEL',
          score: 50,
          bucket: 'MEDIUM',
          comparison: {
            targetText: '눈에 띄면 정리해요',
            viewerText: '눈에 띄면 정리하면 괜찮아요',
          },
        },
        {
          id: 'INDOOR_EATING',
          score: 50,
          bucket: 'MEDIUM',
          comparison: { targetText: '간식은 먹어요', viewerText: '환기·정리 잘하면 OK' },
        },
        {
          id: 'TEMPERATURE',
          score: 100,
          bucket: 'HIGH',
          comparison: { targetText: '보통', viewerText: '보통' },
        },
        {
          id: 'RELATIONSHIP',
          score: 82,
          bucket: 'HIGH',
          comparison: { targetText: '친하게 지내요', viewerText: '친하게 지내요' },
        },
      ],
      hiddenAxisNotices: [{ code: 'DRINKING_EXCLUDED_BY_POLICY' }],
    },
    ...overrides,
  };
}

export function createPublicProfileTombstone(
  overrides: Partial<PublicProfileTombstone> = {},
): PublicProfileTombstone {
  return {
    id: 'user-removed',
    detailState: 'TOMBSTONE',
    relation: { type: 'MATCHED_PARTNER' },
    exposure: {
      listSummaryVisible: false,
      detailViewable: false,
      canViewFull: false,
      scoreVisible: false,
    },
    actions: {
      canBookmark: false,
      canRequestMatch: false,
      canStartChat: false,
      unavailableReasons: ['TARGET_DELETED_OR_DEIDENTIFIED'],
    },
    resultRead: {
      resultReadable: true,
      context: 'PAST_MATCH_HISTORY',
    },
    tombstone: {
      reason: 'DETAIL_CONTEXT_NO_LONGER_VALID',
      displayName: '상대 프로필',
      message: '현재는 상대 프로필 상세 정보를 볼 수 없어요.',
    },
    ...overrides,
  };
}

export function createMatchHistoryResponse(
  overrides: Partial<MatchHistoryResponse> = {},
): MatchHistoryResponse {
  return {
    items: [
      {
        seasonId: 'season-2026-1',
        seasonName: '2026년 1학기',
        viewerParticipantId: 'participant-1',
        viewerDormitoryIdSnapshot: 'dasan',
        finalResult: 'MATCHED_SUCCESS',
        sentRequestCount: 2,
        receivedRequestCount: 1,
        history: [
          {
            id: 'history-entry-1',
            counterpartParticipantId: 'participant-2',
            counterpartNickname: '감자친구',
            stage: 'MATCH',
            result: 'MATCHED_SUCCESS',
            viewerRequested: true,
            matchedAt: '2026-08-03T00:00:00.000Z',
            unmatchedAt: null,
            finalizedAt: '2026-08-06T00:00:00.000Z',
            requestTerminalReason: null,
            activeMatchEndReason: null,
          },
        ],
      },
    ],
    ...overrides,
  };
}
