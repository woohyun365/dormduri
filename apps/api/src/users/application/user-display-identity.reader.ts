import type { Prisma } from '../../generated/prisma/client.js';
import type { PrismaService } from '../../platform/database/prisma.service.js';
import {
  buildUserWithDisplayIdentitySelect,
  mapUserWithDisplayIdentityProjection,
  type UserWithDisplayIdentityRecord,
} from '../current-user/current-user.select.js';

export type UserDisplayIdentityReaderClient =
  | Pick<PrismaService, 'user'>
  | Pick<Prisma.TransactionClient, 'user'>;

export async function getUserWithDisplayIdentity(
  client: UserDisplayIdentityReaderClient,
  userId: string,
): Promise<UserWithDisplayIdentityRecord> {
  const user = await client.user.findUnique({
    where: { id: userId },
    select: buildUserWithDisplayIdentitySelect(),
  });

  if (!user) {
    throw new Error('[UsersService] authenticated user not found');
  }

  return mapUserWithDisplayIdentityProjection(user);
}
