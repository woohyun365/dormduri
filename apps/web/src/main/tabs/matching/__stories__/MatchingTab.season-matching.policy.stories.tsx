import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect } from 'storybook/test';
import { MatchingTabView } from '../MatchingTab';
import { offSeasonHistoryContent } from './matching-off-season-story-support';
import { createSeasonMatchingCurrent, matchingSeasonStory } from './matching-season-story-fixtures';

const meta = {
  title: 'Main/MatchingTab/Season Matching/Policy',
  component: MatchingTabView,
  parameters: {
    docs: {
      description: {
        component:
          'Registration gating for SEASON_MATCHING. A registered, assigned viewer with a complete season profile receives the Current workflow; an unregistered viewer receives the server-owned gate while retained past history stays readable.',
      },
    },
  },
} satisfies Meta<typeof MatchingTabView>;

export default meta;
type SeasonMatchingPolicyStory = StoryObj<typeof MatchingTabView>;

export const RegistrationComplete: SeasonMatchingPolicyStory = {
  ...matchingSeasonStory(
    {
      kind: 'season-matching',
      current: createSeasonMatchingCurrent(),
    },
    'season-matching:registration-gate',
    { pastContent: offSeasonHistoryContent() },
  ),
  name: 'Registration Complete',
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('tab', { name: '현재 매칭' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(canvas.getByRole('heading', { name: '현재 요청을 확인해보세요' })).toBeVisible();
    await expect(canvas.getByText('2인실 매칭 안내')).toBeVisible();
    await expect(canvas.queryByText('시즌 참여 등록 후에 이용 가능해요.')).toBeNull();
  },
};

export const RegistrationRequired: SeasonMatchingPolicyStory = {
  ...matchingSeasonStory(
    {
      kind: 'unavailable',
      reason: 'VIEWER_NOT_REGISTERED',
      seasonState: 'SEASON_MATCHING',
      historySummary: { seasons: 2, matchedCount: 1, unmatchedCount: 0 },
    },
    'season-matching:registration-gate',
    { pastContent: offSeasonHistoryContent() },
  ),
  name: 'Registration Required',
  play: async ({ canvas, userEvent }) => {
    await expect(canvas.getByRole('tab', { name: '현재 매칭' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(canvas.getByText('시즌 참여 등록 후에 이용 가능해요.')).toBeVisible();
    await expect(canvas.getByRole('heading', { name: '시즌 등록이 필요해요' })).toBeVisible();
    await expect(canvas.queryByText('2인실 매칭 안내')).toBeNull();
    await userEvent.click(canvas.getByRole('tab', { name: '지난 기록' }));
    await expect(canvas.getByRole('button', { name: /2026년 1학기/ })).toBeVisible();
  },
};
