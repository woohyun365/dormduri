import { describe, expect, it, vi } from 'vitest';
import { SupportFaqSurface } from '@repo/shared/support';
import { LANDING_FAQ_REVALIDATE_SECONDS, getLandingFaqItems } from '../landing-faq.api';

const supportFaqItem = {
  id: 'faq-1',
  category: 'OTHER',
  question: '공개 질문',
  answer: '공개 답변',
  published: true,
  sortOrder: 10,
  updatedAt: '2026-06-22T00:00:00.000Z',
};

function stubFetch(json: unknown, status = 200) {
  return vi.fn(async () => {
    return new Response(JSON.stringify(json), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as unknown as typeof fetch & { mock: ReturnType<typeof vi.fn>['mock'] };
}

describe('landing FAQ API', () => {
  it('support FAQ LANDING surface를 조회하고 shared response만 Landing view model로 변환한다', async () => {
    const fetchImpl = stubFetch({ items: [supportFaqItem] });

    const result = await getLandingFaqItems({
      fetchImpl,
      rawEnv: { NODE_ENV: 'test', API_URL: 'http://api.test/internal' },
    });

    expect(String(fetchImpl.mock.calls[0]?.[0])).toBe(
      `http://api.test/internal/api/support/faq?surface=${SupportFaqSurface.LANDING}`,
    );
    expect(fetchImpl.mock.calls[0]?.[1]).toEqual({
      next: { revalidate: LANDING_FAQ_REVALIDATE_SECONDS },
    });
    expect(result).toEqual({
      status: 'support_api',
      items: [
        {
          id: 'faq-1',
          question: '공개 질문',
          answer: '공개 답변',
          sortOrder: 10,
          source: 'support_api',
        },
      ],
    });
  });

  it('API 오류, invalid response, empty response는 비상 예비 FAQ로 degrade한다', async () => {
    const failed = await getLandingFaqItems({
      fetchImpl: stubFetch({ success: false }, 503),
      rawEnv: { NODE_ENV: 'test', API_URL: 'http://api.test' },
    });
    expect(failed.status).toBe('fallback_api_error');
    expect(failed.items.length).toBeGreaterThan(0);

    const invalid = await getLandingFaqItems({
      fetchImpl: stubFetch({ items: [{ id: 'faq-invalid' }] }),
      rawEnv: { NODE_ENV: 'test', API_URL: 'http://api.test' },
    });
    expect(invalid.status).toBe('fallback_api_error');

    const empty = await getLandingFaqItems({
      fetchImpl: stubFetch({ items: [] }),
      rawEnv: { NODE_ENV: 'test', API_URL: 'http://api.test' },
    });
    expect(empty.status).toBe('fallback_empty');
  });
});
