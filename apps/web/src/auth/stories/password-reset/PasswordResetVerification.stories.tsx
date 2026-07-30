import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect } from 'storybook/test';
import { PasswordResetFlowView } from '@/auth/flows/password-reset/PasswordResetFlowView';
import { PASSWORD_RESET_STORY_BASE_ARGS } from '../fixtures/auth-story-fixtures';

const verificationState = {
  ...PASSWORD_RESET_STORY_BASE_ARGS.state,
  step: 'verification' as const,
  requestedEmail: PASSWORD_RESET_STORY_BASE_ARGS.state.email,
  verificationCode: '123456',
};

const meta = {
  title: 'Auth/Password Reset/Step 2/Verification',
  component: PasswordResetFlowView,
  parameters: { layout: 'fullscreen' },
  args: {
    ...PASSWORD_RESET_STORY_BASE_ARGS,
    state: verificationState,
    stepNumber: 2,
  },
} satisfies Meta<typeof PasswordResetFlowView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Invalid: Story = {
  args: {
    onVerifyCodeAction: async () => ({
      success: false,
      fieldErrors: { code: '인증 코드가 올바르지 않습니다.' },
    }),
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: '확인' }));
    await expect(canvas.getByText('인증 코드가 올바르지 않습니다.')).toBeVisible();
  },
};

export const Expired: Story = {
  args: {
    countdown: {
      countdown: 0,
      isActive: false,
      formatTime: () => '00:00',
    },
  },
};
