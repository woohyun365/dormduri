import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BackofficePermission } from '@repo/shared/backoffice';
import { ConsoleFrame } from './ConsoleFrame';
import { visibleNavigation } from './navigation';

const navigation = vi.hoisted(() => ({ pathname: '/accounts' }));
vi.mock('next/navigation', () => ({ usePathname: () => navigation.pathname }));

const EVERY: readonly BackofficePermission[] = [
  'admin:account:invite',
  'admin:account:deactivate',
  'admin:access:request',
  'admin:access:approve',
  'admin:audit:read',
  'admin:audit:review',
];

function frame() {
  return (
    <ConsoleFrame
      groups={visibleNavigation(EVERY)}
      user={{ name: '시험 운영자', roles: 'owner(OWNER)' }}
      logout={<button type="button">로그아웃</button>}
      notice={null}
    >
      <p>본문</p>
    </ConsoleFrame>
  );
}

afterEach(() => {
  navigation.pathname = '/accounts';
});

describe('ConsoleFrame (design guide ③)', () => {
  it('keeps the sidebar collapsed after a navigation without writing browser storage', async () => {
    const localSet = vi.spyOn(window.localStorage, 'setItem');
    const sessionSet = vi.spyOn(window.sessionStorage, 'setItem');
    const view = render(frame());
    await userEvent.click(screen.getByRole('button', { name: '메뉴 접기' }));
    expect(screen.getByRole('button', { name: '메뉴 펼치기' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );

    navigation.pathname = '/access';
    view.rerender(frame());

    expect(screen.getByRole('button', { name: '메뉴 펼치기' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.getByRole('link', { current: 'page' })).toHaveAccessibleName('권한 요청');
    expect(localSet).not.toHaveBeenCalled();
    expect(sessionSet).not.toHaveBeenCalled();
  });

  it('marks the current page in the sidebar and the top bar', () => {
    navigation.pathname = '/access';
    render(frame());
    const menu = screen.getByRole('navigation', { name: '백오피스 메뉴' });
    const current = within(menu).getAllByRole('link', { current: 'page' });
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveAccessibleName('권한 요청');
    expect(current[0]).toHaveAttribute('href', '/access');
    expect(within(screen.getByRole('banner')).getByText('운영자 관리')).toBeInTheDocument();
    expect(within(screen.getByRole('banner')).getByText('권한 요청')).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveTextContent('본문');
  });

  it('closes the narrow-screen menu on the next page', async () => {
    const view = render(frame());
    const menuButton = screen.getByRole('button', { name: '메뉴' });
    expect(menuButton).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(menuButton);
    expect(screen.getByRole('button', { name: '메뉴' })).toHaveAttribute('aria-expanded', 'true');

    navigation.pathname = '/audit';
    view.rerender(frame());

    expect(screen.getByRole('button', { name: '메뉴' })).toHaveAttribute('aria-expanded', 'false');
  });
});
