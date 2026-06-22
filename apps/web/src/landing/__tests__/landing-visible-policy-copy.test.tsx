import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Landing from '../Landing';
import { landingSectionHeadings } from '../content/landing-copy';
import {
  LANDING_REQUIRED_POLICY_COPY_IDS,
  getLandingPolicyCopy,
} from '../content/landing-policy-copy';

vi.mock('next/image', () => ({
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} />,
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...rest
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

describe('landing visible policy copy', () => {
  it('핵심 정책 copy를 공개 화면에 노출한다', () => {
    render(<Landing />);

    for (const requiredId of LANDING_REQUIRED_POLICY_COPY_IDS) {
      const copy = getLandingPolicyCopy(requiredId);
      expect(screen.getAllByText(new RegExp(copy.testAnchor)).length).toBeGreaterThan(0);
    }
  });

  it('첫 렌더에서 hero·정책 경계·CTA를 skeleton 없이 노출한다', () => {
    const { container } = render(<Landing />);

    expect(
      screen.getByRole('heading', {
        name: /학기 시작 전,\s*생활패턴이 맞는\s*룸메 후보를 확인하세요/,
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/독립 운영 서비스입니다/).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: /이메일로 시작하기/ })).toHaveAttribute(
      'href',
      '/signup',
    );
    expect(container.textContent).not.toMatch(/서비스를 준비하고 있어요|loading app shell/i);
    expect(container.querySelector('[data-testid="landing-faq-skeleton-row"]')).toBeNull();
  });

  it('공개 화면에서 개발자 중심 용어를 노출하지 않는다', () => {
    const { container } = render(<Landing />);

    expect(container.textContent).not.toMatch(/draft|scope|summary|capability|registration/i);
    expect(container.textContent).not.toMatch(/3-step flow|Product features|Safety & support/i);
  });

  it('섹션 heading과 preview disclaimer를 제품 서사 순서로 노출한다', () => {
    render(<Landing />);

    const headings = landingSectionHeadings.map((heading) => screen.getByText(new RegExp(heading)));

    for (let i = 1; i < headings.length; i++) {
      expect(headings[i]!.compareDocumentPosition(headings[i - 1]!)).toBe(
        Node.DOCUMENT_POSITION_PRECEDING,
      );
    }

    expect(screen.getAllByText('예시')).toHaveLength(2);
    expect(screen.getByText('같은 기숙사 후보와 직접 대화')).toBeInTheDocument();
    expect(screen.getByText(/매칭 요청·수락은 시즌 매칭 기간에만 열립니다/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /이메일로 시작하기/ })).toHaveAttribute(
      'href',
      '/signup',
    );
    expect(screen.getByRole('link', { name: /학교 이메일로 가입하기/ })).toHaveAttribute(
      'href',
      '/signup',
    );
  });
});
