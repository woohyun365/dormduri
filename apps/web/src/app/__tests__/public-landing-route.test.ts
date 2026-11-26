import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { isValidElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LegalDocumentKind, type LegalRevisionNotice } from '@repo/shared/legal';
import { LandingScreen } from '@/screens/landing';

// The `/` route reads the legal revision notices per request (D-LU17). The loader (apps/web/src/legal/api)
// and Next's request marker are mocked here (vi.mock is hoisted above the imports).
const request = vi.hoisted(() => ({
  loadLegalRevisionNotices: vi.fn(),
  connection: vi.fn(async () => undefined),
  order: [] as string[],
}));
vi.mock('@/legal/api/legal-document.server', () => ({
  loadLegalRevisionNotices: (...args: unknown[]) => {
    request.order.push('loader');
    return request.loadLegalRevisionNotices(...args);
  },
}));
vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  connection: () => {
    request.order.push('connection');
    return request.connection();
  },
}));

const { default: Home } = await import('../page');

const notice: LegalRevisionNotice = {
  kind: LegalDocumentKind.PRIVACY_POLICY,
  versionKey: '2026-12-21',
  status: 'scheduled',
  appliesFrom: '2026-12-21',
  appliesUntil: null,
  changeSummary: '변경 요약',
  consentRequired: false,
};

async function landingProps() {
  const element = await Home();
  expect(isValidElement(element)).toBe(true);
  expect((element as { type: unknown }).type).toBe(LandingScreen);
  return (element as { props: { revisionNotices?: readonly LegalRevisionNotice[] } }).props;
}

const readAppSource = (relativePath: string) =>
  readFileSync(path.join(process.cwd(), 'src', 'app', relativePath), 'utf8');

const collectSources = (directory: string): string[] =>
  readdirSync(directory).flatMap((entry) => {
    const absolutePath = path.join(directory, entry);
    const stats = statSync(absolutePath);

    if (stats.isDirectory()) {
      return collectSources(absolutePath);
    }

    return /\.(tsx?|jsx?)$/.test(entry) ? [readFileSync(absolutePath, 'utf8')] : [];
  });

describe('public landing route boundary', () => {
  const pageSource = readAppSource('page.tsx');

  it('root route는 GatewayPage session gateway를 import하지 않는다', () => {
    expect(pageSource).not.toContain('GatewayPage');
    expect(pageSource).not.toMatch(/@\/components\/GatewayPage|components\/GatewayPage/);
  });

  it('root route는 request-time session check 때문에 force-dynamic으로 고정하지 않는다', () => {
    expect(pageSource).not.toMatch(/export\s+const\s+dynamic\s*=\s*['"]force-dynamic['"]/);
  });

  it('root route는 Landing 화면 계층의 공개 entry만 렌더링한다', () => {
    const screenImports = [...pageSource.matchAll(/from\s+['"](@\/screens\/[^'"]*)['"]/g)].map(
      ([, specifier]) => specifier,
    );

    expect(screenImports).toEqual(['@/screens/landing']);
    expect(pageSource).toMatch(/<LandingScreen\s*\/?/);
  });

  it('Landing source는 다른 Web 화면 계층을 import하지 않는다', () => {
    const landingSources = collectSources(path.join(process.cwd(), 'src', 'screens', 'landing'));

    for (const source of landingSources) {
      const webImports = [...source.matchAll(/from\s+['"](@\/[^'"]*)['"]/g)].map(
        ([, specifier = '']) => specifier,
      );
      expect(webImports.filter((specifier) => !specifier.startsWith('@/screens/ui/'))).toEqual([]);
    }
  });

  it('Landing source는 인증 앱 shell skeleton을 직접 소유하지 않는다', () => {
    const landingSources = collectSources(path.join(process.cwd(), 'src', 'screens', 'landing'));

    for (const source of landingSources) {
      expect(source).not.toMatch(/from\s+['"][^'"]*AppShellSkeleton/);
      expect(source).not.toMatch(/from\s+['"][^'"]*GatewaySkeleton/);
      expect(source).not.toMatch(/from\s+['"]@\/components\/Skeleton['"]/);
      expect(source).not.toMatch(/from\s+['"][^'"]*components\/Skeleton['"]/);
    }
  });

  describe('revision notices (D-LU17)', () => {
    beforeEach(() => {
      request.loadLegalRevisionNotices.mockReset();
      request.order.length = 0;
    });

    it('reads the revision notices at request time and passes them to the landing (D-LU17)', async () => {
      request.loadLegalRevisionNotices.mockResolvedValue({
        status: 'published',
        data: { notices: [notice] },
      });

      expect((await landingProps()).revisionNotices).toEqual([notice]);
      // connection() first: the route is rendered per request and the build never reads the API
      // (Next.js 16.4 connection; no force-dynamic export, see above).
      expect(request.order).toEqual(['connection', 'loader']);
      expect(pageSource).toMatch(/await\s+connection\(\)[\s\S]*loadLegalRevisionNotices\(/);
    });

    it('cuts the revision notices read short so a stalled API does not hold the landing (D-LU17)', async () => {
      request.loadLegalRevisionNotices.mockResolvedValue({ status: 'unavailable' });
      await landingProps();

      // Owner LU4 Q4: only the landing line reads with a short timeout; the document pages keep the
      // loader's own timeout.
      const [options] = request.loadLegalRevisionNotices.mock.calls.at(-1) ?? [];
      expect(options).toEqual({ timeoutMs: expect.any(Number) });
      expect((options as { timeoutMs: number }).timeoutMs).toBeLessThanOrEqual(500);
    });

    it('renders the landing without the band when the notices cannot be read (D-LU17)', async () => {
      request.loadLegalRevisionNotices.mockResolvedValue({ status: 'unavailable' });
      expect((await landingProps()).revisionNotices).toEqual([]);

      // A kept copy has no check time on the landing and may name a version already in force.
      request.loadLegalRevisionNotices.mockResolvedValue({
        status: 'last-success',
        data: { notices: [notice] },
        checkedAt: '2026-11-25T09:30:00.000Z',
      });
      expect((await landingProps()).revisionNotices).toEqual([]);
    });
  });
});
