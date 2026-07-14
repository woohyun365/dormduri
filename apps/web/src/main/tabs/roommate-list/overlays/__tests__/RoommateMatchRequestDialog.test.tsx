import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RoommateMatchRequestDialog } from '../RoommateMatchRequestDialog';
import type { RoommateActionDialogState } from '../../hooks/useRoommateActions';
import { ACTIVE_MATCH_ALREADY_EXISTS_MESSAGE } from '../../model/actions/roommateActionReasonCopy';

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
  it('optional note 글자 수를 표시하고 submit payload를 전달한다', async () => {
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
    expect(dialog).toHaveTextContent('매칭 요청 전 알아야 할 사항');
    expect(dialog).toHaveTextContent('요청은 최대 5일 동안 유효해요.');
    expect(dialog).toHaveTextContent('상대가 수락하면 바로 매칭이 확정돼요.');
    expect(dialog).toHaveTextContent('보낸 요청은 매칭 탭에서 상태를 확인할 수 있어요.');
    expect(dialog).not.toHaveTextContent('공통점이나 함께 맞춰 보고 싶은 생활 습관');
    expect(within(dialog).getByText('0/100자')).toBeInTheDocument();
    expect(within(dialog).queryByRole('status')).not.toBeInTheDocument();
    expect(within(dialog).getByLabelText('요청 메시지 (선택)')).toHaveAttribute(
      'placeholder',
      '예: 생활 리듬이 비슷해서 함께 지내 보고 싶어요.',
    );

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

  it('target matched error는 PC에서 한 줄, mobile에서 문장별 줄바꿈 가능한 markup으로 표시한다', () => {
    render(
      <RoommateMatchRequestDialog
        state={matchState}
        submitting={false}
        errorMessage={ACTIVE_MATCH_ALREADY_EXISTS_MESSAGE}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    const dialog = screen.getByRole('dialog', { name: '매칭 요청 보내기' });
    const alert = within(dialog).getByRole('alert');
    expect(alert).toHaveTextContent(ACTIVE_MATCH_ALREADY_EXISTS_MESSAGE);
    expect(alert).not.toHaveClass('whitespace-pre-line');
    expect(within(alert).getByText('목록을 새로고침 후 다른 후보를 찾아보세요.')).toHaveClass(
      'block',
      'sm:inline',
    );
  });

  it('direction limit reached target은 요청 form 대신 amber blocked 안내를 표시한다', async () => {
    const onSubmit = vi.fn();
    render(
      <RoommateMatchRequestDialog
        state={{
          kind: 'matchRequest',
          target: {
            ...matchState.target,
            actions: {
              canBookmark: true,
              canRequestMatch: false,
              canStartChat: true,
              unavailableReasons: ['MATCH_REQUEST_DIRECTION_LIMIT_REACHED'],
            },
          },
        }}
        submitting={false}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    const dialog = screen.getByRole('dialog', { name: '매칭 요청 보내기' });
    expect(within(dialog).getByRole('alert')).toHaveTextContent(
      '이번 시즌에는 해당 유저에게 더 이상 매칭 요청을 보낼 수 없어요',
    );
    expect(within(dialog).queryByLabelText('요청 메시지 (선택)')).not.toBeInTheDocument();

    const submitButton = within(dialog).getByRole('button', { name: '매칭 요청 보내기' });
    expect(submitButton).toBeDisabled();
    expect(submitButton).toHaveClass('bg-amber-50', 'text-amber-700');

    await userEvent.click(submitButton);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
