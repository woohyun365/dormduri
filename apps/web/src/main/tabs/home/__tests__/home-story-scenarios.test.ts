import { describe, expect, it } from 'vitest';
import { homeStoryScenarios } from '../__stories__/home-story-scenarios';

describe('homeStoryScenarios S/R/C matrix', () => {
  const matrixScenarioKeys = [
    'seasonMatchingRegisteredS1R0C1',
    'seasonMatchingRegisteredS1R1C1',
  ] as const;

  it('exposes compressed S/R/C story fixtures from the registered matching matrix', () => {
    expect(matrixScenarioKeys).toHaveLength(2);

    matrixScenarioKeys.forEach((key) => {
      expect(homeStoryScenarios[key]).toBeDefined();
    });
  });

  it('S/R/C labels match sent, received, chatting dashboard counts', () => {
    const s1r0c1 = homeStoryScenarios.seasonMatchingRegisteredS1R0C1.dashboard;
    const s1r1c1 = homeStoryScenarios.seasonMatchingRegisteredS1R1C1.dashboard;

    expect(s1r0c1.matching.pendingSentCount).toBe(1);
    expect(s1r0c1.matching.pendingReceivedCount).toBe(0);
    expect(s1r0c1.matching.recentReceivedRequests).toHaveLength(0);
    expect(s1r0c1.matching.activeChatThreadCount).toBe(2);

    expect(s1r1c1.matching.pendingSentCount).toBe(1);
    expect(s1r1c1.matching.pendingReceivedCount).toBe(2);
    expect(s1r1c1.matching.recentReceivedRequests).toHaveLength(2);
    expect(s1r1c1.matching.activeChatThreadCount).toBe(2);
  });

  it('S/R/C story fixtures use different viewer accounts', () => {
    const scenarios = matrixScenarioKeys.map((key) => homeStoryScenarios[key]);
    const emails = scenarios.map((scenario) => scenario.dashboard.viewer.identity.user.email);

    expect(new Set(emails).size).toBe(emails.length);
    expect(emails.every((email) => email.endsWith('@kangwon.ac.kr'))).toBe(true);
  });

  it('received request fixtures mirror BE home-dashboard receiver semantics', () => {
    const s1r1c1 = homeStoryScenarios.seasonMatchingRegisteredS1R1C1.dashboard;

    expect(s1r1c1.matching.pendingSentCount).toBe(1);
    expect(s1r1c1.matching.pendingReceivedCount).toBe(
      s1r1c1.matching.recentReceivedRequests.length,
    );
    expect(s1r1c1.matching.recentReceivedRequests).toHaveLength(2);
    expect(
      s1r1c1.matching.recentReceivedRequests.every(
        (request) =>
          request.direction === 'RECEIVED' &&
          request.counterpartUserId.startsWith('story-1-1p-1p-received-user-') &&
          request.counterpartParticipantId.startsWith('story-1-1p-1p-received-participant-'),
      ),
    ).toBe(true);
  });
});

describe('homeStoryScenarios de-registration and unmatched states', () => {
  it('season open/matching de-registration scenarios use declined lock state', () => {
    const seasonOpen = homeStoryScenarios.seasonOpenDeregistered.dashboard;
    const seasonMatching = homeStoryScenarios.seasonMatchingDeregistered.dashboard;

    [seasonOpen, seasonMatching].forEach((dashboard) => {
      expect(dashboard.viewer.seasonProfile).toMatchObject({
        intent: 'DECLINED',
        registered: false,
        completion: {
          registrationUnavailable: true,
          registrationUnavailableReasons: ['WITHDRAWN_OR_DECLINED_LOCK'],
        },
      });
      expect(dashboard.viewer.capabilities).toMatchObject({
        canEnterRoommateSearch: false,
        canFinalizeSeasonRegistration: false,
        canRequestMatch: false,
        canStartChat: false,
      });
    });
  });

  it('season matching after unmatched has no activeMatch and keeps matching activity surface open', () => {
    const dashboard = homeStoryScenarios.seasonMatchingUnmatched.dashboard;

    expect(dashboard.season.state).toBe('SEASON_MATCHING');
    expect(dashboard.viewer.match.hasActiveMatch).toBe(false);
    expect(dashboard.matching.activeMatch).toBeNull();
    expect(dashboard.matching.activeChatThreadCount).toBe(1);
    expect(dashboard.viewer.capabilities.canRequestMatch).toBe(true);
  });
});

describe('homeStoryScenarios active match matrix', () => {
  it('exposes default, counterpart-requested, and viewer-requested ActiveMatch states', () => {
    expect(
      homeStoryScenarios.seasonMatchingActiveMatch.dashboard.matching.activeMatch,
    ).toMatchObject({
      unmatchProgress: {
        state: 'NONE',
        requestedByViewerAt: null,
        requestedByCounterpartAt: null,
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
        requestedByViewerAt: null,
        requestedByCounterpartAt: '2026-04-05T01:30:00.000Z',
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
        requestedByViewerAt: '2026-04-05T01:30:00.000Z',
        requestedByCounterpartAt: null,
        progressCount: 1,
        canRequest: false,
        canCancel: true,
      },
    });
  });
});
