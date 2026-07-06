import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HomeOperationsSurface } from '../sections/operations/HomeOperationsSurface';
import { useHomeOperations } from '../hooks/useHomeOperations';
import type { HomeOperationsState } from '../hooks/useHomeOperations';

vi.mock('../hooks/useHomeOperations', () => ({
  useHomeOperations: vi.fn(),
}));

const actions = {
  refresh: vi.fn(async () => undefined),
};

const baseState: HomeOperationsState = {
  loading: false,
  refreshing: false,
  unreadNotificationCount: 1,
};

function mockOperations(overrides: Partial<HomeOperationsState> = {}) {
  vi.mocked(useHomeOperations).mockReturnValue({
    ...baseState,
    ...overrides,
    ...actions,
  });
}

describe('HomeOperationsSurface', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOperations();
  });

  it('공지사항, 알림함, 문의하기를 dedicated page entry로 렌더링한다', () => {
    render(<HomeOperationsSurface />);

    expect(screen.getByRole('region', { name: '공지사항' })).toBeInTheDocument();
    expect(screen.getByLabelText('알림함과 문의하기')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /공지사항을 확인해요/ })).toHaveAttribute(
      'href',
      '/notices',
    );
    expect(screen.getByRole('link', { name: /알림함/ })).toHaveAttribute('href', '/notifications');
    expect(screen.getByRole('link', { name: /문의하기/ })).toHaveAttribute('href', '/support');
    expect(screen.getByText('읽지 않은 알림 1개')).toBeInTheDocument();
  });

  it('unread count를 가져오지 못해도 HomeTab에는 error surface를 노출하지 않는다', () => {
    mockOperations({ unreadNotificationCount: null, loading: false, refreshing: false });

    render(<HomeOperationsSurface />);

    expect(screen.queryByText(/불러오지 못했어요/)).not.toBeInTheDocument();
    expect(screen.getByText('새 알림은 알림함에서 확인할 수 있어요.')).toBeInTheDocument();
  });

  it('카운트를 확인하는 동안에도 전용 페이지 진입점은 유지한다', () => {
    mockOperations({ unreadNotificationCount: null, loading: true });

    render(<HomeOperationsSurface />);

    expect(screen.getByRole('link', { name: /알림함/ })).toHaveAttribute('href', '/notifications');
    expect(screen.getByText('새 알림을 확인하는 중이에요.')).toBeInTheDocument();
  });
});
