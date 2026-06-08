import type { ReportReason } from '@repo/shared/social-safety/report';

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
