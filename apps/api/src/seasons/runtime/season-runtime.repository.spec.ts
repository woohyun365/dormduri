import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getCurrentTimestamp } from '../../generated/prisma/sql.js';
import { SeasonRuntimeRepository, seasonRuntimeSelect } from './season-runtime.repository.js';

describe('SeasonRuntimeRepository', () => {
  const prisma = {
    campusMaster: {
      findUnique: vi.fn(),
    },
    season: {
      findMany: vi.fn(),
    },
    $queryRawTyped: vi.fn(),
  };

  const repository = new SeasonRuntimeRepository(prisma as never);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses provided reference time without DB timestamp query', async () => {
    const now = new Date('2026-02-10T03:00:00.000Z');

    await expect(repository.resolveReferenceTime(now)).resolves.toBe(now);
    expect(prisma.$queryRawTyped).not.toHaveBeenCalled();
  });

  it('falls back to DB current timestamp when reference time is not provided', async () => {
    const now = new Date('2026-02-10T03:00:00.000Z');
    prisma.$queryRawTyped.mockResolvedValue([{ now }]);

    await expect(repository.resolveReferenceTime()).resolves.toBe(now);
    expect(prisma.$queryRawTyped).toHaveBeenCalledWith(getCurrentTimestamp());
  });

  it('reads operated campus metadata through a narrow select', async () => {
    prisma.campusMaster.findUnique.mockResolvedValue({ isOperated: true });

    await expect(repository.isCampusOperated('CHUNCHEON')).resolves.toBe(true);
    expect(prisma.campusMaster.findUnique).toHaveBeenCalledWith({
      where: { code: 'CHUNCHEON' },
      select: { isOperated: true },
    });
  });

  it('reads season runtime rows with deterministic order and current mapper select', async () => {
    prisma.season.findMany.mockResolvedValue([]);

    await repository.findSeasonRuntimeRows('CHUNCHEON');

    expect(seasonRuntimeSelect.dormitoryOperations.where).toEqual({
      dormitory: {
        isActive: true,
        matchingSupported: true,
      },
    });
    expect(prisma.season.findMany).toHaveBeenCalledWith({
      where: { campusCode: 'CHUNCHEON' },
      orderBy: [{ seasonEndDate: 'asc' }, { matchingStartDate: 'asc' }, { createdAt: 'asc' }],
      select: seasonRuntimeSelect,
    });
  });
});
