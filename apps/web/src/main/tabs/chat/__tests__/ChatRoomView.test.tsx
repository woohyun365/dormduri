import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ConversationThreadDetailResponse } from '@repo/shared/chat';
import ChatRoomView from '../ChatRoomView';

const createReportMock = vi.hoisted(() => vi.fn());
const sendMessageMock = vi.hoisted(() => vi.fn());
const leaveThreadMock = vi.hoisted(() => vi.fn());

vi.mock('../api/chat.api', () => ({
  chatApi: {
    updateReadMarker: vi.fn(async () => undefined),
    sendMessage: sendMessageMock,
    leaveThread: leaveThreadMock,
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

  it('메시지를 보내면 trim한 본문을 보내고 입력을 비운 뒤 다시 보낼 수 있다', async () => {
    const user = userEvent.setup();
    const onRefresh = vi.fn(async () => undefined);
    sendMessageMock.mockResolvedValue({});
    render(
      <ChatRoomView detail={detail} viewerId="viewer-1" onBack={vi.fn()} onRefresh={onRefresh} />,
    );

    const input = screen.getByRole('textbox', { name: '메시지' });
    await user.type(input, '  안녕하세요  ');
    await user.click(screen.getByRole('button', { name: '메시지 보내기' }));

    expect(sendMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        targetUserId: 'counterpart-1',
        body: '안녕하세요',
        clientMessageId: expect.any(String),
      }),
    );
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(input).toHaveValue('');
    expect(input).toBeEnabled();
    await user.type(input, '다음 메시지');
    expect(screen.getByRole('button', { name: '메시지 보내기' })).toBeEnabled();
  });

  it('보내기에 실패하면 안내를 보여 주고 입력을 남긴 채 다시 보낼 수 있다', async () => {
    const user = userEvent.setup();
    const onRefresh = vi.fn(async () => undefined);
    sendMessageMock.mockRejectedValue(new Error('send failed'));
    render(
      <ChatRoomView detail={detail} viewerId="viewer-1" onBack={vi.fn()} onRefresh={onRefresh} />,
    );

    const input = screen.getByRole('textbox', { name: '메시지' });
    await user.type(input, '실패할 메시지');
    await user.click(screen.getByRole('button', { name: '메시지 보내기' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('메시지를 보내지 못했어요.');
    expect(onRefresh).not.toHaveBeenCalled();
    expect(input).toHaveValue('실패할 메시지');
    expect(input).toBeEnabled();
    expect(screen.getByRole('button', { name: '메시지 보내기' })).toBeEnabled();
  });

  it('나가기에 성공하면 목록을 다시 읽고 돌아가며, 실패하면 안내 뒤 다시 누를 수 있다', async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    const onRefresh = vi.fn(async () => undefined);
    leaveThreadMock.mockRejectedValueOnce(new Error('leave failed')).mockResolvedValueOnce({});
    render(
      <ChatRoomView detail={detail} viewerId="viewer-1" onBack={onBack} onRefresh={onRefresh} />,
    );

    const leaveButton = screen.getByRole('button', { name: '나가기' });
    await user.click(leaveButton);
    expect(await screen.findByRole('alert')).toHaveTextContent('대화방을 나가지 못했어요.');
    expect(onBack).not.toHaveBeenCalled();
    expect(leaveButton).toBeEnabled();

    await user.click(leaveButton);
    expect(leaveThreadMock).toHaveBeenCalledTimes(2);
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(leaveButton).toBeEnabled();
  });

  it('같은 대화방에서 메시지가 바뀌면 입력 중인 글을 남긴 채 새 목록을 그린다', async () => {
    const user = userEvent.setup();
    const message = (id: string, body: string, senderUserId: string) => ({
      id,
      senderUserId,
      body,
      bodyState: 'PLAIN' as const,
      tombstoneReason: null,
      bodyVersion: 1,
      sentAt: '2026-08-04T03:00:00.000Z',
    });
    const first = { ...detail, messages: [message('m-1', '첫 메시지', 'counterpart-1')] };
    const view = render(
      <ChatRoomView detail={first} viewerId="viewer-1" onBack={vi.fn()} onRefresh={vi.fn()} />,
    );
    await user.type(screen.getByRole('textbox', { name: '메시지' }), '쓰는 중');

    view.rerender(
      <ChatRoomView
        detail={{ ...first, messages: [...first.messages, message('m-2', '새 답장', 'viewer-1')] }}
        viewerId="viewer-1"
        onBack={vi.fn()}
        onRefresh={vi.fn()}
      />,
    );

    expect(screen.getByText('첫 메시지')).toBeInTheDocument();
    expect(screen.getByText('새 답장')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: '메시지' })).toHaveValue('쓰는 중');
  });
});
