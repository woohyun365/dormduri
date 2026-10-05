import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DormitoriesController } from './dormitories.controller.js';

describe('DormitoriesController', () => {
  const dormitoriesService = {
    getDormitories: vi.fn(),
    getDormitoryById: vi.fn(),
  };
  const controller = new DormitoriesController(dormitoriesService as never);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Invalid raw input is covered through real Nest binding in zod-request-binding.spec.ts.
  it.each(['M', undefined] as const)(
    'forwards parsed campus and gender=%s without defaulting',
    async (gender) => {
      const result = { success: true, dormitories: [] };
      dormitoriesService.getDormitories.mockResolvedValue(result);
      await expect(controller.getDormitories({ campus: 'CHUNCHEON', gender })).resolves.toBe(
        result,
      );
      expect(dormitoriesService.getDormitories).toHaveBeenCalledExactlyOnceWith(
        'CHUNCHEON',
        gender,
      );
    },
  );

  it('keeps the non-pilot detail route delegation unchanged', async () => {
    await controller.getDormitoryById('dormitory-1');
    expect(dormitoriesService.getDormitoryById).toHaveBeenCalledExactlyOnceWith('dormitory-1');
  });
});
