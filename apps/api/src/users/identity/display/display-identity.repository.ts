import type { Prisma } from '../../../generated/prisma/client.js';
import type { PrismaService } from '../../../platform/database/prisma.service.js';
import {
  isPrismaKnownRequestError,
  prismaErrorTargetIncludes,
} from '../../../platform/database/prisma-error.js';
import type { UserDisplayIdentityRecord } from '../../current-user/current-user.select.js';
import { usersErrors } from '../../users.errors.js';

export interface ParsedDisplayIdentityNickname {
  nickname: string;
  nicknameNormalized: string;
}

export type UserDisplayIdentityClient =
  | Pick<PrismaService, 'userDisplayIdentity'>
  | Pick<Prisma.TransactionClient, 'userDisplayIdentity'>;

export async function assertNicknameAvailableForUser(
  client: UserDisplayIdentityClient,
  parsedNickname: { nicknameNormalized: string },
  userId: string,
) {
  const existingNickname = await client.userDisplayIdentity.findUnique({
    where: { nicknameNormalized: parsedNickname.nicknameNormalized },
    select: { userId: true },
  });

  if (existingNickname && existingNickname.userId !== userId) {
    throw usersErrors.nicknameAlreadyTaken();
  }
}

export async function updateDisplayIdentityNickname(
  client: UserDisplayIdentityClient,
  input: {
    userId: string;
    displayIdentity: UserDisplayIdentityRecord;
    parsedNickname: ParsedDisplayIdentityNickname;
    now: Date;
  },
) {
  try {
    const updateResult = await client.userDisplayIdentity.updateMany({
      where: {
        userId: input.userId,
        nicknameChangedAt: input.displayIdentity.nicknameChangedAt,
      },
      data: {
        nickname: input.parsedNickname.nickname,
        nicknameNormalized: input.parsedNickname.nicknameNormalized,
        nicknameChangedAt: input.now,
      },
    });

    if (updateResult.count !== 1) {
      throw usersErrors.nicknameCooldownActive();
    }
  } catch (error) {
    if (isPrismaKnownRequestError(error, 'P2002')) {
      if (prismaErrorTargetIncludes(error, 'nicknameNormalized')) {
        throw usersErrors.nicknameAlreadyTaken();
      }
    }
    throw error;
  }
}

export function assertDisplayIdentity(
  displayIdentity: UserDisplayIdentityRecord | null,
): UserDisplayIdentityRecord {
  if (!displayIdentity) {
    throw new Error('[UsersService] user display identity row is required');
  }
  return displayIdentity;
}

export function isSameNickname(
  displayIdentity: UserDisplayIdentityRecord,
  parsedNickname: ParsedDisplayIdentityNickname,
) {
  return (
    displayIdentity.nickname === parsedNickname.nickname &&
    displayIdentity.nicknameNormalized === parsedNickname.nicknameNormalized
  );
}
