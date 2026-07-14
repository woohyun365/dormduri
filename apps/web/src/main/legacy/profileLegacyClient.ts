import type { Campus, RoommateProfile } from '@/types/profile';

/**
 * Legacy matching/chat profile bridge.
 *
 * Root `src/api/profile` was removed with the dev mock adapter. Until MatchingTab/ChatTab move to
 * owner APIs, keep this compatibility surface local to the remaining legacy bridge and fail closed
 * without reintroducing fixture/mock data as product evidence.
 */
export const legacyProfileApi = {
  getProfiles: async (
    _campus: Campus,
    _gender: 'M' | 'F',
    _dormitoryId?: string | null,
  ): Promise<Omit<RoommateProfile, 'matchScore'>[]> => [],
};
