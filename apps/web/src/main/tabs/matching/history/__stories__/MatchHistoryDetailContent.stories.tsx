import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import {
  createPublicProfileFull,
  createPublicProfileTombstone,
} from '@/test/home-profile-detail-fixtures';
import { MatchHistoryDetailContent } from '../MatchHistoryDetailContent';

const meta = {
  title: 'Main/MatchingTab/Runtime/HistoryDetail',
  component: MatchHistoryDetailContent,
  args: {
    profile: createPublicProfileFull({
      resultRead: { resultReadable: true, context: 'PAST_MATCH_HISTORY' },
      matchScore: 91,
    }),
    loading: false,
    error: null,
  },
} satisfies Meta<typeof MatchHistoryDetailContent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FullSnapshot: Story = {};
export const Tombstone: Story = {
  args: {
    profile: createPublicProfileTombstone({
      tombstone: {
        reason: 'TARGET_NO_LONGER_DISCOVERABLE',
        displayName: '탈퇴한 사용자',
        message: '현재는 상대 프로필 상세 정보를 볼 수 없어요.',
      },
    }),
  },
};
