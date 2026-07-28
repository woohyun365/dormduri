import type { LifestyleData } from '@repo/shared/lifestyle';
import type { SeasonProfileDraftRequest } from '@repo/shared/season/participation';
import type { PrismaService } from '../../../src/platform/database/prisma.service.js';
import { toCompleteLifestyleColumnData as mapCompleteLifestyleColumnData } from '../../../src/season-participants/lifestyle/lifestyle-persistence.mapper.js';
import { formatKstDate, subtractDays } from '../../../src/platform/time/kst-date.js';

export const DEFAULT_LIFESTYLE = {
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
  phoneTolerance: 'BRIEF_OK',
  earphoneExpectation: 'MUST',
  sleepEnvPreference: 'NO_SPEAKER',
  screenTolerance: 'LOW_OK',
  indoorEatingTolerance: 'NO_SMELL',
  cleanExpectation: 'STRICT',
  drinkingTolerance: 'LOW_ONLY',
} as const;

export function toCompleteLifestyleColumnData(lifestyle: LifestyleData = DEFAULT_LIFESTYLE) {
  return mapCompleteLifestyleColumnData(lifestyle);
}

export function buildCompleteSeasonProfileDraft(
  intro = '완성된 시즌 프로필',
): SeasonProfileDraftRequest {
  return {
    lifestyle: DEFAULT_LIFESTYLE,
    intro,
    additional: {
      grade: '3',
      mbti: 'INTJ',
    },
  };
}

export function buildIncompleteSeasonProfileDraft(
  intro = '미완성 시즌 프로필',
): SeasonProfileDraftRequest {
  return {
    ...buildCompleteSeasonProfileDraft(intro),
    lifestyle: {
      ...DEFAULT_LIFESTYLE,
      drinkingTolerance: null,
    },
  };
}

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

export async function seedRegisteredAssignedParticipant(
  prisma: PrismaService,
  input: {
    seasonId?: string;
    userId: string;
    participantId: string;
    email: string;
    nickname: string;
  },
) {
  const databaseNow = await prisma.getDatabaseNow();
  const verifiedAt = new Date(databaseNow.getTime() - 24 * 60 * 60 * 1_000);

  await prisma.user.create({
    data: {
      id: input.userId,
      email: input.email,
      emailNormalized: input.email.toLowerCase(),
      passwordHash: 'integration-password-hash',
      gender: 'M',
      campus: 'CHUNCHEON',
      emailVerifiedAt: verifiedAt,
    },
  });

  await prisma.userDisplayIdentity.create({
    data: {
      userId: input.userId,
      nickname: input.nickname,
      nicknameNormalized: input.nickname,
      nicknameChangedAt: null,
    },
  });

  await prisma.userAcademicIdentity.create({
    data: {
      userId: input.userId,
      collegeCode: 'CHUNCHEON_ARTS_ENGINEERING',
      birthYear: 2002,
    },
  });

  await prisma.userAcademicIdentityChangeAllowance.create({
    data: {
      userId: input.userId,
      academicYear: databaseNow.getUTCFullYear(),
      collegeChangeRemaining: 1,
      resetReason: 'INITIAL_CYCLE_ALLOWANCE',
    },
  });

  await prisma.seasonParticipant.create({
    data: {
      id: input.participantId,
      seasonId: input.seasonId ?? 'season-integration',
      userId: input.userId,
      participationIntent: 'REGISTERED',
      registeredAt: verifiedAt,
      dormitoryId: 'dasan',
      dormitorySelectionState: 'ASSIGNED',
      participantStatus: 'ACTIVE',
      campusCodeSnapshot: 'CHUNCHEON',
      genderSnapshot: 'M',
      joinedAt: verifiedAt,
      activatedAt: verifiedAt,
    },
  });

  await prisma.seasonParticipantProfile.create({
    data: {
      participantId: input.participantId,
      nicknameSnapshot: input.nickname,
      nicknameNormalizedSnapshot: input.nickname,
      ...toCompleteLifestyleColumnData(DEFAULT_LIFESTYLE),
      intro: `${input.nickname} 시즌 소개`,
      collegeCode: 'CHUNCHEON_ARTS_ENGINEERING',
      grade: '3',
      mbti: 'INTJ',
      birthYear: 2002,
    },
  });

  await prisma.seasonParticipantProfileHistory.create({
    data: {
      participantId: input.participantId,
      seasonId: input.seasonId ?? 'season-integration',
      nicknameSnapshot: input.nickname,
      nicknameNormalizedSnapshot: input.nickname,
      ...toCompleteLifestyleColumnData(DEFAULT_LIFESTYLE),
      intro: `${input.nickname} 시즌 소개`,
      collegeCode: 'CHUNCHEON_ARTS_ENGINEERING',
      grade: '3',
      mbti: 'INTJ',
      birthYear: 2002,
      registeredAtSnapshot: verifiedAt,
      source: 'SEASON_REGISTRATION',
    },
  });
}

