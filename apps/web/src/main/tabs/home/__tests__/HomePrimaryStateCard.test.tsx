import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createHomeDashboardFixture } from '@/__fixtures__/home-dashboard';
import { buildHomeDashboardViewModel } from '../model/homeDashboardViewModel';
import { HomePrimaryStateCard } from '../HomePrimaryStateCard';
import type { SeasonState } from '@/types/season';
import type { UserProfile } from '@/types/profile';
import type { HomeDashboardResponse } from '@repo/shared/home';

const baseUser: UserProfile = {
  id: 'user-1',
  nickname: '춘천유저',
  gender: 'M',
  campus: 'CHUNCHEON',
  dormitoryId: 'dasan',
  lifestyle: {
    smokingBehavior: 'NO',
    sleepHabit: 'NONE',
    relationshipStyle: 'CASUAL',
  } as UserProfile['lifestyle'],
  intro: '',
  messageToRoommate: '잘 부탁해요',
  additional: { college: 'IT', grade: '2', mbti: 'INTJ', birthYear: 2004 },
};

function renderCard({
  dashboard = createHomeDashboardFixture(),
  seasonState = dashboard.season.state ?? 'OFF_SEASON',
  daysUntilEnd = dashboard.season.daysUntilMatchingEnd ?? 0,
  user = baseUser,
}: {
  dashboard?: HomeDashboardResponse;
  seasonState?: SeasonState;
  daysUntilEnd?: number;
  user?: UserProfile;
} = {}) {
  const onNavigate = vi.fn();
  const onOpenBuildingSelect = vi.fn();
  const viewModel = buildHomeDashboardViewModel({
    dashboard,
    user,
    season: { name: '2026년 1학기', roomSelectionDate: '2026-04-30' },
    seasonState,
    daysUntilEnd,
    renderedAt: new Date('2026-03-20T00:00:00+09:00').getTime(),
  });

  render(
    <HomePrimaryStateCard
      viewModel={viewModel}
      seasonState={seasonState}
      daysUntilEnd={daysUntilEnd}
      onNavigate={onNavigate}
      onOpenBuildingSelect={onOpenBuildingSelect}
    />,
  );

  return { onNavigate, onOpenBuildingSelect };
}

describe('HomePrimaryStateCard', () => {
  it('current season이 없으면 empty-success 상태와 프로필 CTA를 보여준다', async () => {
    const user = userEvent.setup();
    const dashboard = createHomeDashboardFixture({
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
    });
    const { onNavigate } = renderCard({ dashboard, seasonState: 'OFF_SEASON' });

    expect(
      screen.getByRole('heading', { name: '현재 진행 중인 시즌이 없어요' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /내 프로필 확인/ }));
    expect(onNavigate).toHaveBeenCalledWith('profile');
  });

  it('시즌 오픈에서 건물 선택이 필요하면 명시 CTA로만 건물 선택을 연다', async () => {
    const user = userEvent.setup();
    const dashboard = createHomeDashboardFixture({
      viewer: {
        ...createHomeDashboardFixture().viewer,
        selection: { state: 'NOT_SELECTED', dormitoryId: null, source: null },
        capabilities: {
          ...createHomeDashboardFixture().viewer.capabilities,
          canSelectDormitory: true,
        },
      },
    });
    const { onOpenBuildingSelect } = renderCard({ dashboard, seasonState: 'SEASON_OPEN' });

    await user.click(screen.getByRole('button', { name: /배정 건물 입력하기/ }));
    expect(onOpenBuildingSelect).toHaveBeenCalledOnce();
  });

  it('시즌 매칭에서 건물 미배정이면 룸메 찾기가 아니라 건물 배정을 primary로 둔다', () => {
    const dashboard = createHomeDashboardFixture({
      season: {
        ...createHomeDashboardFixture().season,
        state: 'SEASON_MATCHING',
        isOpen: false,
        isMatching: true,
      },
      viewer: {
        ...createHomeDashboardFixture().viewer,
        selection: { state: 'NOT_SELECTED', dormitoryId: null, source: null },
        capabilities: {
          ...createHomeDashboardFixture().viewer.capabilities,
          canSelectDormitory: true,
        },
      },
    });

    renderCard({ dashboard, seasonState: 'SEASON_MATCHING', daysUntilEnd: 7 });

    expect(
      screen.getByRole('heading', { name: '건물 배정 후 매칭을 시작해요' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /건물 배정하기/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /룸메 찾기/ })).not.toBeInTheDocument();
  });

  it('post-match에서는 신규 룸메 찾기 CTA 없이 결과 확인과 matched chat exception을 보여준다', () => {
    const dashboard = createHomeDashboardFixture({
      season: {
        ...createHomeDashboardFixture().season,
        state: 'SEASON_POST_MATCH',
        isOpen: false,
        isMatching: false,
        isPostMatch: true,
      },
      viewer: {
        ...createHomeDashboardFixture().viewer,
        capabilities: {
          ...createHomeDashboardFixture().viewer.capabilities,
          canStartChat: true,
        },
        match: {
          hasActiveMatch: true,
          activeMatch: {
            id: 'match-1',
            seasonId: 'season-2026-1',
            counterpartUserId: 'user-2',
            counterpartParticipantId: 'participant-2',
            counterpartNickname: '감자친구',
            status: 'ACTIVE',
            startedAt: '2026-04-01T00:00:00.000Z',
            endedAt: null,
            endReason: null,
            createdFromRequestId: 'request-1',
            matchScore: 91,
            unmatchProgress: {
              state: 'NONE',
              requestedByViewerAt: null,
              requestedByCounterpartAt: null,
              progressCount: 0,
              requiredCount: 2,
              canRequest: false,
              canCancel: false,
              availableUntil: null,
            },
          },
        },
      },
    });

    renderCard({ dashboard, seasonState: 'SEASON_POST_MATCH' });

    expect(screen.getByRole('heading', { name: '확정 결과를 확인해요' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /시즌 결과 보기/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /채팅 보기/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /룸메 찾기/ })).not.toBeInTheDocument();
  });
});
