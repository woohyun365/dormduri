import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { createHomeDashboardTestResponse } from '@/main/test-support/home-dashboard.builder';
import { buildHomeDashboardViewModel } from '../model/homeDashboardViewModel';
import {
  buildReadinessChecklistItems,
  HomeReadinessChecklist,
} from '../components/HomeReadinessChecklist';
import type { HomeDashboardResponse } from '@repo/shared/home';

function buildViewModel(dashboard: HomeDashboardResponse) {
  return buildHomeDashboardViewModel({
    dashboard,
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

  it('시즌 참여 신청 완료 + 탐색 가능 상태는 완료 항목과 룸메 찾기 action을 함께 보여준다', () => {
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

  it('registrationUnavailableReasons가 있으면 신청 불가 이유를 사용자 문구로 표시한다', () => {
    const dashboard = createHomeDashboardTestResponse({
      viewer: {
        ...createHomeDashboardTestResponse().viewer,
        capabilities: {
          ...createHomeDashboardTestResponse().viewer.capabilities,
          canFinalizeSeasonRegistration: false,
        },
        seasonProfile: {
          ...createHomeDashboardTestResponse().viewer.seasonProfile,
          registered: false,
          completion: {
            profileCompletionRequired: false,
            dormitorySelectionRequired: false,
            registrationUnavailable: true,
            registrationUnavailableReasons: ['SEASON_NOT_OPEN'],
          },
          canFinalizeRegistration: false,
        },
      },
    });

    const items = buildReadinessChecklistItems({ dashboard, viewModel: buildViewModel(dashboard) });

    expect(items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'registration',
          status: 'locked',
          description:
            '현재는 시즌 참여 신청이 열려 있지 않아요. 새 시즌 일정이 열리면 신청 흐름을 다시 안내할게요.',
        }),
      ]),
    );
  });

  it('current season이 없고 다음 시즌이 있으면 일정 공개 전 상태와 다음 진행 대기를 보여준다', () => {
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

    expect(screen.getByText('2026년 2학기 시즌 시작')).toBeInTheDocument();
    expect(screen.queryByText('완료')).not.toBeInTheDocument();
    expect(screen.getByText('시즌 프로필 준비')).toBeInTheDocument();
    expect(screen.getByText('배정된 기숙사 선택')).toBeInTheDocument();
    expect(screen.getByText('시즌 참여 신청')).toBeInTheDocument();
    expect(screen.getAllByText('대기')).toHaveLength(4);
    expect(screen.queryByText('지난 시즌 한눈에')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '룸메 찾기' })).not.toBeInTheDocument();
  });
});
