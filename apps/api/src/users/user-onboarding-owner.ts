import {
  SERVICE_INTRO_NOTICE_KEY,
  type CurrentUserResponse,
  type DismissCurrentUserOnboardingNoticeRequest,
} from '@repo/shared/user-contract';
import type { AuthenticatedUserContext } from '../auth/application/auth-actor-context.types.js';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { isPrismaKnownRequestError } from '../common/prisma/prisma-error.js';
import { CurrentUserViewService } from './current-user-view.service.js';
import { usersErrors } from './users.errors.js';

interface UserOnboardingOwnerDeps {
  prisma: PrismaService;
  currentUserViewService: CurrentUserViewService;
}

export function createUserOnboardingOwner(deps: UserOnboardingOwnerDeps) {
  async function dismissCurrentUserOnboardingNotice(
    authUser: AuthenticatedUserContext,
    input: DismissCurrentUserOnboardingNoticeRequest,
  ): Promise<CurrentUserResponse> {
    if (input.noticeKey !== SERVICE_INTRO_NOTICE_KEY) {
      throw usersErrors.invalidPatch('지원하지 않는 onboarding noticeKey입니다.', 'noticeKey');
    }

    const now = await deps.prisma.getDatabaseNow();
    try {
      await deps.prisma.userDismissedNotice.upsert({
        where: {
          userId_noticeKey: {
            userId: authUser.id,
            noticeKey: SERVICE_INTRO_NOTICE_KEY,
          },
        },
        update: {},
        create: {
          userId: authUser.id,
          noticeKey: SERVICE_INTRO_NOTICE_KEY,
          dismissedAt: now,
        },
      });
    } catch (error) {
      if (!isPrismaKnownRequestError(error, 'P2002')) {
        throw error;
      }
    }

    return deps.currentUserViewService.getCurrentUser(authUser);
  }

  return {
    dismissCurrentUserOnboardingNotice,
  };
}
