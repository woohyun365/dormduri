import type { LifestyleData } from '@repo/shared/lifestyle';
import { describe, expect, it } from 'vitest';
import { toCompleteLifestyleColumnData } from '../../../season-participants/lifestyle/lifestyle-persistence.mapper.js';
import type { SeasonHistoryParticipant } from './ended-season-history.loader.js';
import {
  buildHistoryScoreSnapshot,
  toHistorySnapshotColumns,
} from './match-history-score-snapshot.builder.js';

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

describe('match history score snapshot builder', () => {
  it('매칭 소유 생활패턴으로 점수와 저장 column을 만든다', () => {
    const snapshot = buildHistoryScoreSnapshot(participant('viewer'), participant('counterpart'));
    const columns = toHistorySnapshotColumns(snapshot);

    expect(typeof snapshot.matchScore).toBe('number');
    expect(snapshot.viewerConditionSnapshot?.smokingTolerance).toBe('NO_ONLY');
    expect(snapshot.counterpartLifestyleSnapshot?.smokingBehavior).toBe('NO');
    expect(columns).toMatchObject({
      viewerSmokingToleranceSnapshot: 'NO_ONLY',
      counterpartSmokingBehaviorSnapshot: 'NO',
    });
    expect(snapshot).not.toHaveProperty('hadConversation');
    expect(columns).not.toHaveProperty('lastMessageAt');
  });

  it('프로필이 없으면 점수와 생활패턴 snapshot을 null로 둔다', () => {
    const snapshot = buildHistoryScoreSnapshot(
      participant('viewer', { profile: null }),
      participant('counterpart', { profile: null }),
    );

    expect(snapshot).toEqual({
      matchScore: null,
      viewerConditionSnapshot: null,
      viewerSelfSnapshot: null,
      counterpartLifestyleSnapshot: null,
    });
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
