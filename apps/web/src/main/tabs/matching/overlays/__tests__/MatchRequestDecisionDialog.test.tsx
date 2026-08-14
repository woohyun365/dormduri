import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MatchRequestDecisionDialog } from '../MatchRequestDecisionDialog';

describe('MatchRequestDecisionDialog', () => {
  it.each([
    ['accept', '매칭 요청을 수락할까요?', '다른 유저와의 매칭 요청·채팅은 자동으로 종료'],
    ['reject', '매칭 요청을 거절할까요?', '상대에게 거절 의사를 전달할 수 있어요'],
    ['cancel', '보낸 요청을 취소할까요?', '이 요청만 종료되고 상대에게 요청을 다시 보낼 수 있어요'],
  ] as const)('%s decision의 policy copy를 표시한다', (decision, title, copy) => {
    render(
      <MatchRequestDecisionDialog
        decision={decision}
        nickname="도윤"
        pending={false}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByRole('dialog', { name: title })).toBeInTheDocument();
    expect(screen.getByText(new RegExp(copy))).toBeInTheDocument();
  });

  it('pending 중 confirm/close 중복 interaction을 막는다', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    render(
      <MatchRequestDecisionDialog
        decision="accept"
        nickname="도윤"
        pending
        onClose={onClose}
        onConfirm={onConfirm}
      />,
    );

    await user.click(screen.getByRole('button', { name: '처리 중…' }));
    await user.click(screen.getByRole('button', { name: '돌아가기' }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('열릴 때 destructive confirm 대신 dialog context를 focus하고 Escape로 닫는다', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <MatchRequestDecisionDialog
        decision="accept"
        nickname="도윤"
        pending={false}
        onClose={onClose}
        onConfirm={vi.fn()}
      />,
    );

    const dialog = screen.getByRole('dialog', { name: '매칭 요청을 수락할까요?' });
    await waitFor(() => expect(dialog).toHaveFocus());
    expect(screen.getByRole('button', { name: '수락하기' })).not.toHaveFocus();

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
