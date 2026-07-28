import type { Prisma } from '../../../generated/prisma/client.js';
import type { PrismaService } from '../../../platform/database/prisma.service.js';
import {
  isPrismaKnownRequestError,
  prismaErrorTargetIncludes,
} from '../../../platform/database/prisma-error.js';
import type { UserDisplayIdentityRecord } from '../../current-user/current-user.select.js';
import { usersErrors } from '../../errors/users.errors.js';
import type { ParsedDisplayIdentityNickname as SharedParsedDisplayIdentityNickname } from '@repo/shared/user/identity/display';

export type ParsedDisplayIdentityNickname = Extract<
  SharedParsedDisplayIdentityNickname,
  { ok: true }
>;

export type UserDisplayIdentityClient =
  | Pick<PrismaService, 'userDisplayIdentity'>
  | Pick<Prisma.TransactionClient, 'userDisplayIdentity'>;

export async function assertNicknameAvailableForUser(
  client: UserDisplayIdentityClient,
  parsedNickname: Pick<ParsedDisplayIdentityNickname, 'normalized'>,
  userId: string,
) {
  const existingNickname = await client.userDisplayIdentity.findUnique({
    where: { nicknameNormalized: parsedNickname.normalized },
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
        nickname: input.parsedNickname.value,
        nicknameNormalized: input.parsedNickname.normalized,
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
    displayIdentity.nickname === parsedNickname.value &&
    displayIdentity.nicknameNormalized === parsedNickname.normalized
  );
}
