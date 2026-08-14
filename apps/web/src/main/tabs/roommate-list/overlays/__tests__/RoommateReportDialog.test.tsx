import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RoommateReportDialog } from '../RoommateReportDialog';
import type { RoommateActionDialogState } from '../../hooks/useRoommateActions';

const reportState: RoommateActionDialogState = {
  kind: 'report',
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

describe('RoommateReportDialog', () => {
  it('reason, disclaimer, optional block을 검증하고 profile report submit 값을 만든다', async () => {
    const onSubmit = vi.fn();
    render(
      <RoommateReportDialog
        state={reportState}
        submitting={false}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    const dialog = screen.getByRole('dialog', { name: '룸메이트 신고' });
    expect(within(dialog).getByText('신고 전 알아야 할 사항')).toBeInTheDocument();
    expect(
      within(dialog).getByText('신고가 접수되면 검토 완료 시 알림으로 안내드려요.'),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText('내부 검토 과정과 세부 조치 내용은 공개하지 않아요.'),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText('상대에게 신고자 정보와 차단 여부를 알리지 않아요.'),
    ).toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole('button', { name: '신고 접수' }));
    expect(within(dialog).getByRole('alert')).toHaveTextContent('신고 사유를 선택');

    await userEvent.selectOptions(within(dialog).getByLabelText('신고 사유'), 'FALSE_PROFILE');
    await userEvent.type(
      within(dialog).getByLabelText('상세 내용 (선택)'),
      '프로필이 실제와 달라요.',
    );
    await userEvent.click(within(dialog).getByLabelText('신고 접수와 함께 이 상대를 차단하기'));
    await userEvent.click(
      within(dialog).getByLabelText('허위 신고는 서비스 이용 제한 대상이 될 수 있음을 확인했어요.'),
    );
    await userEvent.click(within(dialog).getByRole('button', { name: '신고 접수' }));

    expect(onSubmit).toHaveBeenCalledWith({
      reason: 'FALSE_PROFILE',
      detail: '프로필이 실제와 달라요.',
      optionalBlock: true,
    });
  });
});
