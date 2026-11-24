import { afterEach, describe, expect, it, vi } from 'vitest';

// The server reads of README §4 with the cookie store, `redirect` and the backoffice API faked: a redirect throws, as
// it does in Next.js, and the test reads where it pointed.
const fakes = vi.hoisted(() => {
  class Redirected extends Error {
    constructor(readonly url: string) {
      super(`redirect ${url}`);
    }
  }
  return { Redirected, token: undefined as string | undefined, callBackofficeApi: vi.fn() };
});
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (fakes.token ? { name, value: fakes.token } : undefined),
  }),
}));
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new fakes.Redirected(url);
  },
}));
vi.mock('@/bff/upstream', () => ({ callBackofficeApi: fakes.callBackofficeApi }));

const { requireFullSession, requireRecoverySession } = await import('./session');

afterEach(() => {
  fakes.token = undefined;
});

async function redirectOf(read: () => Promise<unknown>): Promise<string> {
  const error: unknown = await read().then(
    () => null,
    (thrown: unknown) => thrown,
  );
  if (!(error instanceof fakes.Redirected)) throw new Error('expected a redirect');
  return error.url;
}

describe('session gate (README §4)', () => {
  it('sends a console page whose cookie the API no longer knows to /login?ended=closed', async () => {
    fakes.token = 'session-token';
    fakes.callBackofficeApi.mockResolvedValue({
      kind: 'error',
      status: 401,
      code: 'session_required',
    });
    expect(await redirectOf(requireFullSession)).toBe('/login?ended=closed');
    expect(await redirectOf(requireRecoverySession)).toBe('/login?ended=closed');
  });

  it('keeps /login without a cookie and /login?ended=expired for an expired session', async () => {
    expect(await redirectOf(requireFullSession)).toBe('/login');
    expect(await redirectOf(requireRecoverySession)).toBe('/login');
    expect(fakes.callBackofficeApi).not.toHaveBeenCalled();

    fakes.token = 'session-token';
    fakes.callBackofficeApi.mockResolvedValue({
      kind: 'error',
      status: 401,
      code: 'session_expired',
    });
    expect(await redirectOf(requireFullSession)).toBe('/login?ended=expired');
    expect(await redirectOf(requireRecoverySession)).toBe('/login?ended=expired');
  });
});
