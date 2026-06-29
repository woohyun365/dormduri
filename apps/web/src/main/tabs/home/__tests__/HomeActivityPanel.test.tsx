import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { createHomeDashboardTestResponse } from '@/main/test-support/home-dashboard.builder';
import { buildHomeDashboardViewModel } from '../model/homeDashboardViewModel';
import { HomeActivityPanel } from '../components/HomeActivityPanel';
import type { HomeDashboardResponse } from '@repo/shared/home';

function renderActivity(dashboard: HomeDashboardResponse) {
  const onNavigate = vi.fn();
  const onOpenBuildingSelect = vi.fn();
  const viewModel = buildHomeDashboardViewModel({
    dashboard,
    renderedAt: new Date('2026-07-01T00:00:00+09:00').getTime(),
  });

  render(
    <HomeActivityPanel
      viewModel={viewModel}
      seasonState={viewModel.seasonState}
      onNavigate={onNavigate}
      onOpenBuildingSelect={onOpenBuildingSelect}
    />,
  );

  return { onNavigate, onOpenBuildingSelect };
}

describe('HomeActivityPanel', () => {
  it('시즌 오픈 탐색 준비 섹션에서 시즌 프로필과 기숙사 설정 CTA를 제공한다', async () => {
    const user = userEvent.setup();
    const { onNavigate, onOpenBuildingSelect } = renderActivity(
      createHomeDashboardTestResponse({
        viewer: {
          ...createHomeDashboardTestResponse().viewer,
          selection: { state: 'NOT_SELECTED', dormitoryId: null, source: null },
          capabilities: {
            ...createHomeDashboardTestResponse().viewer.capabilities,
            canEnterRoommateSearch: true,
            canCreateOrUpdateSeasonProfileDraft: true,
            canSelectDormitory: true,
            canFinalizeSeasonRegistration: false,
            canRequestMatch: false,
            canStartChat: false,
          },
          seasonProfile: {
            ...createHomeDashboardTestResponse().viewer.seasonProfile,
            registered: false,
            profileExists: true,
            profileState: 'DRAFT',
            completion: {
              profileCompletionRequired: true,
              dormitorySelectionRequired: true,
              registrationUnavailable: true,
              registrationUnavailableReasons: [
                'PROFILE_INCOMPLETE',
                'DORMITORY_SELECTION_REQUIRED',
              ],
            },
            draftWritable: true,
            canSelectDormitory: true,
            canFinalizeRegistration: false,
          },
        },
      }),
    );

    expect(screen.getByText('탐색 준비')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '시즌 참여 조건을 설정해요' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /생활패턴·룸메 조건 설정/ }));
    expect(onNavigate).toHaveBeenCalledWith('profile');

    await user.click(screen.getByRole('button', { name: /배정된 기숙사 설정/ }));
    expect(onOpenBuildingSelect).toHaveBeenCalledOnce();
  });

  it('시즌 오픈 탐색 준비 섹션에서 참여 완료 후 룸메 후보와 프로필 CTA를 제공한다', async () => {
    const user = userEvent.setup();
    const { onNavigate } = renderActivity(
      createHomeDashboardTestResponse({
        viewer: {
          ...createHomeDashboardTestResponse().viewer,
          capabilities: {
            ...createHomeDashboardTestResponse().viewer.capabilities,
            canEnterRoommateSearch: true,
            canRequestMatch: false,
            canStartChat: true,
          },
        },
      }),
    );

    expect(screen.getByText('탐색 준비')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: '룸메 후보를 미리 알아볼 수 있어요' }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /룸메 후보 보기/ }));
    expect(onNavigate).toHaveBeenCalledWith('list');

    await user.click(screen.getByRole('button', { name: /시즌 프로필 확인/ }));
    expect(onNavigate).toHaveBeenCalledWith('profile');
  });

  it('비시즌에는 지난 시즌 viewer activity aggregate를 compact하게 보여준다', async () => {
    const user = userEvent.setup();
    const { onNavigate } = renderActivity(
      createHomeDashboardTestResponse({
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
    );

    expect(
      screen.getByRole('heading', { name: '이전 시즌 참여 기록이 있어요' }),
    ).toBeInTheDocument();
    expect(screen.getByText('매칭 미성사')).toBeInTheDocument();
    expect(screen.getByText('지난 시즌에는 확정된 매칭이 없었어요.')).toBeInTheDocument();
    expect(screen.getByText('받은 요청')).toBeInTheDocument();
    expect(screen.getByText('보낸 요청')).toBeInTheDocument();
    expect(screen.getByText('대화')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /이전 시즌 상세 보기/ }));
    expect(screen.getByRole('dialog', { name: '이전 시즌 상세 보기' })).toBeInTheDocument();
    expect(
      screen.getByText('직전 시즌의 내 요청, 대화, 매칭 결과를 요약해서 보여드려요.'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '확인' }));

    await user.click(screen.getByRole('button', { name: /이전 시즌 프로필 확인/ }));
    expect(screen.getByRole('dialog', { name: '이전 시즌 프로필 확인' })).toBeInTheDocument();
    expect(screen.getByText('닉네임')).toBeInTheDocument();
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('비시즌 matched history 상태에서는 상대 닉네임이 있는 성공 카드를 보여준다', () => {
    const base = createHomeDashboardTestResponse();

    renderActivity(
      createHomeDashboardTestResponse({
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
          lastSeason: base.seasonHistorySummary.lastSeason
            ? {
                ...base.seasonHistorySummary.lastSeason,
                viewerHadRegistration: true,
                viewerHadMatchSuccess: true,
                viewerActivity: {
                  sentRequestCount: 3,
                  receivedRequestCount: 2,
                  conversationCount: 4,
                  finalResult: 'MATCHED',
                  matchedPartnerNickname: '민지',
                },
              }
            : null,
        },
      }),
    );

    expect(screen.getByText('이전 시즌 활동 요약')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: '이전 시즌에 매칭이 확정됐어요' }),
    ).toBeInTheDocument();
    expect(screen.getByText('민지')).toHaveClass('font-extrabold');
    expect(screen.getByText(/님과 매칭이 성사되었어요/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /이전 시즌 상세 보기/ })).toBeInTheDocument();
  });

  it('비시즌 no history 상태에서는 행동 버튼 없이 다음 시즌 참여 안내만 보여준다', () => {
    const base = createHomeDashboardTestResponse();

    renderActivity(
      createHomeDashboardTestResponse({
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
          lastSeason: base.seasonHistorySummary.lastSeason
            ? {
                ...base.seasonHistorySummary.lastSeason,
                viewerHadRegistration: false,
                viewerHadMatchSuccess: false,
                viewerActivity: {
                  sentRequestCount: 0,
                  receivedRequestCount: 0,
                  conversationCount: 0,
                  finalResult: 'NOT_PARTICIPATED',
                  matchedPartnerNickname: null,
                },
              }
            : null,
        },
      }),
    );

    expect(
      screen.getByRole('heading', { name: '이전 시즌에 참여하지 않았어요' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/다음 시즌이 열리면 참여해보세요/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /이전 시즌 상세 보기/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /이전 시즌 프로필 확인/ })).not.toBeInTheDocument();
  });

  it('완료 시즌 기록이 없으면 새 시즌 활동 대기 상태를 보여준다', () => {
    renderActivity(
      createHomeDashboardTestResponse({
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
        seasonHistorySummary: { lastSeason: null },
      }),
    );

    expect(
      screen.getByRole('heading', { name: '새 시즌이 열리면 활동이 표시돼요' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/아직 시작된 시즌이 없어요/)).toBeInTheDocument();
    expect(screen.getByText(/시즌 일정이 등록되면 참여 방법을 안내할게요/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /이전 시즌 상세 보기/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /이전 시즌 프로필 확인/ })).not.toBeInTheDocument();
  });
});
