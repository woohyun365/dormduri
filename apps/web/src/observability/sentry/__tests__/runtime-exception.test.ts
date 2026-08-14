import { beforeEach, describe, expect, it, vi } from 'vitest';

const sentryMocks = vi.hoisted(() => ({
  captureException: vi.fn(() => 'event-id'),
  setFingerprint: vi.fn(),
  setTags: vi.fn(),
}));

vi.mock('@sentry/nextjs', () => ({
  captureException: sentryMocks.captureException,
  withScope: (callback: (scope: unknown) => void) =>
    callback({
      setFingerprint: sentryMocks.setFingerprint,
      setTags: sentryMocks.setTags,
    }),
}));

import { captureRuntimeException } from '../runtime-exception';

describe('runtime exception facade', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('NEXT_PUBLIC_SENTRY_LOCAL_RECORDING', '1');
  });

  it('동일 Error를 한 번만 capture하고 allowlisted tag만 설정한다', () => {
    const error = new TypeError('student@kangwon.ac.kr private form');
    const context = {
      source: 'route_boundary',
      handled: true,
      digestPresent: false,
    } as const;

    expect(captureRuntimeException(error, context)).toBe('event-id');
    expect(captureRuntimeException(error, context)).toBeUndefined();
    expect(sentryMocks.captureException).toHaveBeenCalledTimes(1);
    expect(sentryMocks.setTags).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'route_boundary', runtime: 'client' }),
    );
  });
});
