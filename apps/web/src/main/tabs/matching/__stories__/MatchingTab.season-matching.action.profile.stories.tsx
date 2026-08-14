import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, within } from 'storybook/test';
import {
  createPublicProfileFull,
  createPublicProfileTombstone,
} from '@/test/home-profile-detail-fixtures';
import { MatchingTabView } from '../MatchingTab';
import {
  createMatchingRequest,
  createMatchingRequestSection,
  createSeasonMatchingCurrent,
  matchingSeasonStory,
} from './matching-season-story-fixtures';
import { offSeasonHistoryContent } from './matching-off-season-story-support';

const meta = {
  title: 'Main/MatchingTab/Season Matching/Action/Profile',
  component: MatchingTabView,
} satisfies Meta<typeof MatchingTabView>;

export default meta;
type Story = StoryObj<typeof MatchingTabView>;

const sentRequest = createMatchingRequest('profile-sent', 'SENT', {
  nickname: '지우',
  score: 92,
});

export const PendingSentRequest: Story = {
  ...matchingSeasonStory(
    {
      kind: 'season-matching',
      current: createSeasonMatchingCurrent({
        requestSection: createMatchingRequestSection([sentRequest]),
      }),
    },
    'season-matching:sent-request',
    { initialRequestTab: 'sent', pastContent: offSeasonHistoryContent() },
    {
      profileByTargetUserId: {
        [sentRequest.counterpartUserId]: createPublicProfileFull({
          id: sentRequest.counterpartUserId,
          nickname: sentRequest.nickname,
          actions: {
            canBookmark: false,
            canRequestMatch: false,
            canStartChat: false,
            unavailableReasons: ['MATCH_REQUEST_ALREADY_PENDING'],
          },
        }),
      },
    },
  ),
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: '지우 프로필 상세 보기' }));
    const dialog = canvas.getByRole('dialog', { name: '요청 상대 프로필' });
    await expect(within(dialog).getByRole('button', { name: '요청 취소' })).toBeVisible();
    await expect(within(dialog).getByRole('button', { name: '신고하기' })).toBeVisible();
    await expect(within(dialog).getByRole('button', { name: '차단하기' })).toBeVisible();
    await expect(dialog).not.toHaveTextContent('public summary');
  },
};

const receivedRequest = createMatchingRequest('profile-received', 'RECEIVED', {
  nickname: '서윤',
  score: 88,
});

export const PendingReceivedRequest: Story = {
  ...matchingSeasonStory(
    {
      kind: 'season-matching',
      current: createSeasonMatchingCurrent({
        requestSection: createMatchingRequestSection([], [receivedRequest]),
      }),
    },
    'season-matching:received-request',
    { pastContent: offSeasonHistoryContent() },
    {
      profileByTargetUserId: {
        [receivedRequest.counterpartUserId]: createPublicProfileFull({
          id: receivedRequest.counterpartUserId,
          nickname: receivedRequest.nickname,
          actions: {
            canBookmark: false,
            canRequestMatch: false,
            canStartChat: true,
            unavailableReasons: ['MATCH_REQUEST_ALREADY_PENDING'],
          },
        }),
      },
    },
  ),
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: '서윤 프로필 상세 보기' }));
    const dialog = canvas.getByRole('dialog', { name: '요청 상대 프로필' });
    await expect(within(dialog).getByRole('button', { name: '수락' })).toBeVisible();
    await expect(within(dialog).queryByRole('button', { name: '거절' })).toBeNull();
    await expect(dialog).not.toHaveTextContent('public summary');
    await userEvent.click(within(dialog).getByRole('button', { name: '수락' }));
    const decisionDialog = canvas.getByRole('dialog', { name: '매칭 요청을 수락할까요?' });
    await userEvent.click(within(decisionDialog).getByRole('button', { name: '돌아가기' }));
    await expect(canvas.getByRole('dialog', { name: '요청 상대 프로필' })).toBeVisible();
  },
};

export const BlockedFromCompatibilityDetail: Story = {
  ...matchingSeasonStory(
    {
      kind: 'season-matching',
      current: createSeasonMatchingCurrent({
        requestSection: createMatchingRequestSection([], [receivedRequest]),
      }),
    },
    'season-matching:received-request',
    { pastContent: offSeasonHistoryContent() },
    {
      profileByTargetUserId: {
        [receivedRequest.counterpartUserId]: createPublicProfileFull({
          id: receivedRequest.counterpartUserId,
          nickname: receivedRequest.nickname,
          actions: {
            canBookmark: false,
            canRequestMatch: false,
            canStartChat: true,
            unavailableReasons: ['MATCH_REQUEST_ALREADY_PENDING'],
          },
        }),
      },
    },
  ),
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: '서윤 프로필 상세 보기' }));
    const profileDialog = canvas.getByRole('dialog', { name: '요청 상대 프로필' });
    await userEvent.click(within(profileDialog).getByRole('button', { name: '차단하기' }));
    const blockDialog = canvas.getByRole('dialog', { name: '룸메이트 차단' });
    await userEvent.click(within(blockDialog).getByRole('button', { name: '차단하기' }));
    await expect(await canvas.findByRole('dialog', { name: '차단을 반영했어요.' })).toBeVisible();
  },
};

const staleRequest = createMatchingRequest('profile-stale', 'SENT', {
  nickname: '하린',
  score: 89,
});

export const TargetUnavailableRace: Story = {
  ...matchingSeasonStory(
    {
      kind: 'season-matching',
      current: createSeasonMatchingCurrent({
        requestSection: createMatchingRequestSection([staleRequest]),
      }),
    },
    'season-matching:sent-request',
    { initialRequestTab: 'sent', pastContent: offSeasonHistoryContent() },
    {
      profileByTargetUserId: {
        [staleRequest.counterpartUserId]: createPublicProfileTombstone({
          id: staleRequest.counterpartUserId,
          relation: { type: 'GENERAL' },
          exposure: {
            listSummaryVisible: false,
            detailViewable: true,
            canViewFull: false,
            scoreVisible: false,
          },
          actions: {
            canBookmark: false,
            canRequestMatch: false,
            canStartChat: false,
            unavailableReasons: ['TARGET_NOT_PUBLIC'],
          },
          resultRead: { resultReadable: false, context: 'NONE' },
          tombstone: {
            reason: 'TARGET_NO_LONGER_DISCOVERABLE',
            displayName: '하린',
            message: '상대 상태가 변경되어 프로필을 볼 수 없어요.',
          },
        }),
      },
    },
  ),
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: '하린 프로필 상세 보기' }));
    const dialog = canvas.getByRole('dialog', { name: '요청 상대 프로필' });
    await expect(dialog).toHaveTextContent('상대가 시즌 참여를 철회했어요.');
    await expect(dialog).toHaveTextContent('상대 상태가 변경되어 프로필을 볼 수 없어요.');
  },
};
