import { supportFaqListResponseSchema, SupportFaqSurface } from '@repo/shared/support';
import { getWebEnv } from '@/config/env';
import { landingFallbackFaqItems } from '../content/landing-fallback-faq';
import {
  mapFallbackFaqItemToLandingFaq,
  mapSupportFaqItemToLandingFaq,
  type LandingFaqViewModel,
} from './landing-faq.mapper';

export const LANDING_FAQ_REVALIDATE_SECONDS = 300;

export type LandingFaqLoadStatus = 'support_api' | 'fallback_api_error' | 'fallback_empty';

export type LandingFaqLoadResult = Readonly<{
  items: readonly LandingFaqViewModel[];
  status: LandingFaqLoadStatus;
  notice?: string;
}>;

type FetchLike = typeof fetch;

const fallbackItems = landingFallbackFaqItems.map(mapFallbackFaqItemToLandingFaq);

export function getLandingFallbackFaqResult(
  status: Extract<
    LandingFaqLoadStatus,
    'fallback_api_error' | 'fallback_empty'
  > = 'fallback_api_error',
): LandingFaqLoadResult {
  return {
    items: fallbackItems,
    status,
    notice:
      status === 'fallback_empty'
        ? '운영 FAQ가 준비되기 전까지 기본 안내를 보여드려요.'
        : 'FAQ를 불러오지 못해 기본 안내를 보여드려요.',
  };
}

function buildLandingFaqApiUrl(rawEnv: NodeJS.ProcessEnv = process.env): string {
  const baseUrl = new URL(getWebEnv(rawEnv).apiUpstreamUrl);
  const basePath = baseUrl.pathname === '/' ? '' : baseUrl.pathname.replace(/\/+$/, '');
  const url = new URL(`${basePath}/api/support/faq`, baseUrl.origin);
  url.searchParams.set('surface', SupportFaqSurface.LANDING);
  return url.toString();
}

export async function getLandingFaqItems(
  input: {
    fetchImpl?: FetchLike;
    rawEnv?: NodeJS.ProcessEnv;
  } = {},
): Promise<LandingFaqLoadResult> {
  let url: string;
  try {
    url = buildLandingFaqApiUrl(input.rawEnv);
  } catch {
    return getLandingFallbackFaqResult('fallback_api_error');
  }

  const fetchImpl = input.fetchImpl ?? fetch;
  const requestInit: RequestInit & { next?: { revalidate: number } } = {
    next: { revalidate: LANDING_FAQ_REVALIDATE_SECONDS },
  };

  try {
    const response = await fetchImpl(url, requestInit);
    if (!response.ok) {
      return getLandingFallbackFaqResult('fallback_api_error');
    }

    const parsed = supportFaqListResponseSchema.safeParse(await response.json());
    if (!parsed.success) {
      return getLandingFallbackFaqResult('fallback_api_error');
    }

    const items = parsed.data.items.map(mapSupportFaqItemToLandingFaq);
    if (items.length === 0) {
      return getLandingFallbackFaqResult('fallback_empty');
    }

    return {
      items,
      status: 'support_api',
    };
  } catch {
    return getLandingFallbackFaqResult('fallback_api_error');
  }
}
