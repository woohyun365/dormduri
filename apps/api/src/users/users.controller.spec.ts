import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SERVICE_INTRO_NOTICE_KEY } from '@repo/shared/user';
import { UsersController } from './users.controller.js';

describe('UsersController', () => {
  const usersService = {
    getCurrentUser: vi.fn(),
    updateCurrentUser: vi.fn(),
    dismissCurrentUserOnboardingNotice: vi.fn(),
    requestAccountDeletion: vi.fn(),
  };
  const controller = new UsersController(usersService as never);
  const authUser = {
    id: 'user-1',
    gender: 'M',
    campus: 'CHUNCHEON',
  } as const;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('PATCH /api/users/me/onboarding parsed body를 dismiss owner로 위임한다', async () => {
    const response = { ok: true };
    usersService.dismissCurrentUserOnboardingNotice.mockResolvedValue(response);

    await expect(
      controller.dismissCurrentUserOnboardingNotice(authUser, {
        noticeKey: SERVICE_INTRO_NOTICE_KEY,
      }),
    ).resolves.toBe(response);

    expect(usersService.dismissCurrentUserOnboardingNotice).toHaveBeenCalledWith(authUser, {
      noticeKey: SERVICE_INTRO_NOTICE_KEY,
    });
  });
});
