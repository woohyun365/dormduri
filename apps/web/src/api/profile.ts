// TODO: BE API 연동 시 실제 endpoint로 교체

import type { Campus, RoommateProfile, UserProfile } from '@/types/profile';
import { toProfileUserProfile } from './profile-user.mapper';

async function getMockData() {
  if (process.env.NODE_ENV === 'development') {
    const { mockRawProfiles } = await import('@/main/dev-only/fixtures/profiles');
    const { mockDb } = await import('@/main/dev-only/fixtures/mock-db');
    return { mockRawProfiles, mockDb };
  }
  return null;
}

export const profileApi = {
  getProfiles: async (
    campus: Campus,
    gender: 'M' | 'F',
    dormitoryId?: string | null,
  ): Promise<Omit<RoommateProfile, 'matchScore'>[]> => {
    const mock = await getMockData();
    if (mock) {
      return mock.mockRawProfiles.filter((p) => {
        if (p.campus !== campus) return false;
        if (p.gender !== gender) return false;
        if (dormitoryId && p.dormitoryId !== dormitoryId) return false;
        return true;
      });
    }
    // TODO: GET /api/profiles?campus=...&gender=...&dormitoryId=...
    return [];
  },

  getMyProfile: async (): Promise<UserProfile | null> => {
    const mock = await getMockData();
    if (mock) {
      const user = mock.mockDb.getCurrentUser();
      return user ? toProfileUserProfile(user) : null;
    }
    // TODO: GET /api/users/me
    return null;
  },

  updateProfile: async (
    patch: Partial<Pick<UserProfile, 'dormitoryId' | 'lifestyle' | 'intro' | 'messageToRoommate'>>,
  ): Promise<{ success: boolean }> => {
    const mock = await getMockData();
    if (mock) {
      const user = mock.mockDb.getCurrentUser();
      if (!user) return { success: false };
      mock.mockDb.updateUser(user.email, patch);
      return { success: true };
    }
    // TODO: PATCH /api/users/me
    return { success: false };
  },
};
