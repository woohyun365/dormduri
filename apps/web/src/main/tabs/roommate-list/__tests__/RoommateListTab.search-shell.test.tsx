import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SeasonProvider, type SeasonContextValue } from '@/main/contexts/SeasonContext';
import { createPublicProfileFull } from '@/test/home-profile-detail-fixtures';
import type { UserProfile } from '@/main/model/profile';
import { createRoommateApiError } from '../api/roommateApiErrors';
import RoommateListTab from '../RoommateListTab';
import {
  useRoommateBookmarkList,
  type UseRoommateBookmarkListResult,
} from '../hooks/useRoommateBookmarkList';
import {
  useRoommateProfileDetail,
  type UseRoommateProfileDetailResult,
} from '../hooks/useRoommateProfileDetail';
import { useRoommateSearch, type UseRoommateSearchResult } from '../hooks/useRoommateSearch';
import { mapRoommateSearchManifest } from '../model/filters/roommateSearchManifestModel';
import { mapRoommateSearchAvailabilityNotices } from '../model/search/roommateSearchNotices';
import {
  createCampusMergedManifest,
  createManifest,
  createSearchResponse,
  createSummary,
} from '../model/search/__tests__/roommateSearchTestFixtures';

vi.mock('../hooks/useRoommateSearch', () => ({
  useRoommateSearch: vi.fn(),
}));
vi.mock('../hooks/useRoommateBookmarkList', () => ({
  useRoommateBookmarkList: vi.fn(),
}));
vi.mock('../hooks/useRoommateProfileDetail', () => ({
  useRoommateProfileDetail: vi.fn(),
}));

const useRoommateSearchMock = vi.mocked(useRoommateSearch);
const useRoommateBookmarkListMock = vi.mocked(useRoommateBookmarkList);
const useRoommateProfileDetailMock = vi.mocked(useRoommateProfileDetail);

function mockMatchMedia(matches: boolean) {
  window.matchMedia = vi.fn((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }));
}

const viewer: UserProfile = {
  id: 'viewer-1',
  nickname: '현재사용자',
  gender: 'F',
  campus: 'CHUNCHEON',
  dormitoryId: 'dasan',
  lifestyle: {
    bedtime: null,
    wakeTime: null,
    sleepHabit: null,
    sleepEnvironment: null,
    screenUsage: null,
    noiseSensitivity: null,
    smokingBehavior: null,
    indoorEating: null,
    phoneBehavior: null,
    earphoneUsage: null,
    cleanLevel: null,
    drinkingFrequency: null,
    relationshipStyle: null,
    temperatureSensitivity: null,
    smokingTolerance: null,
    phoneTolerance: null,
    earphoneExpectation: null,
    sleepEnvPreference: null,
    screenTolerance: null,
    indoorEatingTolerance: null,
    cleanExpectation: null,
    drinkingTolerance: null,
  },
  intro: '',
  messageToRoommate: null,
  additional: {
    college: 'IT',
    grade: null,
    mbti: null,
    birthYear: 2002,
  },
};

const openSeason: SeasonContextValue = {
  season: {
    name: '2026년 2학기',
    roomSelectionDate: '2026-08-20',
  },
  state: 'SEASON_OPEN',
  isOpen: true,
  isMatching: false,
  daysUntilEnd: 30,
};

const matchingSeason: SeasonContextValue = {
  season: {
    name: '2026년 2학기',
    roomSelectionDate: '2026-08-20',
  },
  state: 'SEASON_MATCHING',
  isOpen: true,
  isMatching: true,
  daysUntilEnd: 14,
};

const offSeason: SeasonContextValue = {
  season: {
    name: '',
    roomSelectionDate: '',
  },
  state: 'OFF_SEASON',
  isOpen: false,
  isMatching: false,
  daysUntilEnd: 0,
};

function noopAsync() {
  return vi.fn(async () => {});
}

