import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SESSION_ACTIVITY_EVENT, SESSION_CLOSED_EVENT } from '@/client/bff-client';
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

const CLOSED_NOTICE =
  '이 접속은 끝났습니다. 다른 창에서 로그아웃했거나 역할·계정 상태가 바뀌었을 수 있습니다.';

function closeSession() {
  act(() => {
    window.dispatchEvent(new Event(SESSION_CLOSED_EVENT));
  });
}

describe('SessionEndNotice closed notice (OA-R3, README §4)', () => {
  it('shows the closed notice with a link to /login?ended=closed after a BFF call finds the session closed', () => {
    render(
      <>
        <SessionEndNotice idleRemainingMs={IDLE_TIMEOUT_MS} absoluteRemainingMs={8 * 3_600_000} />
        <label>
          결정 사유
          <textarea name="reason" />
        </label>
      </>,
    );
    fireEvent.change(screen.getByRole('textbox', { name: '결정 사유' }), {
      target: { value: '승인 권한 운영자가 한 명뿐임' },
    });
    expect(screen.queryByRole('alert')).toBeNull();
    closeSession();
    const notice = screen.getByRole('alert');
    expect(notice).toHaveTextContent(CLOSED_NOTICE);
    expect(notice).not.toHaveTextContent('다시 로그인하세요.');
    expect(screen.getByRole('link', { name: '다시 로그인' })).toHaveAttribute(
      'href',
      '/login?ended=closed',
    );
    expect(screen.getByRole('textbox', { name: '결정 사유' })).toHaveValue(
      '승인 권한 운영자가 한 명뿐임',
    );
  });

  it('keeps the closed notice after later activity', () => {
    const view = render(
      <SessionEndNotice idleRemainingMs={60_000} absoluteRemainingMs={8 * 3_600_000} />,
    );
    closeSession();
    act(() => {
      window.dispatchEvent(new Event(SESSION_ACTIVITY_EVENT));
    });
    navigation.pathname = '/audit';
    view.rerender(
      <SessionEndNotice idleRemainingMs={60_000} absoluteRemainingMs={8 * 3_600_000} />,
    );
    act(() => vi.advanceTimersByTime(8 * 3_600_000));
    expect(screen.getByRole('alert')).toHaveTextContent(CLOSED_NOTICE);
    expect(screen.getByRole('link', { name: '다시 로그인' })).toHaveAttribute(
      'href',
      '/login?ended=closed',
    );
  });
});
