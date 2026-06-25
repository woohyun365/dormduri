import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LoginLayout } from '../LoginLayout';

vi.mock('next/image', () => ({
  // eslint-disable-next-line jsx-a11y/alt-text, @next/next/no-img-element
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} />,
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    ...props
  }: React.PropsWithChildren<React.AnchorHTMLAttributes<HTMLAnchorElement>>) => (
    <a {...props}>{children}</a>
  ),
}));

vi.mock('lucide-react', () => ({
  ChevronLeft: () => <span data-testid="icon-chevron-left" />,
}));

describe('LoginLayout', () => {
  it('로그인 shell, 독립 운영 고지, children, footer를 렌더링한다', () => {
    render(
      <LoginLayout footer={<a href="/privacy">개인정보처리방침</a>}>
        <button type="button">로그인 폼 자리</button>
      </LoginLayout>,
    );

    expect(screen.getByRole('heading', { name: '로그인' })).toBeInTheDocument();
    expect(
      screen.getAllByText(/강원대학교 공식 서비스가 아닌 독립 운영 서비스/).length,
    ).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: '로그인 폼 자리' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '자세히 보기' })).toHaveClass(
      'inline-block',
      'whitespace-nowrap',
      'sm:inline',
      'sm:whitespace-normal',
    );
    expect(screen.getByRole('link', { name: '개인정보처리방침' })).toHaveAttribute(
      'href',
      '/privacy',
    );
    const headerContainer = screen.getByRole('banner').firstElementChild;
    expect(headerContainer).toHaveClass('max-w-5xl', 'lg:px-8');
  });

  it('desktop trust panel에 정책과 충돌하지 않는 안내를 제공한다', () => {
    render(
      <LoginLayout>
        <div />
      </LoginLayout>,
    );

    expect(screen.getByText('학교 이메일 로그인')).toBeInTheDocument();
    expect(screen.getByTestId('login-help-panel')).toHaveClass('lg:mt-8');
    expect(screen.getByText('로그인 유지')).toBeInTheDocument();
    expect(screen.getByText(/최대 7일 동안 다시 로그인하지 않아도/)).toBeInTheDocument();
    expect(screen.getByText('비밀번호 재설정')).toBeInTheDocument();
  });
});
