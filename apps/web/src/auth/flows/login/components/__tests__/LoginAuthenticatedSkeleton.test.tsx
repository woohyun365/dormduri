import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LoginAuthenticatedSkeleton } from '../LoginAuthenticatedSkeleton';

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

describe('LoginAuthenticatedSkeleton', () => {
  it('session 확인 상태를 role=status로 안내한다', () => {
    render(<LoginAuthenticatedSkeleton />);

    expect(screen.getByRole('status')).toHaveTextContent('로그인 상태를 확인하고 있어요');
    expect(screen.getByText('이미 로그인되어 있으면 홈으로 이동합니다.')).toBeInTheDocument();
  });
});
