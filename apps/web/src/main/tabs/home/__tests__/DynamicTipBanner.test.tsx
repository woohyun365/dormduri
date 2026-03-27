import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DynamicTipBanner } from '../DynamicTipBanner';

// --- SeasonContext mock ---
const mockSeasonContext = {
  season: { name: '2026 1학기', roomSelectionDate: '2026-04-01' },
  state: 'SEASON_MATCHING' as const,
  isOpen: false,
  isMatching: true,
  daysUntilEnd: 14,
};

vi.mock('@/contexts/SeasonContext', () => ({
  useSeasonContext: () => mockSeasonContext,
}));

const defaultProps = {
  receivedRequests: 0,
  sentRequests: 0,
  conversationCount: 0,
  hasActiveMatch: false,
};

describe('DynamicTipBanner', () => {
  it('활성 매칭 시 확정 팁을 표시한다', () => {
    render(<DynamicTipBanner {...defaultProps} hasActiveMatch />);
    expect(screen.getByText(/매칭이 확정되었어요/)).toBeDefined();
  });

  it('비시즌 시 프로필 완성 팁을 표시한다', () => {
    mockSeasonContext.state = 'OFF_SEASON';
    mockSeasonContext.isMatching = false;
    render(<DynamicTipBanner {...defaultProps} />);
    expect(screen.getByText(/비시즌에도 프로필을/)).toBeDefined();
    mockSeasonContext.state = 'SEASON_MATCHING';
    mockSeasonContext.isMatching = true;
  });

  it('시즌 오픈 시 준비 팁을 표시한다', () => {
    mockSeasonContext.state = 'SEASON_OPEN';
    mockSeasonContext.isMatching = false;
    render(<DynamicTipBanner {...defaultProps} />);
    expect(screen.getByText(/시즌이 곧 시작돼요/)).toBeDefined();
    mockSeasonContext.state = 'SEASON_MATCHING';
    mockSeasonContext.isMatching = true;
  });

  it('받은 요청 4개 이상일 때 요청 팁을 표시한다', () => {
    render(<DynamicTipBanner {...defaultProps} receivedRequests={5} />);
    expect(screen.getByText(/5개의 매칭 요청을 받았어요/)).toBeDefined();
  });

  it('보낸 요청 0건일 때 탐색 팁을 표시한다', () => {
    render(<DynamicTipBanner {...defaultProps} sentRequests={0} />);
    expect(screen.getByText(/아직 요청을 보내지 않았네요/)).toBeDefined();
  });

  it('대화 중일 때 대화 팁을 표시한다', () => {
    render(<DynamicTipBanner {...defaultProps} sentRequests={1} conversationCount={2} />);
    expect(screen.getByText(/2명과 대화 중이에요/)).toBeDefined();
  });

  it('조건이 없을 때 기본 팁을 표시한다', () => {
    render(<DynamicTipBanner {...defaultProps} sentRequests={1} />);
    expect(screen.getByText(/생활패턴이 비슷한 사람과/)).toBeDefined();
  });
});
