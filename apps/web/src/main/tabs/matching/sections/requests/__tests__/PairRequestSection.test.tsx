import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { MatchingRequestSectionView } from '../../../model/matching-request-view';
import { PairRequestSection } from '../PairRequestSection';

function request(id: string, nickname: string) {
  return {
    id,
    direction: 'RECEIVED' as const,
    presentation: 'pending' as const,
    nickname,
    intro: '조용하고 서로 배려하는 생활을 원해요.',
    note: '잘 부탁해요.',
    score: 90,
    scoreHiddenCopy: null,
    detailEntryToken: `token-${id}`,
    canStartChat: false,
    createdAt: '2026-08-01T00:00:00.000Z',
    expiresAt: '2026-08-05T00:00:00.000Z',
    statusLabel: '응답 대기',
    actions: {
      canAccept: true,
      canReject: true,
      canCancel: false,
      disabledReason: null,
      disabledReasonCopy: null,
      disabledReasonDescriptionId: null,
    },
    counterpartUserId: `user-${id}`,
  };
}

const section: MatchingRequestSectionView = {
  quota: { used: 0, limit: 3, remaining: 3 },
  sent: [],
  received: [request('new', '새 요청'), request('old', '이전 요청')],
};

describe('PairRequestSection', () => {
  it('received pending이 있으면 받은 요청을 선택하고 manual APG tab navigation을 제공한다', async () => {
    const user = userEvent.setup();
    const commands = {
      accept: vi.fn(),
      reject: vi.fn(),
      cancel: vi.fn(),
      isPending: () => false,
    };
    const { rerender } = render(
      <PairRequestSection
        section={section}
        serverNow="2026-08-01T00:00:00.000Z"
        roomSelectionDate="2026-08-10"
        commands={commands}
      />,
    );

    const receivedTab = screen.getByRole('tab', { name: /받은 요청 2/ });
    const sentTab = screen.getByRole('tab', { name: /보낸 요청 0/ });
    expect(receivedTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveAccessibleName('받은 요청 2');
    expect(screen.getAllByRole('heading', { level: 3 }).map((node) => node.textContent)).toEqual([
      '새 요청',
      '이전 요청',
    ]);

    await user.type(receivedTab, '{ArrowLeft}');
    expect(sentTab).toHaveFocus();
    expect(receivedTab).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{Enter}');
    expect(sentTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('아직 보낸 요청이 없어요.')).toBeInTheDocument();
    expect(screen.getByText(/보낸 요청 0\/3건 사용/)).toBeInTheDocument();

    rerender(
      <PairRequestSection
        section={{ ...section, received: [] }}
        serverNow="2026-08-01T00:00:00.000Z"
        roomSelectionDate="2026-08-10"
        commands={commands}
      />,
    );
    expect(screen.getByRole('tab', { name: /보낸 요청 0/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('explicit initialTab이 received pending 기본값보다 우선한다', () => {
    render(
      <PairRequestSection
        section={section}
        serverNow="2026-08-01T00:00:00.000Z"
        roomSelectionDate="2026-08-10"
        commands={{ accept: vi.fn(), reject: vi.fn(), cancel: vi.fn(), isPending: () => false }}
        initialTab="sent"
      />,
    );

    expect(screen.getByRole('tab', { name: /보낸 요청 0/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('명시적인 상세 버튼과 request action만 제공한다', () => {
    const onNavigateChat = vi.fn();
    render(
      <PairRequestSection
        section={{
          ...section,
          received: [{ ...section.received[0]!, canStartChat: true }, section.received[1]!],
        }}
        serverNow="2026-08-01T00:00:00.000Z"
        roomSelectionDate={null}
        commands={{ accept: vi.fn(), reject: vi.fn(), cancel: vi.fn(), isPending: () => false }}
        onOpenProfile={vi.fn()}
        onNavigateChat={onNavigateChat}
      />,
    );

    expect(screen.getAllByRole('button', { name: /프로필 상세 보기/ })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: '수락' })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: '거절' })).toHaveLength(2);
    expect(screen.getByRole('button', { name: '채팅하기' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '더보기' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('matching-request-direct-actions')).toHaveLength(2);
    expect(screen.queryByText(/GROUP|그룹 모집/)).not.toBeInTheDocument();
  });

  it('dialog가 열린 뒤 표시 시간이 지나도 local로 action을 제거하지 않고 authoritative command 뒤 focus를 복원한다', async () => {
    const user = userEvent.setup();
    const accept = vi.fn().mockResolvedValue('state-changed');
    const { rerender } = render(
      <PairRequestSection
        section={section}
        serverNow="2026-08-01T00:00:00.000Z"
        roomSelectionDate={null}
        commands={{ accept, reject: vi.fn(), cancel: vi.fn(), isPending: () => false }}
      />,
    );

    const trigger = screen.getAllByRole('button', { name: '수락' })[0]!;
    await user.click(trigger);
    rerender(
      <PairRequestSection
        section={section}
        serverNow="2026-08-06T00:00:00.000Z"
        roomSelectionDate={null}
        commands={{ accept, reject: vi.fn(), cancel: vi.fn(), isPending: () => false }}
      />,
    );
    expect(screen.getAllByText('요청 유효 시간이 지났어요').length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: '수락하기' }));

    expect(accept).toHaveBeenCalledWith('new');
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('disabled reason을 action과 연결하고 긴 요약과 메모를 320px reflow class로 보호한다', () => {
    const disabledRequest = {
      ...request('disabled', '길고 긴 닉네임이 여러 줄로 안전하게 줄바꿈되어야 하는 사용자'),
      intro:
        '아주 긴 소개 문장이 너비를 넘지 않고 자연스럽게 여러 줄로 줄바꿈되는지 확인하기 위한 텍스트입니다.',
      note: '함께 보낸 메모도 모바일 세로 화면에서 가로 스크롤을 만들지 않고 줄바꿈되어야 합니다.',
      actions: {
        canAccept: false,
        canReject: false,
        canCancel: false,
        disabledReason: 'REQUEST_EXPIRED' as const,
        disabledReasonCopy: '요청 유효 시간이 지나 처리할 수 없어요.',
        disabledReasonDescriptionId: 'matching-action-disabled-reason-request_expired',
      },
    };

    const { container } = render(
      <div style={{ width: 320 }}>
        <PairRequestSection
          section={{ ...section, received: [disabledRequest] }}
          serverNow="2026-08-06T00:00:00.000Z"
          roomSelectionDate={null}
          commands={{ accept: vi.fn(), reject: vi.fn(), cancel: vi.fn(), isPending: () => false }}
        />
      </div>,
    );

    const reason = screen.getByText('요청 유효 시간이 지나 처리할 수 없어요.');
    expect(reason).toHaveAttribute('id', 'matching-action-disabled-reason-request_expired');
    expect(screen.getByRole('button', { name: '수락' })).toHaveAttribute(
      'aria-describedby',
      reason.id,
    );
    expect(screen.getByRole('button', { name: '거절' })).toHaveAttribute(
      'aria-describedby',
      reason.id,
    );
    expect(container.querySelector('article')).toHaveClass('min-w-0');
    expect(screen.getByRole('heading', { level: 3 })).toHaveClass('wrap-break-word');
    expect(screen.getByText(disabledRequest.note)).toHaveClass('wrap-break-word');
    expect(reason).toHaveClass('wrap-break-word');
  });
});
