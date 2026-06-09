import type {
  CurrentUserResponse,
  DismissCurrentUserOnboardingNoticeRequest,
} from '@repo/shared/user-contract';
import type { AuthenticatedUserContext } from '../../auth/application/auth-actor-context.types.js';
import type { PrismaService } from '../../platform/database/prisma.service.js';
import type { CurrentUserViewService } from '../current-user/current-user-view.service.js';
import { dismissOnboardingNotice } from './onboarding-notice.repository.js';
import { assertSupportedOnboardingNoticeKey } from './onboarding-notice.policy.js';

export interface DismissOnboardingNoticeCommandDeps {
  prisma: PrismaService;
  currentUserViewService: CurrentUserViewService;
}

export function createDismissOnboardingNoticeCommand(deps: DismissOnboardingNoticeCommandDeps) {
  async function dismissCurrentUserOnboardingNotice(
    authUser: AuthenticatedUserContext,
    input: DismissCurrentUserOnboardingNoticeRequest,
  ): Promise<CurrentUserResponse> {
    const noticeKey = assertSupportedOnboardingNoticeKey(input.noticeKey);
    const now = await deps.prisma.getDatabaseNow();
    await dismissOnboardingNotice(deps.prisma, {
      userId: authUser.id,
      noticeKey,
      dismissedAt: now,
    });

    return deps.currentUserViewService.getCurrentUser(authUser);
  }

  return {
    dismissCurrentUserOnboardingNotice,
  };
}
