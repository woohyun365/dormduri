import type { Metadata } from 'next';

const DEFAULT_PUBLIC_SITE_URL = 'http://localhost:3000';

export type PublicMetadataEnv = Partial<Record<string, string | undefined>>;

export const SITE_NAME = 'KNU 룸메';
export const ROOT_DESCRIPTION = '강원대학교 기숙사 입주생을 위한 독립 운영 룸메이트 찾기 서비스';
export const LANDING_PAGE_TITLE = '강원대 룸메이트 찾기';
export const LANDING_SHARE_TITLE = `${LANDING_PAGE_TITLE} | ${SITE_NAME}`;
export const LANDING_DESCRIPTION =
  'KNU 룸메는 강원대학교 기숙사 입주생이 생활패턴과 기숙사 조건을 확인하고 룸메이트 후보를 찾아보는 독립 운영 서비스입니다.';

export const PUBLIC_SITEMAP_ROUTES = [
  { pathname: '/', changeFrequency: 'weekly', priority: 1 },
  { pathname: '/login', changeFrequency: 'monthly', priority: 0.4 },
  { pathname: '/signup', changeFrequency: 'monthly', priority: 0.5 },
  { pathname: '/terms', changeFrequency: 'monthly', priority: 0.3 },
  { pathname: '/privacy', changeFrequency: 'monthly', priority: 0.3 },
] as const;

function readPublicSiteUrl(rawEnv: PublicMetadataEnv): string {
  const value = rawEnv.NEXT_PUBLIC_APP_URL?.trim();
  return value && value.length > 0 ? value : DEFAULT_PUBLIC_SITE_URL;
}

export function resolvePublicSiteUrl(rawEnv: PublicMetadataEnv = process.env): URL {
  const rawSiteUrl = readPublicSiteUrl(rawEnv);

  try {
    const siteUrl = new URL(rawSiteUrl);
    if (siteUrl.protocol !== 'http:' && siteUrl.protocol !== 'https:') {
      return new URL(DEFAULT_PUBLIC_SITE_URL);
    }

    siteUrl.pathname = '/';
    siteUrl.search = '';
    siteUrl.hash = '';
    return siteUrl;
  } catch {
    return new URL(DEFAULT_PUBLIC_SITE_URL);
  }
}

export function createPublicUrl(pathname: string, rawEnv: PublicMetadataEnv = process.env): string {
  return new URL(pathname, resolvePublicSiteUrl(rawEnv)).toString();
}

export function createRootMetadata(rawEnv: PublicMetadataEnv = process.env): Metadata {
  return {
    metadataBase: resolvePublicSiteUrl(rawEnv),
    title: {
      default: SITE_NAME,
      template: `%s | ${SITE_NAME}`,
    },
    description: ROOT_DESCRIPTION,
    applicationName: SITE_NAME,
    creator: SITE_NAME,
    publisher: SITE_NAME,
    icons: { icon: '/knu_logo.svg' },
    formatDetection: {
      telephone: false,
    },
  };
}

export function createLandingMetadata(): Metadata {
  return {
    title: LANDING_PAGE_TITLE,
    description: LANDING_DESCRIPTION,
    alternates: {
      canonical: '/',
    },
    openGraph: {
      title: LANDING_SHARE_TITLE,
      description: LANDING_DESCRIPTION,
      url: '/',
      siteName: SITE_NAME,
      locale: 'ko_KR',
      type: 'website',
    },
    twitter: {
      card: 'summary',
      title: LANDING_SHARE_TITLE,
      description: LANDING_DESCRIPTION,
    },
  };
}
