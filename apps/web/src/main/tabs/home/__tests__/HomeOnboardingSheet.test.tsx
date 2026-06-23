import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { createHomeDashboardFixture } from '@/__fixtures__/home-dashboard';
import { buildHomeDashboardViewModel } from '../model/homeDashboardViewModel';
import { HomeOnboardingSheet } from '../HomeOnboardingSheet';
import type { UserProfile } from '@/types/profile';
import type { HomeDashboardResponse } from '@repo/shared/home';

const user: UserProfile = {
  id: 'user-1',
  nickname: '춘천유저',
  gender: 'M',
  campus: 'CHUNCHEON',
  dormitoryId: null,
  lifestyle: {
    smokingBehavior: 'NO',
    sleepHabit: 'NONE',
    relationshipStyle: 'CASUAL',
  } as UserProfile['lifestyle'],
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

describe('HomeOnboardingSheet', () => {
  it('service intro dialog를 접근 가능한 이름과 persistent dismiss 버튼으로 보여준다', async () => {
    const userEventInstance = userEvent.setup();
    const onDismissPermanently = vi.fn();

    render(
      <HomeOnboardingSheet
        open
        viewModel={buildViewModel(createHomeDashboardFixture())}
        onClose={vi.fn()}
        onDismissPermanently={onDismissPermanently}
        onNavigate={vi.fn()}
      />,
    );

    expect(screen.getByRole('dialog', { name: '서비스 시작 전 알아두기' })).toBeInTheDocument();
    await userEventInstance.click(screen.getByRole('button', { name: '다시 보지 않기' }));
    expect(onDismissPermanently).toHaveBeenCalledOnce();
  });

  it('Escape는 저장 없이 이번 화면에서만 닫는다', async () => {
    const userEventInstance = userEvent.setup();
    const onClose = vi.fn();
    const onDismissPermanently = vi.fn();

    render(
      <HomeOnboardingSheet
        open
        viewModel={buildViewModel(createHomeDashboardFixture())}
        onClose={onClose}
        onDismissPermanently={onDismissPermanently}
        onNavigate={vi.fn()}
      />,
    );

    await userEventInstance.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledOnce();
    expect(onDismissPermanently).not.toHaveBeenCalled();
  });

  it('dialog가 열리면 close button으로 focus를 옮기고 Tab focus를 dialog 내부에 유지한다', async () => {
    const userEventInstance = userEvent.setup();

    render(
      <HomeOnboardingSheet
        open
        viewModel={buildViewModel(createHomeDashboardFixture())}
        onClose={vi.fn()}
        onDismissPermanently={vi.fn()}
        onNavigate={vi.fn()}
      />,
    );

    const closeButton = screen.getByRole('button', { name: '서비스 안내 닫기' });
    await waitFor(() => expect(closeButton).toHaveFocus());

    await userEventInstance.keyboard('{Shift>}{Tab}{/Shift}');

    expect(screen.getByRole('button', { name: '다시 보지 않기' })).toHaveFocus();
  });

  it('건물 선택이 필요한 사용자는 자동 modal 대신 explicit CTA로만 건물 선택을 연다', async () => {
    const userEventInstance = userEvent.setup();
    const onClose = vi.fn();
    const onOpenBuildingSelect = vi.fn();
    const dashboard = createHomeDashboardFixture({
      viewer: {
        ...createHomeDashboardFixture().viewer,
        selection: { state: 'NOT_SELECTED', dormitoryId: null, source: null },
        capabilities: {
          ...createHomeDashboardFixture().viewer.capabilities,
          canSelectDormitory: true,
          canEnterRoommateSearch: false,
        },
        seasonProfile: {
          ...createHomeDashboardFixture().viewer.seasonProfile,
          registered: false,
          completion: {
            profileCompletionRequired: false,
            dormitorySelectionRequired: true,
            registrationUnavailable: true,
            registrationUnavailableReasons: ['DORMITORY_SELECTION_REQUIRED'],
          },
          canSelectDormitory: true,
        },
      },
    });

    render(
      <HomeOnboardingSheet
        open
        viewModel={buildViewModel(dashboard)}
        onClose={onClose}
        onDismissPermanently={vi.fn()}
        onNavigate={vi.fn()}
        onOpenBuildingSelect={onOpenBuildingSelect}
      />,
    );

    expect(onOpenBuildingSelect).not.toHaveBeenCalled();
    await userEventInstance.click(screen.getByRole('button', { name: /건물 선택하기/ }));

    expect(onClose).toHaveBeenCalledOnce();
    expect(onOpenBuildingSelect).toHaveBeenCalledOnce();
  });
});
