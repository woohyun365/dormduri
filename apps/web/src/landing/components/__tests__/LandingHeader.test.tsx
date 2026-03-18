import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LandingHeader } from '../LandingHeader';

vi.mock('lucide-react', () => ({
  Menu: () => null,
  X: () => null,
}));

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => <img {...props} />,
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...rest
  }: {
    children: React.ReactNode;
    href: string;
    onClick?: () => void;
  }) => (
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

describe('LandingHeader', () => {
  it('로고와 네비게이션 링크를 렌더링한다', () => {
    render(<LandingHeader />);

    expect(screen.getByAltText('KNU 룸메 로고')).toBeInTheDocument();
    expect(screen.getByText('KNU 룸메')).toBeInTheDocument();
    expect(screen.getAllByText('로그인')).toHaveLength(1);
    expect(screen.getAllByText('회원가입')).toHaveLength(1);
  });

  it('메뉴 버튼 클릭 시 모바일 메뉴가 열린다', () => {
    render(<LandingHeader />);

    const menuButton = screen.getByRole('button', { name: '메뉴' });
    expect(menuButton).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(menuButton);

    expect(menuButton).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByText('로그인')).toHaveLength(2);
    expect(screen.getAllByText('회원가입')).toHaveLength(2);
  });

  it('모바일 메뉴에서 링크 클릭 시 메뉴가 닫힌다', () => {
    render(<LandingHeader />);

    fireEvent.click(screen.getByRole('button', { name: '메뉴' }));
    expect(screen.getAllByText('로그인')).toHaveLength(2);

    const mobileLinks = screen.getAllByText('로그인');
    fireEvent.click(mobileLinks[1]!);

    expect(screen.getByRole('button', { name: '메뉴' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('Escape 키로 모바일 메뉴가 닫힌다', () => {
    render(<LandingHeader />);

    fireEvent.click(screen.getByRole('button', { name: '메뉴' }));
    expect(screen.getByRole('button', { name: '메뉴' })).toHaveAttribute('aria-expanded', 'true');

    fireEvent.keyDown(screen.getByRole('banner'), { key: 'Escape' });

    expect(screen.getByRole('button', { name: '메뉴' })).toHaveAttribute('aria-expanded', 'false');
  });
});
