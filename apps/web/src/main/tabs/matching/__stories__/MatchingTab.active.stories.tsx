import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import type { CurrentActiveMatchSummary } from '@repo/shared/match/contract';
import { ActiveMatchSection } from '../sections/active/ActiveMatchSection';

function activeMatch(
  overrides: Partial<CurrentActiveMatchSummary> = {},
): CurrentActiveMatchSummary {
  return {
    id: 'active-story-1',
    seasonId: 'season-2026-2',
    counterpartUserId: 'user-story-2',
    counterpartParticipantId: 'participant-story-2',
    counterpartNickname: '아주 긴 닉네임을 가진 도윤 룸메이트',
    counterpartSummary: {
      id: 'user-story-2',
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
        nickname: '아주 긴 닉네임을 가진 도윤 룸메이트',
        intro: '서로의 수면 시간과 공부 시간을 존중하면서 차분하게 생활하고 싶어요.',
        smokingBehavior: 'NO',
        sleepHabit: null,
        relationshipStyle: null,
      },
      matchScore: 91,
    },
    status: 'ACTIVE',
    startedAt: '2026-08-01T03:00:00.000Z',
    endedAt: null,
    endReason: null,
    createdFromRequestId: 'request-story-1',
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

const commands = {
  requestUnmatch: async () => 'success' as const,
  cancelUnmatchRequest: async () => 'success' as const,
  isPending: () => false,
};

const meta = {
  title: 'Main/MatchingTab/Runtime/ActiveMatch',
  component: ActiveMatchSection,
  args: {
    activeMatch: activeMatch(),
    readOnly: false,
    commands,
    onNavigateChat: () => undefined,
  },
  parameters: {
    docs: {
      description: {
        component:
          'pair-only current ACTIVE relation, mutual unmatch progress, server profile/score/chat capability와 POST_MATCH read-only 변형을 검증합니다.',
      },
    },
  },
} satisfies Meta<typeof ActiveMatchSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NoConsent: Story = {};
export const ViewerRequested: Story = {
  args: {
    activeMatch: activeMatch({
      unmatchProgress: {
        ...activeMatch().unmatchProgress,
        state: 'WAITING_FOR_COUNTERPART',
        requestedByViewerAt: '2026-08-02T03:00:00.000Z',
        progressCount: 1,
        canRequest: false,
        canCancel: true,
      },
    }),
  },
};
export const CounterpartRequested: Story = {
  args: {
    activeMatch: activeMatch({
      unmatchProgress: {
        ...activeMatch().unmatchProgress,
        state: 'WAITING_FOR_ME',
        requestedByCounterpartAt: '2026-08-02T03:00:00.000Z',
        progressCount: 1,
      },
    }),
  },
};
export const CutoffClosed: Story = {
  args: {
    activeMatch: activeMatch({
      unmatchProgress: {
        ...activeMatch().unmatchProgress,
        canRequest: false,
        disabledReason: 'ROOM_SELECTION_CUTOFF',
      },
    }),
  },
};
export const ScoreHidden: Story = {
  args: {
    activeMatch: activeMatch({
      counterpartSummary: {
        ...activeMatch().counterpartSummary!,
        exposure: { ...activeMatch().counterpartSummary!.exposure, scoreVisible: false },
        matchScore: undefined,
      },
      matchScore: undefined,
    }),
  },
};
export const PartialSummary: Story = {
  args: { activeMatch: activeMatch({ counterpartSummary: undefined, matchScore: undefined }) },
};
export const PostMatchReadOnly: Story = {
  args: { activeMatch: activeMatch(), readOnly: true, commands: undefined },
};
