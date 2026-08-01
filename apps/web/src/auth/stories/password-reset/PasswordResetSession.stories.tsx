import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect } from 'storybook/test';
import { AuthSessionTransition } from '@/auth/components';
import { PASSWORD_RESET_STORY_BASE_ARGS } from '../fixtures/auth-story-fixtures';
import { PasswordResetFlowStoryScenario } from '../fixtures/password-reset/PasswordResetFlowStoryScenario';

type PasswordResetSessionStoryState = 'checking' | 'redirecting' | 'unavailable';

interface PasswordResetSessionStoryProps {
  state: PasswordResetSessionStoryState;
}

function PasswordResetSessionStory({ state }: PasswordResetSessionStoryProps) {
  if (state !== 'unavailable') {
    return <AuthSessionTransition state={state} />;
  }

  return (
    <PasswordResetFlowStoryScenario {...PASSWORD_RESET_STORY_BASE_ARGS} isSessionUnavailable />
  );
}

const meta = {
  title: 'Auth/Password Reset/Session',
  component: PasswordResetSessionStory,
  parameters: { layout: 'fullscreen' },
  args: {
    state: 'checking',
  },
} satisfies Meta<typeof PasswordResetSessionStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SessionChecking: Story = {
  name: 'Session Checking',
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('status')).toHaveAttribute('data-state', 'checking');
    await expect(canvas.getByText('로그인 상태를 확인하고 있어요')).toBeVisible();
    await expect(canvas.queryByLabelText('학교 이메일')).not.toBeInTheDocument();
  },
};

export const AuthenticatedRedirect: Story = {
  name: 'Authenticated Redirect',
  args: {
    state: 'redirecting',
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('status')).toHaveAttribute('data-state', 'redirecting');
    await expect(canvas.getByText('로그인되어 있어요')).toBeVisible();
    await expect(canvas.getByText('메인으로 이동하고 있어요.')).toBeVisible();
    await expect(canvas.queryByLabelText('학교 이메일')).not.toBeInTheDocument();
  },
};

export const SessionUnavailable: Story = {
  name: 'Session Unavailable',
  args: {
    state: 'unavailable',
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('로그인 상태를 확인하지 못했어요')).toBeVisible();
    await expect(canvas.getByText('비밀번호 재설정은 계속할 수 있어요.')).toBeVisible();
    await expect(canvas.getByRole('button', { name: '다시 확인' })).toBeEnabled();
    await expect(canvas.getByRole('button', { name: '인증 코드 받기' })).toBeEnabled();
  },
};
