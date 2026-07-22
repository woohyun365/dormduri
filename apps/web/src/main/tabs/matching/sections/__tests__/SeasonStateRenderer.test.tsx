import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SeasonStateRenderer } from '../SeasonStateRenderer';

describe('SeasonStateRenderer', () => {
  it('비시즌 정책 안내는 literal newline 없이 두 줄 DOM으로 렌더링한다', () => {
    const { container } = render(
      <SeasonStateRenderer
        state={{
          kind: 'off-season',
          historySummary: { seasons: 0, matchedCount: 0, unmatchedCount: 0 },
        }}
        requestCommands={{
          accept: async () => 'success' as const,
          reject: async () => 'success' as const,
          cancel: async () => 'success' as const,
          isPending: () => false,
        }}
      />,
    );

    expect(screen.getByText('새 요청과 응답은 다음 시즌에 열려요.')).toBeInTheDocument();
    expect(screen.getByText('이전 시즌 기록은 확인할 수 있어요.')).toBeInTheDocument();
    expect(container).not.toHaveTextContent('\\n');
  });

  it.each([
    [
      { kind: 'off-season', historySummary: { seasons: 0, matchedCount: 0, unmatchedCount: 0 } },
      '현재는 비시즌입니다',
    ],
    [
      { kind: 'season-open', historySummary: { seasons: 0, matchedCount: 0, unmatchedCount: 0 } },
      '시즌 매칭을 기다리고 있어요',
    ],
    [
      {
        kind: 'season-matching',
        current: {
          activeMatch: null,
          serverNow: '2026-08-01T00:00:00.000Z',
          roomSelectionDate: null,
          seasonEndDate: '2026-08-31',
          requestSection: { quota: { used: 0, limit: 3, remaining: 3 }, sent: [], received: [] },
          receivedPendingCount: 2,
          activity: [],
        },
      },
      '현재 요청을 확인해보세요',
    ],
    [
      {
        kind: 'season-post-match',
        activeMatch: null,
        historySummary: { seasons: 0, matchedCount: 0, unmatchedCount: 0 },
        activity: [],
      },
      '활동 이력',
    ],
  ])('official state를 명시적 strategy component로 렌더링한다', (state, text) => {
    render(
      <SeasonStateRenderer
        state={state as never}
        requestCommands={{
          accept: async () => 'success' as const,
          reject: async () => 'success' as const,
          cancel: async () => 'success' as const,
          isPending: () => false,
        }}
      />,
    );
    expect(screen.getByRole('heading', { level: 2, name: text })).toBeInTheDocument();
  });

  it('시즌 준비 화면은 등록 완료와 매칭 기간 대기를 분리해 안내한다', () => {
    render(
      <SeasonStateRenderer
        state={{
          kind: 'season-open',
          historySummary: { seasons: 2, matchedCount: 1, unmatchedCount: 1 },
        }}
        requestCommands={{
          accept: async () => 'success' as const,
          reject: async () => 'success' as const,
          cancel: async () => 'success' as const,
          isPending: () => false,
        }}
      />,
    );

    expect(screen.getByText('시즌 등록을 완료해 주세요.')).toBeInTheDocument();
    expect(screen.getByText('매칭 요청은 시즌 매칭 기간에 열려요.')).toBeInTheDocument();
  });

  it('Post Match ACTIVE는 Season Matching과 같은 main/supporting layout과 전용 안내를 사용한다', () => {
    render(
      <SeasonStateRenderer
        state={{
          kind: 'season-post-match',
          activeMatch: {
            id: 'active-1',
            seasonId: 'season-1',
            counterpartUserId: 'user-2',
            counterpartParticipantId: 'participant-2',
            counterpartNickname: '도윤',
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
              disabledReason: 'SEASON_NOT_ACTIONABLE',
              availableUntil: null,
            },
          },
          roomSelectionDate: '2026-08-10',
          seasonEndDate: '2026-08-31',
          activity: [],
          historySummary: { seasons: 1, matchedCount: 1, unmatchedCount: 0 },
        }}
        requestCommands={{
          accept: async () => 'success' as const,
          reject: async () => 'success' as const,
          cancel: async () => 'success' as const,
          isPending: () => false,
        }}
      />,
    );

    expect(screen.getByTestId('matching-post-match-layout')).toHaveClass(
      'md:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.8fr)]',
    );
    expect(screen.getByRole('complementary', { name: '2인실 매칭 안내' })).toBeVisible();
    expect(screen.getByText('프로필 확인 → 입실 준비')).toBeInTheDocument();
  });
});
