import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createHomeDashboardTestResponse } from '@/main/test-support/home-dashboard.builder';
import { buildHomeDashboardViewModel } from '../model/homeDashboardViewModel';
import { HomeStatsPanel } from '../components/HomeStatsPanel';
import type { SeasonState } from '@/types/season';
import type { HomeDashboardResponse } from '@repo/shared/home';

function renderStats({
  dashboard,
  seasonState,
  daysUntilEnd = 0,
}: {
  dashboard: HomeDashboardResponse;
  seasonState: SeasonState;
  daysUntilEnd?: number;
}) {
  const viewModel = buildHomeDashboardViewModel({
    dashboard,
    season: { name: '2026년 1학기', roomSelectionDate: '2026-04-30' },
    seasonState,
    daysUntilEnd,
    renderedAt: new Date('2026-07-01T00:00:00+09:00').getTime(),
  });

  render(
    <HomeStatsPanel viewModel={viewModel} seasonState={seasonState} daysUntilEnd={daysUntilEnd} />,
  );
}

describe('HomeStatsPanel', () => {
  it('current season이 없으면 지난 시즌 이름과 다음 시즌 preview를 함께 보여준다', () => {
    renderStats({
      seasonState: 'OFF_SEASON',
      dashboard: createHomeDashboardTestResponse({
        season: {
          hasCurrentSeason: false,
          state: null,
          summary: null,
          schedule: null,
          isOpen: false,
          isMatching: false,
          isPostMatch: false,
          daysUntilMatchingEnd: null,
          daysUntilSeasonEnd: null,
        },
      }),
    });

    expect(screen.getByRole('heading', { name: '지난 시즌 요약' })).toBeInTheDocument();
    expect(
      screen.getByText(/2025년 2학기에는 210명이 참여했고 38명이 매칭에 성공했어요/),
    ).toBeInTheDocument();
    expect(screen.getByText(/2026년 2학기 준비는 2026.08.20부터 안내할게요/)).toBeInTheDocument();
  });

  it('완료된 시즌 기록이 없으면 누적 기록 없음 fallback을 보여준다', () => {
    renderStats({
      seasonState: 'OFF_SEASON',
      dashboard: createHomeDashboardTestResponse({
        season: {
          hasCurrentSeason: false,
          state: null,
          summary: null,
          schedule: null,
          isOpen: false,
          isMatching: false,
          isPostMatch: false,
          daysUntilMatchingEnd: null,
          daysUntilSeasonEnd: null,
        },
        seasonHistorySummary: {
          lastSeason: null,
        },
      }),
    });

    expect(screen.getByRole('heading', { name: '서비스 현황' })).toBeInTheDocument();
    expect(screen.getByText(/아직 완료된 시즌 기록이 없어요/)).toBeInTheDocument();
  });

  it('post-match에서는 신규 action이 아니라 result-read 요약임을 설명한다', () => {
    renderStats({
      seasonState: 'SEASON_POST_MATCH',
      dashboard: createHomeDashboardTestResponse({
        season: {
          ...createHomeDashboardTestResponse().season,
          state: 'SEASON_POST_MATCH',
          isOpen: false,
          isMatching: false,
          isPostMatch: true,
        },
      }),
    });

    expect(screen.getByRole('heading', { name: '시즌 결과 요약' })).toBeInTheDocument();
    expect(screen.getByText(/신규 요청은 닫고, 결과 확인과 기록 조회 중심/)).toBeInTheDocument();
  });
});
