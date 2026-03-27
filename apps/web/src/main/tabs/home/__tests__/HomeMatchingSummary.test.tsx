import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HomeMatchingSummary } from '../HomeMatchingSummary';
import type { MatchRequest, ActiveMatch } from '@/types/match';
import type { RoommateProfile } from '@/types/profile';

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

// --- Test data ---
const USER_ID = 'user-001';
const far = '2099-01-01T00:00:00.000Z';
const farExp = '2099-01-06T00:00:00.000Z';

const baseRequest = {
  message: null,
  createdAt: far,
  expiresAt: farExp,
  rejectedAt: null,
  acceptedAt: null,
  resolvedAt: null,
};

const profiles: Omit<RoommateProfile, 'matchScore'>[] = [
  {
    id: '3',
    nickname: '홍길동',
    gender: 'M',
    campus: 'CHUNCHEON',
    dormitoryId: 'dasan',
    lifestyle: {} as RoommateProfile['lifestyle'],
    intro: '',
    messageToRoommate: null,
    additional: { college: null, grade: null, mbti: null, birthYear: null },
  },
];

const defaultProps = {
  matchRequests: [] as MatchRequest[],
  activeMatch: null as ActiveMatch | null,
  userId: USER_ID,
  isCampusOperated: true,
  profiles,
  onNavigate: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockSeasonContext.state = 'SEASON_MATCHING';
  mockSeasonContext.isMatching = true;
});

describe('HomeMatchingSummary', () => {
  it('비운영 캠퍼스 메시지를 표시한다', () => {
    render(<HomeMatchingSummary {...defaultProps} isCampusOperated={false} />);
    expect(screen.getByText(/매칭 서비스를 운영하지 않습니다/)).toBeDefined();
  });

  it('비시즌 메시지를 표시한다', () => {
    mockSeasonContext.state = 'OFF_SEASON';
    mockSeasonContext.isMatching = false;
    render(<HomeMatchingSummary {...defaultProps} />);
    expect(screen.getByText(/다음 시즌이 시작되면/)).toBeDefined();
  });

  it('시즌 오픈 메시지를 표시한다', () => {
    mockSeasonContext.state = 'SEASON_OPEN';
    mockSeasonContext.isMatching = false;
    render(<HomeMatchingSummary {...defaultProps} />);
    expect(screen.getByText(/시즌이 곧 시작돼요/)).toBeDefined();
  });

  it('활성 매칭 시 파트너 정보를 표시하고 통계를 숨긴다', () => {
    const activeMatch: ActiveMatch = {
      matchId: 'm-001',
      partnerUserId: '3',
      partnerNickname: '홍길동',
      partnerDormitoryId: 'dasan',
      matchScore: 85,
      scoreType: 'full',
      matchedAt: far,
      cancelRequestedAt: null,
      cancelRequestedBy: null,
    };
    render(<HomeMatchingSummary {...defaultProps} activeMatch={activeMatch} />);
    expect(screen.getByText(/홍길동님과 매칭 중/)).toBeDefined();
    expect(screen.getByText(/85%/)).toBeDefined();
    expect(screen.queryByText('보낸 요청')).toBeNull();
  });

  it('받은 요청이 있을 때 요청자 닉네임을 표시한다', () => {
    const requests: MatchRequest[] = [
      { id: 'r-1', fromUserId: '3', toUserId: USER_ID, status: 'PENDING', ...baseRequest },
    ];
    render(<HomeMatchingSummary {...defaultProps} matchRequests={requests} />);
    expect(screen.getByText(/홍길동/)).toBeDefined();
    expect(screen.getByText(/매칭을 요청했어요/)).toBeDefined();
  });

  it('보낸만 있을 때 보낸 건수를 표시한다', () => {
    const requests: MatchRequest[] = [
      { id: 'r-1', fromUserId: USER_ID, toUserId: '3', status: 'PENDING', ...baseRequest },
    ];
    render(<HomeMatchingSummary {...defaultProps} matchRequests={requests} />);
    expect(screen.getByText(/보낸 요청 1건 대기 중/)).toBeDefined();
  });

  it('없음 케이스 메시지를 표시한다', () => {
    render(<HomeMatchingSummary {...defaultProps} />);
    expect(screen.getByText(/매칭 요청이 없어요/)).toBeDefined();
  });

  it('활성 상태에서 통계 그리드를 표시한다', () => {
    const requests: MatchRequest[] = [
      { id: 'r-1', fromUserId: USER_ID, toUserId: '3', status: 'PENDING', ...baseRequest },
    ];
    render(<HomeMatchingSummary {...defaultProps} matchRequests={requests} />);
    expect(screen.getByText('보낸 요청')).toBeDefined();
    expect(screen.getByText('받은 요청')).toBeDefined();
    expect(screen.getByText('대화 중')).toBeDefined();
  });

  it('클릭 시 매칭 탭으로 이동한다', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(<HomeMatchingSummary {...defaultProps} onNavigate={onNavigate} />);

    const buttons = screen.getAllByRole('button');
    await user.click(buttons[0]);
    expect(onNavigate).toHaveBeenCalledWith('matching');
  });
});
