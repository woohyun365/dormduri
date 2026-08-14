import { describe, expect, it } from 'vitest';
import {
  findActiveMatchRoomSelectionDate,
  isUnmatchWindowOpen,
  toDetailedActiveMatchSummary,
  type ActiveMatchCommandRecord,
} from './active-match.presenter.js';
import type { CurrentSeasonContext } from '../../../seasons/ports/season-context.port.js';
import { toCompleteLifestyleColumnData } from '../../../season-participants/lifestyle/lifestyle-persistence.mapper.js';

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
      user: { deletedAt: null },
      dormitoryId: 'dasan',
      dormitorySelectionState: 'ASSIGNED',
      profile: {
        ...toCompleteLifestyleColumnData(COMPLETE_LIFESTYLE),
        nicknameSnapshot: '나',
        intro: '내 소개',
      },
    },
    participantB: {
      userId: 'user-2',
      user: { deletedAt: null },
      dormitoryId: 'dasan',
      dormitorySelectionState: 'ASSIGNED',
      profile: {
        ...toCompleteLifestyleColumnData(COMPLETE_LIFESTYLE),
        nicknameSnapshot: '감자친구',
        intro: '상대 소개',
      },
    },
    unmatchRequests: [],
    ...overrides,
  };
}

describe('match read model helpers', () => {
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
    expect(summaryForA.counterpartNickname).toBe('감자친구');
    expect(summaryForA.counterpartSummary).toMatchObject({
      relation: { type: 'MATCHED_PARTNER' },
      resultRead: { resultReadable: true, context: 'CURRENT_MATCHED_PARTNER' },
      profileSummary: { nickname: '감자친구', intro: '상대 소개' },
    });
    expect(summaryForA).toMatchObject({
      unmatchProgress: {
        state: 'WAITING_FOR_COUNTERPART',
        progressCount: 1,
        requiredCount: 2,
        canRequest: false,
        canCancel: true,
        disabledReason: null,
        availableUntil: '2026-02-12T14:59:59.999Z',
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
        disabledReason: null,
      },
    });
  });

  it.each([
    ['post-match season', { state: 'SEASON_POST_MATCH' as const }, 'SEASON_NOT_ACTIONABLE'],
    ['room selection cutoff', {}, 'ROOM_SELECTION_CUTOFF'],
  ])(
    '%s에서는 server-owned disabled reason으로 unmatch action을 닫는다',
    (_, overrides, reason) => {
      const now =
        reason === 'ROOM_SELECTION_CUTOFF'
          ? new Date('2026-02-12T15:00:00.000Z')
          : new Date('2026-02-10T12:00:00.000Z');
      const summary = toDetailedActiveMatchSummary(
        makeActiveMatch(),
        'participant-1',
        makeSeasonContext(overrides),
        now,
      );

      expect(summary.unmatchProgress).toMatchObject({
        canRequest: false,
        canCancel: false,
        disabledReason: reason,
      });
    },
  );

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
            user: { deletedAt: null },
            dormitoryId: 'saerom',
            dormitorySelectionState: 'ASSIGNED',
            profile: {
              ...toCompleteLifestyleColumnData(COMPLETE_LIFESTYLE),
              nicknameSnapshot: '감자친구',
              intro: '상대 소개',
            },
          },
        }),
        seasonContext,
        new Date('2026-02-10T12:00:00.000Z'),
      ),
    ).toBe(false);
  });
});