function createSearchResult(
  overrides: Partial<UseRoommateSearchResult> = {},
): UseRoommateSearchResult {
  const manifest = createManifest();
  const response = createSearchResponse({ manifest });

  return {
    status: 'success',
    query: {
      scope: manifest.scope,
      sort: manifest.sorts.default,
      filters: {},
    },
    manifest: mapRoommateSearchManifest(manifest),
    scopeAvailability: response.scopeAvailability,
    response,
    nextCursor: null,
    items: response.items,
    notices: [],
    statusMessage: null,
    error: null,
    hasNextPage: false,
    canLoadMore: false,
    refresh: noopAsync(),
    loadMore: noopAsync(),
    changeScope: noopAsync(),
    changeSort: noopAsync(),
    applyFilters: noopAsync(),
    removeFilter: noopAsync(),
    resetFilters: noopAsync(),
    ...overrides,
  };
}

function createBookmarkResult(
  overrides: Partial<UseRoommateBookmarkListResult> = {},
): UseRoommateBookmarkListResult {
  return {
    status: 'success',
    sort: 'RECENT',
    items: [],
    nextCursor: null,
    emptyState: 'NO_BOOKMARKS',
    error: null,
    optimisticBookmarkState: {},
    pendingTargetUserIds: [],
    hasNextPage: false,
    canLoadMore: false,
    isTargetPending: vi.fn(() => false),
    getOptimisticBookmarked: vi.fn((_targetUserId, fallback) => fallback),
    refresh: noopAsync(),
    loadMore: noopAsync(),
    changeSort: noopAsync(),
    toggleBookmark: noopAsync(),
    dismissError: vi.fn(),
    ...overrides,
  };
}

function createProfileDetailResult(
  overrides: Partial<UseRoommateProfileDetailResult> = {},
): UseRoommateProfileDetailResult {
  return {
    status: 'closed',
    target: null,
    profile: null,
    error: null,
    isOpen: false,
    open: vi.fn(),
    close: vi.fn(),
    retry: vi.fn(),
    ...overrides,
  } as UseRoommateProfileDetailResult;
}

function renderRoommateListTab(
  season: SeasonContextValue = openSeason,
  props: Partial<React.ComponentProps<typeof RoommateListTab>> = {},
) {
  return render(
    <SeasonProvider value={season}>
      <RoommateListTab user={viewer} onNavigate={vi.fn()} {...props} />
    </SeasonProvider>,
  );
}

