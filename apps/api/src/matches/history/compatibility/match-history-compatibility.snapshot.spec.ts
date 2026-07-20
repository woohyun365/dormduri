import { describe, expect, it } from 'vitest';
import type { LifestyleData } from '@repo/shared/lifestyle';
import { toCompleteLifestyleColumnData } from '../../../season-participants/lifestyle/lifestyle-persistence.mapper.js';
import type { SeasonHistoryParticipant } from '../materialization/ended-season-history.loader.js';
import {
  MATCH_HISTORY_COMPATIBILITY_SCHEMA_VERSION,
  buildMatchHistoryCompatibilitySnapshot,
  readMatchHistoryCompatibilitySnapshot,
} from './match-history-compatibility.snapshot.js';

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

describe('match history compatibility snapshot', () => {
  it('materialization 시점의 public compatibility와 schema version을 함께 만든다', () => {
    const materialized = buildMatchHistoryCompatibilitySnapshot(
      participant('viewer'),
      participant('counterpart'),
    );

    expect(materialized).not.toBeNull();
    expect(materialized?.compatibilitySchemaVersion).toBe(
      MATCH_HISTORY_COMPATIBILITY_SCHEMA_VERSION,
    );
    expect(typeof materialized?.compatibilitySnapshot.overallScore).toBe('number');
    expect(materialized?.compatibilitySnapshot).toMatchObject({
      hiddenAxisNotices: [{ code: 'DRINKING_EXCLUDED_BY_POLICY' }],
    });
    expect(materialized?.compatibilitySnapshot.dimensions).toHaveLength(8);
  });

  it('지원 버전·contract·저장 점수가 모두 일치할 때만 공개 snapshot을 읽는다', () => {
    const materialized = buildMatchHistoryCompatibilitySnapshot(
      participant('viewer'),
      participant('counterpart'),
    );
    expect(materialized).not.toBeNull();
    if (!materialized) return;

    const input = {
      compatibilitySnapshot: materialized.compatibilitySnapshot,
      compatibilitySchemaVersion: materialized.compatibilitySchemaVersion,
      matchScore: materialized.compatibilitySnapshot.overallScore,
    };

    expect(readMatchHistoryCompatibilitySnapshot(input)).toEqual(
      materialized.compatibilitySnapshot,
    );
    expect(
      readMatchHistoryCompatibilitySnapshot({
        ...input,
        compatibilitySchemaVersion: 'public-profile-compatibility.v999',
      }),
    ).toBeNull();
    expect(
      readMatchHistoryCompatibilitySnapshot({
        ...input,
        compatibilitySnapshot: { overallScore: input.matchScore },
      }),
    ).toBeNull();
    expect(
      readMatchHistoryCompatibilitySnapshot({ ...input, matchScore: input.matchScore - 1 }),
    ).toBeNull();
  });
});

function participant(id: string): SeasonHistoryParticipant {
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
  };
}
