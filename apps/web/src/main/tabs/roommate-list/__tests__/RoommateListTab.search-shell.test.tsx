import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SeasonProvider, type SeasonContextValue } from '@/main/contexts/SeasonContext';
import type { UserProfile } from '@/types/profile';
import { createRoommateApiError } from '../api/roommateApiErrors';
import RoommateListTab from '../RoommateListTab';
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

const useRoommateSearchMock = vi.mocked(useRoommateSearch);

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

function renderRoommateListTab(season: SeasonContextValue = openSeason) {
  return render(
    <SeasonProvider value={season}>
      <RoommateListTab user={viewer} onNavigate={vi.fn()} />
    </SeasonProvider>,
  );
}

describe('RoommateListTab search shell', () => {
  beforeEach(() => {
    useRoommateSearchMock.mockReset();
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
});
