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
  it('mobile에서 독립 운영 고지의 자세히 보기 링크가 단어 단위로 유지된다', () => {
    render(
      <SignupLayout>
        <div>회원가입 폼</div>
      </SignupLayout>,
    );

    expect(screen.getByText('회원가입 폼')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '자세히 보기' })).toHaveClass(
      'inline-block',
      'whitespace-nowrap',
      'sm:inline',
      'sm:whitespace-normal',
    );
  });
});
