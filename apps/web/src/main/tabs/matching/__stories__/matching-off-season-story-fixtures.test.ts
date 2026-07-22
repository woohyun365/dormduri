import { describe, expect, it } from 'vitest';
import { matchHistoryResponseSchema } from '@repo/shared/match/contract';
import { publicProfileSchema } from '@repo/shared/profile/contract';
import {
  OFF_SEASON_MATCHED_ENTRY_ID,
  OFF_SEASON_TOMBSTONE_ENTRY_ID,
  offSeasonConversationStats,
  offSeasonHistory,
  offSeasonHistoryDetailClient,
  offSeasonHistorySummary,
} from './matching-off-season-story-fixtures';

describe('matching off-season Storybook fixtures', () => {
  it('종료 요청·매칭 완료·매칭 후 해제 결과를 contract에 맞게 제공한다', () => {
    expect(() => matchHistoryResponseSchema.parse(offSeasonHistory)).not.toThrow();

    const results = offSeasonHistory.items.flatMap((season) =>
      season.history.map((entry) => entry.result),
    );
    expect(results).toEqual(
      expect.arrayContaining([
        'REQUEST_REJECTED',
        'REQUEST_CANCELLED',
        'REQUEST_EXPIRED',
        'MATCHED_SUCCESS',
        'UNMATCHED_AFTER_SUCCESS',
      ]),
    );
    expect(offSeasonHistory.items.map((season) => season.finalResult)).toEqual([
      'MATCHED_SUCCESS',
      'UNMATCHED_AFTER_SUCCESS',
      'MATCHED_SUCCESS',
      'NO_MATCH',
    ]);
    expect(offSeasonHistorySummary).toEqual({ seasons: 4, matchedCount: 2, unmatchedCount: 2 });
    expect(offSeasonHistory.items[0]).toMatchObject({ receivedRequestCount: 3 });
    expect(
      offSeasonHistory.items[0]?.history.filter(
        (entry) => entry.requestTerminalReason === 'CANCELLED_BY_SYSTEM_ACTIVE_MATCH',
      ),
    ).toHaveLength(4);
    expect(
      offSeasonHistory.items[0]?.history
        .filter((entry) => entry.systemCancellationCause === 'VIEWER_MATCHED')
        .map((entry) => entry.stage),
    ).toEqual(['RECEIVED_REQUEST', 'RECEIVED_REQUEST', 'SENT_REQUEST', 'SENT_REQUEST']);
    expect(
      offSeasonHistory.items[1]?.history.filter(
        (entry) => entry.systemCancellationCause === 'VIEWER_MATCHED',
      ),
    ).toHaveLength(1);
    expect(offSeasonConversationStats.past).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ seasonId: 'season-2026-1', conversationUserCount: 4 }),
      ]),
    );
  });

  it('시즌별 요청 상대 수를 history의 중복 제거 결과와 맞춘다', () => {
    for (const season of offSeasonHistory.items) {
      const sentCounterparts = new Set(
        season.history
          .filter((entry) => entry.viewerRequested)
          .map((entry) => entry.counterpartParticipantId),
      );
      const receivedCounterparts = new Set(
        season.history
          .filter((entry) => !entry.viewerRequested)
          .map((entry) => entry.counterpartParticipantId),
      );

      expect(season.sentRequestCount, season.seasonName).toBe(sentCounterparts.size);
      expect(season.receivedRequestCount, season.seasonName).toBe(receivedCounterparts.size);
    }
  });

  it('MATCHED_SUCCESS 상세를 저장된 점수 snapshot과 tombstone으로 분기한다', async () => {
    const full = await offSeasonHistoryDetailClient.getHistoryCounterpartProfile(
      OFF_SEASON_MATCHED_ENTRY_ID,
    );
    const tombstone = await offSeasonHistoryDetailClient.getHistoryCounterpartProfile(
      OFF_SEASON_TOMBSTONE_ENTRY_ID,
    );

    expect(() => publicProfileSchema.parse(full)).not.toThrow();
    expect(() => publicProfileSchema.parse(tombstone)).not.toThrow();
    expect(full).toMatchObject({
      detailState: 'FULL',
      matchScore: 92,
      resultRead: { context: 'PAST_MATCH_HISTORY' },
    });
    expect(tombstone).toMatchObject({
      detailState: 'TOMBSTONE',
      actions: { unavailableReasons: ['TARGET_DELETED_OR_DEIDENTIFIED'] },
      resultRead: { context: 'PAST_MATCH_HISTORY' },
    });
  });
});
