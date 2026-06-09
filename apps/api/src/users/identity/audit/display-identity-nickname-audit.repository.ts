import type { Prisma } from '../../../generated/prisma/client.js';
import type {
  DisplayIdentityNicknameChangeActorType,
  DisplayIdentityNicknameChangeReason,
  DisplayIdentityNicknameChangeSource,
} from '../../../generated/prisma/enums.js';
import type { PrismaService } from '../../../platform/database/prisma.service.js';

type DisplayIdentityNicknameAuditClient =
  | Pick<PrismaService, 'userDisplayIdentityNicknameChangeEvent'>
  | Pick<Prisma.TransactionClient, 'userDisplayIdentityNicknameChangeEvent'>;

export interface DisplayIdentityNicknameAuditReference {
  reportId?: string | null;
  moderationCaseId?: string | null;
  sanctionId?: string | null;
  approvalReference?: string | null;
  metadata?: unknown;
}

export interface RecordDisplayIdentityNicknameChangeAuditInput extends DisplayIdentityNicknameAuditReference {
  userId: string;
  retainedIdentityId?: string | null;
  source: DisplayIdentityNicknameChangeSource;
  reason: DisplayIdentityNicknameChangeReason;
  actorType: DisplayIdentityNicknameChangeActorType;
  actorId?: string | null;
  previousNickname: string;
  previousNicknameNormalized: string;
  nextNickname: string;
  nextNicknameNormalized: string;
  seasonId?: string | null;
  participantId?: string | null;
  seasonProfileSnapshotUpdated?: boolean;
  changedAt: Date;
}

export async function recordDisplayIdentityNicknameChangeAuditTx(
  client: DisplayIdentityNicknameAuditClient,
  input: RecordDisplayIdentityNicknameChangeAuditInput,
) {
  return client.userDisplayIdentityNicknameChangeEvent.create({
    data: {
      userId: input.userId,
      retainedIdentityId: input.retainedIdentityId ?? null,
      source: input.source,
      reason: input.reason,
      actorType: input.actorType,
      actorId: input.actorId ?? null,
      previousNickname: input.previousNickname,
      previousNicknameNormalized: input.previousNicknameNormalized,
      nextNickname: input.nextNickname,
      nextNicknameNormalized: input.nextNicknameNormalized,
      seasonId: input.seasonId ?? null,
      participantId: input.participantId ?? null,
      seasonProfileSnapshotUpdated: input.seasonProfileSnapshotUpdated ?? false,
      reportId: input.reportId ?? null,
      moderationCaseId: input.moderationCaseId ?? null,
      sanctionId: input.sanctionId ?? null,
      approvalReference: input.approvalReference ?? null,
      ...(input.metadata === undefined
        ? {}
        : { metadata: input.metadata as Prisma.InputJsonValue }),
      changedAt: input.changedAt,
    },
    select: { id: true },
  });
}
