import type { MatchRequest, ActiveMatch } from '@/types/match';
import type { RoommateProfile, UserProfile } from '@/types/profile';

export interface MatchingResult {
  requests: MatchRequest[];
  activeMatch: ActiveMatch | null;
}

function emptyMatchingResult(): MatchingResult {
  return { requests: [], activeMatch: null };
}

/**
 * Legacy MatchingTab/ChatTab state bridge.
 *
 * The old root `src/api/matching` delegated to `main/dev-only/fixtures`. That mock surface is now
 * removed from production code, so this bridge intentionally returns an empty state until the
 * remaining MatchingTab/ChatTab owner API migration replaces it.
 */
export const legacyMatchingApi = {
  getState: async (_userId: string): Promise<MatchingResult> => emptyMatchingResult(),

  getRequests: async (_userId: string): Promise<MatchRequest[]> => [],

  getActiveMatch: async (_userId: string): Promise<ActiveMatch | null> => null,

  sendRequest: async (
    _fromId: string,
    _toId: string,
    _message: string | null,
  ): Promise<MatchingResult> => emptyMatchingResult(),

  cancelRequest: async (_requestId: string, _userId: string): Promise<MatchingResult> =>
    emptyMatchingResult(),

  acceptRequest: async (_requestId: string, _userId: string): Promise<MatchingResult> =>
    emptyMatchingResult(),

  rejectRequest: async (_requestId: string, _userId: string): Promise<MatchingResult> =>
    emptyMatchingResult(),

  confirmMatch: async (
    _requestId: string,
    _userId: string,
    _context: {
      currentUser: Pick<UserProfile, 'id' | 'nickname' | 'dormitoryId'>;
      profiles: Omit<RoommateProfile, 'matchScore'>[];
      userLifestyle: UserProfile['lifestyle'];
    },
  ): Promise<MatchingResult> => emptyMatchingResult(),

  revokeConfirmMatch: async (_requestId: string, _userId: string): Promise<MatchingResult> =>
    emptyMatchingResult(),

  finalizePairGroup: async (_userId: string): Promise<MatchingResult> => emptyMatchingResult(),

  endConversation: async (_requestId: string, _userId: string): Promise<MatchingResult> =>
    emptyMatchingResult(),

  endMatch: async (_userId: string): Promise<MatchingResult> => emptyMatchingResult(),
};
