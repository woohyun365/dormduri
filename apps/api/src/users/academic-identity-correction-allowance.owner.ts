import type { Prisma } from '../generated/prisma/client.js';
import type { Campus } from '../generated/prisma/enums.js';
import { PrismaService } from '../platform/database/prisma.service.js';
import { formatKstDate } from '../seasons/season.utils.js';
import { usersErrors } from './users.errors.js';

type AcademicIdentityAllowanceClient =
  | Pick<PrismaService, 'season' | 'userAcademicIdentityChangeAllowance'>
  | Pick<Prisma.TransactionClient, 'season' | 'userAcademicIdentityChangeAllowance'>;

export interface ConsumeAcademicCollegeAllowanceInput {
  userId: string;
  campus: Campus;
  now: Date;
}

type AllowanceResetReason = 'INITIAL_CYCLE_ALLOWANCE' | 'ACADEMIC_CYCLE_ROLLOVER';

export async function consumeAcademicCollegeChangeAllowanceTx(
  client: AcademicIdentityAllowanceClient,
  input: ConsumeAcademicCollegeAllowanceInput,
) {
  const academicYear = await resolveCurrentOrUpcomingAcademicYear(client, input);
  const allowance = await client.userAcademicIdentityChangeAllowance.findUnique({
    where: { userId: input.userId },
    select: {
      academicYear: true,
      collegeChangeRemaining: true,
    },
  });

  if (!allowance || allowance.academicYear !== academicYear) {
    await rolloverAcademicCollegeAllowance(client, {
      userId: input.userId,
      academicYear,
      resetReason: allowance ? 'ACADEMIC_CYCLE_ROLLOVER' : 'INITIAL_CYCLE_ALLOWANCE',
    });
  } else if (allowance.collegeChangeRemaining <= 0) {
    throw usersErrors.academicCollegeChangeAllowanceExhausted();
  }

  const updateResult = await client.userAcademicIdentityChangeAllowance.updateMany({
    where: {
      userId: input.userId,
      academicYear,
      collegeChangeRemaining: { gt: 0 },
    },
    data: {
      collegeChangeRemaining: { decrement: 1 },
    },
  });

  if (updateResult.count !== 1) {
    throw usersErrors.academicCollegeChangeAllowanceExhausted();
  }
}

async function rolloverAcademicCollegeAllowance(
  client: AcademicIdentityAllowanceClient,
  input: {
    userId: string;
    academicYear: number;
    resetReason: AllowanceResetReason;
  },
) {
  await client.userAcademicIdentityChangeAllowance.upsert({
    where: { userId: input.userId },
    create: {
      userId: input.userId,
      academicYear: input.academicYear,
      collegeChangeRemaining: 1,
      resetReason: input.resetReason,
    },
    update: {
      academicYear: input.academicYear,
      collegeChangeRemaining: 1,
      resetReason: input.resetReason,
    },
  });
}

async function resolveCurrentOrUpcomingAcademicYear(
  client: AcademicIdentityAllowanceClient,
  input: ConsumeAcademicCollegeAllowanceInput,
) {
  const today = new Date(`${formatKstDate(input.now)}T00:00:00.000Z`);
  const currentSeason = await client.season.findFirst({
    where: {
      campusCode: input.campus,
      preparationStartDate: { lte: today },
      seasonEndDate: { gte: today },
    },
    orderBy: [{ seasonEndDate: 'asc' }, { matchingStartDate: 'asc' }, { createdAt: 'asc' }],
    select: {
      academicYear: true,
    },
  });

  if (currentSeason) {
    return currentSeason.academicYear;
  }

  const upcomingSeason = await client.season.findFirst({
    where: {
      campusCode: input.campus,
      preparationStartDate: { gt: today },
    },
    orderBy: [{ preparationStartDate: 'asc' }, { matchingStartDate: 'asc' }, { createdAt: 'asc' }],
    select: {
      academicYear: true,
    },
  });

  if (!upcomingSeason) {
    throw usersErrors.academicCorrectionCycleUnavailable();
  }

  return upcomingSeason.academicYear;
}
