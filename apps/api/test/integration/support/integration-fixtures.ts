import type { PrismaService } from '../../../src/common/prisma/prisma.service.js';

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
  smokingTolerance: null,
  phoneTolerance: null,
  earphoneExpectation: null,
  sleepEnvPreference: null,
  screenTolerance: null,
  indoorEatingTolerance: null,
  cleanExpectation: null,
  drinkingTolerance: 'LOW_ONLY',
} as const;

export async function seedBaseSeasonFixtures(prisma: PrismaService) {
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

  await prisma.season.create({
    data: {
      id: 'season-integration',
      campusCode: 'CHUNCHEON',
      academicYear: 2026,
      semester: 1,
      name: '2026-1',
      preparationStartDate: new Date('2026-01-01'),
      matchingStartDate: new Date('2026-02-01'),
      seasonEndDate: new Date('2026-12-31'),
    },
  });

  await prisma.seasonDormitoryOperation.create({
    data: {
      seasonId: 'season-integration',
      dormitoryId: 'dasan',
      isOperated: true,
      roomSelectionDate: new Date('2026-12-31'),
    },
  });
}

export async function seedRegisteredAssignedParticipant(
  prisma: PrismaService,
  input: {
    userId: string;
    participantId: string;
    email: string;
    nickname: string;
  },
) {
  await prisma.user.create({
    data: {
      id: input.userId,
      email: input.email,
      emailNormalized: input.email.toLowerCase(),
      passwordHash: 'integration-password-hash',
      gender: 'M',
      campus: 'CHUNCHEON',
      dormitoryId: 'dasan',
      dormitorySelectionState: 'ASSIGNED',
      emailVerifiedAt: new Date('2026-01-01T00:00:00.000Z'),
    },
  });

  await prisma.userProfile.create({
    data: {
      userId: input.userId,
      nickname: input.nickname,
      nicknameNormalized: input.nickname,
      lifestyle: DEFAULT_LIFESTYLE,
      intro: `${input.nickname} 소개`,
      messageToRoommate: `${input.nickname} 메시지`,
    },
  });

  await prisma.seasonParticipant.create({
    data: {
      id: input.participantId,
      seasonId: 'season-integration',
      userId: input.userId,
      participationIntent: 'REGISTERED',
      registeredAt: new Date('2026-01-01T00:00:00.000Z'),
      dormitoryId: 'dasan',
      dormitorySelectionState: 'ASSIGNED',
      participantStatus: 'ACTIVE',
      campusCodeSnapshot: 'CHUNCHEON',
      genderSnapshot: 'M',
      joinedAt: new Date('2026-01-01T00:00:00.000Z'),
      activatedAt: new Date('2026-01-01T00:00:00.000Z'),
    },
  });

  await prisma.seasonParticipantProfile.create({
    data: {
      participantId: input.participantId,
      nicknameSnapshot: input.nickname,
      nicknameNormalizedSnapshot: input.nickname,
      lifestyle: DEFAULT_LIFESTYLE,
      intro: `${input.nickname} 시즌 소개`,
      messageToRoommate: `${input.nickname} 시즌 메시지`,
    },
  });
}

export function authContext(userId: string) {
  return {
    id: userId,
    gender: 'M' as const,
    campus: 'CHUNCHEON' as const,
    dormitoryId: 'dasan',
    dormitorySelectionState: 'ASSIGNED' as const,
  };
}
