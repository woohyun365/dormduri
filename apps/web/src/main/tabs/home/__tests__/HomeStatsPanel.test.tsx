import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createHomeDashboardTestResponse } from '@/main/test-support/home-dashboard.builder';
import { buildHomeDashboardViewModel } from '../model/homeDashboardViewModel';
import { HomeStatsPanel } from '../components/HomeStatsPanel';
import type { HomeDashboardResponse } from '@repo/shared/home';

function renderStats({ dashboard }: { dashboard: HomeDashboardResponse }) {
  const viewModel = buildHomeDashboardViewModel({
    dashboard,
    renderedAt: new Date('2026-07-01T00:00:00+09:00').getTime(),
  });

  render(
    <HomeStatsPanel
      viewModel={viewModel}
      seasonState={viewModel.seasonState}
      daysUntilEnd={viewModel.daysUntilEnd}
    />,
  );
}

describe('HomeStatsPanel', () => {
  it('current season이 없으면 지난 시즌 요약을 보여준다', () => {
    renderStats({
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
          operatedDormitories: [],
        },
      }),
    });

    expect(screen.getByRole('heading', { name: '지난 시즌 요약' })).toBeInTheDocument();
    expect(
      screen.getByText(/2025년 2학기 참여 흐름과 매칭 결과를 한눈에 확인해보세요/),
    ).toBeInTheDocument();
    expect(screen.getByText(/운영 기숙사 5곳 기준 · 매칭 유저 38명/)).toBeInTheDocument();
    expect(
      screen.queryByText(/2026년 2학기 준비는 2026.07.23부터 안내할게요/),
    ).not.toBeInTheDocument();
  });

  it('완료된 시즌 기록이 없으면 누적 기록 없음 fallback을 보여준다', () => {
    renderStats({
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
          operatedDormitories: [],
        },
        seasonHistorySummary: {
          lastSeason: null,
        },
      }),
    });

    expect(screen.getByRole('heading', { name: '지난 시즌 요약' })).toBeInTheDocument();
    expect(screen.getByText(/한 눈에 알아보기/)).toBeInTheDocument();
    expect(screen.getByText(/아직 완료된 시즌 기록이 없어요/)).toBeInTheDocument();
  });

  it('post-match에서는 신규 action이 아니라 result-read 요약임을 설명한다', () => {
    renderStats({
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
