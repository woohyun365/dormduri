import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SeasonProvider, type SeasonContextValue } from '@/main/contexts/SeasonContext';
import { createPublicProfileFull } from '@/test/home-profile-detail-fixtures';
import type { UserProfile } from '@/types/profile';
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

  it('error state를 alert role과 safe message로 표시한다', async () => {
    const refresh = vi.fn(async () => {});
    useRoommateSearchMock.mockReturnValue(
      createSearchResult({
        status: 'error',
        items: [],
        error: createRoommateApiError({
          code: 'ROOMMATE_SEARCH_NETWORK_ERROR',
          status: 503,
        }),
        refresh,
      }),
    );

    renderRoommateListTab();

    expect(screen.getByRole('alert')).toHaveTextContent('룸메이트 찾기 정보를 불러오지 못했어요');

    await userEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('success state에서 summary, score, notice copy를 표시한다', () => {
    const summary = createSummary('participant-2');
    const notices = mapRoommateSearchAvailabilityNotices([
      { code: 'DETAIL_UNAVAILABLE_BY_POLICY', severity: 'INFO' },
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
    expect(screen.getByText('적합도 88점')).toBeInTheDocument();
    expect(screen.getByText('일부 상세 정보는 열 수 없어요')).toBeInTheDocument();
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

    await userEvent.click(screen.getByRole('button', { name: '흡연 비흡연 필터 제거' }));
    expect(removeFilter).toHaveBeenCalledWith('smokingBehavior');

    await userEvent.click(screen.getByRole('button', { name: '테스트-target-1 관심 목록 저장' }));
    expect(toggleBookmark).toHaveBeenCalledWith('target-1', false);

    await userEvent.click(screen.getByRole('button', { name: '전체 해제' }));
    expect(resetFilters).toHaveBeenCalledTimes(1);
  });

  it('search summary detail action은 detailEntryToken이 있는 target snapshot으로 detail dialog를 연다', async () => {
    const openDetail = vi.fn();
    const summary = createSummary('target-detail');
    useRoommateSearchMock.mockReturnValue(createSearchResult({ items: [summary] }));
    useRoommateProfileDetailMock.mockReturnValue(createProfileDetailResult({ open: openDetail }));

    renderRoommateListTab();

    await userEvent.click(screen.getByRole('button', { name: '테스트-target-detail 상세 보기' }));
    expect(openDetail).toHaveBeenCalledWith({
      targetUserId: 'target-detail',
      nickname: '테스트-target-detail',
      detailEntryToken: 'detail-token-target-detail',
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
      screen.getByRole('button', { name: '테스트-target-no-token 상세 보기를 열 수 없음' }),
    ).toBeDisabled();
    expect(openDetail).not.toHaveBeenCalled();
  });

  it('관심 목록 mode는 search page local filter가 아니라 bookmark hook 결과를 표시한다', async () => {
    useRoommateSearchMock.mockReturnValue(
      createSearchResult({ items: [createSummary('search-only')] }),
    );
    useRoommateBookmarkListMock.mockReturnValue(
      createBookmarkResult({
        items: [
          {
            id: 'bookmark-1',
            targetUserId: 'bookmark-target',
            targetParticipantId: 'bookmark-participant',
            bookmarkedAt: '2026-06-08T00:00:00.000Z',
            visibility: 'VISIBLE',
            profileSummary: {
              nickname: '북마크 사용자',
              intro: '관심 목록 owner 응답',
              smokingBehavior: 'NO',
              sleepHabit: 'NONE',
              relationshipStyle: 'CASUAL',
            },
            matchScore: 91,
          },
        ],
      }),
    );

    renderRoommateListTab();
    await userEvent.click(screen.getByRole('button', { name: '관심 목록' }));

    expect(useRoommateBookmarkListMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ autoLoad: true }),
    );
    expect(screen.getByText('북마크 사용자')).toBeInTheDocument();
    expect(screen.queryByText('테스트-search-only')).not.toBeInTheDocument();
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
    expect(screen.getByRole('status')).toHaveTextContent(
      '지금은 룸메이트 찾기 탐색 기간이 아니에요',
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
