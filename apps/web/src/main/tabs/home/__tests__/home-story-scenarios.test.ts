import { homeDashboardResponseSchema } from '@repo/shared/home';
import { describe, expect, it } from 'vitest';
import { homeStoryScenarios } from '../__stories__/home-story-scenarios';

describe('HomeTab Storybook contract fixtures', () => {
  it('keeps every dashboard fixture aligned with the shared response contract', () => {
    for (const scenario of Object.values(homeStoryScenarios)) {
      expect(() => homeDashboardResponseSchema.parse(scenario.dashboard)).not.toThrow();
    }
  });

  it('preserves representative season registration and capability boundaries', () => {
    expect(homeStoryScenarios.offSeasonNextSeason.dashboard).toMatchObject({
      season: { state: null, isOpen: false, isMatching: false },
      viewer: {
        capabilities: {
          canRequestMatch: false,
          canFinalizeSeasonRegistration: false,
        },
      },
    });
    expect(homeStoryScenarios.seasonOpenDeregistered.dashboard.viewer).toMatchObject({
      seasonProfile: {
        intent: 'DECLINED',
        registered: false,
        completion: {
          registrationUnavailable: true,
          registrationUnavailableReasons: ['WITHDRAWN_OR_DECLINED_LOCK'],
        },
      },
      capabilities: {
        canEnterRoommateSearch: false,
        canFinalizeSeasonRegistration: false,
        canRequestMatch: false,
        canStartChat: false,
      },
    });
    expect(homeStoryScenarios.seasonMatchingRegisteredS1R1C1.dashboard).toMatchObject({
      season: { state: 'SEASON_MATCHING', isMatching: true },
      matching: {
        pendingSentCount: 1,
        pendingReceivedCount: 2,
        activeChatThreadCount: 2,
      },
      viewer: { capabilities: { canRequestMatch: true } },
    });
    expect(homeStoryScenarios.postMatchNotRegistered.dashboard).toMatchObject({
      season: { state: 'SEASON_POST_MATCH', isPostMatch: true },
      viewer: {
        seasonProfile: {
          registered: false,
          hasParticipantRow: false,
          completion: {
            registrationUnavailable: true,
            registrationUnavailableReasons: ['SEASON_NOT_OPEN'],
          },
        },
        capabilities: {
          canRequestMatch: false,
          canFinalizeSeasonRegistration: false,
        },
      },
    });
  });

  it('keeps active-match lifecycle states distinguishable', () => {
    expect(
      homeStoryScenarios.seasonMatchingActiveMatch.dashboard.matching.activeMatch,
    ).toMatchObject({
      status: 'ACTIVE',
      unmatchProgress: {
        state: 'NONE',
        progressCount: 0,
        canRequest: true,
        canCancel: false,
      },
    });
    expect(
      homeStoryScenarios.seasonMatchingActiveMatchCounterpartCancelRequest.dashboard.matching
        .activeMatch,
    ).toMatchObject({
      unmatchProgress: {
        state: 'WAITING_FOR_ME',
        progressCount: 1,
        canRequest: true,
        canCancel: false,
      },
    });
    expect(
      homeStoryScenarios.seasonMatchingActiveMatchSelfCancelRequest.dashboard.matching.activeMatch,
    ).toMatchObject({
      unmatchProgress: {
        state: 'WAITING_FOR_COUNTERPART',
        progressCount: 1,
        canRequest: false,
        canCancel: true,
      },
    });
  });

  it('distinguishes final post-match history outcomes', () => {
    expect(
      homeStoryScenarios.postMatchUnmatched.dashboard.seasonHistorySummary.lastSeason
        ?.viewerActivity.finalResult,
    ).toBe('UNMATCHED_AFTER_SUCCESS');
    expect(
      homeStoryScenarios.postMatchRegisteredNotMatched.dashboard.seasonHistorySummary.lastSeason
        ?.viewerActivity.finalResult,
    ).toBe('NO_MATCH');
    expect(homeStoryScenarios.postMatchMatched.dashboard.matching.activeMatch).toMatchObject({
      status: 'ACTIVE',
      unmatchProgress: { canRequest: false, canCancel: false },
    });
  });

  it('keeps counterpart profile failure as a story-only fallback mode', () => {
    expect(homeStoryScenarios.profileCounterpartError.profileMode).toBe('counterpart-error');
    expect(
      homeStoryScenarios.profileCounterpartError.dashboard.matching.activeMatch,
    ).not.toBeNull();
  });
});
