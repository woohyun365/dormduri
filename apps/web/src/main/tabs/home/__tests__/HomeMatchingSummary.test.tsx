import { describe, it, expect, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HomeMatchingSummary } from '../components/HomeMatchingSummary';
import type { HomeMatchingSummaryProps } from '../components/HomeMatchingSummary';

const defaultProps: HomeMatchingSummaryProps = {
  status: 'NO_ACTIVITY',
  stats: { sentRequests: 0, receivedRequests: 0, activeChats: 0 },
  onNavigate: vi.fn(),
};

describe('HomeMatchingSummary', () => {
  it('비운영 캠퍼스 메시지를 표시한다', () => {
    render(<HomeMatchingSummary {...defaultProps} status="NOT_OPERATED" />);
    expect(screen.getByText(/매칭 서비스를 운영하지 않습니다/)).toBeDefined();
  });

  it('비시즌 메시지를 표시한다', () => {
    render(<HomeMatchingSummary {...defaultProps} status="OFF_SEASON" />);
    expect(screen.getByText(/다음 시즌이 시작되면/)).toBeDefined();
  });

  it('시즌 오픈 메시지를 표시한다', () => {
    render(<HomeMatchingSummary {...defaultProps} status="SEASON_OPEN" />);
    expect(screen.getByText(/시즌이 곧 시작돼요/)).toBeDefined();
  });

  it('활성 매칭 시 파트너 정보를 표시하고 통계를 숨긴다', () => {
    render(
      <HomeMatchingSummary
        {...defaultProps}
        status="ACTIVE_MATCH"
        activeMatch={{ nickname: '홍길동', matchScore: 85 }}
      />,
    );
    expect(screen.getByText(/홍길동님과 매칭 중/)).toBeDefined();
    expect(screen.getByText(/85%/)).toBeDefined();
    expect(screen.queryByText('보낸 요청')).toBeNull();
  });

  it('받은 요청이 있을 때 요청자 닉네임을 표시한다', () => {
    render(
      <HomeMatchingSummary
        {...defaultProps}
        status="HAS_ACTIVITY"
        stats={{ sentRequests: 0, receivedRequests: 1, activeChats: 0 }}
        receivedRequesters={['홍길동']}
      />,
    );
    // 닉네임이 truncate span으로 분리되어 있어 개별 확인
    expect(screen.getByText('홍길동')).toBeDefined();
    expect(screen.getByText(/매칭을 요청했어요/)).toBeDefined();
  });

  it('보낸 요청 건수를 표시한다', () => {
    render(
      <HomeMatchingSummary
        {...defaultProps}
        status="HAS_ACTIVITY"
        stats={{ sentRequests: 2, receivedRequests: 0, activeChats: 0 }}
      />,
    );
    expect(screen.getByText(/보낸 요청 2건 대기 중/)).toBeDefined();
  });

  it('없음 케이스 메시지를 표시한다', () => {
    render(<HomeMatchingSummary {...defaultProps} />);
    expect(screen.getByText(/매칭 요청이 없어요/)).toBeDefined();
  });

  it('registration 전 매칭 기간은 시즌 참여 준비 gate를 표시한다', () => {
    render(<HomeMatchingSummary {...defaultProps} gatingReason="registration_required" />);

    expect(screen.getByText('시즌 참여가 필요해요')).toBeDefined();
    expect(screen.getByRole('button', { name: /시즌 참여 준비하기/ })).toBeDefined();
    expect(screen.queryByText('보낸 요청')).toBeNull();
  });

  it('HAS_ACTIVITY에서 통계 그리드를 표시한다', () => {
    render(
      <HomeMatchingSummary
        {...defaultProps}
        status="HAS_ACTIVITY"
        stats={{ sentRequests: 1, receivedRequests: 2, activeChats: 3 }}
      />,
    );
    expect(screen.getByText('보낸 요청')).toBeDefined();
    expect(screen.getByText('받은 요청')).toBeDefined();
    expect(screen.getByText('대화 중')).toBeDefined();
  });

  it('비활성 상태에서 통계를 숨긴다', () => {
    render(<HomeMatchingSummary {...defaultProps} status="OFF_SEASON" />);
    expect(screen.queryByText('보낸 요청')).toBeNull();
  });

  it('통계 셀 클릭 시 매칭 탭으로 이동한다', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(
      <HomeMatchingSummary
        {...defaultProps}
        status="HAS_ACTIVITY"
        stats={{ sentRequests: 1, receivedRequests: 0, activeChats: 0 }}
        onNavigate={onNavigate}
      />,
    );
    const buttons = screen.getAllByRole('button');
    await user.click(buttons[0]!);
    expect(onNavigate).toHaveBeenCalled();
  });

  it('메시지 구성이 바뀌면 순환 인덱스가 첫 메시지로 리셋된다', () => {
    vi.useFakeTimers();
    try {
      const { rerender } = render(
        <HomeMatchingSummary
          {...defaultProps}
          status="HAS_ACTIVITY"
          stats={{ sentRequests: 1, receivedRequests: 1, activeChats: 0 }}
          receivedRequesters={['홍길동']}
        />,
      );
      const actionButton = screen.getAllByRole('button')[0]!;

      act(() => {
        vi.advanceTimersByTime(3000);
      });
      expect(actionButton).toHaveAttribute('data-active-message-index', '1');

      rerender(
        <HomeMatchingSummary
          {...defaultProps}
          status="HAS_ACTIVITY"
          stats={{ sentRequests: 1, receivedRequests: 1, activeChats: 0 }}
          receivedRequesters={['김철수']}
        />,
      );

      expect(screen.getAllByRole('button')[0]!).toHaveAttribute('data-active-message-index', '0');
    } finally {
      vi.useRealTimers();
    }
  });
});
