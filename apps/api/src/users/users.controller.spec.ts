import { BadRequestException } from '@nestjs/common';
import { SERVICE_INTRO_NOTICE_KEY } from '@repo/shared/user-contract';
import { UsersController } from './users.controller.js';

function getBadRequestResponse(error: unknown) {
  expect(error).toBeInstanceOf(BadRequestException);
  if (!(error instanceof BadRequestException)) {
    throw new Error('Expected BadRequestException');
  }
  return error.getResponse() as { code?: string; details?: unknown };
}

describe('UsersController', () => {
  const usersService = {
    getCurrentUser: jest.fn(),
    updateCurrentUser: jest.fn(),
    dismissCurrentUserOnboardingNotice: jest.fn(),
    requestAccountDeletion: jest.fn(),
  };
  const controller = new UsersController(usersService as never);
  const authUser = {
    id: 'user-1',
    gender: 'M',
    campus: 'CHUNCHEON',
  } as const;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('PATCH /api/users/me/onboarding body를 파싱해 dismiss owner로 위임한다', async () => {
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

  it('PATCH /api/users/me/onboarding은 지원하지 않는 noticeKey를 bad request로 거부한다', async () => {
    try {
      await controller.dismissCurrentUserOnboardingNotice(authUser, {
        noticeKey: 'unknown-notice',
      });
      throw new Error('Expected BadRequestException');
    } catch (error) {
      const response = getBadRequestResponse(error);
      expect(response.code).toBe('INVALID_REQUEST_BODY');
      expect(usersService.dismissCurrentUserOnboardingNotice).not.toHaveBeenCalled();
    }
  });
});
