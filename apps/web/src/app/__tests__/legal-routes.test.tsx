import { readFileSync } from 'node:fs';
import path from 'node:path';
import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LegalDocumentKind,
  type LegalDocumentPageResponse,
  type LegalVersionComparison,
} from '@repo/shared/legal';
import {
  privacyComparison,
  privacyPage,
  termsComparison,
  termsPage,
} from '@/screens/legal/__stories__/storyDocuments';
import PrivacyNotFound from '@/app/privacy/not-found';
import PrivacyPage, { metadata as privacyMetadata } from '@/app/privacy/page';
import TermsNotFound from '@/app/terms/not-found';
import TermsPage, { metadata as termsMetadata } from '@/app/terms/page';
import { formatLegalCheckedAt } from '@/screens/legal/model/legalDocumentModel';
import { legalDocumentNames, legalScreenCopy } from '@/screens/legal/model/legalScreenCopy';

// The legal routes on the new screen layer (fe.comp.route-entry-import-guard): like `/` and the root
// not-found, they import only the public entry of their feature. The loaders (the public reading
// contract, apps/web/src/legal/api) are mocked here (vi.mock is hoisted above the imports); their own
// behaviour has its own tests.
const loaders = vi.hoisted(() => ({
  loadLegalDocumentPage: vi.fn(),
  loadLegalVersionComparison: vi.fn(),
}));
vi.mock('@/legal/api/legal-document.server', () => loaders);

const PRIVACY = LegalDocumentKind.PRIVACY_POLICY;
const TERMS = LegalDocumentKind.TERMS_OF_SERVICE;
const CHECKED_AT = '2026-11-25T09:30:00.000Z';

const routes = [
  {
    kind: PRIVACY,
    path: '/privacy',
    Page: PrivacyPage,
    NotFound: PrivacyNotFound,
    page: privacyPage,
    comparison: privacyComparison,
  },
  {
    kind: TERMS,
    path: '/terms',
    Page: TermsPage,
    NotFound: TermsNotFound,
    page: termsPage,
    comparison: termsComparison,
  },
] as const;

function readRouteSource(file: string): string {
  return readFileSync(path.join(process.cwd(), 'src', 'app', file), 'utf8');
}

function request(version?: string) {
  return { searchParams: Promise.resolve(version === undefined ? {} : { version }) };
}

function sourceMark(container: HTMLElement) {
  return [...container.querySelectorAll('[data-dormduri-legal-source]')].map((element) =>
    element.getAttribute('data-dormduri-legal-source'),
  );
}

function answer(
  page: LegalDocumentPageResponse,
  comparison: LegalVersionComparison | null,
  status: 'published' | 'last-success' = 'published',
) {
  loaders.loadLegalDocumentPage.mockResolvedValue(
    status === 'published' ? { status, data: page } : { status, data: page, checkedAt: CHECKED_AT },
  );
  loaders.loadLegalVersionComparison.mockResolvedValue(
    comparison ? { status: 'published', data: comparison } : { status: 'unavailable' },
  );
}

beforeEach(() => {
  loaders.loadLegalDocumentPage.mockReset();
  loaders.loadLegalVersionComparison.mockReset();
});

