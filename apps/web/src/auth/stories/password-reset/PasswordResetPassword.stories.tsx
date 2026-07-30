import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect } from 'storybook/test';
import { PasswordResetFlowView } from '@/auth/flows/password-reset/PasswordResetFlowView';
import { PASSWORD_RESET_STORY_BASE_ARGS } from '../fixtures/auth-story-fixtures';

const passwordState = {
  ...PASSWORD_RESET_STORY_BASE_ARGS.state,
  step: 'newPassword' as const,
  requestedEmail: PASSWORD_RESET_STORY_BASE_ARGS.state.email,
};

const meta = {
  title: 'Auth/Password Reset/Step 3/New Password',
  component: PasswordResetFlowView,
  parameters: { layout: 'fullscreen' },
  args: {
    ...PASSWORD_RESET_STORY_BASE_ARGS,
    state: passwordState,
    stepNumber: 3,
  },
} satisfies Meta<typeof PasswordResetFlowView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Validation: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: '비밀번호 재설정' }));
    await expect(canvas.getByText(/새 비밀번호를 입력/)).toBeVisible();
  },
};

export const RestartRequired: Story = {
  name: 'Restart Required',
  args: {
    status: {
      variant: 'warning',
      title: '인증 시간이 만료됐어요',
      message: '학교 이메일 인증부터 다시 진행해주세요.',
      action: 'restart',
    },
  },
};
