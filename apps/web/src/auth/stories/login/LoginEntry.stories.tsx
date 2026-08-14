import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { LoginFlowView } from '@/auth/flows/login/LoginFlowView';
import { LOGIN_STORY_BASE_ARGS } from '../fixtures/auth-story-fixtures';

const meta = {
  title: 'Auth/Login/Entry',
  component: LoginFlowView,
  parameters: { layout: 'fullscreen' },
  args: LOGIN_STORY_BASE_ARGS,
} satisfies Meta<typeof LoginFlowView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Ready: Story = {};

export const RememberMe: Story = {
  name: 'Remember Me',
  args: {
    values: {
      ...LOGIN_STORY_BASE_ARGS.values,
      rememberMe: true,
    },
  },
};

export const SessionChecking: Story = {
  name: 'Session Checking',
  args: {
    sessionTransitionState: 'checking',
  },
};

export const AuthenticatedRedirect: Story = {
  name: 'Authenticated Redirect',
  args: {
    sessionTransitionState: 'redirecting',
  },
};

export const SessionUnavailable: Story = {
  name: 'Session Unavailable',
  args: {
    isSessionUnavailable: true,
  },
};
