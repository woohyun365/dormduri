import type { LifestyleData } from '@repo/shared/lifestyle';
import { describe, expect, it } from 'vitest';
import { toCompleteLifestyleColumnData } from '../../../season-participants/lifestyle/lifestyle-persistence.mapper.js';
import type {
  SeasonHistoryParticipant,
  SeasonHistorySource,
} from './ended-season-history.loader.js';
import {
  buildHistoryRows,
  buildMatchHistoryRow,
  buildRequestHistoryRow,
} from './match-history-row.builder.js';

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
} as const satisfies LifestyleData;

describe('match history row builder', () => {
  it('요청 row에는 공개 compatibility를 저장하지 않는다', () => {
    const row = buildRequestHistoryRow({
      id: 'request:request-1:viewer:viewer',
      seasonId: 'season-1',
      viewerParticipant: participant('viewer'),
      counterpartParticipant: participant('counterpart'),
      pairKey: 'counterpart:viewer',
      viewerRequested: true,
      finalizedAt: new Date('2026-04-03T00:00:00.000Z'),
      requestTerminalReason: 'REJECTED_BY_RECEIVER',
      systemCancellationCause: null,
      systemCancellationGroupId: null,
      entryResult: 'REQUEST_REJECTED',
      sourceRequestId: 'request-1',
    });

    expect(row).toMatchObject({
      entryType: 'REQUEST',
      entryResult: 'REQUEST_REJECTED',
      counterpartNicknameSnapshot: 'counterpart',
    });
    expect(row).not.toHaveProperty('compatibilitySnapshot');
    expect(row).not.toHaveProperty('compatibilitySchemaVersion');
    expect(row).not.toHaveProperty('hadConversation');
  });

  it('최종 match row에만 당시 공개 compatibility와 version을 저장한다', () => {
    const row = buildMatchHistoryRow({
      id: 'match:match-1:viewer:viewer',
      seasonId: 'season-1',
      pairKey: 'counterpart:viewer',
      viewerParticipant: participant('viewer'),
      counterpartParticipant: participant('counterpart'),
      viewerRequested: true,
      createdFromRequestId: 'request-1',
      sourceActiveMatchId: 'match-1',
      entryResult: 'MATCHED_SUCCESS',
      activeMatchEndReason: 'SEASON_ENDED',
      matchedAt: new Date('2026-04-04T00:00:00.000Z'),
      unmatchedAt: null,
      finalizedAt: new Date('2026-06-30T00:00:00.000Z'),
    });

    expect(row).toMatchObject({
      entryType: 'MATCH',
      entryResult: 'MATCHED_SUCCESS',
    });
    expect(typeof row.compatibilitySchemaVersion).toBe('string');
    expect(row.compatibilitySnapshot).not.toBeNull();
    expect(row).not.toHaveProperty('threadClosedReason');
    expect(row).not.toHaveProperty('lastMessageAt');
  });

  it('철회된 현재 intent라도 등록 완료 이력이 있으면 요청 history를 만든다', () => {
    const viewer = participant('viewer', { participationIntent: 'DECLINED' });
    const counterpart = participant('counterpart');
    const source: SeasonHistorySource = {
      id: 'season-1',
      name: '2026년 1학기',
      seasonEndDate: new Date('2026-06-30T00:00:00.000Z'),
      participants: [viewer, counterpart],
      matchRequests: [
        {
          id: 'request-1',
          requesterParticipantId: viewer.id,
          receiverParticipantId: counterpart.id,
          status: 'REJECTED',
          terminalReason: 'REJECTED_BY_RECEIVER',
          terminalAt: new Date('2026-04-03T00:00:00.000Z'),
          createdAt: new Date('2026-04-01T00:00:00.000Z'),
          systemCancellationActiveMatchId: null,
          systemCancellationActiveMatch: null,
        },
      ],
      activeMatches: [],
    };

    expect(buildHistoryRows(source, new Date('2026-07-01T00:00:00.000Z'))).toHaveLength(2);
  });
});

function participant(
  id: string,
  overrides: Partial<SeasonHistoryParticipant> = {},
): SeasonHistoryParticipant {
  return {
    id,
    userId: `user-${id}`,
    participationIntent: 'REGISTERED',
    registeredAt: new Date('2026-01-01T00:00:00.000Z'),
    declinedAt: null,
    participantStatus: 'MATCHED',
    dormitoryId: 'dormitory-1',
    dormitorySelectionState: 'ASSIGNED',
    hiddenByAdminAt: null,
    deactivatedAt: null,
    profile: {
      participantId: id,
      nicknameSnapshot: id,
      ...toCompleteLifestyleColumnData(COMPLETE_LIFESTYLE),
    },
    ...overrides,
  };
}
