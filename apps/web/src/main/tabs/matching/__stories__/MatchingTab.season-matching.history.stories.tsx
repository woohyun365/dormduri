import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect } from 'storybook/test';
import { MatchingTabView } from '../MatchingTab';
import { offSeasonHistoryContent } from './matching-off-season-story-support';
import {
  createCurrentActivity,
  createCurrentActivityEntry,
  createSeasonMatchingCurrent,
  matchingHistorySummary,
  matchingSeasonStory,
} from './matching-season-story-fixtures';

const meta = {
  title: 'Main/MatchingTab/Season Matching/History',
  component: MatchingTabView,
  parameters: {
    docs: {
      description: {
        component:
          'Read-only ended-season archive during SEASON_MATCHING. Current requests and active relations remain owned by the Current tab; this tab reuses the production MatchHistorySection without mixing current-season data into history.',
      },
    },
  },
} satisfies Meta<typeof MatchingTabView>;

export default meta;
type SeasonMatchingHistoryStory = StoryObj<typeof MatchingTabView>;

export const SeasonHistory: SeasonMatchingHistoryStory = {
  ...matchingSeasonStory(
    {
      kind: 'season-matching',
      current: createSeasonMatchingCurrent(),
    },
    'season-matching:history',
    {
      selectedSection: 'past',
      pastContent: offSeasonHistoryContent(),
    },
  ),
  name: 'Season History',
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('tab', { name: '지난 기록' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(canvas.getByRole('button', { name: /2026년 1학기/ })).toHaveTextContent(
      '대화한 상대',
    );
  },
};

export const EmptyHistory: SeasonMatchingHistoryStory = {
  ...matchingSeasonStory(
    {
      kind: 'season-matching',
      current: createSeasonMatchingCurrent(),
    },
    'season-matching:history',
    {
      selectedSection: 'past',
      pastContent: offSeasonHistoryContent({ items: [] }, undefined, { current: null, past: [] }),
    },
  ),
  name: 'Empty History',
};

export const Deregistered: SeasonMatchingHistoryStory = {
  ...matchingSeasonStory(
    {
      kind: 'deregistered',
      seasonState: 'SEASON_MATCHING',
      historySummary: matchingHistorySummary,
      activity: createCurrentActivity([
        createCurrentActivityEntry('withdrawn-history', {
          result: 'REQUEST_CANCELLED',
          requestTerminalReason: 'WITHDRAWN_PARTICIPANT',
        }),
      ]),
    },
    'season-matching:history',
    { selectedSection: 'past', pastContent: offSeasonHistoryContent() },
  ),
  name: 'Deregistered',
};
