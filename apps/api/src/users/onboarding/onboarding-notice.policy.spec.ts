import { SERVICE_INTRO_NOTICE_KEY } from '@repo/shared/user';
import { assertSupportedOnboardingNoticeKey } from './onboarding-notice.policy.js';

type HttpErrorLike = {
  getResponse: () => unknown;
};

function isHttpErrorLike(error: unknown): error is HttpErrorLike {
  return (
    typeof error === 'object' &&
    error !== null &&
    'getResponse' in error &&
    typeof (error as { getResponse?: unknown }).getResponse === 'function'
  );
}

describe('onboarding notice policy', () => {
  it('service-intro notice key만 지원한다', () => {
    expect(assertSupportedOnboardingNoticeKey(SERVICE_INTRO_NOTICE_KEY)).toBe(
      SERVICE_INTRO_NOTICE_KEY,
    );
  });

  it('지원하지 않는 notice key는 기존 INVALID_USER_PATCH response를 유지한다', () => {
    try {
      assertSupportedOnboardingNoticeKey('unknown-notice' as never);
      throw new Error('Expected invalid onboarding notice key');
    } catch (error) {
      expect(isHttpErrorLike(error)).toBe(true);
      if (!isHttpErrorLike(error)) {
        throw error;
      }
      expect(error.getResponse()).toEqual({
        success: false,
        code: 'INVALID_USER_PATCH',
        error: '지원하지 않는 onboarding noticeKey입니다.',
        fieldErrors: {
          noticeKey: ['지원하지 않는 onboarding noticeKey입니다.'],
        },
      });
    }
  });
});
