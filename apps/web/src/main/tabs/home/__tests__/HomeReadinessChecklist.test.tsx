import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { createHomeDashboardTestResponse } from '@/main/test-support/home-dashboard.builder';
import { buildHomeDashboardViewModel } from '../model/homeDashboardViewModel';
import {
  buildReadinessChecklistItems,
  HomeReadinessChecklist,
} from '../components/HomeReadinessChecklist';
import type { UserProfile } from '@/types/profile';
import type { HomeDashboardResponse } from '@repo/shared/home';

const user: UserProfile = {
  id: 'user-1',
  nickname: '춘천유저',
  gender: 'M',
  campus: 'CHUNCHEON',
  dormitoryId: null,
  lifestyle: {} as UserProfile['lifestyle'],
  intro: '',
  messageToRoommate: null,
  additional: { college: null, grade: null, mbti: null, birthYear: null },
};

function buildViewModel(dashboard: HomeDashboardResponse) {
  return buildHomeDashboardViewModel({
    dashboard,
    user,
    season: { name: '2026년 1학기', roomSelectionDate: '2026-04-30' },
    seasonState: dashboard.season.state ?? 'OFF_SEASON',
    daysUntilEnd: dashboard.season.daysUntilMatchingEnd ?? 0,
    renderedAt: new Date('2026-03-20T00:00:00+09:00').getTime(),
  });
}

describe('HomeReadinessChecklist', () => {
  it('dashboard/current-user capability를 기준으로 누락된 프로필과 건물 선택 action을 분리한다', async () => {
    const userEventInstance = userEvent.setup();
    const onNavigate = vi.fn();
    const onOpenBuildingSelect = vi.fn();
    const dashboard = createHomeDashboardTestResponse({
      viewer: {
        ...createHomeDashboardTestResponse().viewer,
        selection: { state: 'NOT_SELECTED', dormitoryId: null, source: null },
        capabilities: {
          ...createHomeDashboardTestResponse().viewer.capabilities,
          canCreateOrUpdateSeasonProfileDraft: true,
          canSelectDormitory: true,
          canEnterRoommateSearch: false,
        },
        seasonProfile: {
          ...createHomeDashboardTestResponse().viewer.seasonProfile,
          registered: false,
          draftWritable: true,
          completion: {
            profileCompletionRequired: true,
            dormitorySelectionRequired: true,
            registrationUnavailable: true,
            registrationUnavailableReasons: ['PROFILE_INCOMPLETE', 'DORMITORY_SELECTION_REQUIRED'],
          },
          canSelectDormitory: true,
          canFinalizeRegistration: false,
        },
      },
    });

    render(
      <HomeReadinessChecklist
        dashboard={dashboard}
        viewModel={buildViewModel(dashboard)}
        onNavigate={onNavigate}
        onOpenBuildingSelect={onOpenBuildingSelect}
      />,
    );

    expect(
      screen.getByRole('heading', { name: '다음 행동을 한눈에 확인해요' }),
    ).toBeInTheDocument();
    await userEventInstance.click(screen.getByRole('button', { name: '생활패턴 입력' }));
    await userEventInstance.click(screen.getByRole('button', { name: '건물 선택' }));

    expect(onNavigate).toHaveBeenCalledWith('profile');
    expect(onOpenBuildingSelect).toHaveBeenCalledOnce();
  });

  it('등록 완료 + 탐색 가능 상태는 완료 항목과 룸메 찾기 action을 함께 보여준다', () => {
    const dashboard = createHomeDashboardTestResponse();
    const items = buildReadinessChecklistItems({ dashboard, viewModel: buildViewModel(dashboard) });

    expect(items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'profile', status: 'complete' }),
        expect.objectContaining({ id: 'building', status: 'complete' }),
        expect.objectContaining({ id: 'registration', status: 'complete' }),
        expect.objectContaining({ id: 'matching', status: 'actionable', actionLabel: '룸메 찾기' }),
      ]),
    );
  });

  it('current season이 없으면 새 요청 CTA 대신 프로필 확인만 제안한다', () => {
    const dashboard = createHomeDashboardTestResponse({
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

    render(
      <HomeReadinessChecklist
        dashboard={dashboard}
        viewModel={buildViewModel(dashboard)}
        onNavigate={vi.fn()}
      />,
    );

    expect(screen.getByText('새 시즌 일정 대기')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '내 프로필 확인' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '룸메 찾기' })).not.toBeInTheDocument();
  });
});
