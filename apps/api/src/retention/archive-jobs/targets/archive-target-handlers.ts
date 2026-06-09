import { archiveThreadRetentionJob } from '../../../chat/retention/thread-retention-archive.handler.js';
import { archiveMatchHistoryJob } from '../../../matches/retention/match-history-archive.handler.js';
import type { PrismaService } from '../../../platform/database/prisma.service.js';
import { archiveSeasonProfileHistoryJob } from '../../../season-participants/retention/season-profile-history-archive.handler.js';
import { archiveAcademicIdentityAuditJob } from '../../../users/identity/retention/academic-identity-audit-archive.handler.js';
import { archiveNicknameAuditJob } from '../../../users/identity/retention/nickname-audit-archive.handler.js';
import type { createConversationRetainedBodyOwner } from '../../../chat/retention/conversation-retained-body.service.js';
import type { RetainedVaultOwnerOptions } from '../../vault/retained-vault.service.js';
import type {
  ArchiveDeletionJobHandler,
  ArchiveJobWorkItem,
  ArchiveStorageResult,
} from '../archive-job.types.js';

const archiveTargetHandlers = {
  THREAD_RETENTION: ({ prisma, job, now, conversationRetention }) =>
    archiveThreadRetentionJob(prisma, job, now, conversationRetention),
  NICKNAME_AUDIT: ({ prisma, job, now, retainedVaultOptions }) =>
    archiveNicknameAuditJob(prisma, job, now, retainedVaultOptions),
  ACADEMIC_IDENTITY_AUDIT: ({ prisma, job, now, retainedVaultOptions }) =>
    archiveAcademicIdentityAuditJob(prisma, job, now, retainedVaultOptions),
  SEASON_PROFILE_HISTORY: ({ prisma, job, now, retainedVaultOptions }) =>
    archiveSeasonProfileHistoryJob(prisma, job, now, retainedVaultOptions),
  MATCH_HISTORY: ({ prisma, job, now, retainedVaultOptions }) =>
    archiveMatchHistoryJob(prisma, job, now, retainedVaultOptions),
} satisfies Partial<Record<ArchiveJobWorkItem['target'], ArchiveDeletionJobHandler>>;

export async function archiveDeletionJob(
  prisma: PrismaService,
  job: ArchiveJobWorkItem,
  now: Date,
  conversationRetention: ReturnType<typeof createConversationRetainedBodyOwner>,
  retainedVaultOptions: RetainedVaultOwnerOptions = {},
): Promise<ArchiveStorageResult> {
  const handler = archiveTargetHandlers[job.target];
  if (!handler) {
    return { ok: false, errorCode: 'ARCHIVE_HANDLER_MISSING' };
  }

  return handler({ prisma, job, now, conversationRetention, retainedVaultOptions });
}
