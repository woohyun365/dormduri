import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ConversationThreadSummary } from '@repo/shared/chat';
import ChatTab from '../ChatTab';

const useChatThreadsMock = vi.hoisted(() => vi.fn());
const useChatThreadDetailMock = vi.hoisted(() => vi.fn());

vi.mock('../hooks/useChatThreads', () => ({ useChatThreads: useChatThreadsMock }));
vi.mock('../hooks/useChatThreadDetail', () => ({ useChatThreadDetail: useChatThreadDetailMock }));

const openThread: ConversationThreadSummary = {
  id: 'thread-open',
  seasonId: 'season-1',
  counterpartUserId: 'counterpart-1',
  counterpartParticipantId: 'participant-1',
  threadKind: 'MATCHED' as const,
  status: 'OPEN' as const,
  closedReason: null,
  closedAt: null,
  lastMessageAt: '2026-07-15T10:00:00.000Z',
  canSendMessage: true,
  sendMessageUnavailableReason: null,
  canReport: true,
};

function setupThreads(items = [openThread]) {
  useChatThreadsMock.mockReturnValue({
    data: { items, pageInfo: { hasNextPage: false, nextCursor: null } },
    error: null,
    loading: false,
    refresh: vi.fn(),
  });
  useChatThreadDetailMock.mockReturnValue({
    data: null,
    error: null,
    loading: false,
    refresh: vi.fn(),
  });
}

describe('ChatTab', () => {
  it('chat owner contract의 중립적인 thread 목록을 렌더링한다', () => {
    setupThreads();
    render(<ChatTab viewerId="viewer-1" onNavigate={vi.fn()} />);

    expect(screen.getByRole('heading', { name: '대화 상대' })).toBeInTheDocument();
    expect(screen.getByText('매칭 대화')).toBeInTheDocument();
    expect(screen.queryByText('매칭도')).not.toBeInTheDocument();
  });

  it('읽기 전용 thread를 지난 대화 영역에서 연다', async () => {
    const user = userEvent.setup();
    setupThreads([
      {
        ...openThread,
        id: 'thread-archived',
        status: 'ARCHIVED' as const,
        canSendMessage: false,
        sendMessageUnavailableReason: 'ARCHIVED_THREAD' as const,
      },
    ]);
    render(<ChatTab viewerId="viewer-1" onNavigate={vi.fn()} />);

    await user.click(
      screen.getByRole('button', { name: /지난 대화\s*읽기 전용 대화를 확인할 수 있어요\./ }),
    );
    expect(screen.getByText('보관됨')).toBeInTheDocument();
  });

  it('목록 오류는 upstream 세부 정보를 노출하지 않고 재시도를 제공한다', () => {
    const refresh = vi.fn();
    useChatThreadsMock.mockReturnValue({
      data: null,
      error: new Error('raw upstream stack'),
      loading: false,
      refresh,
    });
    useChatThreadDetailMock.mockReturnValue({
      data: null,
      error: null,
      loading: false,
      refresh: vi.fn(),
    });
    render(<ChatTab viewerId="viewer-1" onNavigate={vi.fn()} />);

    expect(screen.getByRole('alert')).toHaveTextContent('채팅 목록을 불러오지 못했어요.');
    expect(screen.getByRole('alert')).not.toHaveTextContent('raw upstream stack');
  });

  it('chat owner가 제공한 nextCursor가 있을 때만 추가 목록을 요청한다', async () => {
    const user = userEvent.setup();
    const loadMore = vi.fn();
    useChatThreadsMock.mockReturnValue({
      data: { items: [openThread], pageInfo: { hasNextPage: true, nextCursor: 'owner-cursor-2' } },
      error: null,
      loading: false,
      loadingMore: false,
      loadMoreError: null,
      loadMore,
      refresh: vi.fn(),
    });
    useChatThreadDetailMock.mockReturnValue({
      data: null,
      error: null,
      loading: false,
      refresh: vi.fn(),
    });
    render(<ChatTab viewerId="viewer-1" onNavigate={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: '대화 더 불러오기' }));
    expect(loadMore).toHaveBeenCalledOnce();
  });
});
