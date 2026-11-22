import { readdirSync } from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BffRouteContext } from '@/bff/mutation-route';

/**
 * Every BFF route and the upstream path it may call (README §3). A new route fails this test until
 * it is listed here, so no route opens without the same-origin guard and the session check.
 */
const EXPECTED_ROUTES: Record<string, { access: 'public' | 'session' }> = {
  'auth/login/password': { access: 'public' },
  'auth/login/passkey': { access: 'public' },
  'auth/login/totp': { access: 'public' },
  'auth/login/recovery-code': { access: 'public' },
  'auth/registration/options': { access: 'public' },
  'auth/registration': { access: 'public' },
  'auth/logout': { access: 'session' },
  'auth/passkeys/options': { access: 'session' },
  'auth/passkeys': { access: 'session' },
  'auth/reauthentication/options': { access: 'session' },
  'auth/reauthentication': { access: 'session' },
  'auth/totp/confirm': { access: 'session' },
  'auth/totp': { access: 'session' },
  'auth/recovery-codes': { access: 'session' },
  'accounts/invitations': { access: 'session' },
  'accounts/invitations/[invitationId]/revoke': { access: 'session' },
  'accounts/[accountId]/deactivate': { access: 'session' },
  'access/requests': { access: 'session' },
  'access/requests/[requestId]/approve': { access: 'session' },
  'access/requests/[requestId]/reject': { access: 'session' },
  'access/requests/[requestId]/cancel': { access: 'session' },
  'audit/reviews': { access: 'session' },
};

const API_DIR = path.dirname(new URL(import.meta.url).pathname);
const ID = '0f8fad5b-d9cb-469f-a165-70867728950e';
const HTTP_METHODS = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];

function routeFiles(dir = API_DIR, prefix = ''): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) return routeFiles(path.join(dir, entry.name), relative);
    return entry.name === 'route.ts' ? [prefix] : [];
  });
}

function contextFor(route: string): BffRouteContext {
  const params = Object.fromEntries(
    [...route.matchAll(/\[([^\]]+)\]/gu)].map((match) => [match[1]!, ID]),
  );
  return { params: Promise.resolve(params) };
}

function request(route: string, headers: Record<string, string>) {
  const url = `http://localhost:4300/api/${route.replace(/\[[^\]]+\]/gu, ID)}`;
  return new NextRequest(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: '{}',
  });
}

type RouteModule = Record<string, unknown> & {
  POST: (request: NextRequest, context: BffRouteContext) => Promise<Response>;
};

// Vite resolves the route modules at build time; the fs listing above checks nothing is missed.
const ROUTE_MODULES = import.meta.glob<RouteModule>('./**/route.ts');

async function load(route: string): Promise<RouteModule> {
  const loader = ROUTE_MODULES[`./${route}/route.ts`];
  if (!loader) throw new Error(`no route module for ${route}`);
  return loader();
}

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubEnv('BACKOFFICE_API_URL', 'http://backoffice-api.test:4310');
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllEnvs();
});

describe('BFF route table', () => {
  it('lists every route file', () => {
    expect(routeFiles().sort()).toEqual(Object.keys(EXPECTED_ROUTES).sort());
  });

  describe.each(Object.entries(EXPECTED_ROUTES))('%s', (route, { access }) => {
    it('exports POST only (GET never changes state, D-BF4)', async () => {
      const routeModule = await load(route);
      expect(HTTP_METHODS.filter((method) => method in routeModule)).toEqual(['POST']);
    });

    it.each([
      [
        'a cross-origin request',
        { origin: 'http://localhost:3000', 'sec-fetch-site': 'same-site', host: 'localhost:4300' },
      ],
      [
        'a request without Fetch Metadata',
        { origin: 'http://localhost:4300', host: 'localhost:4300' },
      ],
      [
        'a rebound host',
        {
          origin: 'http://localhost:4300',
          'sec-fetch-site': 'same-origin',
          host: 'attacker.example:4300',
        },
      ],
    ])('refuses %s with 403 before calling the API', async (_name, headers) => {
      const { POST } = await load(route);
      const response = await POST(request(route, headers), contextFor(route));
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({ error: { code: 'forbidden_origin' } });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    if (access === 'session') {
      it('needs the session cookie before calling the API', async () => {
        const { POST } = await load(route);
        const response = await POST(
          request(route, {
            origin: 'http://localhost:4300',
            'sec-fetch-site': 'same-origin',
            host: 'localhost:4300',
          }),
          contextFor(route),
        );
        // Logout without a session is already done; every other route asks for one.
        expect(response.status).toBe(route === 'auth/logout' ? 204 : 401);
        expect(fetchMock).not.toHaveBeenCalled();
      });
    }
  });
});
