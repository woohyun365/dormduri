import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import NoticesPageClient from '../NoticesPageClient';
import { noticesPageApi } from '../api/notices-page.api';

vi.mock('../api/notices-page.api', () => ({
  noticesPageApi: {
    listNotices: vi.fn(),
    getNotice: vi.fn(),
  },
}));

const iso = '2026-07-03T00:00:00.000Z';
const notice = {
  id: 'notice-1',
  title: '운영 안내',
  summary: '서비스 운영 안내입니다.',
  severity: 'INFO' as const,
  publishedAt: iso,
  expiresAt: null,
  relatedSeasonId: null,
  createdAt: iso,
  updatedAt: iso,
};

describe('NoticesPageClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(noticesPageApi.listNotices).mockResolvedValue({
      items: [notice],
      pageInfo: { hasNextPage: false, nextCursor: null },
    });
    vi.mocked(noticesPageApi.getNotice).mockResolvedValue({
      notice: { ...notice, body: '공지 상세 본문입니다.' },
    });
  });

  it('공지 목록과 선택된 공지 상세를 표시한다', async () => {
    render(<NoticesPageClient />);

    expect(await screen.findByRole('heading', { name: '운영 안내' })).toBeInTheDocument();
    expect(await screen.findByText('공지 상세 본문입니다.')).toBeInTheDocument();
    expect(noticesPageApi.listNotices).toHaveBeenCalledWith({ limit: 20, severity: undefined });
  });

  it('severity filter를 변경하면 query를 좁혀 다시 조회한다', async () => {
    const user = userEvent.setup();
    render(<NoticesPageClient />);

    await user.click(screen.getByRole('button', { name: '중요' }));

    await waitFor(() => {
      expect(noticesPageApi.listNotices).toHaveBeenCalledWith({ limit: 20, severity: 'CRITICAL' });
    });
  });

  it('공지 상세 route에서 전달된 id를 먼저 조회한다', async () => {
    render(<NoticesPageClient initialNoticeId="notice-1" />);

    const article = await screen.findByRole('article');
    expect(within(article).getByText('공지 상세 본문입니다.')).toBeInTheDocument();
    expect(noticesPageApi.getNotice).toHaveBeenCalledWith('notice-1');
  });
});
