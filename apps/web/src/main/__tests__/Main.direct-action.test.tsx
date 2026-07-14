import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Main from '../Main';
import { seasonApi } from '@/main/legacy/seasonLegacyClient';
import { homeDashboardApi } from '@/main/api/home-dashboard.api';
import { legacyProfileApi as profileApi } from '@/main/legacy/profileLegacyClient';
import { createHomeDashboardTestResponse } from '@/main/test-support/home-dashboard.builder';

const roommateListTabMock = vi.hoisted(() =>
  vi.fn((props: Record<string, unknown>) => {
    void props;
    return null;
  }),
);
const matchingTabMock = vi.hoisted(() =>
  vi.fn((props: Record<string, unknown>) => {
    void props;
    return <section data-testid="main-matching">matching tab</section>;
  }),
);

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
      <button type="button" onClick={() => onTabChange('matching')}>
        매칭 현황
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
  default: roommateListTabMock,
}));

vi.mock('../tabs/profile/ProfileTab', () => ({
  default: () => null,
}));

vi.mock('../tabs/matching/MatchingTab', () => ({
  default: matchingTabMock,
}));

vi.mock('../tabs/chat/ChatTab', () => ({
  default: () => null,
}));

vi.mock('@/main/hooks/useMainLocalOnboardingState', () => ({
  useMainLocalOnboardingState: () => ({
    hasSeenGuide: true,
    markGuideSeen: vi.fn(),
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

describe('Main direct-action baseline', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    roommateListTabMock.mockClear();
    matchingTabMock.mockClear();
    sessionStorage.clear();
    vi.spyOn(seasonApi, 'getCurrentSeason').mockResolvedValue({
      season: { name: '2026년 1학기', roomSelectionDate: '2099-04-30' },
      state: 'SEASON_OPEN',
      isOpen: true,
      isMatching: false,
      isPostMatch: false,
      daysUntilEnd: 14,
    });
    vi.spyOn(homeDashboardApi, 'getDashboard').mockResolvedValue(createHomeDashboardTestResponse());
    vi.spyOn(profileApi, 'getProfiles').mockResolvedValue([]);
  });

  it('Home entry does not force building selection for unassigned open-season users', async () => {
    render(<Main />);

    await screen.findByTestId('main-home');

    expect(screen.queryByRole('dialog', { name: '배정 건물 선택' })).not.toBeInTheDocument();
    expect(homeDashboardApi.getDashboard).toHaveBeenCalledTimes(1);
    expect(seasonApi.getCurrentSeason).not.toHaveBeenCalled();
  });

  it('opens building selection only after the explicit Home CTA', async () => {
    const user = userEvent.setup();
    render(<Main />);

    await screen.findByTestId('main-home');
    expect(screen.queryByRole('dialog', { name: '배정 건물 선택' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '기숙사 선택 시작' }));

    expect(screen.getByRole('dialog', { name: '배정 건물 선택' })).toBeInTheDocument();
  });

  it('does not load legacy roommate data after moving to the list tab', async () => {
    const user = userEvent.setup();
    render(<Main />);

    await screen.findByTestId('main-home');
    expect(seasonApi.getCurrentSeason).not.toHaveBeenCalled();
    expect(profileApi.getProfiles).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: '룸메이트 찾기' }));

    await waitFor(() => expect(roommateListTabMock).toHaveBeenCalled());
    expect(seasonApi.getCurrentSeason).not.toHaveBeenCalled();
    expect(profileApi.getProfiles).not.toHaveBeenCalled();
    expect(homeDashboardApi.getDashboard).toHaveBeenCalledTimes(1);

    const props = roommateListTabMock.mock.lastCall?.[0];
    expect(props).toBeDefined();
    expect(props).toEqual(
      expect.objectContaining({
        user: expect.objectContaining({ id: 'user-1' }),
        onNavigate: expect.any(Function),
        searchEntryAllowed: true,
        viewerSeasonRegistered: true,
      }),
    );
    expect(Object.keys(props ?? {}).sort()).toEqual([
      'onNavigate',
      'searchEntryAllowed',
      'user',
      'viewerSeasonRegistered',
    ]);
  });

  it('passes closed search entry capability without loading legacy list data', async () => {
    const user = userEvent.setup();
    const dashboard = createHomeDashboardTestResponse();
    vi.mocked(homeDashboardApi.getDashboard).mockResolvedValue({
      ...dashboard,
      viewer: {
        ...dashboard.viewer,
        capabilities: {
          ...dashboard.viewer.capabilities,
          canEnterRoommateSearch: false,
        },
      },
    });

    render(<Main />);

    await screen.findByTestId('main-home');
    await user.click(screen.getByRole('button', { name: '룸메이트 찾기' }));

    await waitFor(() => expect(roommateListTabMock).toHaveBeenCalled());
    expect(seasonApi.getCurrentSeason).not.toHaveBeenCalled();
    expect(profileApi.getProfiles).not.toHaveBeenCalled();

    expect(roommateListTabMock.mock.lastCall?.[0]).toEqual(
      expect.objectContaining({
        searchEntryAllowed: false,
      }),
    );
  });

  it('matching tab에는 canonical viewer/season shell만 전달하고 legacy data를 불러오지 않는다', async () => {
    const user = userEvent.setup();
    render(<Main />);

    await screen.findByTestId('main-home');
    expect(seasonApi.getCurrentSeason).not.toHaveBeenCalled();
    expect(profileApi.getProfiles).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: '매칭 현황' }));

    await screen.findByTestId('main-matching');
    expect(seasonApi.getCurrentSeason).not.toHaveBeenCalled();
    expect(profileApi.getProfiles).not.toHaveBeenCalled();
    expect(homeDashboardApi.getDashboard).toHaveBeenCalledTimes(1);
    expect(matchingTabMock).toHaveBeenCalledWith(
      expect.objectContaining({
        viewerId: 'user-1',
        seasonShell: { id: 'season-2026-2', state: 'SEASON_OPEN' },
        onBadgeCountChange: expect.any(Function),
      }),
      undefined,
    );
  });

  it('shows a retryable Home error state when the dashboard fetch fails', async () => {
    const user = userEvent.setup();
    vi.mocked(homeDashboardApi.getDashboard)
      .mockRejectedValueOnce(new Error('raw upstream stack'))
      .mockResolvedValueOnce(createHomeDashboardTestResponse());

    render(<Main />);

    expect(await screen.findByRole('alert')).toHaveTextContent('홈 정보를 불러오지 못했어요');
    expect(screen.getByRole('alert')).not.toHaveTextContent('raw upstream stack');

    await user.click(screen.getByRole('button', { name: '다시 시도' }));

    await screen.findByTestId('main-home');
    expect(homeDashboardApi.getDashboard).toHaveBeenCalledTimes(2);
  });
});
