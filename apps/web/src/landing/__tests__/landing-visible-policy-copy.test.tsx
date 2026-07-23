import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LandingPage from '../LandingPage';
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
    render(<LandingPage />);

    for (const requiredId of LANDING_REQUIRED_POLICY_COPY_IDS) {
      const copy = getLandingPolicyCopy(requiredId);
      expect(screen.getAllByText(new RegExp(copy.testAnchor)).length).toBeGreaterThan(0);
    }
  });

  it('첫 렌더에서 hero·정책 경계·CTA를 skeleton 없이 노출한다', () => {
    const { container } = render(<LandingPage />);
    const hero = container.querySelector<HTMLElement>('#hero');

    expect(hero).not.toBeNull();

    expect(
      screen.getByRole('heading', {
        name: /학기 시작 전,\s*생활패턴이 맞는\s*룸메이트를 찾아요/,
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/학교 공식 서비스가 아닙니다/).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: /이메일로 시작하기/ })).toHaveAttribute(
      'href',
      '/signup',
    );
    expect(within(hero!).getByRole('link', { name: '서비스 범위 보기' })).toHaveAttribute(
      'href',
      '#trust-boundary',
    );
    expect(
      within(hero!).getByRole('figure', { name: '룸메 후보 목록은 이렇게 보여요' }),
    ).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/서비스를 준비하고 있어요|loading app shell/i);
    expect(container.querySelector('[data-testid="landing-faq-skeleton-row"]')).toBeNull();
  });

  it('공개 화면에서 개발자 중심 용어를 노출하지 않는다', () => {
    const { container } = render(<LandingPage />);

    expect(container.textContent).not.toMatch(/draft|scope|summary|capability|registration/i);
    expect(container.textContent).not.toMatch(/3-step flow|Product features|Safety & support/i);
  });

  it('섹션 heading과 preview disclaimer를 제품 서사 순서로 노출한다', () => {
    render(<LandingPage />);

    const headings = landingSectionHeadings.map((heading) => screen.getByText(new RegExp(heading)));

    for (let i = 1; i < headings.length; i++) {
      expect(headings[i]!.compareDocumentPosition(headings[i - 1]!)).toBe(
        Node.DOCUMENT_POSITION_PRECEDING,
      );
    }

    expect(screen.getAllByText('서비스 화면 예시')).toHaveLength(1);
    expect(screen.getAllByText(/실제 사용자 정보가 아닌 이해를 돕기 위한 예시예요\./)).toHaveLength(
      1,
    );
    expect(
      screen.queryByText(/실제 사용자, 실제 점수, 매칭 또는 호실 선택 성공/),
    ).not.toBeInTheDocument();
    expect(screen.getByText('후보와 대화')).toBeInTheDocument();
    expect(screen.getByText('요청·수락')).toBeInTheDocument();
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
