import { describe, expect, it, vi, type Mock } from 'vitest';
import { SERVICE_INTRO_NOTICE_KEY } from '@repo/shared/user';
import { dismissOnboardingNotice } from './onboarding-notice.repository.js';

const NOW = new Date('2026-05-21T00:00:00.000Z');

type DismissedNoticeUpsertArgs = {
  where: {
    userId_noticeKey: {
      userId: string;
      noticeKey: string;
    };
  };
  update: Record<string, never>;
  create: {
    userId: string;
    noticeKey: string;
    dismissedAt: Date;
  };
};

function createClient() {
  return {
    userDismissedNotice: {
      upsert: vi.fn(),
    },
  };
}

describe('onboarding notice repository', () => {
  it('userId+noticeKey compound key 기준으로 dismissed notice를 upsert한다', async () => {
    const client = createClient();

    await dismissOnboardingNotice(client as never, {
      userId: 'user-1',
      noticeKey: SERVICE_INTRO_NOTICE_KEY,
      dismissedAt: NOW,
    });

    const upsertMock = client.userDismissedNotice.upsert as Mock<
      (arg0: DismissedNoticeUpsertArgs) => unknown
    >;
    const [upsertArgs] = upsertMock.mock.calls[0]!;
    expect(upsertArgs).toEqual({
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
  });

  it('P2002 unique race는 idempotent success로 흡수한다', async () => {
    const client = createClient();
    client.userDismissedNotice.upsert.mockRejectedValue({ code: 'P2002' });

    await expect(
      dismissOnboardingNotice(client as never, {
        userId: 'user-1',
        noticeKey: SERVICE_INTRO_NOTICE_KEY,
        dismissedAt: NOW,
      }),
    ).resolves.toBeUndefined();
  });

  it('P2002가 아닌 Prisma error는 삼키지 않는다', async () => {
    const client = createClient();
    const error = Object.assign(new Error('connection closed'), { code: 'P1001' });
    client.userDismissedNotice.upsert.mockRejectedValue(error);

    await expect(
      dismissOnboardingNotice(client as never, {
        userId: 'user-1',
        noticeKey: SERVICE_INTRO_NOTICE_KEY,
        dismissedAt: NOW,
      }),
    ).rejects.toBe(error);
  });
});
