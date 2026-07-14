import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { MatchingApiError } from '../api/matching.api';
import MatchingTab, { MatchingTabView } from '../MatchingTab';

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
            season: { id: 'season-1', state: 'SEASON_MATCHING', roomSelectionDate: '2026-08-10' },
            capability: { canViewMatching: true, reason: null },
            sentRequests: [],
            receivedRequests: [],
            activeMatch: null,
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
    await waitFor(() => expect(screen.getByRole('heading', { name: '매칭 현황' })).toHaveFocus());
    await waitFor(() => expect(onBadgeCountChange).toHaveBeenLastCalledWith(0));
    expect(fetch).toHaveBeenCalledWith(
      '/api/matches/overview',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it.each([
    { kind: 'loading' } as const,
    {
      kind: 'unavailable',
      reason: 'VIEWER_NOT_REGISTERED',
    } as const,
    {
      kind: 'off-season',
      historySummary: { seasons: 0, matchedCount: 0, unmatchedCount: 0 },
    } as const,
  ])('loading/denied/season state가 같은 heading과 responsive shell을 사용한다', (state) => {
    const { container } = render(<MatchingTabView state={state} />);

    expect(screen.getByRole('heading', { level: 1, name: '매칭 현황' })).toBeInTheDocument();
    expect(screen.getByTestId('matching-tab-layout')).toBeInTheDocument();
    expect(container.querySelector('main')).not.toBeInTheDocument();
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
              sentRequests: [],
              receivedRequests: [],
              receivedPendingCount: 0,
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
              availableUntil: null,
            },
          },
          historySummary: { seasons: 1, matchedCount: 1, unmatchedCount: 0 },
        }}
      />,
    );

    expect(
      screen.getByText('매칭된 사용자님과의 확정 결과를 확인할 수 있어요.'),
    ).toBeInTheDocument();
  });
});
