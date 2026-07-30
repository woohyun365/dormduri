import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LoginSessionTransition } from '../LoginSessionTransition';

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

describe('LoginSessionTransition', () => {
  it('session 확인 중에는 checking 상태만 안내한다', () => {
    render(<LoginSessionTransition state="checking" />);

    expect(screen.getByRole('status')).toHaveAttribute('data-state', 'checking');
    expect(screen.getByRole('status')).toHaveTextContent('로그인 상태를 확인하고 있어요');
    expect(screen.getByRole('status')).toHaveTextContent('잠시만 기다려 주세요.');
    expect(screen.queryByText('서비스 이용 흐름')).not.toBeInTheDocument();
    expect(screen.queryByText('로그인되어 있어요')).not.toBeInTheDocument();
  });

  it('인증된 session은 main redirect 상태를 안내한다', () => {
    render(<LoginSessionTransition state="redirecting" />);

    expect(screen.getByRole('status')).toHaveAttribute('data-state', 'redirecting');
    expect(screen.getByRole('status')).toHaveTextContent('로그인되어 있어요');
    expect(screen.getByRole('status')).toHaveTextContent('메인으로 이동하고 있어요.');
    expect(screen.queryByText('서비스 이용 흐름')).not.toBeInTheDocument();
  });
});
