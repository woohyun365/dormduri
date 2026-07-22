import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, waitFor } from 'storybook/test';
import { createPublicProfileFull } from '@/test/home-profile-detail-fixtures';
import { MatchingTabView } from '../MatchingTab';
import { offSeasonHistoryContent } from './matching-off-season-story-support';
import {
  createCurrentActivity,
  createCurrentActivityEntry,
  createMatchingActiveMatch,
  matchingHistorySummary,
  matchingSeasonStory,
} from './matching-season-story-fixtures';

const meta = {
  title: 'Main/MatchingTab/Post Match/Active',
  component: MatchingTabView,
  parameters: {
    docs: {
      description: {
        component:
          'SEASON_POST_MATCH의 현재 시즌 결과와 활동 이력을 함께 확인합니다. 요청 관리는 렌더링하지 않으며, 확정 관계가 있으면 PairMatchCard와 Activity를, 없으면 결과 안내와 Activity를 제공합니다.',
      },
    },
  },
} satisfies Meta<typeof MatchingTabView>;

export default meta;
type Story = StoryObj<typeof MatchingTabView>;

const activePair = createMatchingActiveMatch();
const defaultProfile = createPublicProfileFull();
const activePairNickname = activePair.counterpartNickname ?? '도윤';
const activePairScore = activePair.matchScore ?? 91;
const activePairProfile = createPublicProfileFull({
  id: activePair.counterpartUserId,
  nickname: activePairNickname,
  intro: activePair.counterpartSummary?.profileSummary.intro ?? defaultProfile.intro,
  matchScore: activePairScore,
  compatibility: defaultProfile.compatibility
    ? { ...defaultProfile.compatibility, overallScore: activePairScore }
    : undefined,
});

const matchedActivity = createCurrentActivity([
  createCurrentActivityEntry('received-rejected', {
    counterpartNickname: '새별',
    direction: 'RECEIVED',
    stage: 'RECEIVED_REQUEST',
    occurredAt: '2026-08-02T03:00:00.000Z',
  }),
  createCurrentActivityEntry('matched', {
    counterpartParticipantId: activePair.counterpartParticipantId,
    counterpartNickname: activePairNickname,
    stage: 'MATCH',
    result: 'MATCHED_SUCCESS',
    direction: 'SENT',
    occurredAt: activePair.startedAt,
    requestTerminalReason: 'ACCEPTED',
  }),
  createCurrentActivityEntry('auto-closed', {
    counterpartNickname: '하람',
    result: 'REQUEST_CANCELLED',
    occurredAt: activePair.startedAt,
    requestTerminalReason: 'CANCELLED_BY_SYSTEM_ACTIVE_MATCH',
    systemCancellationCause: 'VIEWER_MATCHED',
    systemCancellationGroupId: activePair.id,
  }),
]);

const unmatchedActivity = createCurrentActivity([
  createCurrentActivityEntry('cancelled', {
    counterpartNickname: '다온',
    result: 'REQUEST_CANCELLED',
    occurredAt: '2026-08-02T03:00:00.000Z',
    requestTerminalReason: 'CANCELLED_BY_REQUESTER',
  }),
  createCurrentActivityEntry('expired', {
    counterpartNickname: '여울',
    direction: 'RECEIVED',
    stage: 'RECEIVED_REQUEST',
    result: 'REQUEST_EXPIRED',
    occurredAt: '2026-08-08T03:00:00.000Z',
    requestTerminalReason: 'EXPIRED',
  }),
]);

export const MatchedResult: Story = {
  ...matchingSeasonStory(
    {
      kind: 'season-post-match',
      activeMatch: activePair,
      roomSelectionDate: '2026-08-10',
      seasonEndDate: '2026-08-31',
      historySummary: matchingHistorySummary,
      activity: matchedActivity,
    },
    'season-post-match:active',
    { pastContent: offSeasonHistoryContent(), onNavigateChat: () => undefined },
    {
      profileByTargetUserId: {
        [activePair.counterpartUserId]: activePairProfile,
      },
    },
  ),
  name: 'Matched Result',
  play: async ({ canvas }) => {
    await waitFor(() => expect(canvas.getByText('이번 시즌 매칭 결과')).toBeVisible());
    await waitFor(() => expect(canvas.getByRole('button', { name: '채팅하기' })).toBeVisible());
    await expect(canvas.getByRole('heading', { name: '활동 이력' })).toBeVisible();
    await expect(canvas.getByText('매칭 완료')).toBeVisible();
    await expect(canvas.queryByText('요청 관리')).not.toBeInTheDocument();
    await expect(canvas.queryByText('매칭 관리')).not.toBeInTheDocument();
  },
};

export const NoMatch: Story = {
  ...matchingSeasonStory(
    {
      kind: 'season-post-match',
      activeMatch: null,
      roomSelectionDate: '2026-08-10',
      seasonEndDate: '2026-08-31',
      historySummary: matchingHistorySummary,
      activity: unmatchedActivity,
    },
    'season-post-match:active',
    { pastContent: offSeasonHistoryContent() },
  ),
  name: 'No Match',
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { name: '활동 이력' })).toBeVisible();
    await expect(canvas.queryByText('이번 시즌 매칭 결과가 없어요')).not.toBeInTheDocument();
    await expect(canvas.getByText('요청 만료')).toBeVisible();
    await expect(canvas.queryByText('요청 관리')).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: /수락|거절|요청 취소/ })).toBeNull();
  },
};
