import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { PasswordResetFlowView } from '@/auth/flows/password-reset/PasswordResetFlowView';
import { PASSWORD_RESET_STORY_BASE_ARGS } from '../fixtures/auth-story-fixtures';

const meta = {
  title: 'Auth/Password Reset/Step 1/Email',
  component: PasswordResetFlowView,
  parameters: { layout: 'fullscreen' },
  args: PASSWORD_RESET_STORY_BASE_ARGS,
} satisfies Meta<typeof PasswordResetFlowView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const RateLimited: Story = {
  name: 'Rate Limited',
  args: {
    status: {
      variant: 'warning',
      title: '잠시 후 다시 시도해주세요',
      message: '인증 코드 요청이 많아 42초 동안 전송이 제한됐어요.',
      isRetryAfter: true,
    },
  },
};
