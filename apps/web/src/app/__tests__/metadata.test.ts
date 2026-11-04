import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  createLandingMetadata,
  createPublicUrl,
  createRootMetadata,
  LANDING_DESCRIPTION,
  LANDING_PREVIEW_IMAGE_ALT,
  LANDING_TITLE,
  PUBLIC_SITEMAP_ROUTES,
  resolvePublicSiteUrl,
  SITE_NAME,
} from '../metadata';
import { metadata as passwordResetMetadata } from '../password-reset/page';
import { createRobots, PUBLIC_ROBOTS_DISALLOW } from '../robots';
import { createSitemap } from '../sitemap';

// Next turns the image import into its built URL and size; Vitest gives a plain path, so the import is
// replaced with what Next gives. The file test below checks that the real file has this size.
const builtPreviewSrc = '/_next/static/media/link-preview.0a1b2c3d.jpg';
vi.mock('../link-preview.jpg', () => ({
  default: { src: '/_next/static/media/link-preview.0a1b2c3d.jpg', width: 1200, height: 630 },
}));

// Width and height from the first JPEG start-of-frame segment.
function readJpegSize(bytes: Buffer): { width: number; height: number } | null {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    const marker = bytes.readUInt8(offset + 1);
    const length = bytes.readUInt16BE(offset + 2);
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { height: bytes.readUInt16BE(offset + 5), width: bytes.readUInt16BE(offset + 7) };
    }
    offset += 2 + length;
  }
  return null;
}

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
      card: 'summary_large_image',
      title: LANDING_TITLE,
      description: LANDING_DESCRIPTION,
    });
    expect(LANDING_DESCRIPTION).toContain('독립 운영 서비스');
    expect(LANDING_DESCRIPTION).not.toMatch(/공식.*서비스/);
  });

  it('gives the landing link preview an absolute image URL, its size and alt text', () => {
    const metadata = createLandingMetadata({ NEXT_PUBLIC_APP_URL: 'https://dormduri.com' });
    const image = {
      url: `https://dormduri.com${builtPreviewSrc}`,
      width: 1200,
      height: 630,
      alt: LANDING_PREVIEW_IMAGE_ALT,
    };

    expect(metadata.openGraph).toMatchObject({ images: [{ ...image, type: 'image/jpeg' }] });
    expect(metadata.twitter).toMatchObject({ card: 'summary_large_image', images: [image] });
    expect(LANDING_PREVIEW_IMAGE_ALT).toContain(SITE_NAME);
  });

  it('keeps the link preview file a 1200×630 JPEG under the KakaoTalk 5MB limit', () => {
    const bytes = readFileSync(path.join(__dirname, '../link-preview.jpg'));

    expect(readJpegSize(bytes)).toEqual({ width: 1200, height: 630 });
    expect(bytes.length).toBeLessThan(5 * 1024 * 1024);
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
