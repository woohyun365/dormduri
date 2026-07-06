import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RoommateBlockDialog } from '../RoommateBlockDialog';
import type { RoommateActionDialogState } from '../../hooks/useRoommateActions';

const blockState: RoommateActionDialogState = {
  kind: 'block',
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

describe('RoommateBlockDialog', () => {
  it('optional note와 live status를 갖고 submit payload를 전달한다', async () => {
    const onSubmit = vi.fn();
    render(
      <RoommateBlockDialog
        state={blockState}
        submitting={false}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    const dialog = screen.getByRole('dialog', { name: '룸메이트 차단' });
    expect(dialog).toHaveTextContent('감자친구님을 차단할까요?');
    expect(within(dialog).getByRole('status')).toHaveTextContent('서버에서 최신 상태');

    await userEvent.type(
      within(dialog).getByLabelText('차단 메모 (선택)'),
      '다시 매칭하고 싶지 않음',
    );
    await userEvent.click(within(dialog).getByRole('button', { name: '차단하기' }));

    expect(onSubmit).toHaveBeenCalledWith({ note: '다시 매칭하고 싶지 않음' });
  });

  it('submitting이면 제출 버튼을 disabled 처리한다', () => {
    render(
      <RoommateBlockDialog state={blockState} submitting onClose={vi.fn()} onSubmit={vi.fn()} />,
    );

    expect(screen.getByRole('button', { name: '차단 처리 중' })).toBeDisabled();
  });
});
