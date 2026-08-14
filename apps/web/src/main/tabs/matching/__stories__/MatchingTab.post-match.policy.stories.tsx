import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, waitFor } from 'storybook/test';
import { MatchingTabView } from '../MatchingTab';
import { offSeasonHistoryContent } from './matching-off-season-story-support';
import { matchingHistorySummary, matchingSeasonStory } from './matching-season-story-fixtures';

const meta = {
  title: 'Main/MatchingTab/Post Match/Policy',
  component: MatchingTabView,
  parameters: {
    docs: {
      description: {
        component:
          'Post Match에는 신규 시즌 등록과 match action이 모두 닫힙니다. 미등록 사용자는 등록 CTA가 아니라 등록 종료 안내와 보존된 지난 기록만 확인합니다.',
      },
    },
  },
} satisfies Meta<typeof MatchingTabView>;

export default meta;
type Story = StoryObj<typeof MatchingTabView>;

export const RegistrationClosed: Story = {
  ...matchingSeasonStory(
    {
      kind: 'unavailable',
      reason: 'VIEWER_NOT_REGISTERED',
      seasonState: 'SEASON_POST_MATCH',
      historySummary: matchingHistorySummary,
    },
    'season-post-match:policy',
    { pastContent: offSeasonHistoryContent() },
  ),
  name: 'Registration Closed',
  play: async ({ canvas }) => {
    await waitFor(() =>
      expect(canvas.getByRole('heading', { name: '이번 시즌 매칭이 종료됐어요' })).toBeVisible(),
    );
    await expect(canvas.queryByRole('button', { name: '시즌 등록 확인하기' })).toBeNull();
    await expect(canvas.getByRole('button', { name: '지난 매칭 기록 보기' })).toBeVisible();
  },
};
