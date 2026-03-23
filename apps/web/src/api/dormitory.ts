// TODO: BE API 연동 시 실제 endpoint로 교체

import type { Campus } from '@/types/profile';
import type { Dormitory } from '@/constants/dormitory';

async function getMockData() {
  if (process.env.NODE_ENV === 'development') {
    const { DORMITORIES, getAvailableDormitories, getDormitoryById } =
      await import('@/constants/dormitory');
    return { DORMITORIES, getAvailableDormitories, getDormitoryById };
  }
  return null;
}

export const dormitoryApi = {
  getDormitories: async (campus: Campus, gender: 'M' | 'F'): Promise<Dormitory[]> => {
    const mock = await getMockData();
    if (mock) {
      return mock.getAvailableDormitories(campus, gender);
    }
    // TODO: GET /api/dormitories?campus=...&gender=...
    return [];
  },

  getDormitoryById: async (id: string): Promise<Dormitory | null> => {
    const mock = await getMockData();
    if (mock) {
      return mock.getDormitoryById(id) ?? null;
    }
    // TODO: GET /api/dormitories/{id}
    return null;
  },
};
