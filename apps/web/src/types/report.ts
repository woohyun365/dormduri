import type { ReportReason as SharedReportReason } from '@repo/shared/social-safety/report';

export type ReportReason = SharedReportReason;

export interface Report {
  targetUserId: string;
  reason: ReportReason;
  detail: string | null;
  createdAt: string;
}

export interface BlockedUser {
  userId: string;
  nickname: string;
  blockedAt: string;
}
