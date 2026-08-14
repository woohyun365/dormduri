import type { PrismaService } from '../../../../src/platform/database/prisma.service.js';
import { formatKstDate, subtractDays } from '../../../../src/platform/time/kst-date.js';

export async function seedBaseSeasonFixtures(prisma: PrismaService) {
  const databaseNow = await prisma.getDatabaseNow();
  const today = formatKstDate(databaseNow);

  await prisma.campusMaster.create({
    data: {
      code: 'CHUNCHEON',
      nameKo: '춘천캠퍼스',
      isOperated: true,
      sortOrder: 1,
    },
  });

  await prisma.dormitory.create({
    data: {
      id: 'dasan',
      campusCode: 'CHUNCHEON',
      nameKo: '다산관',
      roomType: 2,
      genderPolicy: 'M',
      sortOrder: 1,
    },
  });

  await prisma.collegeMaster.create({
    data: {
      code: 'CHUNCHEON_ARTS_ENGINEERING',
      campusCode: 'CHUNCHEON',
      nameKo: '문화예술공과대학',
      sortOrder: 1,
    },
  });

  await prisma.season.create({
    data: {
      id: 'season-integration',
      campusCode: 'CHUNCHEON',
      academicYear: databaseNow.getUTCFullYear(),
      semester: 1,
      name: `${databaseNow.getUTCFullYear()}-1`,
      preparationStartDate: new Date(`${subtractDays(today, 30)}T00:00:00.000Z`),
      matchingStartDate: new Date(`${subtractDays(today, 5)}T00:00:00.000Z`),
      seasonEndDate: new Date(`${subtractDays(today, -60)}T00:00:00.000Z`),
    },
  });

  await prisma.seasonDormitoryOperation.create({
    data: {
      seasonId: 'season-integration',
      dormitoryId: 'dasan',
      isOperated: true,
      roomSelectionDate: new Date(`${subtractDays(today, -30)}T00:00:00.000Z`),
    },
  });
}

export async function seedOperatedDormitoryFixture(
  prisma: PrismaService,
  input: {
    id: string;
    nameKo: string;
    genderPolicy?: 'M' | 'F' | 'BOTH';
    roomSelectionDate?: Date;
    sortOrder?: number;
  },
) {
  const databaseNow = await prisma.getDatabaseNow();
  const today = formatKstDate(databaseNow);

  await prisma.dormitory.create({
    data: {
      id: input.id,
      campusCode: 'CHUNCHEON',
      nameKo: input.nameKo,
      roomType: 2,
      genderPolicy: input.genderPolicy ?? 'M',
      sortOrder: input.sortOrder ?? 2,
    },
  });

  await prisma.seasonDormitoryOperation.create({
    data: {
      seasonId: 'season-integration',
      dormitoryId: input.id,
      isOperated: true,
      roomSelectionDate:
        input.roomSelectionDate ?? new Date(`${subtractDays(today, -30)}T00:00:00.000Z`),
    },
  });
}

export async function disableSeasonDormitoryOperationFixture(
  prisma: PrismaService,
  input: {
    seasonId?: string;
    dormitoryId?: string;
  } = {},
) {
  await prisma.seasonDormitoryOperation.update({
    where: {
      seasonId_dormitoryId: {
        seasonId: input.seasonId ?? 'season-integration',
        dormitoryId: input.dormitoryId ?? 'dasan',
      },
    },
    data: { isOperated: false },
  });
}

export async function moveSeasonDormitorySelectionCutoffToPastFixture(
  prisma: PrismaService,
  input: {
    seasonId?: string;
    dormitoryId?: string;
  } = {},
) {
  const databaseNow = await prisma.getDatabaseNow();
  await prisma.seasonDormitoryOperation.update({
    where: {
      seasonId_dormitoryId: {
        seasonId: input.seasonId ?? 'season-integration',
        dormitoryId: input.dormitoryId ?? 'dasan',
      },
    },
    data: {
      roomSelectionDate: new Date(databaseNow.getTime() - 24 * 60 * 60 * 1_000),
    },
  });
}
