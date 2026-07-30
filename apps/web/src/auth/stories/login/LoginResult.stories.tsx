import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { LoginFlowView } from '@/auth/flows/login/LoginFlowView';
import { LOGIN_STORY_BASE_ARGS, LOGIN_STORY_ERRORS } from '../fixtures/auth-story-fixtures';

const meta = {
  title: 'Auth/Login/Result',
  component: LoginFlowView,
  parameters: { layout: 'fullscreen' },
  args: LOGIN_STORY_BASE_ARGS,
} satisfies Meta<typeof LoginFlowView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const InvalidCredentials: Story = {
  name: 'Invalid Credentials',
  args: {
    uiError: LOGIN_STORY_ERRORS.invalidCredentials,
  },
};

export const Locked: Story = {
  args: {
    uiError: LOGIN_STORY_ERRORS.locked,
    isLocked: true,
    isSubmitDisabled: true,
    cooldownLabel: '04:44',
  },
};

export const Throttled: Story = {
  args: {
    uiError: LOGIN_STORY_ERRORS.throttled,
    isSubmitDisabled: true,
    cooldownLabel: '00:42',
  },
};

export const NetworkError: Story = {
  name: 'Network Error',
  args: {
    uiError: LOGIN_STORY_ERRORS.network,
  },
};

export const ServerUnavailable: Story = {
  name: 'Server Unavailable',
  args: {
    uiError: LOGIN_STORY_ERRORS.serverUnavailable,
  },
};

export const ResetComplete: Story = {
  name: 'Reset Complete',
  args: {
    routeStatus: {
      variant: 'success',
      title: '비밀번호가 변경되었어요',
      message: '새 비밀번호로 다시 로그인해주세요.',
    },
  },
};
