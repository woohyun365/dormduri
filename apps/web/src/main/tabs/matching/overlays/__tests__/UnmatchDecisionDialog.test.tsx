import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { MatchingActiveUnmatchView } from '../../model/matching-active-view';
import { UnmatchDecisionDialog } from '../UnmatchDecisionDialog';

const unmatch: MatchingActiveUnmatchView = {
  state: 'WAITING_FOR_ME',
  progressText: '1/2',
  statusCopy: '상대가 해제를 요청했어요.',
  consentOwner: 'viewer',
  primaryAction: 'request',
  primaryActionLabel: '매칭 해제에 동의',
  disabledReason: null,
  disabledReasonCopy: null,
  disabledReasonDescriptionId: null,
  availableUntil: '2026-08-10T14:59:59.999Z',
};

describe('UnmatchDecisionDialog', () => {
  it('pending 중 close/confirm을 잠근다', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    render(
      <UnmatchDecisionDialog
        unmatch={unmatch}
        nickname="도윤"
        pending
        onClose={onClose}
        onConfirm={onConfirm}
      />,
    );

    expect(screen.getByRole('button', { name: '돌아가기' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '처리 중…' })).toBeDisabled();
    await user.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('열릴 때 destructive confirm을 자동 focus하지 않고 Escape close를 허용한다', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <UnmatchDecisionDialog
        unmatch={unmatch}
        nickname="도윤"
        pending={false}
        onClose={onClose}
        onConfirm={vi.fn()}
      />,
    );

    const dialog = screen.getByRole('dialog', { name: '매칭 해제에 동의할까요?' });
    await waitFor(() => expect(dialog).toHaveFocus());
    expect(screen.getByRole('button', { name: '해제 동의하기' })).not.toHaveFocus();

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
