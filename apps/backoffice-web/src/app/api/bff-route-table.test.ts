import { readdirSync } from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BffRouteContext } from '@/bff/mutation-route';

/**
 * Every BFF route, the upstream call it makes and what the page gets back (README §3). A new route
 * fails this test until it is listed here, so no route opens without the same-origin guard and the
 * session check, and each route module runs its success path against an upstream fake: the upstream
 * path, the forwarded body, the 200 (body) or 204 (none) pairing, the page projection and the cookie.
 */
const ID = '0f8fad5b-d9cb-469f-a165-70867728950e';
const TOKEN = 't'.repeat(43);
const NOW = '2026-11-22T04:00:00.000Z';
const CHALLENGE = { challengeId: ID, options: { challenge: 'c'.repeat(43) } };
const AUTH_CREDENTIAL = {
  id: 'Y3JlZA',
  rawId: 'Y3JlZA',
  type: 'public-key',
  response: { clientDataJSON: 'Y2Q', authenticatorData: 'YWQ', signature: 'c2ln' },
  clientExtensionResults: {},
};
const REGISTRATION_CREDENTIAL = {
  id: 'Y3JlZA',
  rawId: 'Y3JlZA',
  type: 'public-key',
  response: { clientDataJSON: 'Y2Q', attestationObject: 'YXR0' },
  clientExtensionResults: {},
};
const session = (scope: 'FULL' | 'RECOVERY') => ({
  session: { token: TOKEN, scope, absoluteExpiresAt: NOW },
});
const TOTP = { secret: 'A'.repeat(32), uri: 'otpauth://totp/Dormduri:owner' };
const RECOVERY_CODES = ['ABCDE-FGHIJ', 'KLMNO-PQRST'];
const ACCESS_REQUEST = {
  id: ID,
  kind: 'ROLE_GRANT',
  status: 'PENDING',
  contentDigest: 'a'.repeat(64),
  targetAccountId: ID,
  targetRole: 'AUDITOR',
  requestedByAccountId: ID,
  requestReason: null,
  expiresAt: NOW,
  decidedByAccountId: null,
  closedAt: null,
  decisionReason: null,
  selfApproved: false,
  createdAt: NOW,
};

const LEGAL_DRAFT_BODY = {
  kind: 'AGE_14_OR_ABOVE_NOTICE',
  contentSchemaVersion: 1,
  title: '만 14세 이상 확인',
  summaryItems: [],
  sections: [{ type: 'paragraph', text: '만 14세 이상만 가입할 수 있습니다.' }],
  changeSummary: '첫 게시',
  noticeClass: 'INITIAL',
  consentRequired: false,
  proposedEffectiveDate: '2026-06-22',
};
const LEGAL_DRAFT = {
  id: ID,
  kind: 'AGE_14_OR_ABOVE_NOTICE',
  status: 'EDITING',
  revision: 1,
  basedOnVersionId: null,
  authorAccountId: ID,
  content: { ...LEGAL_DRAFT_BODY, appliesUntil: null },
  contentDigest: 'b'.repeat(64),
  createdAt: NOW,
  updatedAt: NOW,
};
const LEGAL_REQUEST = {
  id: ID,
  kind: 'LEGAL_PUBLISH',
  status: 'PENDING',
  contentDigest: 'b'.repeat(64),
  targetLegalDraftId: ID,
  targetLegalVersionId: null,
  requestedByAccountId: ID,
  requestReason: null,
  expiresAt: NOW,
  decidedByAccountId: null,
  closedAt: null,
  decisionReason: null,
  selfApproved: false,
  createdAt: NOW,
};
const LEGAL_VERSION = {
  id: ID,
  kind: 'AGE_14_OR_ABOVE_NOTICE',
  version: 'age-14-or-above-notice-2026-06-22',
  title: '만 14세 이상 확인',
  changeSummary: '첫 게시',
  noticeClass: 'INITIAL',
  consentRequired: false,
  effectiveDate: '2026-06-22',
  appliesUntil: null,
  contentDigest: 'b'.repeat(64),
  publishedAt: NOW,
  withdrawnAt: null,
  requestedByAccountId: ID,
  approvedByAccountId: ID,
  selfApproved: true,
};

