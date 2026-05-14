import type { PrismaService } from '../common/prisma/prisma.service.js';
import {
  buildUserWithProfileSelect,
  mapUserWithParticipantProjection,
  type UserWithParticipantProjectionRecord,
} from '../users/current-user-select.js';
import type { UserWithProfileRecord } from './profile.mapper.js';

export type UserWithParticipantProjection = UserWithParticipantProjectionRecord;

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

  const mapped = mapUserWithParticipantProjection(user);

  return {
    id: mapped.id,
    email: mapped.email,
    emailVerifiedAt: mapped.emailVerifiedAt,
    gender: mapped.gender,
    campus: mapped.campus,
    profile: mapped.profile,
  };
}
