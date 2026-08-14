import type { StoryObj } from '@storybook/nextjs-vite';
import type { ComponentProps } from 'react';
import { createElement, useState } from 'react';
import type { PublicProfile } from '@repo/shared/profile/contract';
import type {
  CurrentActiveMatchSummary,
  CurrentMatchActivityEntry,
} from '@repo/shared/match/contract';
import { MatchingApiError } from '../api/matching.api';
import { MatchingTabView } from '../MatchingTab';
import type {
  MatchingRequestCardView,
  MatchingRequestSectionView,
} from '../model/matching-request-view';
import type { CurrentMatchingView, MatchingViewState } from '../model/matching-view-model';
import { getMatchingDefaultSection } from '../model/matching-default-section';
import { toCurrentMatchActivityItems } from '../model/matching-current-activity-view';
import {
  canonicalMatchingDesignReviewMatrix,
  matchingDesignReviewParameters,
} from './matching-design-review-matrix';
import { useMatchingStoryProfileApiFixtures } from './matching-story-profile-api-fixtures';

export const matchingHistorySummary = { seasons: 2, matchedCount: 1, unmatchedCount: 0 } as const;
export const matchingViewerHeader = {
  nickname: '나',
  gender: 'M',
  campusLabel: '춘천캠퍼스',
  residenceLabel: '다산관 · 2인실',
} as const;

export function createMatchingRequest(
  id: string,
  direction: 'SENT' | 'RECEIVED',
  overrides: Partial<MatchingRequestCardView> = {},
): MatchingRequestCardView {
  return {
    id,
    counterpartUserId: `user-${id}`,
    direction,
    presentation: 'pending',
    nickname: direction === 'RECEIVED' ? `받은 요청 ${id}` : `보낸 요청 ${id}`,
    facts: [
      { label: '흡연 여부', value: '비흡연' },
      { label: '잠버릇', value: '잠버릇 없음' },
      { label: '관계', value: '각자 생활해요' },
    ],
    intro: '생활 리듬을 존중하며 조용하게 지내고 싶어요.',
    note: direction === 'RECEIVED' ? '서로 배려하면서 지내요.' : null,
    score: 87,
    scoreHiddenCopy: null,
    detailEntryToken: `detail-${id}`,
    canStartChat: false,
    createdAt: '2026-08-01T03:00:00.000Z',
    expiresAt: '2026-08-05T03:00:00.000Z',
    statusLabel: direction === 'RECEIVED' ? '응답 필요' : '수락 대기',
    actions: {
      accept: {
        allowed: direction === 'RECEIVED',
        reason: null,
        reasonCopy: null,
        reasonDescriptionId: null,
      },
      reject: {
        allowed: direction === 'RECEIVED',
        reason: null,
        reasonCopy: null,
        reasonDescriptionId: null,
      },
      cancel: {
        allowed: direction === 'SENT',
        reason: null,
        reasonCopy: null,
        reasonDescriptionId: null,
      },
    },
    ...overrides,
  };
}

export function createMatchingRequestSection(
  sent: readonly MatchingRequestCardView[] = [],
  received: readonly MatchingRequestCardView[] = [],
): MatchingRequestSectionView {
  const used = sent.filter((item) => item.presentation === 'pending').length;
  return {
    quota: { used, limit: 3, remaining: Math.max(0, 3 - used) },
    sent,
    received,
  };
}

export function createSeasonMatchingCurrent(
  overrides: Partial<CurrentMatchingView> = {},
): CurrentMatchingView {
  const requestSection = overrides.requestSection ?? createMatchingRequestSection();
  const activeMatch = overrides.activeMatch ?? null;
  return {
    activeMatch,
    serverNow: '2026-08-01T00:00:00.000Z',
    roomSelectionDate: '2026-08-10',
    seasonEndDate: '2026-08-31',
    requestSection,
    receivedPendingCount: requestSection.received.filter(
      (request) => request.presentation === 'pending',
    ).length,
    activity:
      overrides.activity ??
      (activeMatch
        ? createCurrentActivity([
            createCurrentActivityEntry(`active-${activeMatch.id}`, {
              counterpartParticipantId: activeMatch.counterpartParticipantId,
              counterpartNickname: activeMatch.counterpartNickname ?? '매칭 상대',
              stage: 'MATCH',
              result: 'MATCHED_SUCCESS',
              direction: 'SENT',
              occurredAt: activeMatch.startedAt,
              requestTerminalReason: 'ACCEPTED',
            }),
          ])
        : []),
    ...overrides,
  };
}

