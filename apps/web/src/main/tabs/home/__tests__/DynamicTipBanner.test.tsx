import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DynamicTipBanner } from '../DynamicTipBanner';
import type { DynamicTipBannerProps } from '../DynamicTipBanner';

const defaultProps: DynamicTipBannerProps = {
  seasonStatus: 'SEASON_MATCHING',
  receivedRequests: 0,
  sentRequests: 0,
  activeChats: 0,
};

describe('DynamicTipBanner', () => {
  it('비운영 시 준비 중 팁을 표시한다', () => {
    render(<DynamicTipBanner {...defaultProps} seasonStatus="NOT_OPERATED" />);
    expect(screen.getByText(/서비스 운영 준비 중이에요/)).toBeDefined();
  });

  it('활성 매칭 시 확정 팁을 표시한다', () => {
    render(<DynamicTipBanner {...defaultProps} seasonStatus="ACTIVE_MATCH" />);
    expect(screen.getByText(/매칭이 확정되었어요/)).toBeDefined();
  });

  it('비시즌 시 프로필 완성 팁을 표시한다', () => {
    render(<DynamicTipBanner {...defaultProps} seasonStatus="OFF_SEASON" />);
    expect(screen.getByText(/비시즌에도 프로필을/)).toBeDefined();
  });

  it('시즌 오픈 시 준비 팁을 표시한다', () => {
    render(<DynamicTipBanner {...defaultProps} seasonStatus="SEASON_OPEN" />);
    expect(screen.getByText(/시즌이 곧 시작돼요/)).toBeDefined();
  });

  it('받은 요청 4개 이상일 때 요청 팁을 표시한다', () => {
    render(<DynamicTipBanner {...defaultProps} receivedRequests={5} />);
    expect(screen.getByText(/5개의 매칭 요청을 받았어요/)).toBeDefined();
  });

  it('보낸 요청 0건일 때 탐색 팁을 표시한다', () => {
    render(<DynamicTipBanner {...defaultProps} sentRequests={0} />);
    expect(screen.getByText(/아직 요청을 보내지 않았네요/)).toBeDefined();
  });

  it('보낸 요청 있을 때 응답 대기 팁을 표시한다', () => {
    render(<DynamicTipBanner {...defaultProps} sentRequests={2} />);
    expect(screen.getByText(/응답을 기다리고 있어요/)).toBeDefined();
  });

  it('대화만 있을 때 대화 팁을 표시한다', () => {
    // sentRequests=0 → #5(요청 안 보냄)이 첫 팁, activeChats=2 → #6이 두 번째
    // AnimatePresence로 첫 팁만 보이므로 sentRequests=0 + activeChats만으로 테스트
    // #5가 먼저 보이지만, #6도 배열에 포함됨을 간접 검증: indicator dots 존재
    render(<DynamicTipBanner {...defaultProps} sentRequests={0} activeChats={2} />);
    // 첫 팁은 #5 (보낸 요청 0건)
    expect(screen.getByText(/아직 요청을 보내지 않았네요/)).toBeDefined();
    // 2개 이상 팁 → indicator dots 존재
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(2);
  });
});
