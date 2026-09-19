import { render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { MatchingApiError } from '../api/matching.api';
import MatchingTab, { MatchingTabView } from '../MatchingTab';
import {
  createMatchHistoryResponse,
  createPublicProfileFull,
  createPublicProfileTombstone,
} from '@/test/home-profile-detail-fixtures';

function counterpartSummary(nickname: string) {
  return {
    id: `summary-${nickname}`,
    sourceProfile: 'SEASON_PARTICIPANT_PROFILE',
    relation: { type: 'GENERAL' },
    exposure: {
      listSummaryVisible: true,
      detailViewable: true,
      canViewFull: true,
      scoreVisible: true,
    },
    actions: {
      canBookmark: false,
      canRequestMatch: false,
      canStartChat: true,
      unavailableReasons: [],
    },
    resultRead: { resultReadable: false, context: 'NONE' },
    profileSummary: {
      nickname,
      intro: '조용한 생활을 선호해요.',
      smokingBehavior: 'NO',
      sleepHabit: null,
      relationshipStyle: null,
    },
    detailEntryToken: 'detail-token-1',
    matchScore: 91,
  };
}

function receivedRequest(
  status: 'PENDING' | 'CANCELLED_BY_SYSTEM' = 'PENDING',
  id = 'request-1',
  nickname = '도윤',
) {
  return {
    id,
    seasonId: 'season-1',
    direction: 'RECEIVED',
    counterpartUserId: `user-${id}`,
    counterpartParticipantId: `participant-${id}`,
    counterpartSummary: counterpartSummary(nickname),
    status,
    note: '잘 부탁해요.',
    createdAt: '2026-08-01T00:00:00.000Z',
    expiresAt: '2026-08-05T00:00:00.000Z',
    terminalAt: status === 'PENDING' ? null : '2026-08-01T01:00:00.000Z',
    acceptedAt: null,
    terminalReason: status === 'PENDING' ? null : 'MATCH_PRECONDITION_FAILED',
    actions:
      status === 'PENDING'
        ? {
            accept: { allowed: true, reason: null },
            reject: { allowed: true, reason: null },
            cancel: { allowed: false, reason: null },
          }
        : {
            accept: { allowed: false, reason: 'MATCH_PRECONDITION_FAILED' },
            reject: { allowed: false, reason: 'MATCH_PRECONDITION_FAILED' },
            cancel: { allowed: false, reason: 'MATCH_PRECONDITION_FAILED' },
          },
  };
}

function overviewFixture(overrides: Record<string, unknown> = {}) {
  return {
    serverNow: '2026-08-01T00:00:00.000Z',
    season: {
      id: 'season-1',
      state: 'SEASON_MATCHING',
      roomSelectionDate: '2026-08-10',
      seasonEndDate: '2026-08-31',
    },
    capability: { canViewMatching: true, reason: null },
    sentRequests: [],
    receivedRequests: [receivedRequest()],
    activeMatch: null,
    activity: [],
    ...overrides,
  };
}

function currentActivity(overrides: Record<string, unknown> = {}) {
  return {
    id: 'request:request-2',
    counterpartParticipantId: 'participant-request-2',
    counterpartNickname: '민준',
    stage: 'RECEIVED_REQUEST',
    result: 'REQUEST_CANCELLED',
    direction: 'RECEIVED',
    occurredAt: '2026-08-01T01:00:00.000Z',
    requestTerminalReason: 'CANCELLED_BY_SYSTEM_ACTIVE_MATCH',
    systemCancellationCause: 'VIEWER_MATCHED',
    systemCancellationGroupId: 'active-1',
    activeMatchEndReason: null,
    ...overrides,
  };
}

function currentActiveMatch(overrides: Record<string, unknown> = {}) {
  const summary = counterpartSummary('도윤');
  return {
    id: 'active-1',
    seasonId: 'season-1',
    counterpartUserId: 'user-2',
    counterpartParticipantId: 'participant-2',
    counterpartNickname: '도윤',
    counterpartSummary: {
      ...summary,
      relation: { type: 'MATCHED_PARTNER' },
      resultRead: { resultReadable: true, context: 'CURRENT_MATCHED_PARTNER' },
    },
    status: 'ACTIVE',
    startedAt: '2026-08-01T01:00:00.000Z',
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
      canRequest: true,
      canCancel: false,
      disabledReason: null,
      availableUntil: '2026-08-10T14:59:59.999Z',
    },
    ...overrides,
  };
}