export function createCurrentActivityEntry(
  id: string,
  overrides: Partial<CurrentMatchActivityEntry> = {},
): CurrentMatchActivityEntry {
  return {
    id,
    counterpartParticipantId: `participant-${id}`,
    counterpartNickname: '다온',
    stage: 'SENT_REQUEST',
    result: 'REQUEST_REJECTED',
    direction: 'SENT',
    occurredAt: '2026-08-01T03:00:00.000Z',
    requestTerminalReason: 'REJECTED_BY_RECEIVER',
    systemCancellationCause: null,
    systemCancellationGroupId: null,
    activeMatchEndReason: null,
    ...overrides,
  };
}

export function createCurrentActivity(
  entries: readonly CurrentMatchActivityEntry[],
): CurrentMatchingView['activity'] {
  return toCurrentMatchActivityItems(entries);
}

export function createMatchingActiveMatch(
  overrides: Partial<CurrentActiveMatchSummary> = {},
): CurrentActiveMatchSummary {
  return {
    id: 'runtime-match-1',
    seasonId: 'season-2026-2',
    counterpartUserId: 'runtime-user-2',
    counterpartParticipantId: 'runtime-participant-2',
    counterpartNickname: '도윤',
    counterpartSummary: {
      id: 'runtime-user-2',
      sourceProfile: 'SEASON_PARTICIPANT_PROFILE',
      relation: { type: 'MATCHED_PARTNER' },
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
        unavailableReasons: ['VIEWER_ALREADY_MATCHED'],
      },
      resultRead: { resultReadable: true, context: 'CURRENT_MATCHED_PARTNER' },
      profileSummary: {
        nickname: '도윤',
        intro: '서로의 수면 시간과 공부 시간을 존중하면서 차분하게 생활하고 싶어요.',
        smokingBehavior: 'NO',
        sleepHabit: null,
        relationshipStyle: null,
      },
      matchScore: 91,
    },
    status: 'ACTIVE',
    startedAt: '2026-08-04T03:00:00.000Z',
    endedAt: null,
    endReason: null,
    createdFromRequestId: 'runtime-request-1',
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

export function matchingSeasonStory(
  state: MatchingViewState,
  scenario: (typeof canonicalMatchingDesignReviewMatrix)[number],
  args: Omit<Partial<ComponentProps<typeof MatchingTabView>>, 'state'> = {},
  review: {
    readonly longCopy?: boolean;
    readonly profileByTargetUserId?: Readonly<Record<string, PublicProfile>>;
  } = {},
): StoryObj<typeof MatchingTabView> {
  const serverNow =
    state.kind === 'season-matching' ? state.current.serverNow : '2026-08-01T00:00:00.000Z';
  return {
    args: {
      state,
      viewerHeader: matchingViewerHeader,
      selectedSection: getMatchingDefaultSection(state),
      ...args,
    },
    render: (storyArgs) =>
      createElement(MatchingSeasonStoryCanvas, {
        ...storyArgs,
        profileByTargetUserId: review.profileByTargetUserId ?? {},
      }),
    parameters: matchingDesignReviewParameters({ scenario, serverNow, longCopy: review.longCopy }),
  };
}

function MatchingSeasonStoryCanvas(
  props: ComponentProps<typeof MatchingTabView> & {
    readonly profileByTargetUserId: Readonly<Record<string, PublicProfile>>;
  },
) {
  const { profileByTargetUserId, ...viewProps } = props;
  useMatchingStoryProfileApiFixtures(profileByTargetUserId);
  const [selectedSection, setSelectedSection] = useState(
    viewProps.selectedSection ?? getMatchingDefaultSection(viewProps.state),
  );

  return createElement(MatchingTabView, {
    ...viewProps,
    selectedSection,
    onSelectSection: setSelectedSection,
  });
}

export const matchingSystemStates = {
  loading: { kind: 'loading' } as const,
  error: { kind: 'error', error: new MatchingApiError('MATCHING_API_NETWORK') } as const,
};
