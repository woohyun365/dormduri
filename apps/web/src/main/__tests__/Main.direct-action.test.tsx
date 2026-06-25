import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Main from '../Main';
import { seasonApi } from '@/api/season';
import { homeApi } from '@/api/home';
import { profileApi } from '@/api/profile';
import { createHomeDashboardTestResponse } from '@/main/test-support/home-dashboard.builder';

vi.mock('../components/BottomTabBar', () => ({
  BottomTabBar: ({
    onTabChange,
  }: {
    onTabChange: (tab: 'home' | 'list' | 'matching' | 'chat' | 'profile') => void;
  }) => (
    <nav aria-label="하단 탭">
      <button type="button" onClick={() => onTabChange('home')}>
        홈
      </button>
      <button type="button" onClick={() => onTabChange('list')}>
        룸메이트 찾기
      </button>
    </nav>
  ),
}));

vi.mock('../components/BuildingSelectModal', () => ({
  BuildingSelectModal: () => (
    <div role="dialog" aria-label="배정 건물 선택">
      building select modal
    </div>
  ),
}));

vi.mock('../components/DormitoryGuideSheet', () => ({
  DormitoryGuideSheet: () => null,
}));

vi.mock('../components/MatchCelebrationModal', () => ({
  MatchCelebrationModal: () => null,
}));

vi.mock('../tabs/home/HomeTab', () => ({
  default: ({ onOpenBuildingSelect }: { onOpenBuildingSelect?: () => void }) => (
    <section data-testid="main-home">
      home tab
      <button type="button" onClick={onOpenBuildingSelect}>
        기숙사 선택 시작
      </button>
    </section>
  ),
}));

vi.mock('../tabs/roommate-list/RoommateListTab', () => ({
  default: () => null,
}));

vi.mock('../tabs/profile/ProfileTab', () => ({
  default: () => null,
}));

vi.mock('../tabs/matching/MatchingTab', () => ({
  default: () => null,
}));

vi.mock('../tabs/chat/ChatTab', () => ({
  default: () => null,
}));

vi.mock('@/hooks/useOnboardingState', () => ({
  useOnboardingState: () => ({
    hasSeenGuide: true,
    markGuideSeen: vi.fn(),
    resetChecklist: vi.fn(),
    hasSeenTooltip: vi.fn(() => true),
    markTooltipSeen: vi.fn(),
  }),
}));

vi.mock('../hooks/useMainSocialState', () => ({
  useMainSocialState: () => ({
    blockedUsers: [],
    blockedUserIds: new Set<string>(),
    handleUnblockUser: vi.fn(),
    handleBlockUser: vi.fn(),
    handleReportUser: vi.fn(),
  }),
}));

vi.mock('../hooks/useMainMatchingState', () => ({
  useMainMatchingState: () => ({
    matchRequests: [],
    activeMatch: null,
    receivedPendingCount: 0,
    showCelebration: null,
    closeCelebration: vi.fn(),
    handleSendRequest: vi.fn(),
    handleAcceptRequest: vi.fn(),
    handleRejectRequest: vi.fn(),
    handleCancelRequest: vi.fn(),
    handleConfirmMatch: vi.fn(),
    handleRevokeConfirmMatch: vi.fn(),
    handleFinalizePairGroup: vi.fn(),
    handleEndConversation: vi.fn(),
    handleEndMatch: vi.fn(),
  }),
}));

vi.mock('../hooks/useMainListViewState', () => ({
  useMainListViewState: () => ({
    sortMode: 'recommended',
    setSortMode: vi.fn(),
    filters: {},
    setFilters: vi.fn(),
    viewMode: 'card',
    setViewMode: vi.fn(),
  }),
}));

const buildingStats = {
  totalParticipants: 0,
  assignedParticipants: 0,
  buildingMatchable: 0,
  buildingTotal: 0,
  todayNewTotal: 0,
  todayNewBuilding: 0,
  totalMatchSuccess: 0,
  buildingMatchSuccess: 0,
  popularCondition: '-',
};

