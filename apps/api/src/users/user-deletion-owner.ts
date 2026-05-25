import type {
  AccountDeletionRequestAccepted,
  RequestAccountDeletion,
} from '@repo/shared/user-contract';
import { verifyPasswordHash } from '../auth/auth-password.js';
import { badRequestError, conflictError } from '../common/http/api-error.js';
import type { PrismaService } from '../common/prisma/prisma.service.js';
import {
  activateThreadRetentionJobsForArchivedThreads,
  createDeletionArchiveJobsTx,
  retryDueArchiveJobs,
  type ArchiveJobActivationResult,
  type ArchiveJobSweepResult,
} from '../retention/archive-job-owner.js';
import {
  createRetainedIdentitySnapshotTx,
  disposeExpiredRetainedIdentities,
  type RetainedIdentityDisposalResult,
} from '../retention/retained-identity-owner.js';
import { isParticipantRegistered } from '../season-participants/season-participant-policy.js';
import type { SeasonsService } from '../seasons/seasons.service.js';
import { recordDisplayIdentityNicknameChangeAuditTx } from './display-identity-nickname-audit.owner.js';

interface UserDeletionOwnerDeps {
  prisma: PrismaService;
  seasonsService: SeasonsService;
}

type CurrentSeasonContext = NonNullable<
  Awaited<ReturnType<SeasonsService['getCurrentSeasonContext']>>
>;

