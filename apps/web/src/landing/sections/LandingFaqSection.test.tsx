import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LandingFaqSection, LandingFaqSectionSkeleton } from './LandingFaqSection';

describe('LandingFaqSection', () => {
  it('support FAQ result를 FAQ disclosure로 렌더링하고 fallback notice를 숨긴다', () => {
    const { container } = render(
      <LandingFaqSection
        faq={{
          status: 'support_api',
          items: [
            {
              id: 'faq-support',
              question: '지원 FAQ 질문',
              answer: '지원 FAQ 답변',
              sortOrder: 1,
              source: 'support_api',
            },
          ],
        }}
      />,
    );

    expect(screen.getByRole('heading', { name: '자주 묻는 질문' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /지원 FAQ 질문/ })).toBeInTheDocument();
    expect(container.querySelector('[data-faq-source="support_api"]')).toBeInTheDocument();
    expect(screen.queryByText(/기본 안내를 보여드려요/)).not.toBeInTheDocument();
  });

  it('fallback 상태는 안내 문구와 예비 FAQ를 렌더링한다', () => {
    render(
      <LandingFaqSection
        faq={{
          status: 'fallback_api_error',
          notice: 'FAQ를 불러오지 못해 기본 안내를 보여드려요.',
          items: [
            {
              id: 'faq-fallback',
              question: '예비 질문',
              answer: '예비 답변',
              sortOrder: 1,
              source: 'emergency_fallback',
            },
          ],
        }}
      />,
    );

    expect(screen.getByText('FAQ를 불러오지 못해 기본 안내를 보여드려요.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /예비 질문/ })).toBeInTheDocument();
  });

  it('skeleton은 FAQ section 내부 scoped loading으로만 렌더링한다', () => {
    render(<LandingFaqSectionSkeleton />);

    expect(screen.getByRole('heading', { name: '자주 묻는 질문' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
