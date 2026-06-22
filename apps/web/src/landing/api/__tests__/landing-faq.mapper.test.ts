import { describe, expect, it } from 'vitest';
import {
  mapFallbackFaqItemToLandingFaq,
  mapSupportFaqItemToLandingFaq,
} from '../landing-faq.mapper';
import { landingFallbackFaqItems } from '../../content/landing-fallback-faq';

describe('landing FAQ mapper', () => {
  it('support FAQ public fields만 Landing FAQ view model에 싣는다', () => {
    expect(
      mapSupportFaqItemToLandingFaq({
        id: 'faq-1',
        category: 'OTHER',
        question: '질문',
        answer: '답변',
        published: true,
        sortOrder: 1,
        updatedAt: '2026-06-22T00:00:00.000Z',
      }),
    ).toEqual({
      id: 'faq-1',
      question: '질문',
      answer: '답변',
      sortOrder: 1,
      source: 'support_api',
    });
  });

  it('fallback FAQ는 emergency fallback source로 표시한다', () => {
    expect(mapFallbackFaqItemToLandingFaq(landingFallbackFaqItems[0]!)).toMatchObject({
      id: landingFallbackFaqItems[0]!.id,
      source: 'emergency_fallback',
    });
  });
});
