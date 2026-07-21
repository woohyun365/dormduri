import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../platform/database/prisma.service.js', () => ({
  PrismaService: class PrismaService {},
}));
import { HomeDashboardNextSeasonQuery } from './home-dashboard-next-season.query.js';

const now = new Date('2026-06-25T03:00:00.000Z');

function createPrismaMock() {
  return {
    season: {
      findMany: vi.fn(),
    },
  };
}

describe('HomeDashboardNextSeasonQuery', () => {
  const prisma = createPrismaMock();
  const query = new HomeDashboardNextSeasonQuery(prisma as never);

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.season.findMany.mockResolvedValue([]);
  });

  it('비운영 campus는 future season row를 사용자 preview로 노출하지 않는다', async () => {
    await expect(
      query.getNextSeasonPreview({
        campusCode: 'SAMCHEOK',
        now,
        campusOperated: false,
      }),
    ).resolves.toBeNull();

    expect(prisma.season.findMany).not.toHaveBeenCalled();
  });

  it('current season으로 승격되지 않은 다음 future season만 preview로 반환한다', async () => {
    prisma.season.findMany.mockResolvedValue([
      makeSeasonRow({ id: 'current-season', preparation: '2026-03-01' }),
      makeSeasonRow({
        id: 'next-season',
        name: '2026년 2학기',
        preparation: '2026-08-20',
        matching: '2026-09-01',
        end: '2026-12-20',
      }),
    ]);

    const preview = await query.getNextSeasonPreview({
      campusCode: 'CHUNCHEON',
      now,
      campusOperated: true,
    });

    expect(preview).toEqual({
      id: 'next-season',
      name: '2026년 2학기',
      preparationStartDate: '2026-08-20',
      matchingStartDate: '2026-09-01',
      seasonEndDate: '2026-12-20',
      visibleToUser: true,
      operatedDormitories: [
        {
          dormitoryId: 'dasan',
          dormitory: {
            id: 'dasan',
            name: '다산관',
            roomType: 2,
            genderPolicy: 'M',
          },
          isOperated: true,
          roomSelectionDate: '2026-08-20',
        },
      ],
    });
    expect(prisma.season.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { campusCode: 'CHUNCHEON' },
      }),
    );
  });
});

function makeSeasonRow({
  id,
  name = '시즌',
  preparation,
  matching = '2026-04-01',
  end = '2026-06-30',
}: {
  id: string;
  name?: string;
  preparation: string;
  matching?: string;
  end?: string;
}) {
  return {
    id,
    name,
    preparationStartDate: new Date(`${preparation}T00:00:00.000Z`),
    matchingStartDate: new Date(`${matching}T00:00:00.000Z`),
    seasonEndDate: new Date(`${end}T00:00:00.000Z`),
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    dormitoryOperations: [
      {
        dormitoryId: 'dasan',
        dormitory: {
          id: 'dasan',
          nameKo: '다산관',
          roomType: 2,
          genderPolicy: 'M',
        },
        isOperated: true,
        roomSelectionDate: new Date(`${preparation}T00:00:00.000Z`),
      },
    ],
  };
}
