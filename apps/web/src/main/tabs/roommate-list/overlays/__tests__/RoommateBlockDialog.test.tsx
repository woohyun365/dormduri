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
    expect(dialog).toHaveTextContent('차단 전 알아야 할 사항');
    expect(dialog).toHaveTextContent('차단하면 서로의 룸메 목록에서 보이지 않아요.');
    expect(dialog).toHaveTextContent('기존 비매칭 대화는 읽기 전용으로 바뀔 수 있어요.');
    expect(dialog).toHaveTextContent(
      '차단은 차단 목록에서 해제할 수 있고, 상대에게 알리지 않아요.',
    );
    expect(within(dialog).queryByRole('status')).not.toBeInTheDocument();

    await userEvent.type(
      within(dialog).getByPlaceholderText('추후에 차단 이유를 확인하는 본인 참고용 메모예요.'),
      '다시 매칭하고 싶지 않음',
    );
    await userEvent.click(within(dialog).getByRole('button', { name: '차단하기' }));

    expect(onSubmit).toHaveBeenCalledWith({ note: '다시 매칭하고 싶지 않음' });
  });

  it('failure message는 dialog 내부 alert로 표시한다', () => {
    render(
      <RoommateBlockDialog
        state={blockState}
        submitting={false}
        errorMessage="차단을 완료하지 못했어요. 잠시 후 다시 시도해 주세요."
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent(
      '차단을 완료하지 못했어요. 잠시 후 다시 시도해 주세요.',
    );
  });

  it('submitting이면 제출 버튼을 disabled 처리한다', () => {
    render(
      <RoommateBlockDialog state={blockState} submitting onClose={vi.fn()} onSubmit={vi.fn()} />,
    );

    expect(screen.getByRole('button', { name: '차단 처리 중' })).toBeDisabled();
  });
});
