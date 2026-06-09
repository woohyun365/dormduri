import type { Prisma } from '../../generated/prisma/client.js';
import type { PrismaService } from '../../platform/database/prisma.service.js';

type DisplayIdentityNicknameAuditQueryClient = Pick<
  PrismaService,
  'userDisplayIdentityNicknameChangeEvent'
>;

const displayIdentityNicknameChangeAuditSelect = {
  id: true,
  userId: true,
  retainedIdentityId: true,
  source: true,
  reason: true,
  actorType: true,
  actorId: true,
  previousNickname: true,
  previousNicknameNormalized: true,
  nextNickname: true,
  nextNicknameNormalized: true,
  seasonId: true,
  participantId: true,
  seasonProfileSnapshotUpdated: true,
  reportId: true,
  moderationCaseId: true,
  sanctionId: true,
  approvalReference: true,
  metadata: true,
  changedAt: true,
  createdAt: true,
} as const;

export type DisplayIdentityNicknameChangeAuditEntry =
  Prisma.UserDisplayIdentityNicknameChangeEventGetPayload<{
    select: typeof displayIdentityNicknameChangeAuditSelect;
  }>;

export function listDisplayIdentityNicknameChangeAuditForOperations(
  client: DisplayIdentityNicknameAuditQueryClient,
  userId: string,
): Promise<DisplayIdentityNicknameChangeAuditEntry[]> {
  return client.userDisplayIdentityNicknameChangeEvent.findMany({
    where: { userId },
    select: displayIdentityNicknameChangeAuditSelect,
    orderBy: [{ changedAt: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
  });
}