export async function seedActiveMatchFixture(
  prisma: PrismaService,
  input: {
    seasonId?: string;
    activeMatchId: string;
    participantAId: string;
    participantBId: string;
    createdFromRequestId?: string;
    withMatchedThread?: boolean;
  },
) {
  const databaseNow = await prisma.getDatabaseNow();
  const pairKey = [input.participantAId, input.participantBId].sort().join(':');
  const createdFromRequestId = input.createdFromRequestId ?? `${input.activeMatchId}-request`;
  const seasonId = input.seasonId ?? 'season-integration';
  const requestCreatedAt = new Date(databaseNow.getTime() - 2 * 60 * 60 * 1_000);
  const requestAcceptedAt = new Date(databaseNow.getTime() - 90 * 60 * 1_000);
  const activeMatchStartedAt = new Date(databaseNow.getTime() - 60 * 60 * 1_000);

  await prisma.matchRequest.create({
    data: {
      id: createdFromRequestId,
      seasonId,
      pairKey,
      pairMinParticipantId: [input.participantAId, input.participantBId].sort()[0]!,
      pairMaxParticipantId: [input.participantAId, input.participantBId].sort()[1]!,
      requesterParticipantId: input.participantAId,
      receiverParticipantId: input.participantBId,
      status: 'ACCEPTED',
      terminalReason: 'ACCEPTED',
      createdAt: requestCreatedAt,
      expiresAt: new Date(databaseNow.getTime() + 30 * 24 * 60 * 60 * 1_000),
      terminalAt: requestAcceptedAt,
      acceptedAt: requestAcceptedAt,
    },
  });

  await prisma.activeMatch.create({
    data: {
      id: input.activeMatchId,
      seasonId,
      pairKey,
      participantAId: [input.participantAId, input.participantBId].sort()[0]!,
      participantBId: [input.participantAId, input.participantBId].sort()[1]!,
      createdFromRequestId,
      status: 'ACTIVE',
      startedAt: activeMatchStartedAt,
    },
  });

  await prisma.seasonParticipant.updateMany({
    where: {
      id: {
        in: [input.participantAId, input.participantBId],
      },
    },
    data: {
      participantStatus: 'MATCHED',
      matchedAt: activeMatchStartedAt,
    },
  });

  if (input.withMatchedThread) {
    await prisma.conversationThread.create({
      data: {
        id: `${input.activeMatchId}-thread`,
        seasonId,
        pairKey,
        participantAId: [input.participantAId, input.participantBId].sort()[0]!,
        participantBId: [input.participantAId, input.participantBId].sort()[1]!,
        openedByParticipantId: input.participantAId,
        threadKind: 'MATCHED',
        activeMatchId: input.activeMatchId,
        status: 'OPEN',
      },
    });

    await prisma.conversationThreadMember.createMany({
      data: [
        {
          threadId: `${input.activeMatchId}-thread`,
          participantId: input.participantAId,
        },
        {
          threadId: `${input.activeMatchId}-thread`,
          participantId: input.participantBId,
        },
      ],
    });
  }
}

export function authContext(userId: string) {
  return {
    id: userId,
    gender: 'M' as const,
    campus: 'CHUNCHEON' as const,
  };
}
