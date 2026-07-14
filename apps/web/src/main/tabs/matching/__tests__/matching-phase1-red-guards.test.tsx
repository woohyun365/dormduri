import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import * as matchContract from '@repo/shared/match/contract';
import { MatchingTabStorySurface } from '../__stories__/matching-story-renderer';
import { matchingTabStoryScenarios } from '../__stories__/matching-story-scenarios';

type FutureMatchContract = {
  readonly matchCapabilityReasonSchema: { readonly options: readonly string[] };
  readonly matchActionDisabledReasonSchema: { readonly options: readonly string[] };
  readonly matchOverviewResponseSchema: {
    readonly shape: Readonly<Record<string, unknown>>;
  };
};

const futureMatchContract = matchContract as typeof matchContract & FutureMatchContract;

describe('Phase 1 policy and contract guards', () => {
  it.fails(
    'Phase 6 red: POST_MATCH active result는 request/unmatch action을 노출하지 않아야 한다',
    () => {
      render(
        <MatchingTabStorySurface scenario={matchingTabStoryScenarios.seasonPostMatchActive} />,
      );

      expect(screen.queryByRole('button', { name: '매칭 취소하기' })).not.toBeInTheDocument();
    },
  );

  it.fails(
    'Phase 10 red: current/past와 sent/received 전환은 APG tab semantics를 제공해야 한다',
    () => {
      render(
        <MatchingTabStorySurface scenario={matchingTabStoryScenarios.seasonMatchingReceived} />,
      );

      expect(screen.getAllByRole('tablist')).toHaveLength(2);
      expect(screen.getAllByRole('tab')).toHaveLength(4);
    },
  );

  it.fails('Phase 10 red: request menu trigger는 menu ARIA state를 제공해야 한다', () => {
    render(<MatchingTabStorySurface scenario={matchingTabStoryScenarios.seasonMatchingReceived} />);

    expect(screen.getByRole('button', { name: '더보기' })).toHaveAttribute('aria-haspopup', 'menu');
    expect(screen.getByRole('button', { name: '더보기' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
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
