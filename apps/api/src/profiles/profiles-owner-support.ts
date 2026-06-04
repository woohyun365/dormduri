import type { PrismaService } from '../platform/database/prisma.service.js';

export interface UserWithParticipantProjection {
  id: string;
  email: string;
  emailVerifiedAt: Date | null;
  deletedAt?: Date | null;
  gender: 'M' | 'F';
  campus: 'CHUNCHEON' | 'SAMCHEOK' | 'DOGYE';
}

export async function getUserWithProfile(
  prisma: PrismaService,
  userId: string,
): Promise<UserWithParticipantProjection> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      emailVerifiedAt: true,
      deletedAt: true,
      gender: true,
      campus: true,
    },
  });

  if (!user) {
    throw new Error('[ProfilesService] authenticated user not found');
  }

  return user;
}