describe('Main direct-action baseline', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
    vi.spyOn(seasonApi, 'getCurrentSeason').mockResolvedValue({
      season: { name: '2026년 1학기', roomSelectionDate: '2099-04-30' },
      state: 'SEASON_OPEN',
      isOpen: true,
      isMatching: false,
      isPostMatch: false,
      daysUntilEnd: 14,
    });
    vi.spyOn(homeApi, 'getDashboard').mockResolvedValue(createHomeDashboardTestResponse());
    vi.spyOn(homeApi, 'getPastSeasons').mockResolvedValue([]);
    vi.spyOn(profileApi, 'getProfiles').mockResolvedValue([]);
    vi.spyOn(homeApi, 'getBuildingStats').mockResolvedValue(buildingStats);
    vi.spyOn(homeApi, 'getPastSeasonResult').mockResolvedValue(undefined);
    vi.spyOn(homeApi, 'isNextSeasonRegistered').mockResolvedValue(false);
    vi.spyOn(homeApi, 'getUnreadMessages').mockResolvedValue(0);
  });

  it('Home entry does not force building selection for unassigned open-season users', async () => {
    render(<Main />);

    await screen.findByTestId('main-home');

    expect(screen.queryByRole('dialog', { name: '배정 건물 선택' })).not.toBeInTheDocument();
    expect(homeApi.getDashboard).toHaveBeenCalledTimes(1);
    expect(seasonApi.getCurrentSeason).not.toHaveBeenCalled();
    expect(homeApi.getPastSeasons).not.toHaveBeenCalled();
    expect(homeApi.getBuildingStats).not.toHaveBeenCalled();
    expect(homeApi.getPastSeasonResult).not.toHaveBeenCalled();
    expect(homeApi.isNextSeasonRegistered).not.toHaveBeenCalled();
    expect(homeApi.getUnreadMessages).not.toHaveBeenCalled();
  });

  it('opens building selection only after the explicit Home CTA', async () => {
    const user = userEvent.setup();
    render(<Main />);

    await screen.findByTestId('main-home');
    expect(screen.queryByRole('dialog', { name: '배정 건물 선택' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '기숙사 선택 시작' }));

    expect(screen.getByRole('dialog', { name: '배정 건물 선택' })).toBeInTheDocument();
  });

  it('loads legacy roommate data lazily only after moving to a non-Home tab', async () => {
    const user = userEvent.setup();
    render(<Main />);

    await screen.findByTestId('main-home');
    expect(seasonApi.getCurrentSeason).not.toHaveBeenCalled();
    expect(profileApi.getProfiles).not.toHaveBeenCalled();
    expect(homeApi.getPastSeasons).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: '룸메이트 찾기' }));

    await waitFor(() => expect(seasonApi.getCurrentSeason).toHaveBeenCalledTimes(1));
    expect(profileApi.getProfiles).toHaveBeenCalledWith('CHUNCHEON', 'F', 'dasan');
    expect(homeApi.getPastSeasons).toHaveBeenCalledTimes(1);
  });

  it('shows a retryable Home error state when the dashboard fetch fails', async () => {
    const user = userEvent.setup();
    vi.mocked(homeApi.getDashboard)
      .mockRejectedValueOnce(new Error('raw upstream stack'))
      .mockResolvedValueOnce(createHomeDashboardTestResponse());

    render(<Main />);

    expect(await screen.findByRole('alert')).toHaveTextContent('홈 정보를 불러오지 못했어요');
    expect(screen.getByRole('alert')).not.toHaveTextContent('raw upstream stack');

    await user.click(screen.getByRole('button', { name: '다시 시도' }));

    await screen.findByTestId('main-home');
    expect(homeApi.getDashboard).toHaveBeenCalledTimes(2);
  });
});
