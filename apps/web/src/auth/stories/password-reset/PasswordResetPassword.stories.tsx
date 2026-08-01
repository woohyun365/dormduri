import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect } from 'storybook/test';
import { PASSWORD_RESET_COPY } from '@/auth/flows/password-reset/model/password-reset-copy';
import { PASSWORD_RESET_STORY_BASE_ARGS } from '../fixtures/auth-story-fixtures';
import { PasswordResetFlowStoryScenario } from '../fixtures/password-reset/PasswordResetFlowStoryScenario';

const passwordState = {
  step: 'newPassword' as const,
  operation: 'idle' as const,
  email: PASSWORD_RESET_STORY_BASE_ARGS.state.email,
  newPassword: '',
  confirmPassword: '',
  grantExpiresAt: Date.now() + 900_000,
};

const meta = {
  title: 'Auth/Password Reset/Step 2 New Password',
  component: PasswordResetFlowStoryScenario,
  parameters: { layout: 'fullscreen' },
  args: {
    ...PASSWORD_RESET_STORY_BASE_ARGS,
    state: passwordState,
  },
} satisfies Meta<typeof PasswordResetFlowStoryScenario>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const ValidationError: Story = {
  name: 'Validation Error',
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: '새 비밀번호 저장' }));
    await expect(canvas.getByText(/새 비밀번호를 입력/)).toBeVisible();
  },
};

export const PasswordConfirmationMismatch: Story = {
  name: 'Password Confirmation Mismatch',
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(
      canvas.getByLabelText(/^새 비밀번호/, { selector: 'input' }),
      'SafePassword123',
    );
    await userEvent.type(
      canvas.getByLabelText(/^비밀번호 확인/, { selector: 'input' }),
      'DifferentPassword123',
    );
    await userEvent.click(canvas.getByRole('button', { name: '새 비밀번호 저장' }));

    await expect(canvas.getByText('비밀번호가 일치하지 않습니다.')).toBeVisible();
  },
};

export const SamePassword: Story = {
  name: 'Same Password',
  args: {
    state: {
      ...passwordState,
      newPassword: 'SamePassword123',
      confirmPassword: 'SamePassword123',
    },
    onResetPasswordAction: async () => ({
      success: false,
      code: 'AUTH_PASSWORD_UNCHANGED',
      fieldErrors: {
        newPassword: '현재 비밀번호와 동일한 비밀번호는 사용할 수 없습니다.',
      },
    }),
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: '새 비밀번호 저장' }));

    await expect(
      canvas.getByText('현재 비밀번호와 동일한 비밀번호는 사용할 수 없습니다.'),
    ).toBeVisible();
    await expect(canvas.queryByTestId('password-reset-feedback-region')).not.toBeInTheDocument();
  },
};

export const GrantExpired: Story = {
  name: 'Grant Expired',
  args: {
    state: {
      ...passwordState,
      newPassword: 'SafePassword123',
      confirmPassword: 'SafePassword123',
      grantExpiresAt: Date.now() - 1,
    },
    onResetPasswordAction: async () => ({ success: false, restartRequired: true }),
  },
};

export const Submitting: Story = {
  args: {
    state: {
      ...passwordState,
      operation: 'submitting',
    },
  },
};

export const NetworkUnavailable: Story = {
  name: 'Network Unavailable',
  args: {
    actionFeedbackTrigger: 'reset',
    onResetPasswordAction: async () => ({ success: false }),
    state: {
      ...passwordState,
      newPassword: 'SafePassword123',
      confirmPassword: 'SafePassword123',
    },
    status: {
      variant: 'error',
      kind: 'network',
      title: PASSWORD_RESET_COPY.status.resetPasswordNetworkTitle,
      message: PASSWORD_RESET_COPY.status.defaultNetworkError,
    },
  },
};
