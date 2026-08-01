import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect } from 'storybook/test';
import { PASSWORD_RESET_STORY_BASE_ARGS } from '../fixtures/auth-story-fixtures';
import { PasswordResetFlowStoryScenario } from '../fixtures/password-reset/PasswordResetFlowStoryScenario';

const meta = {
  title: 'Auth/Password Reset/Result',
  component: PasswordResetFlowStoryScenario,
  parameters: { layout: 'fullscreen' },
  args: {
    ...PASSWORD_RESET_STORY_BASE_ARGS,
    state: {
      step: 'complete',
      operation: 'idle',
    },
  },
} satisfies Meta<typeof PasswordResetFlowStoryScenario>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Success: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { name: '비밀번호가 변경됐어요' })).toBeVisible();
    await expect(canvas.getByText('새 비밀번호로 다시 로그인해 주세요.')).toBeVisible();
    await expect(canvas.getByText('기존 로그인은 모두 종료됐어요.')).toBeVisible();
    await expect(canvas.getByRole('button', { name: '로그인하기' })).toBeEnabled();
  },
};
