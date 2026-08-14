import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RoommateActionReceiptDialog } from '../RoommateActionReceiptDialog';

const blockReceipt = {
  actionKind: 'block' as const,
  title: '차단을 반영했어요.',
  message: '상대에게 차단 사실을 알리지 않아요.\n차단 목록에서 확인 및 해제 가능해요.',
  counterpartNickname: '감자친구',
};

describe('RoommateActionReceiptDialog', () => {
  it('block success receipt를 리스트 알림 대신 dialog로 표시한다', async () => {
    const onDismiss = vi.fn();
    render(<RoommateActionReceiptDialog receipt={blockReceipt} onDismiss={onDismiss} />);

    expect(screen.getByRole('dialog', { name: '차단을 반영했어요.' })).toBeInTheDocument();
    expect(screen.getByText('차단 후 알아야 할 사항')).toBeInTheDocument();
    expect(screen.getByText('상대에게 차단 사실을 알리지 않아요.')).toBeInTheDocument();
    expect(screen.getByText('차단 목록에서 확인 및 해제 가능해요.')).toBeInTheDocument();
    expect(screen.getByText('감자친구')).toBeInTheDocument();
    expect(screen.getByText('님에 대한')).toBeInTheDocument();
    expect(screen.queryByText(/님에게/u)).not.toBeInTheDocument();
    expect(
      screen.getByRole('dialog', { name: '차단을 반영했어요.' }).querySelector('svg')
        ?.parentElement,
    ).toHaveClass('text-red-600');

    await userEvent.click(screen.getByRole('button', { name: '확인' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('match request receipt는 상대 닉네임을 함께 표시한다', () => {
    render(
      <RoommateActionReceiptDialog
        receipt={{
          actionKind: 'matchRequest',
          title: '매칭 요청을 보냈어요.',
          message: '상대가 수락하면 바로 매칭이 확정돼요.\n요청은 7월 13일까지 유효해요.',
          counterpartNickname: '감자친구',
        }}
        onDismiss={vi.fn()}
      />,
    );

    expect(screen.getByText('감자친구')).toBeInTheDocument();
    expect(screen.getByText('님에게')).toBeInTheDocument();
    expect(screen.getByText('매칭 요청 후 알아야 할 사항')).toBeInTheDocument();
    expect(screen.getByText('상대가 수락하면 바로 매칭이 확정돼요.')).toBeInTheDocument();
    expect(screen.getByText('요청은 7월 13일까지 유효해요.')).toBeInTheDocument();
    expect(
      screen.getByRole('dialog', { name: '매칭 요청을 보냈어요.' }).querySelector('svg')
        ?.parentElement,
    ).toHaveClass('text-emerald-600');
  });

  it('report receipt는 신고 접수 안내를 별도 톤으로 표시한다', () => {
    render(
      <RoommateActionReceiptDialog
        receipt={{
          actionKind: 'report',
          title: '신고를 접수했어요.',
          message:
            '허위 프로필 신고가 접수됐어요.\n검토가 완료되면 알림으로 안내드려요.\n내부 검토 과정과 세부 조치 내용은 공개하지 않아요.',
          counterpartNickname: '감자친구',
        }}
        onDismiss={vi.fn()}
      />,
    );

    expect(screen.getByText('감자친구')).toBeInTheDocument();
    expect(screen.getByText('님에 대한')).toBeInTheDocument();
    expect(screen.getByText('신고 접수 후 알아야 할 사항')).toBeInTheDocument();
    expect(screen.queryByText('매칭 요청 후 알아야 할 사항')).not.toBeInTheDocument();
    expect(screen.getByText('허위 프로필 신고가 접수됐어요.')).toBeInTheDocument();
    expect(screen.getByText('검토가 완료되면 알림으로 안내드려요.')).toBeInTheDocument();
    expect(
      screen.getByText('내부 검토 과정과 세부 조치 내용은 공개하지 않아요.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('dialog', { name: '신고를 접수했어요.' }).querySelector('svg')
        ?.parentElement,
    ).toHaveClass('text-amber-600');
  });

  it('report optional block receipt는 신고 안내와 차단 안내를 두 카드로 표시한다', () => {
    render(
      <RoommateActionReceiptDialog
        receipt={{
          actionKind: 'report',
          title: '신고를 접수했어요.',
          message:
            '허위 프로필 신고가 접수됐어요.\n검토가 완료되면 알림으로 안내드려요.\n내부 검토 과정과 세부 조치 내용은 공개하지 않아요.',
          counterpartNickname: '감자친구',
          secondaryNotice: {
            title: '차단 후 알아야 할 사항',
            message:
              '신고와 함께 차단도 반영했어요.\n상대에게 차단 사실을 알리지 않아요.\n차단 목록에서 확인 및 해제 가능해요.',
          },
        }}
        onDismiss={vi.fn()}
      />,
    );

    expect(screen.getByText('신고 접수 후 알아야 할 사항')).toBeInTheDocument();
    expect(screen.getByText('허위 프로필 신고가 접수됐어요.')).toBeInTheDocument();
    expect(screen.getByText('차단 후 알아야 할 사항')).toBeInTheDocument();
    expect(screen.getByText('신고와 함께 차단도 반영했어요.')).toBeInTheDocument();
    expect(screen.getByText('상대에게 차단 사실을 알리지 않아요.')).toBeInTheDocument();
    expect(screen.getByText('차단 목록에서 확인 및 해제 가능해요.')).toBeInTheDocument();
  });
});
