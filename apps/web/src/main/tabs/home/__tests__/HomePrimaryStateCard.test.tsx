import { describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { createHomeDashboardTestResponse } from '@/main/test-support/home-dashboard.builder';
import { buildHomeDashboardViewModel } from '../model/homeDashboardViewModel';
import { HomePrimaryStateCard } from '../components/HomePrimaryStateCard';
import type { SeasonState } from '@repo/shared/season/runtime';
import type { HomeDashboardResponse } from '@repo/shared/home';

function renderCard({
  dashboard = createHomeDashboardTestResponse(),
  seasonState = dashboard.season.state ?? 'OFF_SEASON',
  daysUntilEnd = dashboard.season.daysUntilMatchingEnd ?? 0,
}: {
  dashboard?: HomeDashboardResponse;
  seasonState?: SeasonState;
  daysUntilEnd?: number;
} = {}) {
  const onNavigate = vi.fn();
  const onOpenBuildingSelect = vi.fn();
  const viewModel = buildHomeDashboardViewModel({
    dashboard,
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

function getCardSection(headingName: string) {
  const section = screen.getByRole('heading', { name: headingName }).closest('section');

  expect(section).not.toBeNull();

  return section;
}

describe('HomePrimaryStateCard', () => {
  it('current season이 없으면 다음 시즌 preview와 이전 시즌 요약만 보여준다', () => {
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
    const { onNavigate } = renderCard({ dashboard, seasonState: 'OFF_SEASON' });

    expect(
      screen.getByRole('heading', { name: '2026년 2학기 준비가 곧 시작돼요' }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/지난 2025년 2학기: 참여 210명/)).not.toBeInTheDocument();
    expect(screen.getByText('이전 시즌 요약')).toBeInTheDocument();
    expect(screen.getByText('지난 참여')).toBeInTheDocument();
    expect(screen.getByText('210명')).toBeInTheDocument();
    expect(screen.getByText('매칭 완료')).toBeInTheDocument();
    expect(screen.getByText('19쌍')).toBeInTheDocument();
    expect(screen.queryByText('내 요청')).not.toBeInTheDocument();
    expect(screen.queryByText('시즌 일정을 확인해주세요.')).not.toBeInTheDocument();
    expect(screen.getByText('시즌 오픈:')).toBeInTheDocument();
    expect(screen.getByText('2026.07.23')).toBeInTheDocument();
    expect(screen.getByText('D-125')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /지난 시즌 기록 보기/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /내 정보 확인/ })).not.toBeInTheDocument();
    expect(screen.getByTestId('home-primary-policy-hint')).toHaveTextContent('비시즌 이용 범위');
    expect(
      screen.getByText('새 룸메 탐색·대화 시작·매칭 요청은 시즌 기간에만 열려요.'),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /비시즌 안내/ })).toHaveLength(4);

    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('current season과 다음 시즌 preview가 없으면 직전 시즌 종료 문구를 보여준다', () => {
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
      nextSeasonPreview: null,
    });

    renderCard({ dashboard, seasonState: 'OFF_SEASON' });

    expect(screen.getByText('2025년 2학기 시즌 매칭 종료')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '다음 시즌에 만나요.' })).toBeInTheDocument();
    expect(
      screen.getByText('다음 시즌 일정은 학교 공식 일정에 맞춰 등록될 예정이에요.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('시즌 오픈:')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /지난 시즌 기록 보기/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /내 정보 확인/ })).not.toBeInTheDocument();
  });

  it('current season, 다음 시즌 preview, 이전 시즌 기록이 모두 없으면 일정 공개 전 문구를 보여준다', () => {
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
      nextSeasonPreview: null,
      seasonHistorySummary: { lastSeason: null },
    });

    renderCard({ dashboard, seasonState: 'OFF_SEASON' });

    expect(screen.getByText('시즌 일정 공개 전')).toBeInTheDocument();
    expect(screen.queryByText(/시즌 매칭 종료/)).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '다음 시즌에 만나요.' })).toBeInTheDocument();
  });

  it('비시즌 정책 배너는 5초 간격 timer를 등록한다', async () => {
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
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
      nextSeasonPreview: null,
      seasonHistorySummary: { lastSeason: null },
    });

    try {
      renderCard({ dashboard, seasonState: 'OFF_SEASON' });

      const rotationCall = setIntervalSpy.mock.calls.find(([, delay]) => delay === 5000);
      const rotatePolicyHint = rotationCall?.[0] as (() => void) | undefined;

      expect(rotatePolicyHint).toBeDefined();
      expect(screen.getByTestId('home-primary-policy-hint')).toHaveTextContent('비시즌 이용 범위');
      expect(screen.getAllByRole('button', { name: /비시즌 안내/ })).toHaveLength(4);

      await act(async () => rotatePolicyHint?.());
      await waitFor(() =>
        expect(screen.getByTestId('home-primary-policy-hint')).toHaveTextContent(
          '확인 가능한 정보',
        ),
      );

      await act(async () => rotatePolicyHint?.());
      await waitFor(() =>
        expect(screen.getByTestId('home-primary-policy-hint')).toHaveTextContent('시즌 프로필'),
      );

      await act(async () => rotatePolicyHint?.());
      await waitFor(() =>
        expect(screen.getByTestId('home-primary-policy-hint')).toHaveTextContent('다음 안내'),
      );
      expect(screen.getByText('시즌 일정이 준비되면 홈에서 안내할게요.')).toBeInTheDocument();
    } finally {
      setIntervalSpy.mockRestore();
    }
  });

  it('시즌 오픈 정책 배너는 상태별 안내와 요약, 대화, 매칭 신청 정책을 순환한다', async () => {
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
    const dashboard = createHomeDashboardTestResponse({
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
            registrationUnavailableReasons: ['PROFILE_INCOMPLETE', 'DORMITORY_SELECTION_REQUIRED'],
          },
          draftWritable: true,
          canSelectDormitory: true,
          canFinalizeRegistration: false,
        },
      },
    });

    try {
      renderCard({ dashboard, seasonState: 'SEASON_OPEN' });

      const rotationCall = setIntervalSpy.mock.calls.find(([, delay]) => delay === 5000);
      const rotatePolicyHint = rotationCall?.[0] as (() => void) | undefined;

      expect(rotatePolicyHint).toBeDefined();
      expect(screen.getByTestId('home-primary-policy-hint')).toHaveTextContent('시즌 참여 준비');
      expect(screen.getAllByRole('button', { name: /시즌 오픈 안내/ })).toHaveLength(4);

      await act(async () => rotatePolicyHint?.());
      await waitFor(() =>
        expect(screen.getByTestId('home-primary-policy-hint')).toHaveTextContent('룸메 후보 탐색'),
      );

      await act(async () => rotatePolicyHint?.());
      await waitFor(() =>
        expect(screen.getByTestId('home-primary-policy-hint')).toHaveTextContent('대화 시작'),
      );

      await act(async () => rotatePolicyHint?.());
      await waitFor(() =>
        expect(screen.getByTestId('home-primary-policy-hint')).toHaveTextContent('매칭 신청'),
      );
      expect(screen.getByText('매칭 신청과 수락은 시즌 매칭 기간에만 열려요.')).toBeInTheDocument();
    } finally {
      setIntervalSpy.mockRestore();
    }
  });

  it('시즌 오픈에서 시즌 프로필은 준비됐고 기숙사만 필요해도 PrimaryCard는 상태만 보여준다', () => {
    const dashboard = createHomeDashboardTestResponse({
      viewer: {
        ...createHomeDashboardTestResponse().viewer,
        selection: { state: 'NOT_SELECTED', dormitoryId: null, source: null },
        capabilities: {
          ...createHomeDashboardTestResponse().viewer.capabilities,
          canSelectDormitory: true,
        },
        seasonProfile: {
          ...createHomeDashboardTestResponse().viewer.seasonProfile,
          registered: false,
          completion: {
            profileCompletionRequired: false,
            dormitorySelectionRequired: true,
            registrationUnavailable: true,
            registrationUnavailableReasons: ['DORMITORY_SELECTION_REQUIRED'],
          },
          canSelectDormitory: true,
          canFinalizeRegistration: false,
        },
      },
    });
    renderCard({ dashboard, seasonState: 'SEASON_OPEN' });

    expect(screen.getByRole('heading', { name: '시즌 참여를 준비해요' })).toBeInTheDocument();
    expect(screen.getByLabelText('시즌 참여 준비 조건')).toHaveTextContent(
      '시즌 프로필완료생활패턴·룸메 조건 설정기숙사필요배정된 기숙사 설정',
    );
    expect(screen.getByLabelText('시즌 참여 신청 상태')).toHaveTextContent(
      '참여 신청대기조건 완료 후 가능',
    );
    expect(screen.getByTestId('home-primary-policy-hint')).toHaveTextContent('시즌 참여 준비');
    expect(screen.getAllByRole('button', { name: /시즌 오픈 안내/ })).toHaveLength(4);

    expect(screen.queryByRole('button', { name: /배정된 기숙사 설정/ })).not.toBeInTheDocument();
  });

  it('시즌 오픈에서 기숙사는 선택됐고 생활패턴만 필요하면 PrimaryCard는 상태만 보여준다', () => {
    const dashboard = createHomeDashboardTestResponse({
      viewer: {
        ...createHomeDashboardTestResponse().viewer,
        selection: {
          state: 'SELECTED',
          dormitoryId: 'dasan',
          source: 'SEASON_PARTICIPANT',
        },
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
            dormitorySelectionRequired: false,
            registrationUnavailable: true,
            registrationUnavailableReasons: ['PROFILE_INCOMPLETE'],
          },
          draftWritable: true,
          canSelectDormitory: true,
          canFinalizeRegistration: false,
        },
      },
    });
    renderCard({
      dashboard,
      seasonState: 'SEASON_OPEN',
    });

    expect(screen.getByText('시즌 오픈 · 시즌 프로필')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '시즌 참여를 준비해요' })).toBeInTheDocument();
    expect(screen.getByLabelText('시즌 참여 준비 조건')).toHaveTextContent(
      '시즌 프로필필요생활패턴·룸메 조건 설정기숙사완료배정된 기숙사 설정',
    );
    expect(screen.getByLabelText('시즌 참여 신청 상태')).toHaveTextContent(
      '참여 신청대기조건 완료 후 가능',
    );
    expect(screen.getByTestId('home-primary-policy-hint')).toHaveTextContent('시즌 참여 준비');
    expect(screen.getAllByRole('button', { name: /시즌 오픈 안내/ })).toHaveLength(4);

    expect(
      screen.queryByRole('button', { name: /생활패턴·룸메 조건 설정/ }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /배정된 기숙사 설정/ })).not.toBeInTheDocument();
  });

  it('시즌 오픈에서 시즌 프로필과 기숙사가 모두 필요하면 PrimaryCard는 준비 상태를 보여준다', () => {
    const dashboard = createHomeDashboardTestResponse({
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
            registrationUnavailableReasons: ['PROFILE_INCOMPLETE', 'DORMITORY_SELECTION_REQUIRED'],
          },
          draftWritable: true,
          canSelectDormitory: true,
          canFinalizeRegistration: false,
        },
      },
    });
    renderCard({
      dashboard,
      seasonState: 'SEASON_OPEN',
    });

    expect(screen.getByText('시즌 오픈 · 준비 시작')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '시즌 참여를 준비해요' })).toBeInTheDocument();
    expect(getCardSection('시즌 참여를 준비해요')).toHaveClass(
      'from-slate-50',
      'via-sky-50',
      'to-cyan-50',
      'border-sky-200',
    );
    expect(screen.getByLabelText('시즌 참여 준비 조건')).toHaveTextContent(
      '시즌 프로필필요생활패턴·룸메 조건 설정기숙사필요배정된 기숙사 설정',
    );
    expect(screen.getByLabelText('시즌 참여 신청 상태')).toHaveTextContent(
      '참여 신청대기조건 완료 후 가능',
    );
    expect(screen.getByTestId('home-primary-policy-hint')).toHaveTextContent('시즌 참여 준비');
    expect(screen.getAllByRole('button', { name: /시즌 오픈 안내/ })).toHaveLength(4);

    expect(
      screen.queryByRole('button', { name: /생활패턴·룸메 조건 설정/ }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /배정된 기숙사 설정/ })).not.toBeInTheDocument();
  });

  it('시즌 오픈에서 참여 신청만 남으면 신청 CTA를 보여준다', () => {
    const dashboard = createHomeDashboardTestResponse({
      viewer: {
        ...createHomeDashboardTestResponse().viewer,
        capabilities: {
          ...createHomeDashboardTestResponse().viewer.capabilities,
          canEnterRoommateSearch: true,
          canFinalizeSeasonRegistration: true,
          canRequestMatch: false,
          canStartChat: false,
        },
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
      },
    });

    renderCard({ dashboard, seasonState: 'SEASON_OPEN' });

    expect(screen.getByText('시즌 오픈 · 준비 완료')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '시즌 참여 신청만 남았어요' })).toBeInTheDocument();
    expect(getCardSection('시즌 참여 신청만 남았어요')).toHaveClass(
      'from-sky-50',
      'via-cyan-50',
      'to-blue-50',
      'border-cyan-200',
    );
    expect(screen.getByLabelText('시즌 참여 준비 조건')).toHaveTextContent(
      '시즌 프로필완료생활패턴·룸메 조건 설정기숙사완료배정된 기숙사 설정',
    );
    expect(screen.getByLabelText('시즌 참여 신청 상태')).toHaveTextContent(
      '참여 신청가능지금 신청 가능',
    );
    expect(screen.queryByRole('button', { name: /시즌 참여 신청하기/ })).not.toBeInTheDocument();
    expect(screen.getByTestId('home-primary-policy-hint')).toHaveTextContent('시즌 참여 신청');
    expect(screen.getAllByRole('button', { name: /시즌 오픈 안내/ })).toHaveLength(4);
  });

  it('시즌 오픈에서 룸메 후보만 볼 수 있으면 PrimaryCard는 후보 상태를 보여준다', () => {
    const dashboard = createHomeDashboardTestResponse({
      viewer: {
        ...createHomeDashboardTestResponse().viewer,
        capabilities: {
          ...createHomeDashboardTestResponse().viewer.capabilities,
          canEnterRoommateSearch: true,
          canRequestMatch: false,
          canStartChat: true,
        },
      },
      matching: {
        ...createHomeDashboardTestResponse().matching,
        pendingSentCount: 0,
        pendingReceivedCount: 0,
        unreadMessageCount: 0,
      },
    });
    renderCard({ dashboard, seasonState: 'SEASON_OPEN' });

    expect(screen.getByText('시즌 오픈 · 참여 완료')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: '룸메 후보를 미리 알아보세요' }),
    ).toBeInTheDocument();
    const registeredPreviewSection = getCardSection('룸메 후보를 미리 알아보세요');

    expect(registeredPreviewSection).toHaveClass('bg-cyan-50', 'border-cyan-300');
    expect(registeredPreviewSection).not.toHaveClass('bg-linear-to-r');
    expect(screen.queryByRole('button', { name: /룸메 후보 보기/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /룸메 찾기/ })).not.toBeInTheDocument();
    const cardSection = getCardSection('룸메 후보를 미리 알아보세요');

    expect(screen.queryByText('237명')).not.toBeInTheDocument();
    expect(screen.queryByText('41명')).not.toBeInTheDocument();
    expect(screen.queryByText('8명')).not.toBeInTheDocument();
    expect(screen.getByLabelText('시즌 참여 준비 조건')).toHaveTextContent(
      '시즌 프로필완료생활패턴·룸메 조건 설정기숙사완료배정된 기숙사 설정',
    );
    expect(screen.getByLabelText('시즌 참여 신청 상태')).toHaveTextContent(
      '참여 신청완료룸메 후보 보기 가능',
    );
    expect(cardSection).not.toHaveTextContent('매칭 신청대기');
    expect(screen.getByTestId('home-primary-policy-hint')).toHaveTextContent('룸메 후보');
    expect(screen.getAllByRole('button', { name: /시즌 오픈 안내/ })).toHaveLength(4);
  });

  it('시즌 오픈에서 시즌 프로필 미완료 상태로 운영 기숙사가 준비 중이면 PrimaryCard는 운영 대기 상태를 보여준다', () => {
    const dashboard = createHomeDashboardTestResponse({
      stats: {
        ...createHomeDashboardTestResponse().stats,
        buildingTotal: 0,
        buildingMatchable: 0,
        todayNewBuilding: 0,
      },
      viewer: {
        ...createHomeDashboardTestResponse().viewer,
        selection: { state: 'NOT_SELECTED', dormitoryId: null, source: null },
        capabilities: {
          ...createHomeDashboardTestResponse().viewer.capabilities,
          canEnterRoommateSearch: false,
          canSelectDormitory: false,
          canFinalizeSeasonRegistration: false,
          canRequestMatch: false,
          canStartChat: false,
        },
        seasonProfile: {
          ...createHomeDashboardTestResponse().viewer.seasonProfile,
          intent: 'UNDECIDED',
          registered: false,
          profileExists: true,
          profileState: 'DRAFT',
          completion: {
            profileCompletionRequired: true,
            dormitorySelectionRequired: true,
            registrationUnavailable: true,
            registrationUnavailableReasons: ['PROFILE_INCOMPLETE', 'NO_SELECTABLE_DORMITORY'],
          },
          draftWritable: true,
          canSelectDormitory: false,
          canFinalizeRegistration: false,
        },
      },
    });
    renderCard({ dashboard, seasonState: 'SEASON_OPEN' });

    expect(screen.getByText('시즌 오픈 · 운영 준비')).toBeInTheDocument();
    expect(screen.getByLabelText('시즌 참여 준비 조건')).toHaveTextContent(
      '시즌 프로필필요생활패턴·룸메 조건 설정기숙사보류운영 정보 대기',
    );
    expect(
      screen.getByText('운영 정보가 등록되기 전에도 시즌 프로필은 먼저 준비할 수 있어요.'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /생활패턴·룸메 조건 설정/ }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /배정된 기숙사 설정/ })).not.toBeInTheDocument();
  });

  it('시즌 오픈에서 운영 기숙사가 준비 중이면 사용자 입력 오류처럼 보이지 않게 안내한다', () => {
    const dashboard = createHomeDashboardTestResponse({
      stats: {
        ...createHomeDashboardTestResponse().stats,
        buildingTotal: 0,
        buildingMatchable: 0,
        todayNewBuilding: 0,
      },
      viewer: {
        ...createHomeDashboardTestResponse().viewer,
        selection: { state: 'NOT_SELECTED', dormitoryId: null, source: null },
        capabilities: {
          ...createHomeDashboardTestResponse().viewer.capabilities,
          canEnterRoommateSearch: false,
          canSelectDormitory: false,
          canFinalizeSeasonRegistration: false,
          canRequestMatch: false,
          canStartChat: false,
        },
        seasonProfile: {
          ...createHomeDashboardTestResponse().viewer.seasonProfile,
          intent: 'UNDECIDED',
          registered: false,
          profileExists: true,
          profileState: 'DRAFT',
          completion: {
            profileCompletionRequired: false,
            dormitorySelectionRequired: true,
            registrationUnavailable: true,
            registrationUnavailableReasons: ['NO_SELECTABLE_DORMITORY'],
          },
          draftWritable: true,
          canSelectDormitory: false,
          canFinalizeRegistration: false,
        },
      },
    });

    renderCard({ dashboard, seasonState: 'SEASON_OPEN' });

    expect(screen.getByText('시즌 오픈 · 운영 준비')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: '운영 기숙사 정보가 준비 중이에요' }),
    ).toBeInTheDocument();
    expect(getCardSection('운영 기숙사 정보가 준비 중이에요')).toHaveClass(
      'from-amber-50',
      'to-yellow-50',
      'border-amber-200',
    );
    expect(screen.getByText('운영 정보가 등록되면 기숙사 선택을 안내할게요.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /배정된 기숙사 설정/ })).not.toBeInTheDocument();
  });

  it('시즌 매칭에서 건물 미배정이면 룸메 찾기가 아니라 건물 배정을 primary로 둔다', () => {
    const dashboard = createHomeDashboardTestResponse({
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
