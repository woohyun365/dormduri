import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ConversationThreadDetailResponse } from '@repo/shared/chat';
import ChatRoomView from '../ChatRoomView';

const createReportMock = vi.hoisted(() => vi.fn());

vi.mock('../api/chat.api', () => ({
  chatApi: {
    updateReadMarker: vi.fn(),
    sendMessage: vi.fn(),
    leaveThread: vi.fn(),
    createReport: createReportMock,
  },
}));

const detail: ConversationThreadDetailResponse = {
  thread: {
    id: 'thread-1',
    seasonId: 'season-1',
    counterpartUserId: 'counterpart-1',
    counterpartParticipantId: 'participant-1',
    threadKind: 'MATCHED',
    status: 'OPEN',
    closedReason: null,
    closedAt: null,
    lastMessageAt: null,
    canSendMessage: true,
    sendMessageUnavailableReason: null,
    canReport: true,
  },
  messages: [],
};

describe('ChatRoomView', () => {
  it('canReport thread만 social-safety CHAT_THREAD 신고를 제출한다', async () => {
    const user = userEvent.setup();
    createReportMock.mockResolvedValue({ received: true });
    render(
      <ChatRoomView detail={detail} viewerId="viewer-1" onBack={vi.fn()} onRefresh={vi.fn()} />,
    );

    await user.click(screen.getByRole('button', { name: '신고하기' }));
    const dialog = screen.getByRole('dialog', { name: '대화 신고' });
    await user.click(screen.getByRole('checkbox', { name: /허위 신고/ }));
    await user.click(within(dialog).getByRole('button', { name: '신고하기' }));

    expect(createReportMock).toHaveBeenCalledWith(
      expect.objectContaining({
        targetType: 'CHAT_THREAD',
        targetId: 'thread-1',
        falseReportDisclaimerAccepted: true,
      }),
    );
  });

  it('canReport가 false면 신고 action을 노출하지 않는다', () => {
    render(
      <ChatRoomView
        detail={{ ...detail, thread: { ...detail.thread, canReport: false } }}
        viewerId="viewer-1"
        onBack={vi.fn()}
        onRefresh={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: '신고하기' })).not.toBeInTheDocument();
  });
});
