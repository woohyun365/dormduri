import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DormitoriesService } from './dormitories.service.js';

describe('DormitoriesService', () => {
  const dormitoryCatalogQuery = {
    getDormitories: vi.fn(),
    getDormitoryById: vi.fn(),
  };
  const dormitoryGuideQuery = {
    getDormitoryGuide: vi.fn(),
  };
  const service = new DormitoriesService(
    dormitoryCatalogQuery as never,
    dormitoryGuideQuery as never,
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('public catalog list는 DormitoryCatalogQuery로 위임한다', async () => {
    const response = { campus: { code: 'CHUNCHEON' }, items: [] };
    dormitoryCatalogQuery.getDormitories.mockResolvedValue(response);

    await expect(service.getDormitories('CHUNCHEON', 'M')).resolves.toBe(response);

    expect(dormitoryCatalogQuery.getDormitories).toHaveBeenCalledWith('CHUNCHEON', 'M');
  });

  it('public catalog detail은 DormitoryCatalogQuery로 위임한다', async () => {
    const response = { id: 'dasan', name: '다산관' };
    dormitoryCatalogQuery.getDormitoryById.mockResolvedValue(response);

    await expect(service.getDormitoryById('dasan')).resolves.toBe(response);

    expect(dormitoryCatalogQuery.getDormitoryById).toHaveBeenCalledWith('dasan');
  });

  it('public guide는 DormitoryGuideQuery로 위임한다', async () => {
    const response = { dormitory: { id: 'dasan' }, guide: {} };
    dormitoryGuideQuery.getDormitoryGuide.mockResolvedValue(response);

    await expect(service.getDormitoryGuide('dasan')).resolves.toBe(response);

    expect(dormitoryGuideQuery.getDormitoryGuide).toHaveBeenCalledWith('dasan');
  });
});
