import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createHomeDashboardTestResponse } from '@/main/test-support/home-dashboard.builder';
import { buildHomeDashboardViewModel } from '../model/homeDashboardViewModel';
import { HomeStatusTip } from '../components/HomeStatusTip';

function renderTip({ hasCurrentSeason = false }: { hasCurrentSeason?: boolean } = {}) {
  const dashboard = createHomeDashboardTestResponse({
    season: hasCurrentSeason
      ? createHomeDashboardTestResponse().season
      : {
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
  });
  const viewModel = buildHomeDashboardViewModel({
    dashboard,
    renderedAt: new Date('2026-03-20T00:00:00+09:00').getTime(),
  });

  render(
    <HomeStatusTip
      viewModel={viewModel}
      seasonState={viewModel.seasonState}
      onOpenOnboarding={vi.fn()}
    />,
  );
}

describe('HomeStatusTip', () => {
  it('비시즌에는 정책 반복 대신 이용 안내 재진입 문구를 보여준다', () => {
    renderTip();

    expect(screen.getByRole('heading', { name: '이용 안내' })).toBeInTheDocument();
    expect(screen.getByText('시즌 전 안내를 다시 확인할 수 있어요.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '이용 안내 다시 보기' })).toBeInTheDocument();
  });
});