interface RouteSpec {
  readonly access: 'public' | 'session';
  /** Upstream path with every path id set to ID. */
  readonly upstream: string;
  /** The upstream method when it is not POST (a draft save is a PUT); the browser always posts. */
  readonly upstreamMethod?: 'PUT';
  readonly body?: unknown;
  /** The upstream's success answer: a JSON body (200) or none (204). */
  readonly upstreamBody?: unknown;
  /** What the page gets: the upstream body unless the route projects it; none means 204. */
  readonly page?: unknown;
  /** Login and registration put the token in the cookie, never in the page body. */
  readonly issuesSession?: boolean;
}

const EXPECTED_ROUTES: Record<string, RouteSpec> = {
  'auth/login/password': {
    access: 'public',
    upstream: '/auth/login/password',
    body: { email: 'owner@backoffice.test', password: 'p'.repeat(12) },
    upstreamBody: { ...CHALLENGE, recovery: { totp: true, recoveryCode: false } },
  },
  'auth/login/passkey': {
    access: 'public',
    upstream: '/auth/login/passkey',
    body: { challengeId: ID, credential: AUTH_CREDENTIAL },
    upstreamBody: session('FULL'),
    page: { scope: 'FULL' },
    issuesSession: true,
  },
  'auth/login/totp': {
    access: 'public',
    upstream: '/auth/login/totp',
    body: { challengeId: ID, code: '123456' },
    upstreamBody: session('RECOVERY'),
    page: { scope: 'RECOVERY' },
    issuesSession: true,
  },
  'auth/login/recovery-code': {
    access: 'public',
    upstream: '/auth/login/recovery-code',
    body: { challengeId: ID, code: 'ABCDE-FGHIJ' },
    upstreamBody: session('RECOVERY'),
    page: { scope: 'RECOVERY' },
    issuesSession: true,
  },
  'auth/registration/options': {
    access: 'public',
    upstream: '/auth/registration/options',
    body: { code: 'c'.repeat(16) },
    upstreamBody: { ...CHALLENGE, email: 'owner@backoffice.test', displayName: 'Owner' },
  },
  'auth/registration': {
    access: 'public',
    upstream: '/auth/registration',
    body: {
      code: 'c'.repeat(16),
      password: 'p'.repeat(12),
      challengeId: ID,
      credential: REGISTRATION_CREDENTIAL,
    },
    upstreamBody: {
      ...session('FULL'),
      accountId: ID,
      totp: TOTP,
      recoveryCodes: RECOVERY_CODES,
    },
    page: { scope: 'FULL', totp: TOTP, recoveryCodes: RECOVERY_CODES },
    issuesSession: true,
  },
  'auth/logout': { access: 'session', upstream: '/auth/logout' },
  'auth/passkeys/options': {
    access: 'session',
    upstream: '/auth/passkeys/options',
    upstreamBody: CHALLENGE,
  },
  'auth/passkeys': {
    access: 'session',
    upstream: '/auth/passkeys',
    body: { challengeId: ID, credential: REGISTRATION_CREDENTIAL, label: 'MacBook' },
    upstreamBody: { passkeyId: ID },
  },
  'auth/reauthentication/options': {
    access: 'session',
    upstream: '/auth/reauthentication/options',
    upstreamBody: CHALLENGE,
  },
  'auth/reauthentication': {
    access: 'session',
    upstream: '/auth/reauthentication',
    body: { challengeId: ID, credential: AUTH_CREDENTIAL },
    upstreamBody: { reauthenticatedUntil: NOW },
  },
  'auth/totp/confirm': {
    access: 'session',
    upstream: '/auth/totp/confirm',
    body: { code: '123456' },
  },
  'auth/totp': { access: 'session', upstream: '/auth/totp', upstreamBody: TOTP },
  'auth/recovery-codes': {
    access: 'session',
    upstream: '/auth/recovery-codes',
    upstreamBody: { recoveryCodes: RECOVERY_CODES },
  },
  'accounts/invitations': {
    access: 'session',
    upstream: '/accounts/invitations',
    body: { email: 'auditor@backoffice.test', displayName: '감사 운영자' },
    upstreamBody: { invitationId: ID, code: 'c'.repeat(20), expiresAt: NOW },
  },
  'accounts/invitations/[invitationId]/revoke': {
    access: 'session',
    upstream: `/accounts/invitations/${ID}/revoke`,
  },
  'accounts/[accountId]/deactivate': {
    access: 'session',
    upstream: `/accounts/${ID}/deactivate`,
    body: { reason: '퇴직' },
  },
  'access/requests': {
    access: 'session',
    upstream: '/access/requests',
    body: { kind: 'ROLE_GRANT', targetAccountId: ID, targetRole: 'AUDITOR' },
    upstreamBody: ACCESS_REQUEST,
  },
  'access/requests/[requestId]/approve': {
    access: 'session',
    upstream: `/access/requests/${ID}/approve`,
    body: { contentDigest: 'a'.repeat(64) },
    upstreamBody: { ...ACCESS_REQUEST, status: 'APPROVED', decidedByAccountId: ID },
  },
  'access/requests/[requestId]/reject': {
    access: 'session',
    upstream: `/access/requests/${ID}/reject`,
    body: { contentDigest: 'a'.repeat(64), reason: '대상이 맞지 않음' },
    upstreamBody: { ...ACCESS_REQUEST, status: 'REJECTED', decidedByAccountId: ID },
  },
  'access/requests/[requestId]/cancel': {
    access: 'session',
    upstream: `/access/requests/${ID}/cancel`,
    upstreamBody: { ...ACCESS_REQUEST, status: 'CANCELLED' },
  },
  'audit/reviews': {
    access: 'session',
    upstream: '/audit/reviews',
    body: { note: '11월 점검' },
    upstreamBody: { auditEventId: ID },
  },
  'legal/drafts': {
    access: 'session',
    upstream: '/legal/drafts',
    body: { source: 'import', draft: LEGAL_DRAFT_BODY },
    upstreamBody: LEGAL_DRAFT,
  },
  'legal/drafts/[draftId]': {
    access: 'session',
    upstream: `/legal/drafts/${ID}`,
    upstreamMethod: 'PUT',
    body: { revision: 1, draft: LEGAL_DRAFT_BODY },
    upstreamBody: { ...LEGAL_DRAFT, revision: 2 },
  },
  'legal/drafts/[draftId]/discard': {
    access: 'session',
    upstream: `/legal/drafts/${ID}/discard`,
    body: { revision: 2 },
    upstreamBody: { ...LEGAL_DRAFT, status: 'DISCARDED', revision: 3 },
  },
  'legal/drafts/[draftId]/publish-requests': {
    access: 'session',
    upstream: `/legal/drafts/${ID}/publish-requests`,
    body: { revision: 2, reason: '첫 게시' },
    upstreamBody: LEGAL_REQUEST,
  },
  'legal/versions/[versionId]/withdraw-requests': {
    access: 'session',
    upstream: `/legal/versions/${ID}/withdraw-requests`,
    body: { reason: '시행일을 다시 정함' },
    upstreamBody: {
      ...LEGAL_REQUEST,
      kind: 'LEGAL_WITHDRAW',
      targetLegalDraftId: null,
      targetLegalVersionId: ID,
    },
  },
  'legal/requests/[requestId]/approve': {
    access: 'session',
    upstream: `/legal/requests/${ID}/approve`,
    body: { contentDigest: 'b'.repeat(64), reason: '승인 권한 운영자가 한 명뿐임' },
    upstreamBody: {
      request: { ...LEGAL_REQUEST, status: 'APPROVED', decidedByAccountId: ID, selfApproved: true },
      version: LEGAL_VERSION,
    },
  },
  'legal/requests/[requestId]/reject': {
    access: 'session',
    upstream: `/legal/requests/${ID}/reject`,
    body: { contentDigest: 'b'.repeat(64), reason: '시행일이 너무 이름' },
    upstreamBody: {
      request: { ...LEGAL_REQUEST, status: 'REJECTED', decidedByAccountId: ID },
      version: null,
    },
  },
  'legal/requests/[requestId]/cancel': {
    access: 'session',
    upstream: `/legal/requests/${ID}/cancel`,
    upstreamBody: { ...LEGAL_REQUEST, status: 'CANCELLED' },
  },
};

