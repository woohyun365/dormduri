import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MatchRequestDecisionDialog } from '../MatchRequestDecisionDialog';

describe('MatchRequestDecisionDialog', () => {
  it.each([
    ['accept', '매칭 요청을 수락할까요?', '다른 미결 요청은 시스템에서 종료'],
    ['reject', '매칭 요청을 거절할까요?', '내부 사유는 공개되지 않아요'],
    ['cancel', '보낸 요청을 취소할까요?', '이 요청만 종료'],
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
});
