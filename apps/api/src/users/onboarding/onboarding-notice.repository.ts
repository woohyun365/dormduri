import type { Prisma } from '../../generated/prisma/client.js';
import type { PrismaService } from '../../platform/database/prisma.service.js';
import { isPrismaKnownRequestError } from '../../platform/database/prisma-error.js';
import type { SupportedOnboardingNoticeKey } from './onboarding-notice.policy.js';

export type OnboardingNoticeClient =
  | Pick<PrismaService, 'userDismissedNotice'>
  | Pick<Prisma.TransactionClient, 'userDismissedNotice'>;

export interface DismissOnboardingNoticeInput {
  userId: string;
  noticeKey: SupportedOnboardingNoticeKey;
  dismissedAt: Date;
}

export async function dismissOnboardingNotice(
  client: OnboardingNoticeClient,
  input: DismissOnboardingNoticeInput,
) {
  try {
    await client.userDismissedNotice.upsert({
      where: {
        userId_noticeKey: {
          userId: input.userId,
          noticeKey: input.noticeKey,
        },
      },
      update: {},
      create: {
        userId: input.userId,
        noticeKey: input.noticeKey,
        dismissedAt: input.dismissedAt,
      },
    });
  } catch (error) {
    if (!isPrismaKnownRequestError(error, 'P2002')) {
      throw error;
    }
  }
}
