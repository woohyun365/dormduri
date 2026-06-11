import type { AccountDeletionRequestAccepted, RequestAccountDeletion } from '@repo/shared/user';
import { verifyPasswordHash } from '../../auth/application/auth-password-hash.js';
import type {
  PrismaService,
  RetentionWorkerPrismaService,
} from '../../platform/database/prisma.service.js';
import { createDeletionArchiveJobsTx } from '../../retention/archive-jobs/create-deletion-archive-jobs.command.js';
import { createRetainedIdentitySnapshotTx } from '../../retention/retained-identities/create-retained-identity-snapshot.command.js';
import type { SeasonContextPort } from '../../seasons/ports/season-context.port.js';
import { recordDisplayIdentityNicknameChangeAuditTx } from '../identity/audit/display-identity-nickname-audit.repository.js';
import {
  buildAccountDeletionDisplayAuditMetadata,
  buildAccountDeletionRetainedIdentityMetadata,
  buildDeletedDisplayIdentityNormalized,
} from './account-deletion-deidentification.mapper.js';
import {
  applyDisplayIdentityDeletionTombstoneTx,
  deleteAcademicIdentityForDeletedUserTx,
  findAccountDeletionCurrentParticipant,
  findAccountDeletionTransactionUser,
  findAccountDeletionUser,
  markAccountDeletedTx,
  minimizeSeasonParticipantProfilesForDeletedUserTx,
  revokeActiveAuthSessionsForDeletedUserTx,
} from './account-deletion.repository.js';
import {
  assertAccountDeletionAllowedForCurrentSeasonParticipant,
  assertAccountDeletionPasswordMatches,
  assertAccountDeletionUserExists,
  assertAccountIsNotDeleted,
} from './account-deletion-precondition.policy.js';

interface RequestAccountDeletionCommandDeps {
  prisma: PrismaService;
  retentionWorkerPrisma: RetentionWorkerPrismaService;
  seasonsService: SeasonContextPort;
}

export function createRequestAccountDeletionCommand(deps: RequestAccountDeletionCommandDeps) {
  return {
    async requestAccountDeletion(
      userId: string,
      input: RequestAccountDeletion,
    ): Promise<AccountDeletionRequestAccepted> {
      const now = await deps.prisma.getDatabaseNow();
      const user = await findAccountDeletionUser(deps.prisma, userId);

      assertAccountDeletionUserExists(user);
      assertAccountIsNotDeleted(user);

      const passwordMatches = await verifyPasswordHash(user.passwordHash, input.password);
      assertAccountDeletionPasswordMatches(passwordMatches);

      const seasonContext = await deps.seasonsService.getCurrentSeasonContext(user.campus, now);
      if (seasonContext) {
        const currentParticipant = await findAccountDeletionCurrentParticipant(deps.prisma, {
          seasonId: seasonContext.season.id,
          userId: user.id,
        });

        assertAccountDeletionAllowedForCurrentSeasonParticipant(currentParticipant, seasonContext);
      }

      const retainedIdentity = await deps.retentionWorkerPrisma.runSerializableTransaction(
        async (tx) => {
          const txUser = await findAccountDeletionTransactionUser(tx, user.id);

          assertAccountDeletionUserExists(txUser);
          assertAccountIsNotDeleted(txUser);

          if (seasonContext) {
            const txParticipant = await findAccountDeletionCurrentParticipant(tx, {
              seasonId: seasonContext.season.id,
              userId: txUser.id,
            });

            assertAccountDeletionAllowedForCurrentSeasonParticipant(txParticipant, seasonContext);
          }

          if (!txUser.displayIdentity) {
            throw new Error('[UserDeletionOwner] user display identity row is required');
          }

          const retained = await createRetainedIdentitySnapshotTx(tx, {
            userId: txUser.id,
            deletedAt: now,
            metadata: buildAccountDeletionRetainedIdentityMetadata(),
          });

          await createDeletionArchiveJobsTx(tx, {
            retainedIdentityId: retained.id,
            userId: txUser.id,
            deletedAt: now,
          });

          await revokeActiveAuthSessionsForDeletedUserTx(tx, {
            userId: txUser.id,
            revokedAt: now,
          });

          await recordDisplayIdentityNicknameChangeAuditTx(tx, {
            userId: txUser.id,
            retainedIdentityId: retained.id,
            source: 'ACCOUNT_DELETION_DEIDENTIFICATION',
            reason: 'ACCOUNT_DELETION',
            actorType: 'SYSTEM',
            actorId: 'account-deletion',
            previousNickname: txUser.displayIdentity.nickname,
            previousNicknameNormalized: txUser.displayIdentity.nicknameNormalized,
            nextNickname: retained.displayLabel,
            nextNicknameNormalized: buildDeletedDisplayIdentityNormalized(retained),
            changedAt: now,
            metadata: buildAccountDeletionDisplayAuditMetadata(),
          });

          await applyDisplayIdentityDeletionTombstoneTx(tx, {
            userId: txUser.id,
            retained,
            changedAt: now,
          });
          await deleteAcademicIdentityForDeletedUserTx(tx, txUser.id);
          await minimizeSeasonParticipantProfilesForDeletedUserTx(tx, {
            userId: txUser.id,
            retained,
          });
          await markAccountDeletedTx(tx, {
            userId: txUser.id,
            retained,
            deletedAt: now,
          });

          return retained;
        },
      );

      return {
        state: 'DEIDENTIFIED_RETAINED',
        deletedAt: now.toISOString(),
        retentionHoldUntil: retainedIdentity.retentionHoldUntil?.toISOString() ?? null,
      };
    },
  };
}
