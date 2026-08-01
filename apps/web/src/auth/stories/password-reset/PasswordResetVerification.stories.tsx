import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect } from 'storybook/test';
import { PASSWORD_RESET_COPY } from '@/auth/flows/password-reset/model/password-reset-copy';
import { PASSWORD_RESET_STORY_BASE_ARGS } from '../fixtures/auth-story-fixtures';
import { PasswordResetFlowStoryScenario } from '../fixtures/password-reset/PasswordResetFlowStoryScenario';

const verificationState = {
  step: 'verification' as const,
  operation: 'idle' as const,
  email: PASSWORD_RESET_STORY_BASE_ARGS.state.email,
  verificationCode: '123456',
  codeExpiresAt: Date.now() + 593_000,
};

const meta = {
  title: 'Auth/Password Reset/Step 1 School Email Verification/Code',
  component: PasswordResetFlowStoryScenario,
  parameters: { layout: 'fullscreen' },
  args: {
    ...PASSWORD_RESET_STORY_BASE_ARGS,
    state: verificationState,
  },
} satisfies Meta<typeof PasswordResetFlowStoryScenario>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Code: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: '재전송 · 9:53' })).toBeDisabled();
  },
};

export const Verified: Story = {
  args: {
    state: {
      step: 'verified',
      operation: 'idle',
      email: PASSWORD_RESET_STORY_BASE_ARGS.state.email,
      grantExpiresAt: Date.now() + 900_000,
    },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(PASSWORD_RESET_COPY.email.verified)).toBeVisible();
    await expect(
      canvas.getByRole('button', { name: PASSWORD_RESET_COPY.email.next }),
    ).toBeEnabled();
  },
};

export const InvalidCode: Story = {
  name: 'Invalid Code',
  args: {
    onVerifyCodeAction: async () => ({
      success: false,
      fieldErrors: { code: PASSWORD_RESET_COPY.status.verifyFailureMessage },
    }),
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: '인증 확인' }));
    await expect(canvas.getByText(PASSWORD_RESET_COPY.status.verifyFailureMessage)).toBeVisible();
  },
};

export const ResendAvailable: Story = {
  name: 'Resend Available',
  args: {
    countdown: {
      countdown: 0,
      isActive: false,
    },
  },
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole('button', { name: PASSWORD_RESET_COPY.verification.resend }),
    ).toBeEnabled();
  },
};

export const Resending: Story = {
  args: {
    state: {
      ...verificationState,
      operation: 'resending',
    },
    countdown: {
      countdown: 0,
      isActive: false,
    },
  },
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole('button', { name: PASSWORD_RESET_COPY.verification.resending }),
    ).toBeDisabled();
    await expect(
      canvas.getByRole('button', { name: PASSWORD_RESET_COPY.verification.verify }),
    ).toBeDisabled();
  },
};

export const ResendSuccess: Story = {
  name: 'Resend Success',
  args: {
    state: {
      ...verificationState,
      verificationCode: '',
    },
    status: {
      variant: 'success',
      title: PASSWORD_RESET_COPY.status.resendSucceededTitle,
      message: PASSWORD_RESET_COPY.status.resendSucceededMessage,
    },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(PASSWORD_RESET_COPY.status.resendSucceededTitle)).toBeVisible();
    await expect(canvas.getByRole('button', { name: '재전송 · 9:53' })).toBeDisabled();
  },
};

export const ResendFailed: Story = {
  name: 'Resend Failed',
  args: {
    state: verificationState,
    status: {
      variant: 'error',
      title: PASSWORD_RESET_COPY.status.sendCodeFailureTitle,
      message: '새 인증 코드를 보내지 못했어요. 다시 시도해 주세요.',
    },
    countdown: {
      countdown: 0,
      isActive: false,
    },
  },
};

export const TooManyAttempts: Story = {
  name: 'Too Many Attempts',
  args: {
    actionFeedbackTrigger: 'verify',
    onVerifyCodeAction: async () => ({ success: false }),
    status: {
      variant: 'warning',
      kind: 'attempts-exhausted',
      title: PASSWORD_RESET_COPY.status.attemptsExhaustedTitle,
      message: PASSWORD_RESET_COPY.status.attemptsExhaustedMessage,
    },
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      canvas.getByRole('button', { name: PASSWORD_RESET_COPY.verification.verify }),
    );
    await expect(
      canvas.getByRole('button', { name: PASSWORD_RESET_COPY.verification.resend }),
    ).toBeEnabled();
  },
};

export const VerificationNetworkUnavailable: Story = {
  name: 'Verification Network Unavailable',
  args: {
    actionFeedbackTrigger: 'verify',
    onVerifyCodeAction: async () => ({ success: false }),
    status: {
      variant: 'error',
      kind: 'network',
      title: PASSWORD_RESET_COPY.status.verifyCodeNetworkTitle,
      message: PASSWORD_RESET_COPY.status.defaultNetworkError,
    },
  },
};
