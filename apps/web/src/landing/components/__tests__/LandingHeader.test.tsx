import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LandingHeader } from '../LandingHeader';

vi.mock('lucide-react', () => ({
  Menu: () => null,
  X: () => null,
}));

vi.mock('next/image', () => ({
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
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
    className?: string;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

function mockMatchMedia() {
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
}

beforeEach(() => {
  mockMatchMedia();
});

describe('LandingHeader', () => {
  it('로고와 주요 행동 링크를 렌더링한다', () => {
    render(<LandingHeader />);

    expect(screen.getByAltText('KNU 룸메 로고')).toBeInTheDocument();
    expect(screen.getByText('KNU 룸메')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: '로그인' })).toHaveLength(1);
    expect(screen.getAllByRole('link', { name: '회원가입' })).toHaveLength(1);
  });

  it('데스크톱 섹션 내비게이션은 hash link semantics를 유지한다', () => {
    render(<LandingHeader />);

    expect(screen.getByRole('navigation', { name: '랜딩 주요 섹션' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '이용 흐름' })).toHaveAttribute(
      'href',
      '#how-it-works',
    );
    expect(screen.getByRole('link', { name: '서비스 소개' })).toHaveAttribute('href', '#features');
    expect(screen.getByRole('link', { name: '시즌 정책' })).toHaveAttribute('href', '#season');
    expect(screen.getByRole('link', { name: 'FAQ' })).toHaveAttribute('href', '#faq');
  });

  it('메뉴 버튼은 controlled mobile menu를 열고 aria-controls를 연결한다', () => {
    render(<LandingHeader />);

    const menuButton = screen.getByRole('button', { name: '메뉴' });
    expect(menuButton).toHaveAttribute('aria-expanded', 'false');
    const menuId = menuButton.getAttribute('aria-controls');
    expect(menuId).toBeTruthy();

    fireEvent.click(menuButton);

    expect(menuButton).toHaveAttribute('aria-expanded', 'true');
    const mobileMenu = document.getElementById(menuId!);
    expect(mobileMenu).toBeInTheDocument();
    expect(mobileMenu).toHaveAttribute('data-state', 'open');
    expect(mobileMenu).toHaveAttribute('aria-hidden', 'false');
    expect(
      within(mobileMenu!).getByRole('navigation', { name: '랜딩 모바일 내비게이션' }),
    ).toBeInTheDocument();
    expect(within(mobileMenu!).getByRole('link', { name: '로그인' })).toBeInTheDocument();
    expect(within(mobileMenu!).getByRole('link', { name: '회원가입' })).toBeInTheDocument();
  });

  it('모바일 메뉴에서 hash link 클릭 시 메뉴가 닫힌다', () => {
    render(<LandingHeader />);

    const menuButton = screen.getByRole('button', { name: '메뉴' });
    fireEvent.click(menuButton);
    const menuId = menuButton.getAttribute('aria-controls')!;
    const mobileMenu = document.getElementById(menuId)!;

    fireEvent.click(within(mobileMenu).getByRole('link', { name: 'FAQ' }));

    expect(menuButton).toHaveAttribute('aria-expanded', 'false');
    expect(document.getElementById(menuId)).toHaveAttribute('data-state', 'closed');
    expect(document.getElementById(menuId)).toHaveAttribute('aria-hidden', 'true');
  });

  it('모바일 메뉴에서 로그인/회원가입 링크 클릭 시 메뉴가 닫힌다', () => {
    render(<LandingHeader />);

    const menuButton = screen.getByRole('button', { name: '메뉴' });
    fireEvent.click(menuButton);
    const mobileMenu = document.getElementById(menuButton.getAttribute('aria-controls')!)!;

    fireEvent.click(within(mobileMenu).getByRole('link', { name: '로그인' }));

    expect(menuButton).toHaveAttribute('aria-expanded', 'false');
  });

  it('Escape 키로 모바일 메뉴를 닫고 focus를 메뉴 버튼으로 되돌린다', () => {
    render(<LandingHeader />);

    const menuButton = screen.getByRole('button', { name: '메뉴' });
    menuButton.focus();
    fireEvent.click(menuButton);
    expect(menuButton).toHaveAttribute('aria-expanded', 'true');

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(menuButton).toHaveAttribute('aria-expanded', 'false');
    expect(menuButton).toHaveFocus();
  });
});
