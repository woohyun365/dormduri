import type { Prisma } from '../../generated/prisma/client.js';
import type { PrismaService } from '../../platform/database/prisma.service.js';
import {
  buildDeletedDisplayIdentityNormalized,
  buildDeletedEmail,
  buildDeletedPasswordHash,
  buildSeasonParticipantProfileDeidentificationData,
} from './account-deletion-deidentification.mapper.js';

export const accountDeletionUserSelect = {
  id: true,
  campus: true,
  passwordHash: true,
  deletedAt: true,
} as const;

export const accountDeletionTransactionUserSelect = {
  id: true,
  deletedAt: true,
  displayIdentity: {
    select: {
      nickname: true,
      nicknameNormalized: true,
    },
  },
} as const;

export const accountDeletionParticipantSelect = {
  id: true,
  participationIntent: true,
  registeredAt: true,
  declinedAt: true,
  dormitoryId: true,
  dormitorySelectionState: true,
  participantStatus: true,
  hiddenByAdminAt: true,
  deactivatedAt: true,
  profile: { select: { participantId: true } },
} as const;

export type AccountDeletionUser = Prisma.UserGetPayload<{
  select: typeof accountDeletionUserSelect;
}>;

export type AccountDeletionTransactionUser = Prisma.UserGetPayload<{
  select: typeof accountDeletionTransactionUserSelect;
}>;

export type AccountDeletionParticipant = Prisma.SeasonParticipantGetPayload<{
  select: typeof accountDeletionParticipantSelect;
}>;

interface RetainedDeletionIdentity {
  anonymizedActorKey: string;
  displayLabel: string;
}

type AccountDeletionUserReader =
  Pick<PrismaService, 'user'> | Pick<Prisma.TransactionClient, 'user'>;
type AccountDeletionParticipantReader =
  Pick<PrismaService, 'seasonParticipant'> | Pick<Prisma.TransactionClient, 'seasonParticipant'>;

export function findAccountDeletionUser(
  client: AccountDeletionUserReader,
  userId: string,
): Promise<AccountDeletionUser | null> {
  return client.user.findUnique({
    where: { id: userId },
    select: accountDeletionUserSelect,
  });
}

export function findAccountDeletionTransactionUser(
  client: AccountDeletionUserReader,
  userId: string,
): Promise<AccountDeletionTransactionUser | null> {
  return client.user.findUnique({
    where: { id: userId },
    select: accountDeletionTransactionUserSelect,
  });
}

export function findAccountDeletionCurrentParticipant(
  client: AccountDeletionParticipantReader,
  input: { seasonId: string; userId: string },
): Promise<AccountDeletionParticipant | null> {
  return client.seasonParticipant.findUnique({
    where: {
      seasonId_userId: input,
    },
    select: accountDeletionParticipantSelect,
  });
}

export function revokeActiveAuthSessionsForDeletedUserTx(
  tx: Prisma.TransactionClient,
  input: { userId: string; revokedAt: Date },
) {
  return tx.authSession.updateMany({
    where: {
      userId: input.userId,
      revokedAt: null,
    },
    data: {
      revokedAt: input.revokedAt,
    },
  });
}

export function applyDisplayIdentityDeletionTombstoneTx(
  tx: Prisma.TransactionClient,
  input: { userId: string; retained: RetainedDeletionIdentity; changedAt: Date },
) {
  return tx.userDisplayIdentity.updateMany({
    where: { userId: input.userId },
    data: {
      nickname: input.retained.displayLabel,
      nicknameNormalized: buildDeletedDisplayIdentityNormalized(input.retained),
      nicknameChangedAt: input.changedAt,
    },
  });
}

export async function deleteAcademicIdentityForDeletedUserTx(
  tx: Prisma.TransactionClient,
  userId: string,
) {
  await tx.userAcademicIdentity.deleteMany({
    where: { userId },
  });

  await tx.userAcademicIdentityChangeAllowance.deleteMany({
    where: { userId },
  });
}

export function minimizeSeasonParticipantProfilesForDeletedUserTx(
  tx: Prisma.TransactionClient,
  input: { userId: string; retained: RetainedDeletionIdentity },
) {
  return tx.seasonParticipantProfile.updateMany({
    where: { participant: { userId: input.userId } },
    data: buildSeasonParticipantProfileDeidentificationData(input.retained),
  });
}

export function markAccountDeletedTx(
  tx: Prisma.TransactionClient,
  input: { userId: string; retained: RetainedDeletionIdentity; deletedAt: Date },
) {
  const deletedEmail = buildDeletedEmail(input.retained);

  return tx.user.update({
    where: { id: input.userId },
    data: {
      email: deletedEmail,
      emailNormalized: deletedEmail,
      passwordHash: buildDeletedPasswordHash(input.retained),
      emailVerifiedAt: null,
      deletedAt: input.deletedAt,
    },
  });
}
