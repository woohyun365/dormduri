import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { PasswordResetFlowView } from '@/auth/flows/password-reset/PasswordResetFlowView';
import { PASSWORD_RESET_STORY_BASE_ARGS } from '../fixtures/auth-story-fixtures';

const meta = {
  title: 'Auth/Password Reset/Result/Complete',
  component: PasswordResetFlowView,
  parameters: { layout: 'fullscreen' },
  args: {
    ...PASSWORD_RESET_STORY_BASE_ARGS,
    state: {
      ...PASSWORD_RESET_STORY_BASE_ARGS.state,
      step: 'complete',
    },
    stepNumber: 3,
  },
} satisfies Meta<typeof PasswordResetFlowView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Success: Story = {};