describe('legal routes', () => {
  it('imports only the public entry of the legal screens (G-LU9)', () => {
    for (const file of [
      'privacy/page.tsx',
      'terms/page.tsx',
      'privacy/not-found.tsx',
      'terms/not-found.tsx',
    ]) {
      const source = readRouteSource(file);
      const screenImports = [...source.matchAll(/from\s+['"](@\/screens\/[^'"]*)['"]/g)].map(
        ([, specifier]) => specifier,
      );
      expect([file, screenImports]).toEqual([file, ['@/screens/legal']]);
      expect([file, source]).not.toEqual([file, expect.stringMatching(/['"]use client['"]/)]);
      expect([file, source]).not.toEqual([file, expect.stringContaining('@/legal/components')]);
    }
  });

  it.each(routes)('renders each load state on the new screen at $path (G-LU9)', async (route) => {
    answer(route.page, route.comparison);
    const shown = render(await route.Page(request()));
    expect(loaders.loadLegalDocumentPage).toHaveBeenCalledWith(route.kind, undefined);
    expect(loaders.loadLegalVersionComparison).toHaveBeenCalledWith(
      route.kind,
      route.page.viewing.versionKey,
    );
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(route.page.viewing.title);
    const nav = screen.getByRole('navigation', { name: legalScreenCopy.documentNavLabel });
    expect(within(nav).getByRole('link', { name: legalDocumentNames[route.kind] })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(sourceMark(shown.container)).toEqual(['published']);
    shown.unmount();

    answer(route.page, route.comparison, 'last-success');
    const kept = render(await route.Page(request()));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(route.page.viewing.title);
    const status = screen.getByText(legalScreenCopy.lastSuccessNotice).closest('[role="status"]');
    expect(status).toHaveTextContent(formatLegalCheckedAt(CHECKED_AT));
    expect(sourceMark(kept.container)).toEqual(['last-success']);
    kept.unmount();

    loaders.loadLegalDocumentPage.mockResolvedValue({ status: 'unavailable' });
    const unavailable = render(await route.Page(request()));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      `${legalDocumentNames[route.kind]}${legalScreenCopy.unavailableTitleSuffix}`,
    );
    expect(sourceMark(unavailable.container)).toEqual([]);
    expect(loaders.loadLegalVersionComparison).toHaveBeenCalledTimes(2);
  });

  it('passes the version address to the loader and draws the comparison it answers', async () => {
    answer(privacyPage, privacyComparison);
    render(await PrivacyPage(request('2026-11-20')));

    expect(loaders.loadLegalDocumentPage).toHaveBeenCalledWith(PRIVACY, '2026-11-20');
    expect(
      screen.getByRole('region', { name: legalScreenCopy.comparisonTitle }),
    ).toBeInTheDocument();
  });

  it('draws the comparison line, not a table, when the comparison cannot be read', async () => {
    answer(privacyPage, null);
    render(await PrivacyPage(request()));

    expect(screen.getByRole('region', { name: legalScreenCopy.comparisonTitle })).toHaveTextContent(
      legalScreenCopy.comparisonUnavailable,
    );
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(privacyPage.viewing.title);
  });

  it.each(routes)(
    'throws not-found for a version address the loader does not find, and the segment draws the version-not-found page at $path (G-LU7)',
    async (route) => {
      loaders.loadLegalDocumentPage.mockResolvedValue({ status: 'version-not-found' });

      await expect(route.Page(request('2026-01-01'))).rejects.toMatchObject({
        digest: 'NEXT_HTTP_ERROR_FALLBACK;404',
      });
      expect(loaders.loadLegalVersionComparison).not.toHaveBeenCalled();

      render(<route.NotFound />);
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
        `${legalDocumentNames[route.kind]}${legalScreenCopy.versionNotFoundTitleSuffix}`,
      );
      expect(
        screen.getByRole('link', { name: legalScreenCopy.viewCurrentVersionLabel }),
      ).toHaveAttribute('href', route.path);
    },
  );

  it('shows the unavailable page, not version-not-found, at the current address (G-LU7)', async () => {
    loaders.loadLegalDocumentPage.mockResolvedValue({ status: 'version-not-found' });
    render(await TermsPage(request()));

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      `${legalDocumentNames[TERMS]}${legalScreenCopy.unavailableTitleSuffix}`,
    );
    expect(
      screen.getByRole('link', { name: legalScreenCopy.unavailableRetryLabel }),
    ).toHaveAttribute('href', '/terms');
  });

  it('keeps the privacy tab title as the law names it and the terms tab title as the screen names it (G-LU2)', () => {
    // The name the law gives the privacy policy (LB-R1), pinned as written (fe.ds.copy-authority).
    expect(privacyMetadata.title).toBe('개인정보 처리방침');
    expect(termsMetadata.title).toBe(legalDocumentNames[TERMS]);
  });
});