const API = 'http://backoffice-api.test:4310';
const SAME_ORIGIN = {
  origin: 'http://localhost:4300',
  'sec-fetch-site': 'same-origin',
  host: 'localhost:4300',
};
const API_DIR = path.dirname(new URL(import.meta.url).pathname);
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

function request(route: string, headers: Record<string, string>, body: unknown = {}) {
  const url = `http://localhost:4300/api/${route.replace(/\[[^\]]+\]/gu, ID)}`;
  return new NextRequest(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function upstreamAnswer(body: unknown): Response {
  return body === undefined
    ? new Response(null, { status: 204 })
    : new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'content-type': 'application/json' },
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
  vi.stubEnv('BACKOFFICE_API_URL', API);
  vi.spyOn(process.stderr, 'write').mockReturnValue(true);
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('BFF route table', () => {
  it('lists every route file', () => {
    expect(routeFiles().sort()).toEqual(Object.keys(EXPECTED_ROUTES).sort());
  });

  describe.each(Object.entries(EXPECTED_ROUTES))('%s', (route, spec) => {
    const { access } = spec;
    it('exports POST only (GET never changes state, README §3)', async () => {
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
      expect(response.headers.get('x-backoffice-session-activity')).toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('calls its upstream path once and gives the page its projection', async () => {
      fetchMock.mockResolvedValueOnce(upstreamAnswer(spec.upstreamBody));
      const { POST } = await load(route);
      const response = await POST(
        request(route, { ...SAME_ORIGIN, cookie: `dormduri_bo_session=session-token` }, spec.body),
        contextFor(route),
      );

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0]!;
      expect(String(url)).toBe(`${API}${spec.upstream}`);
      expect(init?.method).toBe(spec.upstreamMethod ?? 'POST');
      expect(init?.body === undefined ? undefined : JSON.parse(String(init.body))).toEqual(
        spec.body,
      );
      expect(new Headers(init?.headers).get('authorization')).toBe(
        access === 'session' ? 'Bearer session-token' : null,
      );

      const page = spec.page ?? spec.upstreamBody;
      const text = await response.text();
      expect(response.status).toBe(page === undefined ? 204 : 200);
      expect(text === '' ? undefined : JSON.parse(text)).toEqual(page);
      expect(response.headers.get('cache-control')).toBe('no-store');
      const cookies = response.headers.getSetCookie();
      if (spec.issuesSession) {
        expect(text).not.toContain(TOKEN);
        expect(cookies[0]).toContain(`dormduri_bo_session=${TOKEN};`);
      } else if (route === 'auth/logout') {
        expect(cookies[0]).toMatch(/Max-Age=0/u);
      } else {
        expect(cookies).toEqual([]);
      }
      expect(response.headers.get('x-backoffice-session-activity')).toBe(
        access === 'session' && route !== 'auth/logout' ? '1' : null,
      );
    });

    it('answers 502 when the upstream status does not match the route (200 with a body or 204)', async () => {
      fetchMock.mockResolvedValueOnce(
        upstreamAnswer(spec.upstreamBody === undefined ? { unexpected: true } : undefined),
      );
      const { POST } = await load(route);
      const response = await POST(
        request(route, { ...SAME_ORIGIN, cookie: `dormduri_bo_session=session-token` }, spec.body),
        contextFor(route),
      );
      expect(response.status).toBe(502);
      expect(await response.json()).toEqual({ error: { code: 'upstream_invalid' } });
      expect(response.headers.getSetCookie()).toEqual(
        route === 'auth/logout' ? [expect.stringMatching(/Max-Age=0/u)] : [],
      );
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
