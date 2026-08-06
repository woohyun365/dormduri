import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../../../platform/database/prisma.service.js';
import type { MatchHistoryRepository } from '../persistence/match-history.repository.js';
import { MatchHistoryMaterializationService } from './match-history-materialization.service.js';

describe('MatchHistoryMaterializationService', () => {
  it('종료 시즌을 순서대로 serializable transaction에서 재구축한다', async () => {
    const findMany = vi.fn().mockResolvedValue([{ id: 'season-2' }, { id: 'season-1' }]);
    const tx = { id: 'tx' };
    const runSerializableTransaction = vi.fn((callback: (client: unknown) => unknown) =>
      Promise.resolve(callback(tx)),
    );
    const rebuildSeasonHistoryEntries = vi.fn().mockResolvedValueOnce(3).mockResolvedValueOnce(2);
    const prisma = {
      season: { findMany },
      runSerializableTransaction,
    } as unknown as PrismaService;
    const repository = {
      rebuildSeasonHistoryEntries,
    } as unknown as MatchHistoryRepository;
    const service = new MatchHistoryMaterializationService(prisma, repository);
    const now = new Date('2026-07-01T00:00:00.000Z');

    await expect(service.materializeEndedSeasonHistory(now, 'user-1')).resolves.toEqual({
      processedSeasons: 2,
      rebuiltEntries: 5,
    });

    expect(runSerializableTransaction).toHaveBeenCalledTimes(2);
    expect(rebuildSeasonHistoryEntries).toHaveBeenNthCalledWith(1, tx, 'season-2', now);
    expect(rebuildSeasonHistoryEntries).toHaveBeenNthCalledWith(2, tx, 'season-1', now);
  });

  it('과거 참여 시즌은 현재 intent가 아니라 등록 완료 시점으로 조회한다', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const prisma = {
      season: { findMany },
      runSerializableTransaction: vi.fn(),
    } as unknown as PrismaService;
    const service = new MatchHistoryMaterializationService(prisma, {
      rebuildSeasonHistoryEntries: vi.fn(),
    });

    await service.materializeEndedSeasonHistory(new Date('2026-07-01T00:00:00.000Z'), 'user-1');

    const query = findMany.mock.calls[0]?.[0] as {
      where: { participants?: { some: Record<string, unknown> } };
    };
    expect(query.where.participants?.some).toEqual({
      userId: 'user-1',
      registeredAt: { not: null },
    });
    expect(query.where.participants?.some).not.toHaveProperty('participationIntent');
  });

  it('지정 시즌 재구축 결과가 없으면 처리 시즌 수도 0으로 반환한다', async () => {
    const runSerializableTransaction = vi.fn((callback: (client: unknown) => unknown) =>
      Promise.resolve(callback({ id: 'tx' })),
    );
    const service = new MatchHistoryMaterializationService(
      { runSerializableTransaction } as unknown as PrismaService,
      {
        rebuildSeasonHistoryEntries: vi.fn().mockResolvedValue(0),
      },
    );

    await expect(
      service.materializeSeasonHistoryById('season-1', new Date('2026-07-01T00:00:00.000Z')),
    ).resolves.toEqual({ processedSeasons: 0, rebuiltEntries: 0 });
  });
});
