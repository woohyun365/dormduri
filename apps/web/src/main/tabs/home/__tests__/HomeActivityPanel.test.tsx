import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { createHomeDashboardTestResponse } from '@/main/test-support/home-dashboard.builder';
import { buildHomeDashboardViewModel } from '../model/homeDashboardViewModel';
import { HomeActivityPanel } from '../components/HomeActivityPanel';
import type { HomeDashboardResponse } from '@repo/shared/home';

function renderActivity(
  dashboard: HomeDashboardResponse,
  options: { onDeregisterSeasonParticipation?: () => Promise<void> } = {},
) {
  const onNavigate = vi.fn();
  const onDeregisterSeasonParticipation =
    options.onDeregisterSeasonParticipation ?? vi.fn().mockResolvedValue(undefined);
  const viewModel = buildHomeDashboardViewModel({
    dashboard,
    renderedAt: new Date('2026-07-01T00:00:00+09:00').getTime(),
  });

  render(
    <HomeActivityPanel
      viewModel={viewModel}
      seasonState={viewModel.seasonState}
      onNavigate={onNavigate}
      onDeregisterSeasonParticipation={onDeregisterSeasonParticipation}
    />,
  );

  return { onNavigate, onDeregisterSeasonParticipation };
}

describe('HomeActivityPanel', () => {
  it('시즌 오픈 required 상태에서 설정 이동 CTA와 구성 확인 modal을 제공한다', async () => {
    const user = userEvent.setup();
    const { onNavigate } = renderActivity(
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
    expect(screen.getByRole('heading', { name: '이번 시즌 현황' })).toBeInTheDocument();
    expect(screen.getByText('이번 시즌 참여자')).toBeInTheDocument();
    expect(screen.getByText('내 건물 참여자')).toBeInTheDocument();
    expect(screen.getByText('운영 기숙사 리스트')).toBeInTheDocument();
    expect(screen.getByText('190명')).toBeInTheDocument();
    expect(screen.getByText('춘천캠퍼스 기준')).toBeInTheDocument();
    expect(screen.getByText('-')).toBeInTheDocument();
    expect(screen.getByText('시즌 참여 시 공개')).toBeInTheDocument();
    expect(screen.getByText('5곳')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /시즌 프로필\/기숙사 설정/ }));
    expect(onNavigate).toHaveBeenCalledWith('profile');

    await user.click(screen.getByRole('button', { name: /시즌 프로필 구성 확인/ }));
    expect(screen.getByRole('dialog', { name: '시즌 프로필 구성을 확인해요' })).toBeInTheDocument();
    expect(screen.getByText('생활패턴')).toBeInTheDocument();
    expect(screen.getByText('룸메 조건')).toBeInTheDocument();
    expect(screen.getAllByText('설정 필요').length).toBeGreaterThanOrEqual(2);
    await user.click(screen.getByRole('button', { name: '확인' }));

    await user.click(screen.getByRole('button', { name: /운영 기숙사 리스트/ }));
    expect(screen.getByRole('dialog', { name: '운영 기숙사 리스트' })).toBeInTheDocument();
    expect(screen.getByText('다온관')).toBeInTheDocument();
  });

  it('시즌 매칭 required 상태에서도 시즌 오픈의 탐색 준비 섹션 패턴을 사용한다', async () => {
    const user = userEvent.setup();
    const { onNavigate } = renderActivity(
      createHomeDashboardTestResponse({
        season: {
          ...createHomeDashboardTestResponse().season,
          state: 'SEASON_MATCHING',
          isOpen: false,
          isMatching: true,
        },
        viewer: {
          ...createHomeDashboardTestResponse().viewer,
          selection: { state: 'NOT_SELECTED', dormitoryId: null, source: null },
          capabilities: {
            ...createHomeDashboardTestResponse().viewer.capabilities,
            canEnterRoommateSearch: false,
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
              profileCompletionRequired: false,
              dormitorySelectionRequired: true,
              registrationUnavailable: true,
              registrationUnavailableReasons: ['DORMITORY_SELECTION_REQUIRED'],
            },
            draftWritable: true,
            canSelectDormitory: true,
            canFinalizeRegistration: false,
          },
        },
      }),
    );

    expect(screen.getByText('탐색 준비')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '이번 시즌 현황' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '매칭 활동' })).not.toBeInTheDocument();
    expect(screen.getByText('이번 시즌 참여자')).toBeInTheDocument();
    expect(screen.getByText('내 건물 참여자')).toBeInTheDocument();
    expect(screen.getByText('시즌 참여 시 공개')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /시즌 프로필\/기숙사 설정/ }));
    expect(onNavigate).toHaveBeenCalledWith('profile');

    await user.click(screen.getByRole('button', { name: /시즌 프로필 구성 확인/ }));
    expect(screen.getByRole('dialog', { name: '시즌 프로필 구성을 확인해요' })).toBeInTheDocument();
  });

  it('시즌 오픈 ready 상태에서 신청 전 확인 modal과 프로필 설정 이동 CTA를 제공한다', async () => {
    const user = userEvent.setup();
    const { onNavigate } = renderActivity(
      createHomeDashboardTestResponse({
        viewer: {
          ...createHomeDashboardTestResponse().viewer,
          seasonProfile: {
            ...createHomeDashboardTestResponse().viewer.seasonProfile,
            intent: 'UNDECIDED',
            registered: false,
            profileExists: true,
            profileState: 'DRAFT',
            completion: {
              profileCompletionRequired: false,
              dormitorySelectionRequired: false,
              registrationUnavailable: false,
              registrationUnavailableReasons: [],
            },
            draftWritable: true,
            canSelectDormitory: true,
            canFinalizeRegistration: true,
          },
          capabilities: {
            ...createHomeDashboardTestResponse().viewer.capabilities,
            canFinalizeSeasonRegistration: true,
            canRequestMatch: false,
            canStartChat: false,
          },
        },
      }),
    );

    expect(screen.getByText('탐색 준비')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '이번 시즌 현황' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /시즌 참여 신청하기/ }));
    expect(screen.getByRole('dialog', { name: '시즌 참여 신청 전 확인' })).toBeInTheDocument();
    expect(screen.getByText('신청 가능')).toBeInTheDocument();
    expect(screen.getByText(/신청 완료 후에는 이번 시즌 기준/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '확인' }));

    await user.click(screen.getByRole('button', { name: /시즌 프로필\/기숙사 설정/ }));
    expect(onNavigate).toHaveBeenCalledWith('profile');
  });

  it('시즌 오픈 registered 상태에서 철회 안내와 시즌 프로필 보기 modal을 제공한다', async () => {
    const user = userEvent.setup();
    const onDeregisterSeasonParticipation = vi.fn().mockResolvedValue(undefined);
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
      { onDeregisterSeasonParticipation },
    );

    expect(screen.getByText('탐색 준비')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '이번 시즌 현황' })).toBeInTheDocument();
    expect(screen.getByText('이번 시즌 참여자')).toBeInTheDocument();
    expect(screen.getByText('내 건물 참여자')).toBeInTheDocument();
    expect(screen.getByText('운영 기숙사 리스트')).toBeInTheDocument();
    expect(screen.getByText('190명')).toBeInTheDocument();
    expect(screen.getByText('64명')).toBeInTheDocument();
    expect(screen.getByText('다산관 기준')).toBeInTheDocument();
    expect(screen.getByText('(+3명)')).toBeInTheDocument();
    expect(screen.getByText('5곳')).toBeInTheDocument();
    expect(screen.getByText('클릭 시 확인 가능')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /시즌 참여 철회하기/ }));
    const withdrawalDialog = screen.getByRole('dialog', { name: '시즌 참여 철회 정책' });
    expect(withdrawalDialog).toBeInTheDocument();
    expect(withdrawalDialog).toHaveClass('rounded-t-3xl');
    expect(screen.getByText('같은 시즌 재참여 불가')).toBeInTheDocument();
    await user.click(within(withdrawalDialog).getByRole('button', { name: '시즌 참여 철회하기' }));
    expect(onDeregisterSeasonParticipation).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog', { name: '시즌 참여 철회 정책' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /시즌 프로필 보기/ }));
    const profileDialog = screen.getByRole('dialog', { name: '이번 시즌 프로필 보기' });
    expect(profileDialog).toBeInTheDocument();
    expect(
      screen.getByText('같은 기숙사 룸메 후보에게 표시되는 이번 시즌 기준 정보를 확인해요.'),
    ).toBeInTheDocument();
    expect(onNavigate).not.toHaveBeenCalledWith('list');
  });

  it('운영 기숙사가 없으면 current season fixture 기준으로 참여자와 운영 기숙사 수를 0으로 보여준다', async () => {
    const user = userEvent.setup();

    renderActivity(
      createHomeDashboardTestResponse({
        season: {
          ...createHomeDashboardTestResponse().season,
          operatedDormitories: [],
        },
        stats: {
          ...createHomeDashboardTestResponse().stats,
          totalParticipants: 0,
          assignedParticipants: 0,
          buildingTotal: 0,
          buildingMatchable: 0,
          todayNewTotal: 0,
          todayNewBuilding: 0,
          totalMatchSuccess: 0,
          buildingMatchSuccess: 0,
          todayMatchSuccessTotal: 0,
          todayMatchSuccessBuilding: 0,
        },
        viewer: {
          ...createHomeDashboardTestResponse().viewer,
          seasonProfile: {
            ...createHomeDashboardTestResponse().viewer.seasonProfile,
            registered: false,
            completion: {
              profileCompletionRequired: false,
              dormitorySelectionRequired: true,
              registrationUnavailable: true,
              registrationUnavailableReasons: ['NO_SELECTABLE_DORMITORY'],
            },
            canFinalizeRegistration: false,
          },
          selection: { state: 'NOT_SELECTED', dormitoryId: null, source: null },
          capabilities: {
            ...createHomeDashboardTestResponse().viewer.capabilities,
            canEnterRoommateSearch: false,
            canSelectDormitory: false,
            canFinalizeSeasonRegistration: false,
            canRequestMatch: false,
            canStartChat: false,
          },
        },
      }),
    );

    expect(screen.getByText('탐색 준비')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '이번 시즌 현황' })).toBeInTheDocument();
    expect(screen.getByText('0명')).toBeInTheDocument();
    expect(screen.getByText('0곳')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /시즌 프로필 설정/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /운영 기숙사 리스트/ }));
    expect(screen.getByRole('dialog', { name: '운영 기숙사 리스트' })).toBeInTheDocument();
    expect(screen.getByText('아직 등록된 운영 기숙사 정보가 없어요.')).toBeInTheDocument();
  });

  it('운영 기숙사가 없고 시즌 프로필이 미완료면 프로필 설정 CTA만 제공한다', async () => {
    const user = userEvent.setup();
    const { onNavigate } = renderActivity(
      createHomeDashboardTestResponse({
        season: {
          ...createHomeDashboardTestResponse().season,
          operatedDormitories: [],
        },
        stats: {
          ...createHomeDashboardTestResponse().stats,
          totalParticipants: 0,
          assignedParticipants: 0,
          buildingTotal: 0,
          buildingMatchable: 0,
          todayNewTotal: 0,
          todayNewBuilding: 0,
          totalMatchSuccess: 0,
          buildingMatchSuccess: 0,
          todayMatchSuccessTotal: 0,
          todayMatchSuccessBuilding: 0,
        },
        viewer: {
          ...createHomeDashboardTestResponse().viewer,
          seasonProfile: {
            ...createHomeDashboardTestResponse().viewer.seasonProfile,
            registered: false,
            profileState: 'DRAFT',
            completion: {
              profileCompletionRequired: true,
              dormitorySelectionRequired: true,
              registrationUnavailable: true,
              registrationUnavailableReasons: ['PROFILE_INCOMPLETE', 'NO_SELECTABLE_DORMITORY'],
            },
            canFinalizeRegistration: false,
          },
          selection: { state: 'NOT_SELECTED', dormitoryId: null, source: null },
          capabilities: {
            ...createHomeDashboardTestResponse().viewer.capabilities,
            canEnterRoommateSearch: false,
            canSelectDormitory: false,
            canFinalizeSeasonRegistration: false,
            canRequestMatch: false,
            canStartChat: false,
          },
        },
      }),
    );

    await user.click(screen.getByRole('button', { name: /시즌 프로필 설정/ }));
    expect(onNavigate).toHaveBeenCalledWith('profile');
    expect(
      screen.queryByRole('button', { name: /시즌 프로필\/기숙사 설정/ }),
    ).not.toBeInTheDocument();
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
          operatedDormitories: [],
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
    const activityDialog = screen.getByRole('dialog', { name: '이전 시즌 상세 보기' });
    expect(activityDialog).toBeInTheDocument();
    expect(activityDialog).toHaveClass('rounded-t-3xl');
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
          operatedDormitories: [],
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
          operatedDormitories: [],
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
          operatedDormitories: [],
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
