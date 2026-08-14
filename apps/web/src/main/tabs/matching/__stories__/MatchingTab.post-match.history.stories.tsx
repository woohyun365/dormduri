import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect } from 'storybook/test';
import { MatchingTabView } from '../MatchingTab';
import { offSeasonHistoryContent } from './matching-off-season-story-support';
import {
  createCurrentActivity,
  createCurrentActivityEntry,
  matchingHistorySummary,
  matchingSeasonStory,
} from './matching-season-story-fixtures';

const meta = {
  title: 'Main/MatchingTab/Post Match/History',
  component: MatchingTabView,
  parameters: {
    docs: {
      description: {
        component:
          'Post Match에 도달하기 전에 시즌 참여를 철회한 사용자도 GET /api/matches/history가 보존한 종료 시즌 이력을 확인합니다. current activity와 과거 season history는 서로 다른 탭에서 분리합니다.',
      },
    },
  },
} satisfies Meta<typeof MatchingTabView>;

export default meta;
type Story = StoryObj<typeof MatchingTabView>;

export const Deregistered: Story = {
  ...matchingSeasonStory(
    {
      kind: 'deregistered',
      seasonState: 'SEASON_POST_MATCH',
      historySummary: matchingHistorySummary,
      activity: createCurrentActivity([
        createCurrentActivityEntry('withdrawn', {
          result: 'REQUEST_CANCELLED',
          requestTerminalReason: 'WITHDRAWN_PARTICIPANT',
        }),
      ]),
    },
    'season-post-match:history',
    { selectedSection: 'past', pastContent: offSeasonHistoryContent() },
  ),
  name: 'Deregistered',
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('tab', { name: '지난 기록' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(canvas.getByRole('button', { name: /2026년 1학기/ })).toBeVisible();
  },
};
