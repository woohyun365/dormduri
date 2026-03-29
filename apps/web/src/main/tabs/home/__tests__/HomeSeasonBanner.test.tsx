import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SeasonProvider } from '@/contexts/SeasonContext';
import { HomeSeasonBanner } from '../HomeSeasonBanner';

function renderBanner({
  daysUntilEnd,
  hasActiveMatch = false,
}: {
  daysUntilEnd: number;
  hasActiveMatch?: boolean;
}) {
  return render(
    <SeasonProvider
      value={{
        season: { name: '2026년 1학기', roomSelectionDate: '2099-04-30' },
        state: 'SEASON_MATCHING',
        isOpen: false,
        isMatching: true,
        daysUntilEnd,
      }}
    >
      <HomeSeasonBanner hasActiveMatch={hasActiveMatch} />
    </SeasonProvider>,
  );
}

describe('HomeSeasonBanner', () => {
  it('D-3 미확정 유저에게 자동 취소 안내를 표시한다', () => {
    renderBanner({ daysUntilEnd: 3, hasActiveMatch: false });
    expect(screen.getByText('시즌 종료 임박')).toBeInTheDocument();
    expect(screen.getByText(/미결 요청은 자동 취소되기 전에 확인/)).toBeInTheDocument();
  });

  it('D-3 확정 유저에게 학교 시스템 안내를 표시한다', () => {
    renderBanner({ daysUntilEnd: 3, hasActiveMatch: true });
    expect(screen.getByText('호실 선택 준비 안내')).toBeInTheDocument();
    expect(screen.getByText(/학교 시스템에서 직접 진행/)).toBeInTheDocument();
  });
});
