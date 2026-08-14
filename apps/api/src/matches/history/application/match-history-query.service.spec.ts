import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../../../platform/database/prisma.service.js';
import { DEIDENTIFIED_USER_DISPLAY_NAME } from '../../../privacy/deidentification/deidentified-display.policy.js';
import { MatchHistoryQueryService } from './match-history-query.service.js';

describe('MatchHistoryQueryService', () => {
  it('과거 참여 시즌은 현재 intent가 아니라 등록 완료 시점으로 조회한다', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const service = new MatchHistoryQueryService({
      seasonParticipant: { findMany },
    } as unknown as PrismaService);

    await expect(
      service.listPastSeasonHistoryForUser('user-1', new Date('2026-07-01T00:00:00.000Z')),
    ).resolves.toEqual({ items: [] });

    const query = findMany.mock.calls[0]?.[0] as { where: Record<string, unknown> };
    expect(query.where).toMatchObject({
      userId: 'user-1',
      registeredAt: { not: null },
    });
    expect(query.where).not.toHaveProperty('participationIntent');
  });

  it('탈퇴한 상대는 저장된 활동을 유지하되 비식별 표시명으로 제시한다', async () => {
    const participantFindMany = vi
      .fn()
      .mockResolvedValueOnce([
        {
          id: 'viewer-participant',
          seasonId: 'season-1',
          dormitoryId: 'dormitory-1',
          season: { id: 'season-1', name: '2026년 1학기' },
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'counterpart-participant',
          userId: 'counterpart-user',
          user: { deletedAt: new Date('2026-06-01T00:00:00.000Z') },
        },
      ]);
    const historyFindMany = vi.fn().mockResolvedValue([
      {
        id: 'history-1',
        viewerParticipantId: 'viewer-participant',
        counterpartParticipantId: 'counterpart-participant',
        counterpartNicknameSnapshot: '기존닉네임',
        entryType: 'MATCH',
        entryResult: 'MATCHED_SUCCESS',
        viewerRequested: true,
        matchedAt: new Date('2026-04-01T00:00:00.000Z'),
        unmatchedAt: null,
        finalizedAt: new Date('2026-06-01T00:00:00.000Z'),
        requestTerminalReason: null,
        systemCancellationCause: null,
        systemCancellationGroupId: null,
        activeMatchEndReason: 'SEASON_ENDED',
      },
    ]);
    const service = new MatchHistoryQueryService({
      seasonParticipant: { findMany: participantFindMany },
      seasonMatchHistoryEntry: { findMany: historyFindMany },
    } as unknown as PrismaService);

    const result = await service.listPastSeasonHistoryForUser(
      'user-1',
      new Date('2026-07-01T00:00:00.000Z'),
    );

    expect(result.items[0]?.history[0]).toMatchObject({
      counterpartNickname: DEIDENTIFIED_USER_DISPLAY_NAME,
      result: 'MATCHED_SUCCESS',
    });
  });
});
