import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RoommateMatchRequestDialog } from '../RoommateMatchRequestDialog';
import type { RoommateActionDialogState } from '../../hooks/useRoommateActions';

const matchState: RoommateActionDialogState = {
  kind: 'matchRequest',
  target: {
    targetUserId: 'target-1',
    nickname: '감자친구',
    actions: {
      canBookmark: true,
      canRequestMatch: true,
      canStartChat: false,
      unavailableReasons: [],
    },
  },
};

describe('RoommateMatchRequestDialog', () => {
  it('optional note와 stale 안내를 표시하고 submit payload를 전달한다', async () => {
    const onSubmit = vi.fn();
    render(
      <RoommateMatchRequestDialog
        state={matchState}
        submitting={false}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    const dialog = screen.getByRole('dialog', { name: '매칭 요청 보내기' });
    expect(dialog).toHaveTextContent('서버가 전송 시점의 시즌·기숙사·프로필 상태를 다시 확인');
    expect(within(dialog).getByRole('status')).toHaveTextContent('서버에서 안전하게 거절');

    await userEvent.type(within(dialog).getByLabelText('요청 메시지 (선택)'), '잘 부탁해요.');
    await userEvent.click(within(dialog).getByRole('button', { name: '매칭 요청 보내기' }));

    expect(onSubmit).toHaveBeenCalledWith({ note: '잘 부탁해요.' });
  });

  it('stale error copy와 pending disabled 상태를 표시한다', () => {
    render(
      <RoommateMatchRequestDialog
        state={matchState}
        submitting
        errorMessage="목록 이후 상대나 시즌 상태가 바뀌었을 수 있어요."
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    const dialog = screen.getByRole('dialog', { name: '매칭 요청 보내기' });
    expect(within(dialog).getByRole('alert')).toHaveTextContent('상대나 시즌 상태가 바뀌었을 수');
    expect(within(dialog).getByRole('button', { name: '요청 전송 중' })).toBeDisabled();
  });
});
