import { beforeEach, describe, expect, it, vi } from 'vitest';

const sentryMocks = vi.hoisted(() => ({
  init: vi.fn(),
  setTag: vi.fn(),
  captureRouterTransitionStart: vi.fn(),
}));

vi.mock('@sentry/nextjs', () => sentryMocks);

import {
  captureSentryRouterTransition,
  initializeSentryClient,
  resetSentryClientForTests,
} from '../client';

describe('Sentry client initialization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    resetSentryClientForTests();
  });

  it('production evidence가 불완전해도 제품 초기화를 중단하지 않는다', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_WEB_OBSERVABILITY_ENVIRONMENT', 'production');
    vi.stubEnv('NEXT_PUBLIC_SENTRY_ENABLED', '1');

    expect(initializeSentryClient()).toBe(false);
    expect(sentryMocks.init).not.toHaveBeenCalled();
  });

  it('SDK init 실패를 제품 runtime으로 전파하지 않는다', () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('NEXT_PUBLIC_SENTRY_LOCAL_RECORDING', '1');
    sentryMocks.init.mockImplementationOnce(() => {
      throw new Error('provider init failed');
    });

    expect(initializeSentryClient()).toBe(false);
    expect(() => captureSentryRouterTransition('/signup', 'push')).not.toThrow();
  });
});
