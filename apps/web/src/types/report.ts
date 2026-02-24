export type ReportReason = 'SPAM' | 'FAKE_INFO' | 'OFFENSIVE' | 'SCAM' | 'OTHER';

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
