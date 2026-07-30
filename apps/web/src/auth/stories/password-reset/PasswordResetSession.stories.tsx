import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { PasswordResetFlowView } from '@/auth/flows/password-reset/PasswordResetFlowView';
import { PASSWORD_RESET_STORY_BASE_ARGS } from '../fixtures/auth-story-fixtures';

const meta = {
  title: 'Auth/Password Reset/Session/Availability',
  component: PasswordResetFlowView,
  parameters: { layout: 'fullscreen' },
  args: PASSWORD_RESET_STORY_BASE_ARGS,
} satisfies Meta<typeof PasswordResetFlowView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AuthenticatedNotice: Story = {
  name: 'Authenticated Notice',
  args: {
    isAuthenticated: true,
  },
};

export const SessionUnavailable: Story = {
  name: 'Session Unavailable',
  args: {
    isSessionUnavailable: true,
  },
};
