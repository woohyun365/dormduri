import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect } from 'storybook/test';
import { MatchingTabView } from '../MatchingTab';
import { matchingSeasonStory, matchingSystemStates } from './matching-season-story-fixtures';

const meta = {
  title: 'Main/MatchingTab/System',
  component: MatchingTabView,
  parameters: {
    docs: {
      description: {
        component:
          'Matching BFF loading과 retryable error 상태를 production responsive shell에서 검증합니다.',
      },
    },
  },
} satisfies Meta<typeof MatchingTabView>;

export default meta;
type Story = StoryObj<typeof MatchingTabView>;

export const Loading = {
  ...matchingSeasonStory(matchingSystemStates.loading, 'system:loading-error-recovery'),
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { name: '나님' })).toBeVisible();
    await expect(canvas.getByRole('status', { name: '매칭 정보를 불러오는 중' })).toBeVisible();
  },
} satisfies Story;
const errorRecovery = matchingSeasonStory(
  matchingSystemStates.error,
  'system:loading-error-recovery',
);
export const ErrorRecovery = {
  ...errorRecovery,
  args: { ...errorRecovery.args, onRetry: async () => undefined },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('alert')).toBeVisible();
    await expect(canvas.getByRole('button', { name: '다시 시도' })).toBeVisible();
  },
} satisfies Story;
