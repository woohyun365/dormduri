import type { Prisma } from '../../../generated/prisma/client.js';
import type { PrismaService } from '../../../platform/database/prisma.service.js';

export type AcademicIdentityChangeReason = 'USER_CORRECTION' | 'ACADEMIC_CYCLE_ALLOWANCE';

export type AcademicIdentityAuditClient =
  | Pick<PrismaService, 'userAcademicIdentityChangeEvent'>
  | Pick<Prisma.TransactionClient, 'userAcademicIdentityChangeEvent'>;

export interface AcademicIdentityChangeAuditInput {
  userId: string;
  reason: AcademicIdentityChangeReason;
  actorType?: 'USER' | 'ADMIN' | 'SYSTEM';
  actorId: string;
  previousCollegeCode: string;
  nextCollegeCode: string;
  previousBirthYear: number;
  nextBirthYear: number;
  changedAt: Date;
  retainedIdentityId?: string | null;
  seasonId?: string | null;
  participantId?: string | null;
  reportId?: string | null;
  moderationCaseId?: string | null;
  sanctionId?: string | null;
  approvalReference?: string | null;
}

export async function recordAcademicIdentityChangeAuditTx(
  client: AcademicIdentityAuditClient,
  input: AcademicIdentityChangeAuditInput,
) {
  return client.userAcademicIdentityChangeEvent.create({
    data: {
      userId: input.userId,
      retainedIdentityId: input.retainedIdentityId ?? null,
      source: 'USER_SELF',
      reason: input.reason,
      actorType: input.actorType ?? 'USER',
      actorId: input.actorId,
      previousCollegeCode: input.previousCollegeCode,
      nextCollegeCode: input.nextCollegeCode,
      previousBirthYear: input.previousBirthYear,
      nextBirthYear: input.nextBirthYear,
      seasonId: input.seasonId ?? null,
      participantId: input.participantId ?? null,
      reportId: input.reportId ?? null,
      moderationCaseId: input.moderationCaseId ?? null,
      sanctionId: input.sanctionId ?? null,
      approvalReference: input.approvalReference ?? null,
      changedAt: input.changedAt,
    },
    select: { id: true },
  });
}
