import React from 'react';
import { render, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LandingFooter } from './LandingFooter';

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

describe('LandingFooter', () => {
  it('법적 안내와 서비스 외부 문의 창구를 제공한다', () => {
    const { container } = render(<LandingFooter externalInquiryEmail="outside@example.com" />);
    const footer = container.querySelector('footer');

    expect(footer).not.toBeNull();
    expect(within(footer!).getByRole('link', { name: /KNU 룸메 로고/ })).toHaveAttribute(
      'href',
      '/',
    );
    expect(within(footer!).getByRole('link', { name: '이용약관' })).toHaveAttribute(
      'href',
      '/terms',
    );
    expect(within(footer!).getByRole('link', { name: '개인정보처리방침' })).toHaveAttribute(
      'href',
      '/privacy',
    );
    expect(within(footer!).getByText('outside@example.com')).toBeInTheDocument();
    expect(
      within(footer!).queryByRole('link', { name: 'outside@example.com' }),
    ).not.toBeInTheDocument();
    expect(within(footer!).getByText('서비스 외부 문의')).toBeInTheDocument();
  });

  it('상세 개인정보 안내는 Support에 맡기고 독립 운영 고지만 유지한다', () => {
    const { container } = render(<LandingFooter externalInquiryEmail="outside@example.com" />);
    const footer = container.querySelector('footer');

    expect(
      within(footer!).getByText('KNU 룸메는 학교 공식 서비스가 아닙니다.'),
    ).toBeInTheDocument();
    expect(within(footer!).queryByText(/개인정보·민감정보 입력/)).not.toBeInTheDocument();
  });
});
