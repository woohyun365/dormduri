import {
  findActiveMatchRoomSelectionDate,
  isUnmatchWindowOpen,
  toDetailedActiveMatchSummary,
  toMatchRequestSummary,
  type ActiveMatchCommandRecord,
  type MatchRequestRecord,
} from './match-read-model.js';
import type { CurrentSeasonContext } from '../seasons/season.types.js';
import { toCompleteLifestyleColumnData } from '../common/lifestyle/lifestyle.persistence.js';

const COMPLETE_LIFESTYLE = {
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
  cleanLevel: 'WEEKLY_3_UP',
  drinkingFrequency: 'NONE',
  relationshipStyle: 'CLOSE',
  temperatureSensitivity: 'NORMAL',
  smokingTolerance: 'NO_ONLY',
  indoorEatingTolerance: 'NO_SMELL',
  phoneTolerance: 'BRIEF_OK',
  earphoneExpectation: 'MUST',
  cleanExpectation: 'STRICT',
  drinkingTolerance: 'LOW_ONLY',
  sleepEnvPreference: 'NO_SPEAKER',
  screenTolerance: 'LOW_OK',
} as const;

function makeSeasonContext(overrides: Partial<CurrentSeasonContext> = {}): CurrentSeasonContext {
  return {
    campusCode: 'CHUNCHEON',
    season: {
      id: 'season-1',
      name: '2026-1',
      preparationStartDate: '2026-02-01',
      matchingStartDate: '2026-02-05',
      seasonEndDate: '2026-02-28',
    },
    operatedDormitories: [
      {
        dormitoryId: 'dasan',
        isOperated: true,
        roomSelectionDate: '2026-02-12',
      },
    ],
    state: 'SEASON_MATCHING',
    isActive: true,
    isOpen: false,
    isMatching: true,
    isPostMatch: false,
    daysUntilMatchingEnd: 2,
    daysUntilSeasonEnd: 18,
    schedule: {
      preparationStart: '2026-02-01',
      matchingStart: '2026-02-05',
      matchingEnd: '2026-02-12',
      seasonEnd: '2026-02-28',
    },
    override: {
      active: false,
      state: null,
      reason: null,
      startedAt: null,
      endsAt: null,
    },
    ...overrides,
  };
}

function makeRequestParticipant(input: {
  userId: string;
  nicknameSnapshot?: string;
  intro?: string;
  profileMissing?: boolean;
}): MatchRequestRecord['requesterParticipant'] {
  return {
    userId: input.userId,
    registeredAt: new Date('2026-02-01T00:00:00.000Z'),
    dormitoryId: 'dasan',
    dormitorySelectionState: 'ASSIGNED',
    participationIntent: 'REGISTERED',
    declinedAt: null,
    participantStatus: 'ACTIVE',
    withdrawnAt: null,
    hiddenByAdminAt: null,
    deactivatedAt: null,
    user: { deletedAt: null },
    profile: input.profileMissing
      ? null
      : {
          nicknameSnapshot: input.nicknameSnapshot ?? input.userId,
          intro: input.intro ?? '',
          ...toCompleteLifestyleColumnData(COMPLETE_LIFESTYLE),
        },
  };
}

function makeActiveMatch(
  overrides: Partial<ActiveMatchCommandRecord> = {},
): ActiveMatchCommandRecord {
  return {
    id: 'active-1',
    seasonId: 'season-1',
    participantAId: 'participant-1',
    participantBId: 'participant-2',
    status: 'ACTIVE',
    startedAt: new Date('2026-02-10T03:00:00.000Z'),
    endedAt: null,
    endReason: null,
    createdFromRequestId: 'request-1',
    participantA: {
      userId: 'user-1',
      dormitoryId: 'dasan',
      dormitorySelectionState: 'ASSIGNED',
      profile: toCompleteLifestyleColumnData(COMPLETE_LIFESTYLE),
    },
    participantB: {
      userId: 'user-2',
      dormitoryId: 'dasan',
      dormitorySelectionState: 'ASSIGNED',
      profile: toCompleteLifestyleColumnData(COMPLETE_LIFESTYLE),
    },
    unmatchRequests: [],
    ...overrides,
  };
}

