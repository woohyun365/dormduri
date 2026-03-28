import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HomeMatchingSummary } from '../HomeMatchingSummary';
import type { HomeMatchingSummaryProps } from '../HomeMatchingSummary';

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
    expect(screen.getByText(/홍길동님이 매칭을 요청했어요/)).toBeDefined();
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

  it('클릭 시 매칭 탭으로 이동한다', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(<HomeMatchingSummary {...defaultProps} status="NO_ACTIVITY" onNavigate={onNavigate} />);
    const buttons = screen.getAllByRole('button');
    await user.click(buttons[0]!);
    expect(onNavigate).toHaveBeenCalledWith('matching');
  });
});
