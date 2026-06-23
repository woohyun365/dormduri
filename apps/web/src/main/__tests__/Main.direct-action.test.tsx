import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Main from '../Main';
import { seasonApi } from '@/api/season';
import { profileApi } from '@/api/profile';
import { homeApi } from '@/api/home';
import type { UserProfile } from '@/types/profile';

vi.mock('../components/BottomTabBar', () => ({
  BottomTabBar: () => <nav aria-label="하단 탭">Bottom tabs</nav>,
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
  default: () => <section data-testid="main-home">home tab</section>,
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
    hasSeenTooltip: true,
    markTooltipSeen: vi.fn(),
  }),
}));

vi.mock('../hooks/useMainProfileState', () => ({
  useMainProfileState: (initialUser: UserProfile) => ({
    user: initialUser,
    showBuildingSelect: false,
    setShowBuildingSelect: vi.fn(),
    handleSelectDormitory: vi.fn(),
    handleIntroChange: vi.fn(),
    handleMessageChange: vi.fn(),
    handleLifestyleChange: vi.fn(),
    handleAdditionalChange: vi.fn(),
    handleShowGuide: vi.fn(),
    handleCloseGuide: vi.fn(),
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

const baseUser: UserProfile = {
  id: 'user-1',
  nickname: '춘천유저',
  gender: 'M',
  campus: 'CHUNCHEON',
  dormitoryId: null,
  lifestyle: {} as UserProfile['lifestyle'],
  intro: '',
  messageToRoommate: null,
  additional: { college: null, grade: null, mbti: null, birthYear: null },
};

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
    vi.spyOn(profileApi, 'getProfiles').mockResolvedValue([]);
    vi.spyOn(homeApi, 'getBuildingStats').mockResolvedValue(buildingStats);
    vi.spyOn(homeApi, 'getPastSeasonResult').mockResolvedValue(undefined);
    vi.spyOn(homeApi, 'getPastSeasons').mockResolvedValue([]);
    vi.spyOn(homeApi, 'isNextSeasonRegistered').mockResolvedValue(false);
    vi.spyOn(homeApi, 'getUnreadMessages').mockResolvedValue(0);
  });

  it('documents that Home currently auto-opens building selection for unassigned open-season users', async () => {
    render(<Main initialUser={baseUser} />);

    await screen.findByTestId('main-home');

    expect(screen.getByRole('dialog', { name: '배정 건물 선택' })).toBeInTheDocument();
  });

  it.skip('target: Home entry does not force building selection; users start it through a direct CTA', async () => {
    render(<Main initialUser={baseUser} />);

    await screen.findByTestId('main-home');

    expect(screen.queryByRole('dialog', { name: '배정 건물 선택' })).not.toBeInTheDocument();
  });
});
