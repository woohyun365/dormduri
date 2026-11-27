import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SESSION_ACTIVITY_EVENT } from '@/client/bff-client';
import { IDLE_TIMEOUT_MS, SessionEndNotice } from './SessionEndNotice';

const navigation = vi.hoisted(() => ({ pathname: '/', search: '' }));
vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
  useSearchParams: () => new URLSearchParams(navigation.search),
}));

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  fetchMock.mockReset();
  navigation.pathname = '/';
  navigation.search = '';
});

describe('IdleNotice (OA-R3, README §4)', () => {
  it('shows the idle notice when the server-given time runs out, without asking anyone', () => {
    render(<SessionEndNotice idleRemainingMs={60_000} absoluteRemainingMs={8 * 3_600_000} />);
    act(() => vi.advanceTimersByTime(59_999));
    expect(screen.queryByRole('alert')).toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByRole('alert')).toHaveTextContent('15분 동안 활동이 없어 접속이 끝났습니다.');
    expect(screen.getByRole('link', { name: '다시 로그인' })).toHaveAttribute(
      'href',
      '/login?ended=idle',
    );
  });

  it('never polls the session, even for a whole idle period', () => {
    render(
      <SessionEndNotice idleRemainingMs={IDLE_TIMEOUT_MS} absoluteRemainingMs={8 * 3_600_000} />,
    );
    act(() => vi.advanceTimersByTime(IDLE_TIMEOUT_MS * 2));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('starts the idle countdown over after a BFF call reached the API', () => {
    render(<SessionEndNotice idleRemainingMs={60_000} absoluteRemainingMs={8 * 3_600_000} />);
    act(() => vi.advanceTimersByTime(50_000));
    act(() => {
      window.dispatchEvent(new Event(SESSION_ACTIVITY_EVENT));
    });
    act(() => vi.advanceTimersByTime(IDLE_TIMEOUT_MS - 1));
    expect(screen.queryByRole('alert')).toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('keeps the absolute limit when activity continues', () => {
    render(
      <SessionEndNotice idleRemainingMs={IDLE_TIMEOUT_MS} absoluteRemainingMs={20 * 60_000} />,
    );
    for (let minute = 0; minute < 19; minute += 1) {
      act(() => vi.advanceTimersByTime(60_000));
      act(() => {
        window.dispatchEvent(new Event(SESSION_ACTIVITY_EVENT));
      });
    }
    act(() => vi.advanceTimersByTime(60_000));
    expect(screen.getByRole('alert')).toHaveTextContent(
      '로그인한 지 8시간이 지나 접속이 끝났습니다.',
    );
  });

  it('clears a notice shown too early once activity proves the session is alive', () => {
    render(<SessionEndNotice idleRemainingMs={1_000} absoluteRemainingMs={8 * 3_600_000} />);
    act(() => vi.advanceTimersByTime(1_000));
    expect(screen.getByRole('alert')).toBeInTheDocument();
    act(() => {
      window.dispatchEvent(new Event(SESSION_ACTIVITY_EVENT));
    });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('counts a navigation as activity (the next page reads the session on the server)', () => {
    const view = render(
      <SessionEndNotice idleRemainingMs={60_000} absoluteRemainingMs={8 * 3_600_000} />,
    );
    act(() => vi.advanceTimersByTime(50_000));
    navigation.pathname = '/audit';
    view.rerender(
      <SessionEndNotice idleRemainingMs={60_000} absoluteRemainingMs={8 * 3_600_000} />,
    );
    act(() => vi.advanceTimersByTime(IDLE_TIMEOUT_MS - 1));
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
