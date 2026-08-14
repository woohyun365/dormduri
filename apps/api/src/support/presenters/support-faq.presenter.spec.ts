import { describe, expect, it } from 'vitest';
import { toSupportFaqDetailResponse, toSupportFaqListResponse } from './support-faq.presenter.js';

const faqRecord = {
  id: 'faq-1',
  category: 'OTHER',
  question: '질문',
  answer: '답변',
} as const;

describe('support FAQ presenter', () => {
  it('목록과 상세 응답에 공개 표현 필드만 제공한다', () => {
    const item = {
      id: 'faq-1',
      category: 'OTHER',
      question: '질문',
      answer: '답변',
    };

    expect(toSupportFaqListResponse([faqRecord])).toEqual({ items: [item] });
    expect(toSupportFaqDetailResponse(faqRecord)).toEqual({ item });
  });
});
