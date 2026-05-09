import type { PrismaService } from '../common/prisma/prisma.service.js';
import { buildUserWithProfileSelect } from '../users/current-user-select.js';
import type { UserWithProfileRecord } from './profile.mapper.js';
import type { CurrentSeasonParticipantRecord } from '../season-participants/season-participants.service.js';

export type UserWithParticipantProjection = UserWithProfileRecord & {
  seasonParticipants?: CurrentSeasonParticipantRecord[];
};

export async function getUserWithProfile(
  prisma: PrismaService,
  userId: string,
): Promise<UserWithProfileRecord> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: buildUserWithProfileSelect(null),
  });

  if (!user) {
    throw new Error('[ProfilesService] authenticated user not found');
  }

  return user;
}
