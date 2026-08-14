import type { Prisma } from '../../../generated/prisma/client.js';
import { PrismaService } from '../../../platform/database/prisma.service.js';
import {
  isPrismaKnownRequestError,
  prismaErrorTargetIncludes,
} from '../../../platform/database/prisma-error.js';
import type { UserDisplayIdentityRecord } from '../../current-user/current-user.select.js';
import { usersErrors } from '../../errors/users.errors.js';
import type { ParsedDisplayIdentityNickname as SharedParsedDisplayIdentityNickname } from '@repo/shared/user/identity/display';
import { Injectable } from '@nestjs/common';

export type ParsedDisplayIdentityNickname = Extract<
  SharedParsedDisplayIdentityNickname,
  { ok: true }
>;

export type UserDisplayIdentityClient =
  | Pick<PrismaService, 'userDisplayIdentity'>
  | Pick<Prisma.TransactionClient, 'userDisplayIdentity'>;

@Injectable()
export class DisplayIdentityRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findNicknameOwner(
    nicknameNormalized: string,
    client: UserDisplayIdentityClient = this.prisma,
  ): Promise<string | null> {
    const identity = await client.userDisplayIdentity.findUnique({
      where: { nicknameNormalized },
      select: { userId: true },
    });

    return identity?.userId ?? null;
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
