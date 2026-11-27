import { z } from 'zod';
import { afterEach, describe, expect, it, vi } from 'vitest';

// A page read of README §1 with the cookie store, `redirect` and the backoffice API faked: a redirect throws, as it
// does in Next.js, and the test reads where it pointed.
const fakes = vi.hoisted(() => {
  class Redirected extends Error {
    constructor(readonly url: string) {
      super(`redirect ${url}`);
    }
  }
  class NotFound extends Error {}
  return {
    Redirected,
    NotFound,
    token: undefined as string | undefined,
    callBackofficeApi: vi.fn(),
  };
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
  notFound: () => {
    throw new fakes.NotFound('not found');
  },
}));
vi.mock('@/bff/upstream', () => ({ callBackofficeApi: fakes.callBackofficeApi }));

const { readBackoffice, readBackofficeTarget } = await import('./backoffice-read');
const { BackofficeUnavailableError } = await import('./session');

const read = () => readBackoffice('/audit/events', z.object({ events: z.array(z.unknown()) }));

afterEach(() => {
  fakes.token = undefined;
});

async function redirectOf(run: () => Promise<unknown>): Promise<string> {
  const error: unknown = await run().then(
    () => null,
    (thrown: unknown) => thrown,
  );
  if (!(error instanceof fakes.Redirected)) throw new Error('expected a redirect');
  return error.url;
}

describe('readBackoffice (README §1)', () => {
  it('sends a console page whose cookie the API no longer knows to /login?ended=closed', async () => {
    fakes.token = 'session-token';
    fakes.callBackofficeApi.mockResolvedValue({
      kind: 'error',
      status: 401,
      code: 'session_required',
    });
    expect(await redirectOf(read)).toBe('/login?ended=closed');
  });

  it('keeps /login without a cookie and /login?ended=expired for an expired session', async () => {
    expect(await redirectOf(read)).toBe('/login');
    expect(fakes.callBackofficeApi).not.toHaveBeenCalled();

    fakes.token = 'session-token';
    fakes.callBackofficeApi.mockResolvedValue({
      kind: 'error',
      status: 401,
      code: 'session_expired',
    });
    expect(await redirectOf(read)).toBe('/login?ended=expired');
  });

  it('renders the not-found page when the API has no such target (a detail read of a missing id)', async () => {
    fakes.token = 'session-token';
    fakes.callBackofficeApi.mockResolvedValue({ kind: 'error', status: 404, code: 'not_found' });
    await expect(
      readBackofficeTarget('/legal/drafts/5a1f0c2e-0000-4000-8000-0000000000d1', z.object({})),
    ).rejects.toBeInstanceOf(fakes.NotFound);
  });

  it('keeps a list read the API answers not_found an unusable read, not a missing page', async () => {
    // The home's pending lines read lists; a missing route there leaves its line, not the whole page.
    fakes.token = 'session-token';
    fakes.callBackofficeApi.mockResolvedValue({ kind: 'error', status: 404, code: 'not_found' });
    await expect(read()).rejects.toBeInstanceOf(BackofficeUnavailableError);
  });
});
