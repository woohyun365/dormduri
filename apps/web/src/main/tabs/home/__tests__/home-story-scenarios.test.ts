import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { homeStoryScenarios } from '../__stories__/home-story-scenarios';

describe('HomeTab Storybook source boundary', () => {
  it('uses owner paths and the story API fixture layer instead of deleted component facades', () => {
    const storySource = readFileSync(
      join(process.cwd(), 'src/main/tabs/home/__stories__/HomeTab.stories.tsx'),
      'utf8',
    );

    expect(storySource).toContain('./home-story-api-fixtures');
    expect(storySource).toContain('../layout/HomeDashboardErrorState');
    expect(storySource).not.toContain('../components/');
    expect(storySource).not.toContain('useHomeProfileDetailStoryApiFixtures');
  });

  it('keeps dedicated operations page flow stories connected through HomeTab entries', () => {
    const storySource = readFileSync(
      join(process.cwd(), 'src/main/tabs/home/__stories__/HomeOperationsPageFlow.stories.tsx'),
      'utf8',
    );

    expect(storySource).toContain("title: 'Main/HomeTab/Operations Pages'");
    expect(storySource).toContain('NoticesPageClient');
    expect(storySource).toContain('NotificationsPageClient');
    expect(storySource).toContain('SupportPageClient');
    expect(storySource).toContain('resolveStoryRouteFromHref');
    expect(storySource).toContain('/support?ticketId=');
    expect(storySource).toContain('Notifications / match request received');
    expect(storySource).toContain('Notifications / sent request accepted');
    expect(storySource).toContain('Notifications / sent request rejected');
    expect(storySource).toContain('Notifications / active match created');
    expect(storySource).toContain('Notifications / support reply');
    expect(storySource).toContain('Notifications / report status updated');
    expect(storySource).toContain('Notifications / season notice');
    expect(storySource).toContain('Notifications / chat thread created');
    expect(storySource).toContain('Notifications / empty');
    expect(storySource).toContain('Notifications / error');
    expect(storySource).toContain('Notices / empty');
    expect(storySource).toContain('Support / error');
  });

  it('does not expose operations error states as HomeTab scenarios', () => {
    const storySource = readFileSync(
      join(process.cwd(), 'src/main/tabs/home/__stories__/HomeTab.stories.tsx'),
      'utf8',
    );

    expect(storySource).not.toContain('OperationsPartialError');
    expect(storySource).not.toContain('OperationsAllError');
    expect(homeStoryScenarios).not.toHaveProperty('operationsPartialError');
    expect(homeStoryScenarios).not.toHaveProperty('operationsAllError');
  });
});

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

describe('homeStoryScenarios post-match matrix', () => {
  const postMatchScenarioKeys = [
    'postMatchNotRegistered',
    'postMatchDeregistered',
    'postMatchMatched',
    'postMatchUnmatched',
    'postMatchRegisteredNotMatched',
    'postMatchUserHistory',
    'postMatchRegistrationUnavailable',
  ] as const;

  it('exposes policy-based post-match story fixtures without a separate during-register duplicate', () => {
    expect(postMatchScenarioKeys).toHaveLength(7);

    postMatchScenarioKeys.forEach((key) => {
      expect(homeStoryScenarios[key]).toBeDefined();
      expect(homeStoryScenarios[key].dashboard.season.state).toBe('SEASON_POST_MATCH');
      expect(homeStoryScenarios[key].dashboard.season.isPostMatch).toBe(true);
      expect(homeStoryScenarios[key].dashboard.viewer.capabilities.canRequestMatch).toBe(false);
      expect(
        homeStoryScenarios[key].dashboard.viewer.capabilities.canFinalizeSeasonRegistration,
      ).toBe(false);
    });

    expect(homeStoryScenarios).not.toHaveProperty('postMatchDuringRegister');
  });

  it('post-match not registered and de-registered states keep registration unavailable reasons explicit', () => {
    expect(homeStoryScenarios.postMatchNotRegistered.dashboard.viewer.seasonProfile).toMatchObject({
      registered: false,
      hasParticipantRow: false,
      completion: {
        registrationUnavailable: true,
        registrationUnavailableReasons: ['SEASON_NOT_OPEN'],
      },
    });
    expect(homeStoryScenarios.postMatchNotRegistered.dashboard.viewer.capabilities).toMatchObject({
      canEnterRoommateSearch: true,
      canViewMatchHistory: false,
    });

    expect(homeStoryScenarios.postMatchDeregistered.dashboard.viewer.seasonProfile).toMatchObject({
      intent: 'DECLINED',
      registered: false,
      completion: {
        registrationUnavailable: true,
        registrationUnavailableReasons: ['WITHDRAWN_OR_DECLINED_LOCK'],
      },
    });
    expect(homeStoryScenarios.postMatchDeregistered.dashboard.viewer.capabilities).toMatchObject({
      canEnterRoommateSearch: false,
    });
  });

  it('post-match matched state preserves result-read active match and matched chat only', () => {
    const dashboard = homeStoryScenarios.postMatchMatched.dashboard;

    expect(dashboard.viewer.seasonProfile.registered).toBe(true);
    expect(dashboard.viewer.match.hasActiveMatch).toBe(true);
    expect(dashboard.matching.activeMatch).toMatchObject({
      status: 'ACTIVE',
      unmatchProgress: {
        canRequest: false,
        canCancel: false,
        availableUntil: null,
      },
    });
    expect(dashboard.viewer.capabilities).toMatchObject({
      canStartChat: true,
      canRequestMatch: false,
    });
  });

  it('post-match unmatched and not-matched states distinguish final history semantics', () => {
    expect(
      homeStoryScenarios.postMatchUnmatched.dashboard.seasonHistorySummary.lastSeason
        ?.viewerActivity.finalResult,
    ).toBe('UNMATCHED_AFTER_SUCCESS');
    expect(
      homeStoryScenarios.postMatchRegisteredNotMatched.dashboard.seasonHistorySummary.lastSeason
        ?.viewerActivity.finalResult,
    ).toBe('NO_MATCH');
  });

  it('post-match registration unavailable represents the roomSelectionDate cutoff/during-register case as one state', () => {
    const dashboard = homeStoryScenarios.postMatchRegistrationUnavailable.dashboard;

    expect(dashboard.viewer.seasonProfile).toMatchObject({
      intent: 'UNDECIDED',
      registered: false,
      profileExists: true,
      profileState: 'COMPLETE',
      completion: {
        registrationUnavailable: true,
        registrationUnavailableReasons: ['SEASON_NOT_OPEN'],
      },
      canFinalizeRegistration: false,
    });
    expect(homeStoryScenarios.postMatchRegistrationUnavailable.description).toContain(
      'during register',
    );
  });
});

describe('homeStoryScenarios modal fixture matrix', () => {
  it('keeps active match counterpart profile fallback story explicit and story-only', () => {
    expect(homeStoryScenarios.profileCounterpartError.profileMode).toBe('counterpart-error');
    expect(
      homeStoryScenarios.profileCounterpartError.dashboard.matching.activeMatch,
    ).not.toBeNull();
  });
});