describe('MatchingTab canonical runtime', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('legacy props 없이 real BFF overview를 읽고 badge selector를 알린다', async () => {
    const onBadgeCountChange = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            serverNow: '2026-08-01T00:00:00.000Z',
            season: {
              id: 'season-1',
              state: 'SEASON_MATCHING',
              roomSelectionDate: '2026-08-10',
              seasonEndDate: '2026-08-31',
            },
            capability: { canViewMatching: true, reason: null },
            sentRequests: [],
            receivedRequests: [],
            activeMatch: null,
            activity: [],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    );

    render(
      <MatchingTab
        viewerId="viewer-1"
        seasonShell={{ id: 'season-1', state: 'SEASON_MATCHING' }}
        onBadgeCountChange={onBadgeCountChange}
      />,
    );

    await screen.findByText('현재 요청을 확인해보세요');
    await waitFor(() => expect(document.getElementById('matching-tab-heading')).toHaveFocus());
    await waitFor(() => expect(onBadgeCountChange).toHaveBeenLastCalledWith(0));
    expect(fetch).toHaveBeenCalledWith(
      '/api/matches/overview',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('past initial section은 history만 lazy load하고 current 선택은 history를 eager load하지 않는다', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json(overviewFixture()))
      .mockResolvedValueOnce(Response.json(createMatchHistoryResponse()));
    vi.stubGlobal('fetch', fetchMock);

    const { rerender } = render(
      <MatchingTab
        viewerId="viewer-1"
        seasonShell={{ id: 'season-1', state: 'SEASON_MATCHING' }}
      />,
    );
    await screen.findByText('현재 요청을 확인해보세요');
    expect(fetchMock.mock.calls.map(([path]) => path)).not.toContain('/api/matches/history');

    rerender(
      <MatchingTab
        viewerId="viewer-2"
        seasonShell={{ id: 'season-2', state: 'SEASON_MATCHING' }}
        initialSection="past"
      />,
    );
    expect(await screen.findByRole('heading', { name: '매칭 기록' })).toBeInTheDocument();
    await waitFor(() =>
      expect(fetchMock.mock.calls.map(([path]) => path)).toContain('/api/matches/history'),
    );
  });

  it.each([
    { seasonState: 'OFF_SEASON', label: '비시즌' },
    { seasonState: 'SEASON_OPEN', label: '시즌 준비' },
  ] as const)('$label은 지난 기록을 기본 선택하고 history를 읽는다', async ({ seasonState }) => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json(
          overviewFixture({
            season: {
              id: 'season-1',
              state: seasonState,
              roomSelectionDate: null,
              seasonEndDate: '2026-08-31',
            },
          }),
        ),
      )
      .mockResolvedValueOnce(Response.json(createMatchHistoryResponse()));
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MatchingTab viewerId="viewer-1" seasonShell={{ id: 'season-1', state: seasonState }} />,
    );

    const historyHeading = await screen.findByRole('heading', { name: '매칭 기록' });
    await waitFor(() => expect(historyHeading).toHaveFocus());
    expect(screen.getByRole('tab', { name: '지난 기록' })).toHaveAttribute('aria-selected', 'true');
    await waitFor(() =>
      expect(fetchMock.mock.calls.map(([path]) => path)).toContain('/api/matches/history'),
    );
  });

  it('controlled auto section은 overview가 준비된 뒤 season default를 한 URL intent에 고정한다', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json(
          overviewFixture({
            season: {
              id: 'season-1',
              state: 'OFF_SEASON',
              roomSelectionDate: null,
              seasonEndDate: '2026-08-31',
            },
          }),
        ),
      )
      .mockResolvedValueOnce(Response.json(createMatchHistoryResponse()))
      .mockResolvedValueOnce(Response.json({ items: [] }));
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MatchingTab
        viewerId="viewer-1"
        seasonShell={{ id: 'season-1', state: 'OFF_SEASON' }}
        routeSelection={{}}
        routeIntentKey="auto-off-season"
      />,
    );

    expect(await screen.findByRole('tab', { name: '지난 기록' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(fetchMock.mock.calls.filter(([path]) => path === '/api/matches/overview')).toHaveLength(
      1,
    );
  });

  it('current/past tab은 Arrow 이동만으로 history를 읽지 않고 explicit activation 뒤 선택 panel heading에 focus한다', async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json(overviewFixture()))
      .mockResolvedValueOnce(Response.json(createMatchHistoryResponse()));
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MatchingTab
        viewerId="viewer-1"
        seasonShell={{ id: 'season-1', state: 'SEASON_MATCHING' }}
      />,
    );

    const current = await screen.findByRole('tab', { name: '현재 매칭' });
    const past = screen.getByRole('tab', { name: '지난 기록' });
    await waitFor(() => expect(document.getElementById('matching-tab-heading')).toHaveFocus());
    current.focus();
    await user.keyboard('{ArrowRight}');

    expect(past).toHaveFocus();
    expect(current).toHaveAttribute('aria-selected', 'true');
    expect(fetchMock.mock.calls.map(([path]) => path)).not.toContain('/api/matches/history');

    await user.keyboard('{Enter}');
    expect(await screen.findByRole('heading', { name: '매칭 기록' })).toHaveFocus();
    await waitFor(() =>
      expect(fetchMock.mock.calls.map(([path]) => path)).toContain('/api/matches/history'),
    );

    await user.click(current);
    await waitFor(() => expect(screen.getByRole('heading', { name: '현재 매칭' })).toHaveFocus());
  });

  it('controlled URL selection rerender는 overview를 다시 읽지 않고 section/request tab을 갱신한다', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json(overviewFixture()))
      .mockResolvedValueOnce(Response.json(createMatchHistoryResponse()))
      .mockResolvedValueOnce(Response.json({ items: [] }));
    vi.stubGlobal('fetch', fetchMock);

    const common = {
      viewerId: 'viewer-1',
      seasonShell: { id: 'season-1', state: 'SEASON_MATCHING' as const },
    };
    const { rerender } = render(
      <MatchingTab
        {...common}
        routeSelection={{ section: 'current', requestTab: 'sent' }}
        routeIntentKey="?section=current&requestTab=sent"
      />,
    );

    expect(await screen.findByRole('tab', { name: '보낸 요청 0' })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    rerender(
      <MatchingTab
        {...common}
        routeSelection={{ section: 'past' }}
        routeIntentKey="?section=past"
      />,
    );
    expect(await screen.findByRole('heading', { name: '매칭 기록' })).toBeInTheDocument();

    rerender(
      <MatchingTab
        {...common}
        routeSelection={{ section: 'current', requestTab: 'received' }}
        routeIntentKey="?section=current&requestTab=received"
      />,
    );
    expect(await screen.findByRole('tab', { name: '받은 요청 1' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(fetchMock.mock.calls.filter(([path]) => path === '/api/matches/overview')).toHaveLength(
      1,
    );
  });

  it('controlled auto request tab은 URL intent마다 data로 평가하고 background refresh에는 고정된다', async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json(overviewFixture()))
      .mockResolvedValueOnce(Response.json({ message: 'state changed' }, { status: 409 }))
      .mockResolvedValueOnce(Response.json(overviewFixture({ receivedRequests: [] })));
    vi.stubGlobal('fetch', fetchMock);

    const { rerender } = render(
      <MatchingTab
        viewerId="viewer-1"
        seasonShell={{ id: 'season-1', state: 'SEASON_MATCHING' }}
        routeSelection={{}}
        routeIntentKey="auto-1"
      />,
    );

    const received = await screen.findByRole('tab', { name: '받은 요청 1' });
    expect(received).toHaveAttribute('aria-selected', 'true');
    await user.click(screen.getByRole('button', { name: '거절' }));
    await user.click(screen.getByRole('button', { name: '거절하기' }));
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: '받은 요청 0' })).toHaveAttribute(
        'aria-selected',
        'true',
      ),
    );

    rerender(
      <MatchingTab
        viewerId="viewer-1"
        seasonShell={{ id: 'season-1', state: 'SEASON_MATCHING' }}
        routeSelection={{}}
        routeIntentKey="auto-2"
      />,
    );
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: '보낸 요청 0' })).toHaveAttribute(
        'aria-selected',
        'true',
      ),
    );
  });

  it('controlled user selection publishes explicit URL intent while legacy initial props remain local', async () => {
    const user = userEvent.setup();
    const onRouteSelectionChange = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => Promise.resolve(Response.json(overviewFixture()))),
    );

    const { unmount } = render(
      <MatchingTab
        viewerId="viewer-1"
        seasonShell={{ id: 'season-1', state: 'SEASON_MATCHING' }}
        routeSelection={{}}
        routeIntentKey="auto"
        onRouteSelectionChange={onRouteSelectionChange}
      />,
    );
    await user.click(await screen.findByRole('tab', { name: '지난 기록' }));
    expect(onRouteSelectionChange).toHaveBeenLastCalledWith({ section: 'past' });
    await user.click(screen.getByRole('tab', { name: '보낸 요청 0' }));
    expect(onRouteSelectionChange).toHaveBeenLastCalledWith({ requestTab: 'sent' });

    unmount();
    render(
      <MatchingTab
        viewerId="viewer-1"
        seasonShell={{ id: 'season-1', state: 'SEASON_MATCHING' }}
        initialSection="current"
        initialRequestTab="sent"
      />,
    );
    expect(await screen.findByRole('tab', { name: '보낸 요청 0' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('chat owner capability가 열리면 Main shell navigation command만 호출한다', async () => {
    const user = userEvent.setup();
    const onNavigateChat = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          Response.json(
            overviewFixture({ receivedRequests: [], activeMatch: currentActiveMatch() }),
          ),
        ),
    );

    render(
      <MatchingTab
        viewerId="viewer-1"
        seasonShell={{ id: 'season-1', state: 'SEASON_MATCHING' }}
        onNavigateChat={onNavigateChat}
      />,
    );

    await user.click(await screen.findByRole('button', { name: '채팅하기' }));
    expect(onNavigateChat).toHaveBeenCalledTimes(1);
  });

  it('request detailEntryToken을 roommate-search public detail owner에 전달한다', async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json(overviewFixture()))
      .mockResolvedValueOnce(
        Response.json(createPublicProfileFull({ id: 'user-request-1', nickname: '도윤' })),
      );
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MatchingTab
        viewerId="viewer-1"
        seasonShell={{ id: 'season-1', state: 'SEASON_MATCHING' }}
      />,
    );

    await user.click(await screen.findByRole('button', { name: '도윤 프로필 상세 보기' }));
    const dialog = await screen.findByRole('dialog', { name: '요청 상대 프로필' });
    expect(within(dialog).getByRole('heading', { name: '도윤' })).toBeInTheDocument();
    expect(
      within(dialog).getByRole('heading', { name: '생활패턴 적합도 분석 결과' }),
    ).toBeInTheDocument();

    const detailCall = fetchMock.mock.calls[1];
    const detailUrl = new URL(String(detailCall?.[0]), 'http://localhost');
    expect(detailUrl.pathname).toBe('/api/profiles/user-request-1');
    expect(detailUrl.searchParams.get('detailEntryToken')).toBe('detail-token-1');
  });

  it('request summary 이후 상대가 시즌 참여를 철회하면 tombstone detail로 degrade한다', async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json(overviewFixture()))
      .mockResolvedValueOnce(
        Response.json(
          createPublicProfileTombstone({
            id: 'user-request-1',
            relation: { type: 'GENERAL' },
            resultRead: { resultReadable: false, context: 'NONE' },
            tombstone: {
              reason: 'TARGET_NO_LONGER_DISCOVERABLE',
              displayName: '도윤',
              message: '상대가 시즌 참여를 철회해 프로필을 볼 수 없어요.',
            },
          }),
        ),
      );
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MatchingTab
        viewerId="viewer-1"
        seasonShell={{ id: 'season-1', state: 'SEASON_MATCHING' }}
      />,
    );

    await user.click(await screen.findByRole('button', { name: '도윤 프로필 상세 보기' }));
    const dialog = await screen.findByRole('dialog', { name: '요청 상대 프로필' });
    expect(within(dialog).getByText('상대가 시즌 참여를 철회했어요.')).toBeInTheDocument();
    expect(
      within(dialog).getByText('상대가 시즌 참여를 철회해 프로필을 볼 수 없어요.'),
    ).toBeInTheDocument();
  });

  it.each([
    { kind: 'loading' } as const,
    {
      kind: 'unavailable',
      reason: 'VIEWER_NOT_REGISTERED',
      seasonState: 'SEASON_MATCHING',
      historySummary: { seasons: 0, matchedCount: 0, unmatchedCount: 0 },
    } as const,
    {
      kind: 'off-season',
      historySummary: { seasons: 0, matchedCount: 0, unmatchedCount: 0 },
    } as const,
  ])('loading/denied/season state가 같은 heading과 responsive shell을 사용한다', (state) => {
    const { container } = render(<MatchingTabView state={state} />);

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByTestId('matching-tab-hero')).toBeInTheDocument();
    expect(screen.getByTestId('matching-tab-layout')).toBeInTheDocument();
    expect(container.querySelector('main')).not.toBeInTheDocument();
  });

  it('loading은 viewer identity와 production main/supporting grid를 유지한다', () => {
    render(
      <MatchingTabView
        state={{ kind: 'loading' }}
        viewerHeader={{
          nickname: '나',
          gender: 'M',
          campusLabel: '춘천캠퍼스',
          residenceLabel: '다산관 · 2인실',
        }}
      />,
    );

    expect(screen.getByRole('heading', { name: '나님' })).toBeInTheDocument();
    expect(screen.getByRole('status', { name: '매칭 정보를 불러오는 중' })).toBeInTheDocument();
    expect(screen.getByTestId('matching-tab-layout')).toHaveClass('max-w-md', 'md:max-w-5xl');
    expect(screen.getByTestId('matching-tab-loading-layout')).toHaveClass(
      'md:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.8fr)]',
    );
  });

  it('비시즌 header는 현재 기숙사 대신 HomeTab과 같은 캠퍼스 맥락을 표시한다', () => {
    render(
      <MatchingTabView
        state={{
          kind: 'off-season',
          historySummary: { seasons: 0, matchedCount: 0, unmatchedCount: 0 },
        }}
        viewerHeader={{
          nickname: '나',
          gender: 'M',
          campusLabel: '춘천캠퍼스',
          residenceLabel: '다산관 · 2인실',
        }}
        selectedSection="past"
        pastContent={<p>지난 기록</p>}
      />,
    );

    expect(screen.getByText('춘천캠퍼스')).toBeInTheDocument();
    expect(screen.queryByText('다산관 · 2인실')).not.toBeInTheDocument();
  });

  it('error retry는 public copy만 노출하고 overview refetch를 호출한다', async () => {
    const onRetry = vi.fn().mockResolvedValue(undefined);
    const ui = userEvent.setup();

    render(
      <MatchingTabView
        state={{
          kind: 'error',
          error: new MatchingApiError('MATCHING_API_NETWORK'),
        }}
        onRetry={onRetry}
      />,
    );

    expect(
      screen.getByText('매칭 정보를 불러오지 못했어요. 잠시 후 다시 시도해주세요.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/raw upstream/i)).not.toBeInTheDocument();
    expect(screen.getByTestId('matching-tab-layout')).toHaveClass('max-w-md', 'md:max-w-5xl');
    expect(screen.getByTestId('matching-tab-error')).toHaveClass('max-w-3xl');
    await ui.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it.each([
    {
      consistency: { kind: 'transitioning', nextMismatchCount: 1 } as const,
      message: '시즌 전환을 확인하고 있어요. 잠시만 기다려주세요.',
    },
    {
      consistency: { kind: 'mismatch', nextMismatchCount: 2 } as const,
      message: '홈과 매칭의 시즌 정보가 달라 최신 상태를 다시 확인해야 해요.',
    },
  ])(
    'season $consistency.kind 상태는 action을 합성하지 않고 공통 shell에서 닫는다',
    ({ consistency, message }) => {
      render(
        <MatchingTabView
          state={{
            kind: 'season-matching',
            current: {
              activeMatch: null,
              serverNow: '2026-08-01T00:00:00.000Z',
              roomSelectionDate: null,
              seasonEndDate: '2026-08-31',
              requestSection: {
                quota: { used: 0, limit: 3, remaining: 3 },
                sent: [],
                received: [],
              },
              receivedPendingCount: 0,
              activity: [],
            },
          }}
          consistency={consistency}
          onRetry={async () => undefined}
        />,
      );

      expect(screen.getByTestId('matching-tab-layout')).toBeInTheDocument();
      expect(screen.getByText(message)).toBeInTheDocument();
      expect(screen.queryByTestId('matching-current-sections-slot')).not.toBeInTheDocument();
    },
  );

  it('optional counterpart summary는 안전한 기본 이름으로 degrade한다', () => {
    render(
      <MatchingTabView
        state={{
          kind: 'season-post-match',
          activeMatch: {
            id: 'match-1',
            seasonId: 'season-1',
            counterpartUserId: 'user-2',
            counterpartParticipantId: 'participant-2',
            status: 'ACTIVE',
            startedAt: '2026-08-01T00:00:00.000Z',
            endedAt: null,
            endReason: null,
            createdFromRequestId: 'request-1',
            unmatchProgress: {
              state: 'NONE',
              requestedByViewerAt: null,
              requestedByCounterpartAt: null,
              progressCount: 0,
              requiredCount: 2,
              canRequest: false,
              canCancel: false,
              disabledReason: null,
              availableUntil: null,
            },
          },
          historySummary: { seasons: 1, matchedCount: 1, unmatchedCount: 0 },
          activity: [],
        }}
      />,
    );

    expect(screen.getByRole('heading', { name: '매칭된 사용자' })).toBeInTheDocument();
    expect(screen.getByTestId('matching-tab-layout')).toHaveClass('md:max-w-5xl');
  });

  it('수락 confirm 뒤 endpoint를 한 번 호출하고 authoritative overview로 active 전환한다', async () => {
    const user = userEvent.setup();
    const onBadgeCountChange = vi.fn();
    const activeMatch = {
      id: 'active-1',
      seasonId: 'season-1',
      counterpartUserId: 'user-2',
      counterpartParticipantId: 'participant-2',
      counterpartNickname: '도윤',
      counterpartSummary: counterpartSummary('도윤'),
      status: 'ACTIVE',
      startedAt: '2026-08-01T01:00:00.000Z',
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
        canRequest: true,
        canCancel: false,
        disabledReason: null,
        availableUntil: '2026-08-10T00:00:00.000Z',
      },
    };
    const sibling = receivedRequest('PENDING', 'request-2', '민준');
    const systemCancelledSibling = {
      ...sibling,
      status: 'CANCELLED_BY_SYSTEM' as const,
      terminalAt: '2026-08-01T01:00:00.000Z',
      terminalReason: 'CANCELLED_BY_SYSTEM_ACTIVE_MATCH' as const,
      actions: {
        accept: { allowed: false, reason: 'REQUEST_ALREADY_RESOLVED' as const },
        reject: { allowed: false, reason: 'REQUEST_ALREADY_RESOLVED' as const },
        cancel: { allowed: false, reason: 'REQUEST_ALREADY_RESOLVED' as const },
      },
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json(overviewFixture({ receivedRequests: [receivedRequest(), sibling] })),
      )
      .mockResolvedValueOnce(
        Response.json({
          request: { ...receivedRequest(), status: 'ACCEPTED', actions: undefined },
          activeMatch,
        }),
      )
      .mockResolvedValueOnce(
        Response.json(
          overviewFixture({
            receivedRequests: [systemCancelledSibling],
            activeMatch,
            activity: [currentActivity()],
          }),
        ),
      );
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MatchingTab
        viewerId="viewer-1"
        seasonShell={{ id: 'season-1', state: 'SEASON_MATCHING' }}
        onBadgeCountChange={onBadgeCountChange}
      />,
    );

    await screen.findByText('민준');
    await user.click(screen.getAllByRole('button', { name: '수락' })[0]!);
    expect(screen.getByRole('dialog', { name: '매칭 요청을 수락할까요?' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '수락하기' }));

    await screen.findByRole('dialog', { name: '매칭 완료' });
    expect(screen.getByText('요청 1건 자동 종료')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/matches/requests/request-1/accept',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(fetchMock.mock.calls.filter(([path]) => path === '/api/matches/overview')).toHaveLength(
      2,
    );
    await waitFor(() => expect(onBadgeCountChange).toHaveBeenLastCalledWith(0));
  });

  it('stale 수락은 raw message 없이 refetch한 system-cancelled row와 public feedback으로 수렴한다', async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json(overviewFixture()))
      .mockResolvedValueOnce(
        Response.json({ message: 'raw upstream target hidden' }, { status: 409 }),
      )
      .mockResolvedValueOnce(
        Response.json(
          overviewFixture({
            receivedRequests: [receivedRequest('CANCELLED_BY_SYSTEM')],
            activity: [
              currentActivity({
                requestTerminalReason: 'MATCH_PRECONDITION_FAILED',
                systemCancellationCause: null,
                systemCancellationGroupId: null,
              }),
            ],
          }),
        ),
      );
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MatchingTab
        viewerId="viewer-1"
        seasonShell={{ id: 'season-1', state: 'SEASON_MATCHING' }}
      />,
    );

    await user.click(await screen.findByRole('button', { name: '수락' }));
    await user.click(screen.getByRole('button', { name: '수락하기' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '매칭 상태가 변경되었어요. 최신 상태를 다시 확인해주세요.',
    );
    expect(screen.getByText('요청 1건 자동 종료')).toBeInTheDocument();
    expect(screen.queryByText(/raw upstream target hidden/)).not.toBeInTheDocument();
  });

  it('active profile은 request token 없이 current MATCHED_PARTNER result-read를 다시 확인한다', async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json(overviewFixture({ receivedRequests: [], activeMatch: currentActiveMatch() })),
      )
      .mockResolvedValueOnce(
        Response.json(createPublicProfileFull({ id: 'user-2', nickname: '도윤' })),
      );
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MatchingTab
        viewerId="viewer-1"
        seasonShell={{ id: 'season-1', state: 'SEASON_MATCHING' }}
      />,
    );

    await user.click(await screen.findByRole('button', { name: '도윤 프로필 상세 보기' }));
    const dialog = await screen.findByRole('dialog', { name: '확정된 룸메이트 프로필' });
    expect(dialog).toBeInTheDocument();
    expect(
      within(dialog).getByRole('heading', { name: '생활패턴 적합도 분석 결과' }),
    ).toBeInTheDocument();
    const detailUrl = new URL(String(fetchMock.mock.calls[1]?.[0]), 'http://localhost');
    expect(detailUrl.pathname).toBe('/api/profiles/user-2');
    expect(detailUrl.search).toBe('');
  });

  it('active result-read가 tombstone이면 full detail 대신 최소 결과만 표시한다', async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json(overviewFixture({ receivedRequests: [], activeMatch: currentActiveMatch() })),
      )
      .mockResolvedValueOnce(
        Response.json(
          createPublicProfileTombstone({
            id: 'user-2',
            resultRead: { resultReadable: true, context: 'CURRENT_MATCHED_PARTNER' },
            tombstone: {
              reason: 'DETAIL_CONTEXT_NO_LONGER_VALID',
              displayName: '탈퇴한 사용자',
              message: '현재는 상대 프로필 상세 정보를 볼 수 없어요.',
            },
          }),
        ),
      );
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MatchingTab
        viewerId="viewer-1"
        seasonShell={{ id: 'season-1', state: 'SEASON_MATCHING' }}
      />,
    );

    await user.click(await screen.findByRole('button', { name: '도윤 프로필 상세 보기' }));
    const dialog = await screen.findByRole('dialog', { name: '확정된 룸메이트 프로필' });
    expect(within(dialog).getByText('상대가 시즌 참여를 철회했어요.')).toBeInTheDocument();
    expect(within(dialog).queryByText('현재 매칭도 92점')).not.toBeInTheDocument();
  });

  it('active result-read의 retryable 오류는 public copy와 같은 관계 맥락의 재시도를 유지한다', async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json(overviewFixture({ receivedRequests: [], activeMatch: currentActiveMatch() })),
      )
      .mockRejectedValueOnce(new Error('raw upstream profile error'))
      .mockResolvedValueOnce(
        Response.json(createPublicProfileFull({ id: 'user-2', nickname: '도윤' })),
      );
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MatchingTab
        viewerId="viewer-1"
        seasonShell={{ id: 'season-1', state: 'SEASON_MATCHING' }}
      />,
    );

    await user.click(await screen.findByRole('button', { name: '도윤 프로필 상세 보기' }));
    const dialog = await screen.findByRole('dialog', { name: '확정된 룸메이트 프로필' });
    expect(within(dialog).getByRole('alert')).toHaveTextContent('프로필을 확인하지 못했어요');
    expect(within(dialog).queryByText(/raw upstream profile error/)).not.toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: '다시 시도' }));
    expect(await within(dialog).findByRole('heading', { name: '도윤' })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('상대 요청에 동의하면 terminal response와 overview refetch 뒤 완료 feedback으로 수렴한다', async () => {
    const user = userEvent.setup();
    const activeMatch = currentActiveMatch({
      unmatchProgress: {
        ...currentActiveMatch().unmatchProgress,
        state: 'WAITING_FOR_ME',
        requestedByCounterpartAt: '2026-08-02T00:00:00.000Z',
        progressCount: 1,
      },
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json(overviewFixture({ receivedRequests: [], activeMatch })))
      .mockResolvedValueOnce(
        Response.json({
          activeMatch: {
            ...activeMatch,
            status: 'UNMATCHED',
            endedAt: '2026-08-02T01:00:00.000Z',
            endReason: 'UNMATCHED_BY_MUTUAL_CONSENT',
            unmatchProgress: {
              ...activeMatch.unmatchProgress,
              state: 'COMPLETED',
              requestedByViewerAt: '2026-08-02T01:00:00.000Z',
              progressCount: 2,
              canRequest: false,
              disabledReason: 'ACTIVE_MATCH_NOT_ACTIONABLE',
            },
          },
        }),
      )
      .mockResolvedValueOnce(
        Response.json(overviewFixture({ receivedRequests: [], activeMatch: null })),
      );
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MatchingTab
        viewerId="viewer-1"
        seasonShell={{ id: 'season-1', state: 'SEASON_MATCHING' }}
      />,
    );

    await user.click(await screen.findByRole('button', { name: '매칭 해제에 동의' }));
    await user.click(screen.getByRole('button', { name: '해제 동의하기' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      '두 사람 모두 동의해 매칭이 해제되었어요.',
    );
    expect(screen.queryByRole('heading', { name: '확정된 룸메이트' })).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/matches/active/active-1/unmatch-request',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
