import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { PASSWORD_RESET_COPY } from '@/auth/flows/password-reset/model/password-reset-copy';
import { PASSWORD_RESET_STORY_BASE_ARGS } from '../fixtures/auth-story-fixtures';
import { PasswordResetFlowStoryScenario } from '../fixtures/password-reset/PasswordResetFlowStoryScenario';

const meta = {
  title: 'Auth/Password Reset/Step 1 School Email Verification/Request',
  component: PasswordResetFlowStoryScenario,
  parameters: { layout: 'fullscreen' },
  args: PASSWORD_RESET_STORY_BASE_ARGS,
} satisfies Meta<typeof PasswordResetFlowStoryScenario>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Request: Story = {};

export const Submitting: Story = {
  args: {
    state: {
      step: 'email',
      operation: 'submitting',
      email: PASSWORD_RESET_STORY_BASE_ARGS.state.email,
    },
  },
};

export const RateLimited: Story = {
  name: 'Rate Limited',
  args: {
    actionFeedbackTrigger: 'send',
    status: {
      variant: 'warning',
      title: PASSWORD_RESET_COPY.status.retryAfterTitle,
      isRetryAfter: true,
      countdownSeconds: 42,
    },
  },
};

export const RequestNetworkUnavailable: Story = {
  name: 'Request Network Unavailable',
  args: {
    actionFeedbackTrigger: 'send',
    status: {
      variant: 'error',
      kind: 'network',
      title: PASSWORD_RESET_COPY.status.sendCodeNetworkTitle,
      message: PASSWORD_RESET_COPY.status.defaultNetworkError,
    },
  },
};
