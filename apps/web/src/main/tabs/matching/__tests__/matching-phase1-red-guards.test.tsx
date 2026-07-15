import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as matchContract from '@repo/shared/match/contract';
import { MatchingTabView } from '../MatchingTab';
import { MatchingTabStorySurface } from '../__stories__/matching-story-renderer';
import { matchingTabStoryScenarios } from '../__stories__/matching-story-scenarios';
import { MATCHING_BASELINE_NOW } from '../__stories__/matching-story-scenarios';
import { MatchingSectionTabs } from '../components/MatchingSectionTabs';
import { MatchRequestSummaryCard } from '../components/MatchRequestSummaryCard';

type FutureMatchContract = {
  readonly matchCapabilityReasonSchema: { readonly options: readonly string[] };
  readonly matchActionDisabledReasonSchema: { readonly options: readonly string[] };
  readonly matchOverviewResponseSchema: {
    readonly shape: Readonly<Record<string, unknown>>;
  };
};

const futureMatchContract = matchContract as typeof matchContract & FutureMatchContract;

beforeEach(() => {
  vi.spyOn(Date, 'now').mockReturnValue(new Date(MATCHING_BASELINE_NOW).getTime());
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Phase 1 policy and contract guards', () => {
  it('Phase 6 regression: canonical POST_MATCH active result는 request/unmatch action을 노출하지 않는다', () => {
    render(
      <MatchingTabView
        state={{
          kind: 'season-post-match',
          activeMatch: {
            id: 'match-1',
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
              disabledReason: null,
              availableUntil: null,
            },
          },
          historySummary: { seasons: 1, matchedCount: 1, unmatchedCount: 0 },
        }}
      />,
    );

    expect(screen.getByText('도윤님과의 확정 결과를 확인할 수 있어요.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '매칭 취소하기' })).not.toBeInTheDocument();
  });

  it('Phase 10 regression: canonical current/past tabs는 stable APG ids를 제공한다', () => {
    render(<MatchingSectionTabs selected="current" onSelect={() => undefined} />);

    expect(screen.getByRole('tablist', { name: '매칭 기록 구분' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '현재 매칭' })).toHaveAttribute(
      'aria-controls',
      'matching-section-panel-current',
    );
    expect(screen.getByRole('tab', { name: '지난 기록' })).toHaveAttribute(
      'aria-controls',
      'matching-section-panel-past',
    );
  });

  it('Phase 10 regression: canonical request runtime은 menu가 아닌 direct action을 유지한다', () => {
    const source = String(MatchRequestSummaryCard);
    expect(source).not.toContain('더보기');
    expect(source).not.toContain('aria-haspopup');
    expect(source).toContain('onDecision');
  });

  it('current confirmation dialog는 alertdialog baseline을 유지한다', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    const ui = userEvent.setup();

    render(<MatchingTabStorySurface scenario={matchingTabStoryScenarios.seasonMatchingReceived} />);
    await ui.click(screen.getByRole('button', { name: '수락하기' }));

    expect(screen.getByRole('alertdialog', { name: '요청 수락' })).toBeInTheDocument();
  });

  it('Phase 2 contract: pair overview는 public capability/action reason taxonomy를 shared contract로 제공한다', () => {
    expect(futureMatchContract.matchCapabilityReasonSchema.options).toEqual([
      'CAMPUS_NOT_OPERATED',
      'VIEWER_NOT_REGISTERED',
      'VIEWER_PROFILE_INCOMPLETE',
      'VIEWER_NOT_ASSIGNED',
      'SEASON_NOT_ACTIONABLE',
      'SAFETY_OR_VISIBILITY_RESTRICTED',
    ]);
    expect(futureMatchContract.matchActionDisabledReasonSchema.options).toEqual([
      'SEASON_NOT_ACTIONABLE',
      'ROOM_SELECTION_CUTOFF',
      'REQUEST_EXPIRED',
      'REQUEST_ALREADY_RESOLVED',
      'MATCH_PRECONDITION_FAILED',
      'ACTIVE_MATCH_NOT_ACTIONABLE',
      'UNMATCH_ALREADY_PENDING',
      'TARGET_UNAVAILABLE',
    ]);
    expect(Object.keys(futureMatchContract.matchOverviewResponseSchema.shape)).toEqual([
      'serverNow',
      'season',
      'capability',
      'sentRequests',
      'receivedRequests',
      'activeMatch',
    ]);
  });
});