describe('match read model helpers', () => {
  it('request summary는 viewer 기준으로 SENT/RECEIVED counterpart를 정렬한다', () => {
    const request: MatchRequestRecord = {
      id: 'request-1',
      seasonId: 'season-1',
      requesterParticipantId: 'participant-1',
      receiverParticipantId: 'participant-2',
      status: 'PENDING',
      note: '안녕하세요',
      createdAt: new Date('2026-02-10T03:00:00.000Z'),
      expiresAt: new Date('2026-02-11T14:59:59.000Z'),
      terminalAt: null,
      acceptedAt: null,
      terminalReason: null,
      requesterParticipant: makeRequestParticipant({
        userId: 'user-1',
        nicknameSnapshot: '요청자',
        intro: '요청자 소개',
      }),
      receiverParticipant: makeRequestParticipant({
        userId: 'user-2',
        nicknameSnapshot: '수신자',
        intro: '수신자 소개',
      }),
    };

    const sentSummary = toMatchRequestSummary(request, 'participant-1');
    expect(sentSummary).toMatchObject({
      direction: 'SENT',
      counterpartUserId: 'user-2',
      counterpartParticipantId: 'participant-2',
    });
    expect(sentSummary.counterpartSummary.id).toBe('user-2');
    expect(sentSummary.counterpartSummary.profileSummary.nickname).toBe('수신자');

    const receivedSummary = toMatchRequestSummary(request, 'participant-2');
    expect(receivedSummary).toMatchObject({
      direction: 'RECEIVED',
      counterpartUserId: 'user-1',
      counterpartParticipantId: 'participant-1',
    });
    expect(receivedSummary.counterpartSummary.id).toBe('user-1');
    expect(receivedSummary.counterpartSummary.profileSummary.nickname).toBe('요청자');
  });

  it('request summary는 profile missing을 삭제 사용자 tombstone label로 위장하지 않는다', () => {
    const request: MatchRequestRecord = {
      id: 'request-1',
      seasonId: 'season-1',
      requesterParticipantId: 'participant-1',
      receiverParticipantId: 'participant-2',
      status: 'PENDING',
      note: null,
      createdAt: new Date('2026-02-10T03:00:00.000Z'),
      expiresAt: new Date('2026-02-11T14:59:59.000Z'),
      terminalAt: null,
      acceptedAt: null,
      terminalReason: null,
      requesterParticipant: makeRequestParticipant({ userId: 'user-1', profileMissing: true }),
      receiverParticipant: makeRequestParticipant({ userId: 'user-2', profileMissing: true }),
    };

    const summary = toMatchRequestSummary(request, 'participant-2');

    expect(summary.counterpartSummary.profileSummary.nickname).toBe('프로필 확인 불가');
    expect(summary.counterpartSummary.profileSummary.nickname).not.toBe('탈퇴한 사용자');
  });

  it('detailed active match summary는 viewer/counterpart unmatch progress를 계산한다', () => {
    const activeMatch = makeActiveMatch({
      unmatchRequests: [
        {
          id: 'unmatch-1',
          participantId: 'participant-1',
          status: 'PENDING',
          requestedAt: new Date('2026-02-10T03:00:00.000Z'),
          terminalAt: null,
        },
      ],
    });

    const summaryForA = toDetailedActiveMatchSummary(
      activeMatch,
      'participant-1',
      makeSeasonContext(),
      new Date('2026-02-10T12:00:00.000Z'),
    );
    expect(summaryForA.matchScore).toEqual(expect.any(Number));
    expect(summaryForA).toMatchObject({
      unmatchProgress: {
        state: 'WAITING_FOR_COUNTERPART',
        progressCount: 1,
        requiredCount: 2,
        canRequest: false,
        canCancel: true,
      },
    });

    const summaryForB = toDetailedActiveMatchSummary(
      activeMatch,
      'participant-2',
      makeSeasonContext(),
      new Date('2026-02-10T12:00:00.000Z'),
    );
    expect(summaryForB.matchScore).toEqual(expect.any(Number));
    expect(summaryForB).toMatchObject({
      unmatchProgress: {
        state: 'WAITING_FOR_ME',
        progressCount: 1,
        requiredCount: 2,
        canRequest: true,
        canCancel: false,
      },
    });
  });

  it('same dormitory + season matching + roomSelectionDate 전까지만 unmatch window를 연다', () => {
    const seasonContext = makeSeasonContext();
    const activeMatch = makeActiveMatch();

    expect(findActiveMatchRoomSelectionDate(activeMatch, seasonContext)).toBe('2026-02-12');
    expect(
      isUnmatchWindowOpen(activeMatch, seasonContext, new Date('2026-02-12T14:59:59.000Z')),
    ).toBe(true);
    expect(
      isUnmatchWindowOpen(activeMatch, seasonContext, new Date('2026-02-13T00:00:00.000Z')),
    ).toBe(false);
    expect(
      isUnmatchWindowOpen(
        makeActiveMatch({
          participantB: {
            userId: 'user-2',
            dormitoryId: 'saerom',
            dormitorySelectionState: 'ASSIGNED',
            profile: toCompleteLifestyleColumnData(COMPLETE_LIFESTYLE),
          },
        }),
        seasonContext,
        new Date('2026-02-10T12:00:00.000Z'),
      ),
    ).toBe(false);
  });
});
