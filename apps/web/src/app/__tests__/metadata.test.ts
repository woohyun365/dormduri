import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createLandingMetadata,
  createPublicUrl,
  createRootMetadata,
  LANDING_DESCRIPTION,
  LANDING_TITLE,
  PUBLIC_SITEMAP_ROUTES,
  resolvePublicSiteUrl,
  SITE_NAME,
} from '../metadata';
import { metadata as passwordResetMetadata } from '../password-reset/page';
import { createRobots, PUBLIC_ROBOTS_DISALLOW } from '../robots';
import { createSitemap } from '../sitemap';

const productionLikeEnv = {
  NEXT_PUBLIC_APP_URL: 'https://roommate.example.test/app?debug=1#hash',
};

function collectProductionSourceText(directory: string): string {
  return readdirSync(directory)
    .flatMap((entry) => {
      if (entry === '__tests__') return [];

      const absolutePath = path.join(directory, entry);
      const stats = statSync(absolutePath);

      if (stats.isDirectory()) {
        return collectProductionSourceText(absolutePath);
      }

      return /\.(tsx?|jsx?)$/.test(entry) ? [readFileSync(absolutePath, 'utf8')] : [];
    })
    .join('\n');
}

describe('web metadata baseline', () => {
  it('normalizes the public site URL to an origin-only metadata base', () => {
    expect(resolvePublicSiteUrl(productionLikeEnv).toString()).toBe(
      'https://roommate.example.test/',
    );
    expect(createPublicUrl('/signup', productionLikeEnv)).toBe(
      'https://roommate.example.test/signup',
    );
  });

  it('defines root metadata without user-specific or secret fields', () => {
    const metadata = createRootMetadata(productionLikeEnv);

    expect(metadata.metadataBase?.toString()).toBe('https://roommate.example.test/');
    // Tab titles read the service name first (Owner 2026-10-28, #706).
    expect(metadata.title).toEqual({ default: SITE_NAME, template: `${SITE_NAME} | %s` });
    expect(metadata.description).toContain('독립 운영');
    expect(JSON.stringify(metadata)).not.toMatch(/token|session|email|userId/i);
  });

  it('defines landing canonical, Open Graph, and Twitter metadata', () => {
    const metadata = createLandingMetadata();

    expect(LANDING_TITLE).toBe('돔두리 | 강원대 룸메이트 찾기');
    expect(metadata.title).toEqual({ absolute: LANDING_TITLE });
    expect(metadata.description).toBe(LANDING_DESCRIPTION);
    expect(metadata.alternates).toEqual({ canonical: '/' });
    expect(metadata.openGraph).toMatchObject({
      title: LANDING_TITLE,
      description: LANDING_DESCRIPTION,
      url: '/',
      siteName: SITE_NAME,
      locale: 'ko_KR',
      type: 'website',
    });
    expect(metadata.twitter).toMatchObject({
      card: 'summary',
      title: LANDING_TITLE,
      description: LANDING_DESCRIPTION,
    });
    expect(LANDING_DESCRIPTION).toContain('독립 운영 서비스');
    expect(LANDING_DESCRIPTION).not.toMatch(/공식.*서비스/);
  });

  it('keeps robots private/API boundary explicit', () => {
    const robots = createRobots(productionLikeEnv);

    expect(robots.sitemap).toBe('https://roommate.example.test/sitemap.xml');
    expect(robots.host).toBe('https://roommate.example.test');
    expect(robots.rules).toMatchObject({
      userAgent: '*',
      allow: '/',
      disallow: [...PUBLIC_ROBOTS_DISALLOW],
    });
    expect(PUBLIC_ROBOTS_DISALLOW).toContain('/api/');
    expect(PUBLIC_ROBOTS_DISALLOW).toContain('/main');
  });

  it('emits only public static routes in sitemap', () => {
    const sitemap = createSitemap(productionLikeEnv);
    const urls = sitemap.map((entry) => entry.url);

    expect(urls).toEqual(
      PUBLIC_SITEMAP_ROUTES.map((route) => createPublicUrl(route.pathname, productionLikeEnv)),
    );
    expect(urls.some((url) => url.includes('/api/'))).toBe(false);
    expect(urls.some((url) => url.endsWith('/main'))).toBe(false);
    expect(urls.some((url) => url.endsWith('/password-reset'))).toBe(false);
  });

  it('defines password reset route metadata while keeping it out of sitemap', () => {
    expect(passwordResetMetadata.title).toBe('비밀번호 재설정');
    expect(passwordResetMetadata.description).toContain('강원대학교 이메일 인증');
    expect(PUBLIC_SITEMAP_ROUTES.map((route) => route.pathname as string)).not.toContain(
      '/password-reset',
    );
  });

  it('does not introduce FAQ rich-result JSON-LD for landing', () => {
    const sourceText = [
      collectProductionSourceText(path.join(process.cwd(), 'src', 'app')),
      collectProductionSourceText(path.join(process.cwd(), 'src', 'screens', 'landing')),
    ].join('\n');

    expect(sourceText).not.toContain('FAQPage');
    expect(sourceText).not.toContain('application/ld+json');
  });
});
