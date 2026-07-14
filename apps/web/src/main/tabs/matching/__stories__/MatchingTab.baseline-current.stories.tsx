import type { Meta } from '@storybook/nextjs-vite';
import { expect } from 'storybook/test';
import {
  createMatchingStory,
  MATCHING_TAB_BASELINE_DESCRIPTION,
  MatchingTabStorySurface,
  type MatchingTabStory,
} from './matching-story-renderer';
import { matchingTabStoryScenarios } from './matching-story-scenarios';

const meta = {
  title: 'Main/MatchingTab/Baseline/Current',
  component: MatchingTabStorySurface,
  parameters: {
    docs: {
      description: {
        component: MATCHING_TAB_BASELINE_DESCRIPTION,
      },
    },
  },
  argTypes: {
    scenario: {
      table: {
        disable: true,
      },
    },
  },
} satisfies Meta<typeof MatchingTabStorySurface>;

export default meta;

export const OffSeasonCurrent = createMatchingStory(matchingTabStoryScenarios.offSeasonCurrent);
export const SeasonOpenCurrent = createMatchingStory(matchingTabStoryScenarios.seasonOpenCurrent);
export const SeasonMatchingEmpty = createMatchingStory(
  matchingTabStoryScenarios.seasonMatchingEmpty,
);
export const SeasonMatchingSent = createMatchingStory(matchingTabStoryScenarios.seasonMatchingSent);
export const SeasonMatchingReceived = createMatchingStory(
  matchingTabStoryScenarios.seasonMatchingReceived,
);
export const SeasonMatchingActive = createMatchingStory(
  matchingTabStoryScenarios.seasonMatchingActive,
);
export const SeasonMatchingUnmatchPending = createMatchingStory(
  matchingTabStoryScenarios.seasonMatchingUnmatchPending,
);
export const SeasonPostMatchActive = createMatchingStory(
  matchingTabStoryScenarios.seasonPostMatchActive,
);

export const ReceivedRequestMenuSmoke: MatchingTabStory = {
  ...createMatchingStory(matchingTabStoryScenarios.seasonMatchingReceived),
  name: 'SEASON_MATCHING · 받은 요청 메뉴 smoke',
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: '더보기' }));
    await expect(canvas.getByRole('button', { name: '프로필 보기' })).toBeInTheDocument();
  },
};

export const ReceivedRequestAcceptDialogSmoke: MatchingTabStory = {
  ...createMatchingStory(matchingTabStoryScenarios.seasonMatchingReceived),
  name: 'SEASON_MATCHING · 받은 요청 수락 dialog smoke',
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: '수락하기' }));
    await expect(canvas.getByRole('alertdialog', { name: '요청 수락' })).toBeInTheDocument();
  },
};