const accountDeletionParticipantSelect = {
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

export function createUserDeletionOwner(deps: UserDeletionOwnerDeps) {
  async function requestAccountDeletion(
    userId: string,
    input: RequestAccountDeletion,
  ): Promise<AccountDeletionRequestAccepted> {
    const now = await deps.prisma.getDatabaseNow();
    const user = await deps.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        campus: true,
        passwordHash: true,
        deletedAt: true,
      },
    });

    if (!user) {
      throw badRequestError('ACCOUNT_DELETION_USER_NOT_FOUND', '사용자 정보를 찾을 수 없습니다.');
    }

    if (user.deletedAt) {
      throw conflictError('ACCOUNT_ALREADY_DELETED', '이미 삭제 처리된 계정입니다.');
    }

    const passwordMatches = await verifyPasswordHash(user.passwordHash, input.password);
    if (!passwordMatches) {
      throw badRequestError('ACCOUNT_DELETION_PASSWORD_MISMATCH', '비밀번호가 일치하지 않습니다.');
    }

    const seasonContext = await deps.seasonsService.getCurrentSeasonContext(user.campus, now);
    if (seasonContext) {
      const currentParticipant = await deps.prisma.seasonParticipant.findUnique({
        where: {
          seasonId_userId: {
            seasonId: seasonContext.season.id,
            userId: user.id,
          },
        },
        select: accountDeletionParticipantSelect,
      });

      if (isParticipantRegistered(currentParticipant)) {
        throw accountDeletionBlockedBySeasonParticipation(seasonContext);
      }
    }

    const retainedIdentity = await deps.prisma.runSerializableTransaction(async (tx) => {
      const txUser = await tx.user.findUnique({
        where: { id: user.id },
        select: {
          id: true,
          deletedAt: true,
          displayIdentity: {
            select: {
              nickname: true,
              nicknameNormalized: true,
            },
          },
        },
      });

      if (!txUser || txUser.deletedAt) {
        throw conflictError('ACCOUNT_ALREADY_DELETED', '이미 삭제 처리된 계정입니다.');
      }

      if (seasonContext) {
        const txParticipant = await tx.seasonParticipant.findUnique({
          where: {
            seasonId_userId: {
              seasonId: seasonContext.season.id,
              userId: txUser.id,
            },
          },
          select: accountDeletionParticipantSelect,
        });

        if (isParticipantRegistered(txParticipant)) {
          throw accountDeletionBlockedBySeasonParticipation(seasonContext);
        }
      }
      if (!txUser.displayIdentity) {
        throw new Error('[UserDeletionOwner] user display identity row is required');
      }

      const retained = await createRetainedIdentitySnapshotTx(tx, {
        userId: txUser.id,
        deletedAt: now,
        metadata: {
          schemaVersion: 1,
          migration: {
            source: 'ACCOUNT_DELETE',
            note: 'immediate de-identification with five-day retained identifier anchor',
          },
          request: {
            requestedBy: 'USER',
            note: '계정 삭제 요청 수락 즉시 비식별화',
          },
        },
      });

      await createDeletionArchiveJobsTx(tx, {
        retainedIdentityId: retained.id,
        userId: txUser.id,
        deletedAt: now,
      });

      await tx.authSession.updateMany({
        where: {
          userId: txUser.id,
          revokedAt: null,
        },
        data: {
          revokedAt: now,
        },
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
        nextNicknameNormalized: `deleted-${retained.anonymizedActorKey}`,
        changedAt: now,
        metadata: {
          schemaVersion: 1,
          priority: 'ACCOUNT_DELETION_TOMBSTONE_OVERRIDES_DISPLAY_IDENTITY',
          requestedBy: 'USER',
        },
      });

      await tx.userDisplayIdentity.updateMany({
        where: { userId: txUser.id },
        data: {
          nickname: retained.displayLabel,
          nicknameNormalized: `deleted-${retained.anonymizedActorKey}`,
          nicknameChangedAt: now,
        },
      });

      await tx.seasonParticipantProfile.updateMany({
        where: { participant: { userId: txUser.id } },
        data: {
          nicknameSnapshot: retained.displayLabel,
          nicknameNormalizedSnapshot: `deleted-${retained.anonymizedActorKey}`,
          bedtime: null,
          wakeTime: null,
          sleepHabit: null,
          sleepEnvironment: null,
          screenUsage: null,
          noiseSensitivity: null,
          smokingBehavior: null,
          indoorEating: null,
          phoneBehavior: null,
          earphoneUsage: null,
          cleanLevel: null,
          drinkingFrequency: null,
          relationshipStyle: null,
          temperatureSensitivity: null,
          smokingTolerance: null,
          phoneTolerance: null,
          earphoneExpectation: null,
          sleepEnvPreference: null,
          screenTolerance: null,
          indoorEatingTolerance: null,
          cleanExpectation: null,
          drinkingTolerance: null,
          intro: '',
          collegeCode: null,
          grade: null,
          mbti: null,
          birthYear: null,
        },
      });

      await tx.user.update({
        where: { id: txUser.id },
        data: {
          email: `deleted+${retained.anonymizedActorKey}@deleted.local`,
          emailNormalized: `deleted+${retained.anonymizedActorKey}@deleted.local`,
          passwordHash: `deleted:${retained.anonymizedActorKey}`,
          emailVerifiedAt: null,
          deletedAt: now,
        },
      });

      return retained;
    });

    return {
      state: 'DEIDENTIFIED_RETAINED',
      deletedAt: now.toISOString(),
      retentionHoldUntil: retainedIdentity.retentionHoldUntil?.toISOString() ?? null,
    };
  }

  return {
    requestAccountDeletion,
    activateThreadRetentionJobsForArchivedThreads(now: Date): Promise<ArchiveJobActivationResult> {
      return activateThreadRetentionJobsForArchivedThreads(deps.prisma, now);
    },
    retryDueDeletionArchiveJobs(now: Date): Promise<ArchiveJobSweepResult> {
      return retryDueArchiveJobs(deps.prisma, now);
    },
    disposeExpiredRetainedIdentities(now: Date): Promise<RetainedIdentityDisposalResult> {
      return disposeExpiredRetainedIdentities(deps.prisma, now);
    },
  };
}

function accountDeletionBlockedBySeasonParticipation(seasonContext: CurrentSeasonContext) {
  return conflictError(
    'ACCOUNT_DELETION_BLOCKED_BY_SEASON_PARTICIPATION',
    '현재 시즌 참여 중에는 계정 삭제 요청을 받을 수 없습니다. 시즌 참여 철회를 먼저 진행하거나 시즌 종료 후 다시 시도해주세요.',
    {
      seasonState: seasonContext.state,
      seasonEndDate: seasonContext.schedule.seasonEnd,
    },
  );
}
