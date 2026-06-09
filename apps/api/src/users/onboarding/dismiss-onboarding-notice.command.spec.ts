import { SERVICE_INTRO_NOTICE_KEY, type CurrentUserResponse } from '@repo/shared/user';
import { createDismissOnboardingNoticeCommand } from './dismiss-onboarding-notice.command.js';

const NOW = new Date('2026-05-21T00:00:00.000Z');
const AUTH_USER = {
  id: 'user-1',
  gender: 'M',
  campus: 'CHUNCHEON',
} as const;
const CURRENT_USER_RESPONSE = { ok: true } as unknown as CurrentUserResponse;

describe('DismissOnboardingNoticeCommand', () => {
  const prisma = {
    getDatabaseNow: jest.fn(),
    userDismissedNotice: {
      upsert: jest.fn(),
    },
  };
  const currentUserViewService = {
    getCurrentUser: jest.fn(),
  };
  const command = createDismissOnboardingNoticeCommand({
    prisma: prisma as never,
    currentUserViewService: currentUserViewService as never,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.getDatabaseNow.mockResolvedValue(NOW);
    prisma.userDismissedNotice.upsert.mockResolvedValue({
      userId: AUTH_USER.id,
      noticeKey: SERVICE_INTRO_NOTICE_KEY,
      dismissedAt: NOW,
    });
    currentUserViewService.getCurrentUser.mockResolvedValue(CURRENT_USER_RESPONSE);
  });

  it('service-intro notice를 dismiss한 뒤 current-user를 readback한다', async () => {
    const result = await command.dismissCurrentUserOnboardingNotice(AUTH_USER, {
      noticeKey: SERVICE_INTRO_NOTICE_KEY,
    });

    expect(prisma.getDatabaseNow).toHaveBeenCalledTimes(1);
    expect(prisma.userDismissedNotice.upsert).toHaveBeenCalledWith({
      where: {
        userId_noticeKey: {
          userId: 'user-1',
          noticeKey: SERVICE_INTRO_NOTICE_KEY,
        },
      },
      update: {},
      create: {
        userId: 'user-1',
        noticeKey: SERVICE_INTRO_NOTICE_KEY,
        dismissedAt: NOW,
      },
    });
    expect(currentUserViewService.getCurrentUser).toHaveBeenCalledWith(AUTH_USER);
    const [nowOrder] = prisma.getDatabaseNow.mock.invocationCallOrder;
    const [writeOrder] = prisma.userDismissedNotice.upsert.mock.invocationCallOrder;
    const [readbackOrder] = currentUserViewService.getCurrentUser.mock.invocationCallOrder;
    expect(nowOrder).toBeLessThan(writeOrder!);
    expect(writeOrder).toBeLessThan(readbackOrder!);
    expect(result).toBe(CURRENT_USER_RESPONSE);
  });

  it('같은 notice를 두 번 dismiss해도 동일 compound key upsert로 idempotent하게 처리한다', async () => {
    await command.dismissCurrentUserOnboardingNotice(AUTH_USER, {
      noticeKey: SERVICE_INTRO_NOTICE_KEY,
    });
    await command.dismissCurrentUserOnboardingNotice(AUTH_USER, {
      noticeKey: SERVICE_INTRO_NOTICE_KEY,
    });

    expect(prisma.userDismissedNotice.upsert).toHaveBeenCalledTimes(2);
    expect(currentUserViewService.getCurrentUser).toHaveBeenCalledTimes(2);
  });

  it('P2002 unique race도 current-user readback success로 흡수한다', async () => {
    prisma.userDismissedNotice.upsert.mockRejectedValueOnce({ code: 'P2002' });

    await expect(
      command.dismissCurrentUserOnboardingNotice(AUTH_USER, {
        noticeKey: SERVICE_INTRO_NOTICE_KEY,
      }),
    ).resolves.toBe(CURRENT_USER_RESPONSE);

    expect(currentUserViewService.getCurrentUser).toHaveBeenCalledWith(AUTH_USER);
  });

  it('지원하지 않는 noticeKey는 DB now/write/readback 없이 거부한다', async () => {
    await expect(
      command.dismissCurrentUserOnboardingNotice(AUTH_USER, {
        noticeKey: 'unknown-notice',
      } as never),
    ).rejects.toMatchObject({ response: { code: 'INVALID_USER_PATCH' } });

    expect(prisma.getDatabaseNow).not.toHaveBeenCalled();
    expect(prisma.userDismissedNotice.upsert).not.toHaveBeenCalled();
    expect(currentUserViewService.getCurrentUser).not.toHaveBeenCalled();
  });
});
