import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createHomeDashboardTestResponse } from '@/main/test-support/home-dashboard.builder';
import { buildHomeDashboardViewModel } from '../model/homeDashboardViewModel';
import {
  buildReadinessChecklistItems,
  HomeReadinessChecklist,
} from '../sections/readiness/HomeReadinessChecklist';
import type { HomeDashboardResponse } from '@repo/shared/home';

function buildViewModel(dashboard: HomeDashboardResponse) {
  return buildHomeDashboardViewModel({
    dashboard,
    renderedAt: new Date('2026-03-20T00:00:00+09:00').getTime(),
  });
}

describe('HomeReadinessChecklist', () => {
  it('dashboard/current-user capability를 기준으로 누락된 프로필과 건물 선택 상태를 분리한다', () => {
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
      screen.getByRole('heading', { name: '신청 전 필요한 항목을 확인해요' }),
    ).toBeInTheDocument();
    expect(screen.getByText('시즌 참여 준비')).toBeInTheDocument();
    expect(screen.getByText('시즌 프로필 준비')).toBeInTheDocument();
    expect(screen.getByText('배정된 기숙사 선택')).toBeInTheDocument();
    expect(screen.getAllByText('진행 가능').length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByRole('button', { name: '시즌 프로필 설정' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '기숙사 설정' })).not.toBeInTheDocument();
    expect(onNavigate).not.toHaveBeenCalled();
    expect(onOpenBuildingSelect).not.toHaveBeenCalled();
  });

  it('시즌 참여 신청 전 매칭 시즌 preview는 amber 강조 없이 대기 상태로 둔다', () => {
    const dashboard = createHomeDashboardTestResponse({
      viewer: {
        ...createHomeDashboardTestResponse().viewer,
        seasonProfile: {
          ...createHomeDashboardTestResponse().viewer.seasonProfile,
          registered: false,
          completion: {
            profileCompletionRequired: false,
            dormitorySelectionRequired: false,
            registrationUnavailable: false,
            registrationUnavailableReasons: [],
          },
          canFinalizeRegistration: true,
        },
        capabilities: {
          ...createHomeDashboardTestResponse().viewer.capabilities,
          canFinalizeSeasonRegistration: true,
        },
      },
    });
    const items = buildReadinessChecklistItems({ dashboard, viewModel: buildViewModel(dashboard) });

    expect(items[0]).toEqual(
      expect.objectContaining({
        id: 'matching-season',
        title: '2026년 2학기 시즌 매칭',
        status: 'locked',
        tone: undefined,
      }),
    );
  });

  it('registrationUnavailableReasons가 있어도 시즌 참여 신청 문구는 일정한 준비 흐름으로 표시한다', () => {
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
          title: '시즌 참여 신청',
          status: 'locked',
          icon: 'progress',
          description: '생활패턴과 기숙사 설정을 확인한 뒤 시즌 참여 신청을 마무리해요.',
        }),
      ]),
    );

    render(
      <HomeReadinessChecklist
        dashboard={dashboard}
        viewModel={buildViewModel(dashboard)}
        onNavigate={vi.fn()}
      />,
    );

    expect(screen.getByText('시즌 참여 신청')).toBeInTheDocument();
    expect(screen.getAllByText('대기').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: '시즌 참여 신청' })).not.toBeInTheDocument();
  });

  it('시즌 참여 철회 후에는 신청 항목을 불가 상태로 고정한다', () => {
    const dashboard = createHomeDashboardTestResponse({
      viewer: {
        ...createHomeDashboardTestResponse().viewer,
        capabilities: {
          ...createHomeDashboardTestResponse().viewer.capabilities,
          canFinalizeSeasonRegistration: false,
        },
        seasonProfile: {
          ...createHomeDashboardTestResponse().viewer.seasonProfile,
          intent: 'DECLINED',
          registered: false,
          completion: {
            profileCompletionRequired: false,
            dormitorySelectionRequired: false,
            registrationUnavailable: true,
            registrationUnavailableReasons: ['WITHDRAWN_OR_DECLINED_LOCK'],
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
          title: '시즌 참여 신청',
          status: 'blocked',
          icon: 'lock',
          description: '시즌 재참여가 필요한 경우 문의하기를 이용해주세요.',
          actionLabel: undefined,
        }),
      ]),
    );

    render(
      <HomeReadinessChecklist
        dashboard={dashboard}
        viewModel={buildViewModel(dashboard)}
        onNavigate={vi.fn()}
      />,
    );

    expect(screen.getByText('시즌 참여 신청')).toBeInTheDocument();
    expect(screen.getByText('불가')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '시즌 참여 신청' })).not.toBeInTheDocument();
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
        operatedDormitories: [],
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
    const items = buildReadinessChecklistItems({ dashboard, viewModel: buildViewModel(dashboard) });
    expect(items).toEqual([
      expect.objectContaining({ id: 'next-season-schedule', icon: 'clock' }),
      expect.objectContaining({ id: 'next-season-profile', icon: 'clock' }),
      expect.objectContaining({ id: 'next-season-building', icon: 'clock' }),
      expect.objectContaining({ id: 'next-season-matching', icon: 'clock' }),
    ]);
    expect(screen.queryByText('지난 시즌 한눈에')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '룸메 찾기' })).not.toBeInTheDocument();
  });

  it('post-match에서는 신청 준비 대신 결과 확인 안내 항목을 보여준다', () => {
    const activeMatch = {
      id: 'match-1',
      seasonId: 'season-2026-1',
      counterpartUserId: 'user-2',
      counterpartParticipantId: 'participant-2',
      counterpartNickname: '감자친구',
      status: 'ACTIVE' as const,
      startedAt: '2026-08-03T00:00:00.000Z',
      endedAt: null,
      endReason: null,
      createdFromRequestId: 'request-1',
      matchScore: 91,
      unmatchProgress: {
        state: 'NONE' as const,
        requestedByViewerAt: null,
        requestedByCounterpartAt: null,
        progressCount: 0,
        requiredCount: 2 as const,
        canRequest: false,
        canCancel: false,
        availableUntil: null,
      },
    };
    const dashboard = createHomeDashboardTestResponse({
      season: {
        ...createHomeDashboardTestResponse().season,
        state: 'SEASON_POST_MATCH',
        isOpen: false,
        isMatching: false,
        isPostMatch: true,
      },
      viewer: {
        ...createHomeDashboardTestResponse().viewer,
        capabilities: {
          ...createHomeDashboardTestResponse().viewer.capabilities,
          canStartChat: true,
          canFinalizeSeasonRegistration: false,
          canRequestMatch: false,
        },
        match: { hasActiveMatch: true, activeMatch },
      },
      matching: {
        ...createHomeDashboardTestResponse().matching,
        activeMatch,
      },
    });

    render(
      <HomeReadinessChecklist
        dashboard={dashboard}
        viewModel={buildViewModel(dashboard)}
        onNavigate={vi.fn()}
      />,
    );

    expect(screen.getByText('마감 정리 안내')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '결과 확인 항목을 확인해요' })).toBeInTheDocument();
    expect(screen.getByText('새 참여·매칭 요청 종료')).toBeInTheDocument();
    expect(screen.getByText('이번 시즌 활동 확인')).toBeInTheDocument();
    expect(screen.getByText('매칭 상대 채팅 유지')).toBeInTheDocument();
    expect(screen.getByText('비매칭 대화 정리')).toBeInTheDocument();
    expect(screen.getByText('유지')).toBeInTheDocument();
    expect(screen.getByText('닫힘')).toBeInTheDocument();
    expect(screen.getAllByText('확인')).toHaveLength(2);
  });
});
