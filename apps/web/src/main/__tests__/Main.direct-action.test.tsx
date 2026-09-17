import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Main from '../Main';
import { seasonApi } from '@/main/legacy/seasonLegacyClient';
import { homeDashboardApi } from '@/main/api/home-dashboard.api';
import { legacyProfileApi as profileApi } from '@/main/legacy/profileLegacyClient';
import { seasonParticipationApi } from '@/main/api/season-participation.api';
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
const profileTabMock = vi.hoisted(() => vi.fn());
const homeTabMock = vi.hoisted(() => vi.fn());

vi.mock('../components/BottomTabBar', () => ({
  BottomTabBar: ({
    onTabChange,
    badges,
  }: {
    onTabChange: (tab: 'home' | 'list' | 'matching' | 'chat' | 'profile') => void;
    badges?: Partial<Record<'home' | 'list' | 'matching' | 'chat' | 'profile', number>>;
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
      <button type="button" onClick={() => onTabChange('profile')}>
        프로필
      </button>
      {badges?.matching ? <span data-testid="matching-badge">{badges.matching}</span> : null}
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

vi.mock('../tabs/home/HomeTab', () => ({
  default: (props: {
    onOpenBuildingSelect?: () => void;
    onNavigate: (
      tab: 'home' | 'list' | 'matching' | 'chat' | 'profile',
      options?: { requestTab?: 'sent' | 'received' },
    ) => void;
    onDeregisterSeasonParticipation: () => Promise<void>;
  }) => {
    homeTabMock(props);
    return (
      <section data-testid="main-home">
        home tab
        <button type="button" onClick={props.onOpenBuildingSelect}>
          기숙사 선택 시작
        </button>
        <button
          type="button"
          onClick={() => props.onNavigate('matching', { requestTab: 'received' })}
        >
          받은 요청 바로가기
        </button>
      </section>
    );
  },
}));

vi.mock('../tabs/roommate-list/RoommateListTab', () => ({
  default: roommateListTabMock,
}));

vi.mock('../tabs/profile/ProfileTab', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../tabs/profile/ProfileTab')>();
  const { createElement } = await import('react');

  return {
    default: (props: React.ComponentProps<typeof actual.default>) => {
      profileTabMock(props);
      return createElement(actual.default, props);
    },
  };
});

vi.mock('../tabs/matching/MatchingTab', () => ({
  default: matchingTabMock,
}));

vi.mock('../tabs/chat/ChatTab', () => ({
  default: () => null,
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

describe('Main direct-action baseline', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    roommateListTabMock.mockClear();
    matchingTabMock.mockClear();
    profileTabMock.mockClear();
    homeTabMock.mockClear();
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

  it('시즌 참여 철회 성공 시 dashboard를 정확히 한 번 추가 조회한다', async () => {
    vi.spyOn(seasonParticipationApi, 'deregisterCurrentSeasonParticipation').mockResolvedValue();
    render(<Main />);

    await screen.findByTestId('main-home');
    const onDeregisterSeasonParticipation =
      homeTabMock.mock.lastCall?.[0]?.onDeregisterSeasonParticipation;
    expect(onDeregisterSeasonParticipation).toEqual(expect.any(Function));

    await act(async () => {
      await (onDeregisterSeasonParticipation as () => Promise<void>)();
    });

    expect(seasonParticipationApi.deregisterCurrentSeasonParticipation).toHaveBeenCalledTimes(1);
    expect(homeDashboardApi.getDashboard).toHaveBeenCalledTimes(2);
  });

  it('시즌 참여 철회 실패 시 dashboard를 추가 조회하지 않는다', async () => {
    const mutationError = new Error('deregister failed');
    vi.spyOn(seasonParticipationApi, 'deregisterCurrentSeasonParticipation').mockRejectedValue(
      mutationError,
    );
    render(<Main />);

    await screen.findByTestId('main-home');
    const onDeregisterSeasonParticipation =
      homeTabMock.mock.lastCall?.[0]?.onDeregisterSeasonParticipation;
    let caught: unknown;
    await act(async () => {
      try {
        await (onDeregisterSeasonParticipation as () => Promise<void>)();
      } catch (error) {
        caught = error;
      }
    });

    expect(caught).toBe(mutationError);
    expect(seasonParticipationApi.deregisterCurrentSeasonParticipation).toHaveBeenCalledTimes(1);
    expect(homeDashboardApi.getDashboard).toHaveBeenCalledTimes(1);
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

  it('Home의 requestTab deep-link option을 canonical MatchingTab에 전달한다', async () => {
    const user = userEvent.setup();
    render(<Main />);

    await screen.findByTestId('main-home');
    await user.click(screen.getByRole('button', { name: '받은 요청 바로가기' }));

    await screen.findByTestId('main-matching');
    expect(matchingTabMock.mock.lastCall?.[0]).toEqual(
      expect.objectContaining({ initialRequestTab: 'received' }),
    );
  });

  it('MatchingTab navigation intent는 Main의 기존 tab owner로만 전달한다', async () => {
    const user = userEvent.setup();
    render(<Main />);

    await screen.findByTestId('main-home');
    await user.click(screen.getByRole('button', { name: '매칭 현황' }));
    await screen.findByTestId('main-matching');

    const onNavigationIntent = matchingTabMock.mock.lastCall?.[0]?.onNavigationIntent;
    expect(onNavigationIntent).toEqual(expect.any(Function));

    await act(async () => {
      (onNavigationIntent as (intent: 'roommate') => void)('roommate');
    });

    await waitFor(() => expect(roommateListTabMock).toHaveBeenCalled());
    expect(matchingTabMock.mock.lastCall?.[0]).toEqual(
      expect.objectContaining({ onNavigationIntent: expect.any(Function) }),
    );
  });

  it('Profile의 저장된 local snapshot은 non-Home에서 유지하고 저장 전 draft와 Home 진입에서는 폐기한다', async () => {
    const user = userEvent.setup();
    render(<Main />);

    await screen.findByTestId('main-home');
    await user.click(screen.getByRole('button', { name: '프로필' }));
    await screen.findByRole('heading', { name: '내 프로필' });

    await user.click(screen.getByRole('button', { name: '작성하기' }));
    const editor = screen.getByRole('textbox');
    await user.type(editor, '아직 저장하지 않은 소개');

    await user.click(screen.getByRole('button', { name: '룸메이트 찾기' }));
    await user.click(screen.getByRole('button', { name: '프로필' }));

    expect(screen.queryByDisplayValue('아직 저장하지 않은 소개')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '작성하기' }));
    await user.type(screen.getByRole('textbox'), '적용된 소개');
    await user.click(screen.getByRole('button', { name: '저장' }));
    expect(screen.getAllByText('적용된 소개')).not.toHaveLength(0);

    await user.click(screen.getByRole('button', { name: '룸메이트 찾기' }));
    await user.click(screen.getByRole('button', { name: '프로필' }));
    expect(screen.getAllByText('적용된 소개')).not.toHaveLength(0);

    await user.click(screen.getByRole('button', { name: '홈' }));
    await screen.findByTestId('main-home');
    await user.click(screen.getByRole('button', { name: '프로필' }));
    expect(screen.queryAllByText('적용된 소개')).toHaveLength(0);
    expect(screen.getByRole('button', { name: '작성하기' })).toBeInTheDocument();
    expect(homeDashboardApi.getDashboard).toHaveBeenCalledTimes(1);
  });

  it('Profile 기숙사 callback과 Matching badge는 non-Home 형제에만 유지되고 Home에서 reset된다', async () => {
    const user = userEvent.setup();
    render(<Main />);

    await screen.findByTestId('main-home');
    await user.click(screen.getByRole('button', { name: '프로필' }));
    await waitFor(() => expect(profileTabMock).toHaveBeenCalled());

    const onDormitoryChange = profileTabMock.mock.lastCall?.[0]?.onDormitoryChange;
    expect(onDormitoryChange).toEqual(expect.any(Function));
    await act(async () => {
      (onDormitoryChange as (dormitoryId: string | null) => void)('daon');
    });

    await user.click(screen.getByRole('button', { name: '룸메이트 찾기' }));
    expect(roommateListTabMock.mock.lastCall?.[0]).toEqual(
      expect.objectContaining({
        user: expect.objectContaining({
          dormitoryId: 'daon',
          dormitory: expect.objectContaining({ id: 'daon', name: '다온관' }),
        }),
        searchEntryAllowed: true,
        viewerSeasonRegistered: true,
      }),
    );

    await user.click(screen.getByRole('button', { name: '매칭 현황' }));
    expect(matchingTabMock.mock.lastCall?.[0]).toEqual(
      expect.objectContaining({
        viewerHeader: expect.objectContaining({ residenceLabel: '다온관 · 2인실' }),
      }),
    );
    expect(Object.keys(matchingTabMock.mock.lastCall?.[0] ?? {}).sort()).toEqual([
      'initialRequestTab',
      'initialSection',
      'onBadgeCountChange',
      'onNavigateChat',
      'onNavigationIntent',
      'seasonShell',
      'viewerHeader',
      'viewerId',
    ]);
    const onBadgeCountChange = matchingTabMock.mock.lastCall?.[0]?.onBadgeCountChange;
    await act(async () => {
      (onBadgeCountChange as (count: number) => void)(4);
    });
    expect(screen.getByTestId('matching-badge')).toHaveTextContent('4');

    await user.click(screen.getByRole('button', { name: '룸메이트 찾기' }));
    expect(screen.getByTestId('matching-badge')).toHaveTextContent('4');
    expect(homeDashboardApi.getDashboard).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: '홈' }));
    await screen.findByTestId('main-home');
    expect(screen.queryByTestId('matching-badge')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '룸메이트 찾기' }));
    expect(roommateListTabMock.mock.lastCall?.[0]).toEqual(
      expect.objectContaining({
        user: expect.objectContaining({
          dormitoryId: 'dasan',
          dormitory: expect.objectContaining({ id: 'dasan', name: '다산관' }),
        }),
      }),
    );
    expect(screen.queryByTestId('matching-badge')).not.toBeInTheDocument();
    expect(homeDashboardApi.getDashboard).toHaveBeenCalledTimes(1);
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