describe('RoommateListTab search shell', () => {
  beforeEach(() => {
    mockMatchMedia(false);
    useRoommateSearchMock.mockReset();
    useRoommateBookmarkListMock.mockReset();
    useRoommateProfileDetailMock.mockReset();
    useRoommateBookmarkListMock.mockReturnValue(createBookmarkResult());
    useRoommateProfileDetailMock.mockReturnValue(createProfileDetailResult());
  });

  it('loading state를 status role로 표시한다', () => {
    useRoommateSearchMock.mockReturnValue(
      createSearchResult({
        status: 'loading-search',
        items: [],
        response: null,
        manifest: null,
      }),
    );

    renderRoommateListTab();

    expect(screen.getByRole('status')).toHaveTextContent('룸메이트 목록을 불러오는 중이에요');
  });

  it('desktop loading state에서는 우측 검색/필터 패널도 skeleton으로 표시한다', async () => {
    mockMatchMedia(true);
    useRoommateSearchMock.mockReturnValue(
      createSearchResult({
        status: 'loading-search',
        items: [],
        response: null,
        manifest: null,
      }),
    );

    renderRoommateListTab();

    const complementary = await screen.findByRole('complementary', {
      name: '룸메이트 찾기 필터와 보조 정보',
    });
    expect(
      within(complementary).getByTestId('roommate-search-desktop-aside-skeleton'),
    ).toBeInTheDocument();
    expect(
      within(complementary).queryByRole('button', { name: '필터 열기' }),
    ).not.toBeInTheDocument();
  });

  it('error state를 alert role과 safe message로 표시한다', async () => {
    const refresh = vi.fn(async () => {});
    useRoommateSearchMock.mockReturnValue(
      createSearchResult({
        status: 'error',
        items: [],
        error: createRoommateApiError({
          code: 'BFF_UPSTREAM_UNAVAILABLE',
          status: 503,
        }),
        refresh,
      }),
    );

    renderRoommateListTab();

    expect(screen.getByRole('alert')).toHaveTextContent(
      '룸메이트 찾기 서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.',
    );
    expect(screen.queryByRole('region', { name: '검색 결과 설정' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('complementary', { name: '룸메이트 찾기 필터와 보조 정보' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('검색 결과')).not.toBeInTheDocument();
    expect(
      screen
        .queryAllByRole('status')
        .some((status) => status.textContent?.includes('룸메이트 찾기 서버에 연결하지 못했어요')),
    ).toBe(false);

    await userEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('success state에서 summary와 score를 표시하되 availability notice header card는 숨긴다', () => {
    const summary = createSummary('participant-2');
    const notices = mapRoommateSearchAvailabilityNotices([
      { code: 'DISCOVERY_ACTIONABLE_ONLY', severity: 'INFO' },
    ]);
    useRoommateSearchMock.mockReturnValue(
      createSearchResult({
        items: [summary],
        notices,
      }),
    );

    renderRoommateListTab();

    expect(screen.getByText('테스트-participant-2')).toBeInTheDocument();
    expect(screen.getByText('조용한 생활을 선호해요.')).toBeInTheDocument();
    expect(screen.getByText('매칭점수 88점')).toBeInTheDocument();
    expect(screen.queryByText('요청 가능한 후보만 보여줘요')).not.toBeInTheDocument();
    expect(
      screen.queryByText('지금 상세 확인과 요청이 가능한 후보 중심으로 결과를 조정했어요.'),
    ).not.toBeInTheDocument();
  });

  it('nextCursor가 있으면 cursor 기반 더 보기를 호출한다', async () => {
    const loadMore = vi.fn(async () => {});
    useRoommateSearchMock.mockReturnValue(
      createSearchResult({
        nextCursor: 'cursor-next',
        hasNextPage: true,
        canLoadMore: true,
        loadMore,
      }),
    );

    renderRoommateListTab();

    await userEvent.click(screen.getByRole('button', { name: '더 보기' }));
    expect(loadMore).toHaveBeenCalledTimes(1);
  });

  it('loading-more 상태에서는 기존 검색 카드를 유지하고 append 버튼만 잠근다', () => {
    useRoommateSearchMock.mockReturnValue(
      createSearchResult({
        status: 'loading-more',
        items: [createSummary('append-visible')],
        nextCursor: 'cursor-next',
        hasNextPage: true,
        canLoadMore: true,
      }),
    );

    renderRoommateListTab();

    expect(screen.getByText('테스트-append-visible')).toBeInTheDocument();
    expect(screen.queryByText('룸메이트 목록을 불러오는 중이에요')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '불러오는 중' })).toBeDisabled();
  });

  it('campus merged summary card는 캠퍼스명을 표시하고 summary 전용 버튼을 만들지 않는다', () => {
    const manifest = createCampusMergedManifest();
    const summary = {
      ...createSummary('campus-preview-card'),
      exposure: {
        listSummaryVisible: true,
        detailViewable: false,
        canViewFull: false,
        scoreVisible: false,
      },
      actions: {
        canBookmark: false,
        canRequestMatch: false,
        canStartChat: false,
        unavailableReasons: ['DIFFERENT_DORMITORY' as const],
      },
      detailEntryToken: undefined,
    };
    useRoommateSearchMock.mockReturnValue(
      createSearchResult({
        items: [summary],
        query: { scope: 'CAMPUS_MERGED', sort: 'NICKNAME', filters: {} },
        manifest: mapRoommateSearchManifest(manifest),
        response: createSearchResponse({ manifest, items: [summary] }),
      }),
    );

    renderRoommateListTab(openSeason);

    const card = screen.getByRole('article', { name: '테스트-campus-preview-card' });
    expect(within(card).getByText('춘천캠퍼스')).toBeInTheDocument();
    expect(within(card).queryByText('프로필 열람 불가')).not.toBeInTheDocument();
    expect(within(card).queryByText('대화 불가')).not.toBeInTheDocument();
    expect(within(card).queryByText('매칭 신청 불가')).not.toBeInTheDocument();
    expect(
      within(card).getByText('다른 건물 유저는 프로필 요약만 확인 가능해요'),
    ).toBeInTheDocument();
    expect(within(card).queryByRole('button')).not.toBeInTheDocument();
    expect(within(card).queryByText('미리보기')).not.toBeInTheDocument();
    expect(screen.queryByText('조건 필터')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '필터 열기' })).not.toBeInTheDocument();
    expect(screen.queryByRole('switch', { name: '저장한 후보만 보기' })).not.toBeInTheDocument();
  });

  it('search mode에서 manifest filter bar와 bookmark action을 연결한다', async () => {
    const summary = createSummary('target-1');
    const removeFilter = vi.fn(async () => {});
    const resetFilters = vi.fn(async () => {});
    const toggleBookmark = vi.fn(async () => {});
    useRoommateSearchMock.mockReturnValue(
      createSearchResult({
        items: [summary],
        query: {
          scope: 'SAME_BUILDING_ONLY',
          sort: 'MATCH_SCORE',
          filters: { smokingBehavior: 'NO' },
        },
        removeFilter,
        resetFilters,
      }),
    );
    useRoommateBookmarkListMock.mockReturnValue(createBookmarkResult({ toggleBookmark }));

    renderRoommateListTab();

    await userEvent.click(screen.getByRole('button', { name: '흡연 여부 비흡연 필터 제거' }));
    expect(removeFilter).toHaveBeenCalledWith('smokingBehavior');

    await userEvent.click(screen.getByRole('button', { name: '테스트-target-1 관심 목록 저장' }));
    expect(toggleBookmark).toHaveBeenCalledWith('target-1', false);

    await userEvent.click(screen.getByRole('button', { name: '전체 해제' }));
    expect(resetFilters).toHaveBeenCalledTimes(1);
  });

  it('bookmark stale failure는 rollback 이후 최신 목록 확인 banner를 표시한다', async () => {
    const refresh = vi.fn(async () => {});
    const dismissError = vi.fn();
    useRoommateSearchMock.mockReturnValue(
      createSearchResult({
        items: [createSummary('target-1')],
        refresh,
      }),
    );
    useRoommateBookmarkListMock.mockReturnValue(
      createBookmarkResult({
        error: createRoommateApiError({ code: 'TARGET_NOT_BOOKMARKABLE', status: 404 }),
        dismissError,
      }),
    );

    renderRoommateListTab();

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('관심 목록을 변경하지 못했어요.');
    expect(alert).toHaveTextContent('현재 상태에서는 관심 목록에 저장할 수 없어요.');

    await userEvent.click(within(alert).getByRole('button', { name: '목록 새로고침' }));
    expect(dismissError).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('desktop layout에서는 조건 필터를 검색 결과 카드 안에 포함한다', async () => {
    mockMatchMedia(true);
    useRoommateSearchMock.mockReturnValue(
      createSearchResult({ items: [createSummary('target-1')] }),
    );

    renderRoommateListTab();

    const complementary = await screen.findByRole('complementary', {
      name: '룸메이트 찾기 필터와 보조 정보',
    });

    await waitFor(() => {
      expect(
        within(complementary).getByRole('region', { name: '검색 결과 설정' }),
      ).toBeInTheDocument();
      expect(
        within(screen.getByRole('banner')).queryByRole('region', { name: '검색 결과 설정' }),
      ).not.toBeInTheDocument();
    });

    const asideText = complementary.textContent ?? '';
    expect(asideText.indexOf('검색 결과')).toBeGreaterThanOrEqual(0);
    expect(asideText.indexOf('조건 필터')).toBeGreaterThan(asideText.indexOf('검색 결과'));
    const resultControlsCard = within(complementary).getByRole('region', {
      name: '검색 결과 설정',
    });
    expect(resultControlsCard).toHaveTextContent('조건 필터');
    expect(
      within(resultControlsCard).getByRole('switch', { name: '저장한 후보만 보기' }),
    ).toHaveAttribute('aria-checked', 'false');
    expect(within(complementary).queryByText('Discovery')).not.toBeInTheDocument();
    expect(
      within(complementary).queryByText('조건을 보며 후보를 쉽게 비교해요'),
    ).not.toBeInTheDocument();
  });

  it('mobile layout에서는 헤더 문구와 검색 결과 설정 카드를 분리해 경계를 명확히 한다', () => {
    useRoommateSearchMock.mockReturnValue(
      createSearchResult({ items: [createSummary('mobile-boundary')] }),
    );

    renderRoommateListTab();

    const banner = screen.getByRole('banner');
    expect(
      within(banner).getByText(
        '시즌 후보를 둘러보고, 같은 건물 후보는 생활패턴과 조건까지 비교해 볼 수 있어요.',
      ),
    ).toBeInTheDocument();
    expect(
      within(banner).queryByRole('region', { name: '검색 결과 설정' }),
    ).not.toBeInTheDocument();

    const resultControlsCard = screen.getByRole('region', { name: '검색 결과 설정' });
    expect(resultControlsCard).toHaveClass('rounded-none', 'border-y', 'shadow-none');
    expect(resultControlsCard).not.toHaveClass('rounded-3xl', 'shadow-sm');
    expect(within(resultControlsCard).getByText('검색 결과')).toBeInTheDocument();
  });

  it('desktop campus merged scope에서는 조건 필터 진입점을 렌더링하지 않는다', async () => {
    mockMatchMedia(true);
    const manifest = createCampusMergedManifest();
    useRoommateSearchMock.mockReturnValue(
      createSearchResult({
        items: [createSummary('campus-filter-hidden')],
        query: { scope: 'CAMPUS_MERGED', sort: 'NICKNAME', filters: {} },
        manifest: mapRoommateSearchManifest(manifest),
        response: createSearchResponse({
          manifest,
          items: [createSummary('campus-filter-hidden')],
        }),
      }),
    );

    renderRoommateListTab(openSeason);

    const complementary = await screen.findByRole('complementary', {
      name: '룸메이트 찾기 필터와 보조 정보',
    });

    expect(
      within(complementary).getByRole('region', { name: '검색 결과 설정' }),
    ).toBeInTheDocument();
    expect(within(complementary).queryByText('조건 필터')).not.toBeInTheDocument();
    expect(
      within(complementary).queryByRole('button', { name: '필터 열기' }),
    ).not.toBeInTheDocument();
    expect(
      within(complementary).queryByRole('switch', { name: '저장한 후보만 보기' }),
    ).not.toBeInTheDocument();
    expect(
      within(complementary).queryByText('현재 탐색 범위에서는 조건 필터를 사용할 수 없어요.'),
    ).not.toBeInTheDocument();
  });

  it('SEASON_OPEN 등록 완료 viewer는 same dormitory scope를 먼저 요청한다', () => {
    const manifest = createCampusMergedManifest();
    useRoommateSearchMock.mockReturnValue(
      createSearchResult({
        items: [],
        query: { scope: 'CAMPUS_MERGED', sort: 'NICKNAME', filters: {} },
        manifest: mapRoommateSearchManifest(manifest),
        response: createSearchResponse({ manifest, items: [] }),
      }),
    );

    renderRoommateListTab(openSeason);

    expect(useRoommateSearchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        initialQuery: { scope: 'SAME_BUILDING_ONLY', sort: 'MATCH_SCORE' },
      }),
    );
    expect(screen.getByRole('heading', { name: '룸메이트 찾기 오픈' })).toBeInTheDocument();
    expect(
      screen.getByText(
        '시즌 후보를 둘러보고, 같은 건물 후보는 생활패턴과 조건까지 비교해 볼 수 있어요.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '시즌 등록하러 가기' })).not.toBeInTheDocument();
  });

  it('SEASON_OPEN 등록 완료 viewer에게 same dormitory 상세 탐색 문구를 표시한다', () => {
    useRoommateSearchMock.mockReturnValue(createSearchResult({ items: [] }));

    renderRoommateListTab(openSeason);

    expect(useRoommateSearchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        initialQuery: { scope: 'SAME_BUILDING_ONLY', sort: 'MATCH_SCORE' },
      }),
    );
    expect(screen.getByRole('heading', { name: '룸메이트 찾기 오픈' })).toBeInTheDocument();
    expect(
      screen.getByText(
        '시즌 후보를 둘러보고, 같은 건물 후보는 생활패턴과 조건까지 비교해 볼 수 있어요.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '시즌 등록하러 가기' })).not.toBeInTheDocument();
  });

  it('SEASON_OPEN 미등록 viewer는 선택 draft가 있어도 campus merged scope를 먼저 요청한다', () => {
    const manifest = createCampusMergedManifest();
    useRoommateSearchMock.mockReturnValue(
      createSearchResult({
        items: [],
        query: { scope: 'CAMPUS_MERGED', sort: 'NICKNAME', filters: {} },
        manifest: mapRoommateSearchManifest(manifest),
        response: createSearchResponse({ manifest, items: [] }),
      }),
    );

    renderRoommateListTab(openSeason, {
      user: { ...viewer, dormitoryId: 'dasan' },
      viewerSeasonRegistered: false,
    });

    expect(useRoommateSearchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        initialQuery: { scope: 'CAMPUS_MERGED', sort: 'NICKNAME' },
      }),
    );
    expect(screen.getByText('시즌에 참여한 룸메이트가 아직 없어요.')).toBeInTheDocument();
  });

  it('SEASON_OPEN 미등록 viewer의 campus merged 미리보기에서는 건물 등록 CTA를 숨긴다', () => {
    const manifest = createCampusMergedManifest();
    useRoommateSearchMock.mockReturnValue(
      createSearchResult({
        items: [],
        query: { scope: 'CAMPUS_MERGED', sort: 'NICKNAME', filters: {} },
        manifest: mapRoommateSearchManifest(manifest),
        response: createSearchResponse({ manifest, items: [] }),
      }),
    );

    renderRoommateListTab(openSeason, { user: { ...viewer, dormitoryId: null } });

    expect(useRoommateSearchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        initialQuery: { scope: 'CAMPUS_MERGED', sort: 'NICKNAME' },
      }),
    );
    expect(screen.getByRole('heading', { name: '룸메이트 찾기 오픈' })).toBeInTheDocument();
    expect(
      screen.getByText(
        '시즌 후보를 둘러보고, 같은 건물 후보는 생활패턴과 조건까지 비교해 볼 수 있어요.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '시즌 등록하러 가기' })).not.toBeInTheDocument();
  });

  it('SEASON_OPEN 미등록 viewer는 선택 draft가 있어도 same dormitory scope에서 등록 gating만 표시한다', () => {
    useRoommateSearchMock.mockReturnValue(createSearchResult({ items: [] }));

    renderRoommateListTab(openSeason, {
      user: { ...viewer, dormitoryId: 'dasan' },
      viewerSeasonRegistered: false,
    });

    expect(screen.getByText('시즌 등록 후 같은 건물 후보를 볼 수 있어요.')).toBeInTheDocument();
    expect(
      screen.getByText('등록을 마치면 같은 건물 후보 리스트와 생활패턴 비교가 열려요.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('switch', { name: '저장한 후보만 보기' })).not.toBeInTheDocument();
  });

  it('SEASON_OPEN 미등록 viewer가 same dormitory scope를 볼 때 list empty 영역에 등록 gating만 표시한다', () => {
    const onNavigate = vi.fn();
    useRoommateSearchMock.mockReturnValue(createSearchResult({ items: [] }));

    renderRoommateListTab(openSeason, { user: { ...viewer, dormitoryId: null }, onNavigate });

    expect(screen.getByText('시즌 등록 후 같은 건물 후보를 볼 수 있어요.')).toBeInTheDocument();
    expect(
      screen.getByText('등록을 마치면 같은 건물 후보 리스트와 생활패턴 비교가 열려요.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '시즌 등록하러 가기' })).not.toBeInTheDocument();
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('SEASON_MATCHING 미등록 viewer도 same dormitory scope에서 같은 등록 gating을 표시한다', () => {
    useRoommateSearchMock.mockReturnValue(createSearchResult({ items: [] }));

    renderRoommateListTab(matchingSeason, { user: { ...viewer, dormitoryId: null } });

    expect(useRoommateSearchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        initialQuery: { scope: 'CAMPUS_MERGED', sort: 'NICKNAME' },
      }),
    );
    expect(screen.getByText('시즌 등록 후 같은 건물 후보를 볼 수 있어요.')).toBeInTheDocument();
    expect(
      screen.getByText('등록을 마치면 같은 건물 후보 리스트와 생활패턴 비교가 열려요.'),
    ).toBeInTheDocument();
  });

  it('campus merged 빈 목록은 시즌 참여자 empty copy를 표시한다', () => {
    const manifest = createCampusMergedManifest();
    useRoommateSearchMock.mockReturnValue(
      createSearchResult({
        items: [],
        query: { scope: 'CAMPUS_MERGED', sort: 'NICKNAME', filters: {} },
        manifest: mapRoommateSearchManifest(manifest),
        response: createSearchResponse({ manifest, items: [] }),
      }),
    );

    renderRoommateListTab(openSeason, { user: { ...viewer, dormitoryId: null } });

    expect(screen.getByText('시즌에 참여한 룸메이트가 아직 없어요.')).toBeInTheDocument();
    expect(
      screen.getByText('시즌 등록을 마친 사용자가 생기면 이곳에 표시돼요.'),
    ).toBeInTheDocument();
  });

  it('same dormitory 빈 목록은 필터 확장/새로고침 empty copy를 표시한다', () => {
    useRoommateSearchMock.mockReturnValue(createSearchResult({ items: [] }));

    renderRoommateListTab(openSeason);

    expect(screen.getByText('조건에 맞는 룸메이트가 아직 없어요.')).toBeInTheDocument();
    expect(
      screen.getByText('필터를 조금 넓히거나 새로고침 후 다시 확인해 보세요.'),
    ).toBeInTheDocument();
  });

  it('search summary detail action은 detailEntryToken이 있는 target snapshot으로 detail dialog를 연다', async () => {
    const openDetail = vi.fn();
    const summary = createSummary('target-detail');
    useRoommateSearchMock.mockReturnValue(createSearchResult({ items: [summary] }));
    useRoommateProfileDetailMock.mockReturnValue(createProfileDetailResult({ open: openDetail }));

    renderRoommateListTab();

    await userEvent.click(
      screen.getByRole('button', { name: '테스트-target-detail 프로필 열람하기' }),
    );
    expect(openDetail).toHaveBeenCalledWith({
      targetUserId: 'target-detail',
      nickname: '테스트-target-detail',
      detailEntryToken: 'detail-token-target-detail',
      dormitoryLabel: '다산관',
      pendingMatchRequest: null,
    });
  });

  it('detail modal의 매칭 요청 action은 match request dialog를 연다', async () => {
    useRoommateSearchMock.mockReturnValue(
      createSearchResult({ items: [createSummary('target-action')] }),
    );
    useRoommateProfileDetailMock.mockReturnValue(
      createProfileDetailResult({
        status: 'success',
        target: {
          targetUserId: 'target-action',
          nickname: '테스트-target-action',
          detailEntryToken: 'detail-token-target-action',
        },
        profile: createPublicProfileFull({
          id: 'target-action',
          nickname: '테스트-target-action',
          actions: {
            canBookmark: true,
            canRequestMatch: true,
            canStartChat: false,
            unavailableReasons: [],
          },
        }),
        isOpen: true,
      }),
    );

    renderRoommateListTab();

    await userEvent.click(screen.getByRole('button', { name: '매칭 요청 보내기' }));

    expect(screen.getByRole('dialog', { name: '매칭 요청 보내기' })).toHaveTextContent(
      '테스트-target-action님에게 매칭 요청을 보낼까요?',
    );
  });

  it('bookmark action은 detail dialog를 열지 않는다', async () => {
    const openDetail = vi.fn();
    const toggleBookmark = vi.fn(async () => {});
    const summary = createSummary('target-bookmark');
    useRoommateSearchMock.mockReturnValue(createSearchResult({ items: [summary] }));
    useRoommateBookmarkListMock.mockReturnValue(createBookmarkResult({ toggleBookmark }));
    useRoommateProfileDetailMock.mockReturnValue(createProfileDetailResult({ open: openDetail }));

    renderRoommateListTab();

    await userEvent.click(
      screen.getByRole('button', { name: '테스트-target-bookmark 관심 목록 저장' }),
    );
    expect(toggleBookmark).toHaveBeenCalledWith('target-bookmark', false);
    expect(openDetail).not.toHaveBeenCalled();
  });

  it('token 없는 summary item은 direct detail fetch를 시도하지 않는다', async () => {
    const openDetail = vi.fn();
    const summary = { ...createSummary('target-no-token'), detailEntryToken: undefined };
    useRoommateSearchMock.mockReturnValue(createSearchResult({ items: [summary] }));
    useRoommateProfileDetailMock.mockReturnValue(createProfileDetailResult({ open: openDetail }));

    renderRoommateListTab();

    expect(
      screen.queryByRole('button', { name: /테스트-target-no-token 상세/u }),
    ).not.toBeInTheDocument();
    expect(openDetail).not.toHaveBeenCalled();
  });

  it('저장한 후보 toggle은 별도 저장 리스트 카드 없이 search 결과를 bookmark 상태로 좁힌다', async () => {
    const savedSummary = {
      ...createSummary('saved-search'),
      profileSummary: {
        ...createSummary('saved-search').profileSummary,
        nickname: '저장된 검색 후보',
      },
      bookmark: { bookmarked: true },
    };
    useRoommateSearchMock.mockReturnValue(
      createSearchResult({ items: [savedSummary, createSummary('search-only')] }),
    );

    renderRoommateListTab();
    const bookmarkOnlySwitch = screen.getByRole('switch', { name: '저장한 후보만 보기' });
    expect(bookmarkOnlySwitch).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByText('저장된 검색 후보')).toBeInTheDocument();
    expect(screen.getByText('테스트-search-only')).toBeInTheDocument();

    await userEvent.click(bookmarkOnlySwitch);

    expect(useRoommateBookmarkListMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ autoLoad: false }),
    );
    expect(screen.getByRole('switch', { name: '저장한 후보만 보기' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByRole('group', { name: '정렬' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '필터 열기' })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: '저장한 후보 정렬' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: '룸메이트 저장한 후보' })).not.toBeInTheDocument();
    expect(screen.queryByText(/^저장한 후보$/u)).not.toBeInTheDocument();
    expect(screen.getByText('저장된 검색 후보')).toBeInTheDocument();
    expect(screen.queryByText('테스트-search-only')).not.toBeInTheDocument();
  });

  it('저장한 후보 toggle 결과가 비어도 별도 저장 리스트 카드 없이 검색 결과 empty copy만 표시한다', async () => {
    useRoommateSearchMock.mockReturnValue(
      createSearchResult({ items: [createSummary('unsaved-1'), createSummary('unsaved-2')] }),
    );

    renderRoommateListTab();
    await userEvent.click(screen.getByRole('switch', { name: '저장한 후보만 보기' }));

    expect(screen.getByText('아직 저장한 후보가 없어요.')).toBeInTheDocument();
    expect(
      screen.getByText('같은 건물 후보 카드의 북마크를 눌러 다시 볼 후보를 저장해 보세요.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: '룸메이트 저장한 후보' })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: '저장한 후보 정렬' })).not.toBeInTheDocument();
  });

  it('OFF_SEASON에서는 browse closed copy를 표시하고 auto-load를 끈다', () => {
    useRoommateSearchMock.mockReturnValue(
      createSearchResult({
        status: 'idle',
        items: [],
        response: null,
        manifest: null,
      }),
    );

    renderRoommateListTab(offSeason);

    expect(useRoommateSearchMock).toHaveBeenCalledWith(
      expect.objectContaining({ autoLoad: false }),
    );
    expect(screen.getByRole('heading', { name: '룸메이트 찾기 준비 중' })).toBeInTheDocument();
    expect(screen.getByText('다음 시즌이 시작되면 안내할게요.')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(
      '지난 시즌 룸메이트 찾기 탐색이 종료되었어요.',
    );
  });

  it('coarse entry capability가 닫히면 auto-load 없이 safe copy를 표시한다', () => {
    useRoommateSearchMock.mockReturnValue(
      createSearchResult({
        status: 'idle',
        items: [],
        response: null,
        manifest: null,
      }),
    );

    renderRoommateListTab(openSeason, { searchEntryAllowed: false });

    expect(useRoommateSearchMock).toHaveBeenCalledWith(
      expect.objectContaining({ autoLoad: false }),
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      '현재 상태에서는 룸메이트 찾기 탐색을 열 수 없어요',
    );
  });
});
