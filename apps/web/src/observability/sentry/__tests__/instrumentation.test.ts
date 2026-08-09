import { beforeEach, describe, expect, it, vi } from 'vitest';

const sentryMocks = vi.hoisted(() => ({
  captureRequestError: vi.fn(),
}));

vi.mock('@sentry/nextjs', () => sentryMocks);

import { onRequestError } from '@/instrumentation';

describe('Next request error instrumentation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it('account-free recording config에서 unexpected request error를 한 번 전달한다', () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('NEXT_RUNTIME', 'nodejs');
    vi.stubEnv('NEXT_PUBLIC_SENTRY_LOCAL_RECORDING', '1');

    onRequestError(new Error('synthetic server error'), {} as never, {} as never);

    expect(sentryMocks.captureRequestError).toHaveBeenCalledTimes(1);
  });

  it('provider capture 실패를 request flow로 전파하지 않는다', () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('NEXT_RUNTIME', 'edge');
    vi.stubEnv('NEXT_PUBLIC_SENTRY_LOCAL_RECORDING', '1');
    sentryMocks.captureRequestError.mockImplementationOnce(() => {
      throw new Error('provider unavailable');
    });

    expect(() =>
      onRequestError(new Error('synthetic edge error'), {} as never, {} as never),
    ).not.toThrow();
  });
});
