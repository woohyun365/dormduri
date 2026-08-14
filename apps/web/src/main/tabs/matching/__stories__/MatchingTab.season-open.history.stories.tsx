import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect } from 'storybook/test';
import { MatchingTabView } from '../MatchingTab';
import { offSeasonHistoryContent, offSeasonStoryState } from './matching-off-season-story-support';
import { matchingHistorySummary, matchingSeasonStory } from './matching-season-story-fixtures';

const seasonOpenState = {
  kind: 'season-open',
  historySummary: offSeasonStoryState.historySummary,
} as const;

const meta = {
  title: 'Main/MatchingTab/Season Open/History',
  component: MatchingTabView,
  parameters: {
    docs: {
      description: {
        component:
          'SEASON_OPEN archive scenarios. Matching actions remain closed, so the production history section is the default surface while season registration stays available from its owner screen.',
      },
    },
  },
} satisfies Meta<typeof MatchingTabView>;

export default meta;
type SeasonOpenHistoryStory = StoryObj<typeof MatchingTabView>;

export const SeasonHistory: SeasonOpenHistoryStory = {
  ...matchingSeasonStory(seasonOpenState, 'season-open:history', {
    pastContent: offSeasonHistoryContent(),
  }),
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

export const EmptyHistory: SeasonOpenHistoryStory = {
  ...matchingSeasonStory(
    {
      kind: 'season-open',
      historySummary: { seasons: 0, matchedCount: 0, unmatchedCount: 0 },
    },
    'season-open:history',
    {
      pastContent: offSeasonHistoryContent({ items: [] }, undefined, { current: null, past: [] }),
    },
  ),
  name: 'Empty History',
};

export const Deregistered: SeasonOpenHistoryStory = {
  ...matchingSeasonStory(
    {
      kind: 'deregistered',
      seasonState: 'SEASON_OPEN',
      historySummary: matchingHistorySummary,
      activity: [],
    },
    'season-open:history',
    { selectedSection: 'past', pastContent: offSeasonHistoryContent() },
  ),
  name: 'Deregistered',
};
