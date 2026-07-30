import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { LoginFlowView } from '@/auth/flows/login/LoginFlowView';
import { LOGIN_STORY_BASE_ARGS } from '../fixtures/auth-story-fixtures';

const meta = {
  title: 'Auth/Login/Submission',
  component: LoginFlowView,
  parameters: { layout: 'fullscreen' },
  args: LOGIN_STORY_BASE_ARGS,
} satisfies Meta<typeof LoginFlowView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Pending: Story = {
  args: {
    values: {
      ...LOGIN_STORY_BASE_ARGS.values,
      password: '••••••••••',
    },
    isSubmitting: true,
    isSubmitDisabled: true,
  },
};

export const Redirecting: Story = {
  args: {
    values: {
      ...LOGIN_STORY_BASE_ARGS.values,
      password: '••••••••••',
    },
    isRedirecting: true,
    isSubmitDisabled: true,
  },
};
