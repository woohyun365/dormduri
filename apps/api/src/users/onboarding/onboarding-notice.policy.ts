import {
  SERVICE_INTRO_NOTICE_KEY,
  type DismissCurrentUserOnboardingNoticeRequest,
} from '@repo/shared/user';
import { usersErrors } from '../users.errors.js';

export type SupportedOnboardingNoticeKey = typeof SERVICE_INTRO_NOTICE_KEY;

export function assertSupportedOnboardingNoticeKey(
  noticeKey: DismissCurrentUserOnboardingNoticeRequest['noticeKey'],
): SupportedOnboardingNoticeKey {
  if (noticeKey !== SERVICE_INTRO_NOTICE_KEY) {
    throw usersErrors.invalidPatch('지원하지 않는 onboarding noticeKey입니다.', 'noticeKey');
  }

  return SERVICE_INTRO_NOTICE_KEY;
}
