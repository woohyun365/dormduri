import type { PrismaService } from '../../../../src/platform/database/prisma.service.js';
import { DEFAULT_LIFESTYLE, toCompleteLifestyleColumnData } from './lifestyle-profile.fixture.js';

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
