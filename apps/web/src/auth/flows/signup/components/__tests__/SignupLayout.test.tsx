import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SignupLayout } from '../SignupLayout';

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

describe('SignupLayout', () => {
  it('PC에서는 우측 단계가 스크롤되어도 좌측 안내 위치를 유지한다', () => {
    render(
      <SignupLayout>
        <div>회원가입 폼</div>
      </SignupLayout>,
    );

    expect(screen.getByTestId('signup-help-panel')).toHaveClass(
      'lg:[@media(min-height:700px)]:sticky',
      'lg:[@media(min-height:700px)]:top-32',
      'lg:[@media(min-height:700px)]:self-start',
    );
  });

  it('독립 운영 고지를 viewport별 문구로 한 줄에 유지한다', () => {
    render(
      <SignupLayout>
        <div>회원가입 폼</div>
      </SignupLayout>,
    );

    expect(screen.getByText('회원가입 폼')).toBeInTheDocument();
    expect(screen.getByText('강원대학교 비공식 독립 운영 서비스예요.')).toHaveClass('sm:hidden');
    expect(
      screen.getByText('본 서비스는 강원대학교 공식 서비스가 아닌 독립 운영 서비스입니다.'),
    ).toHaveClass('hidden', 'sm:inline');
    expect(screen.getByText('강원대학교 비공식 독립 운영 서비스예요.').closest('p')).toHaveClass(
      'whitespace-nowrap',
    );
    expect(screen.getByRole('link', { name: '자세히 보기' })).toHaveClass(
      'inline-block',
      'whitespace-nowrap',
      'sm:inline',
      'sm:whitespace-normal',
    );
  });
});
