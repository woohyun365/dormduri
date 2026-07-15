import type { RoommateProfile, UserProfile } from '@/types/profile';

export type LegacyMatchStatus = 'PENDING' | 'IN_CONVERSATION' | 'ACTIVE';

export interface LegacyMatchRequest {
  id: string;
  fromUserId: string;
  toUserId: string;
  status: LegacyMatchStatus;
  message: string | null;
  createdAt: string;
  expiresAt: string;
}

export interface LegacyActiveMatch {
  matchId: string;
  partnerUserId: string;
  partnerNickname: string;
  matchScore: number;
  matchedAt: string;
}

export interface LegacyPastSeasonData {
  id: string;
  name: string;
  matchResult: 'success' | 'no_match';
}

export type LegacyPairUser = UserProfile;
export type LegacyPairProfile = Omit<RoommateProfile, 'matchScore'>;
