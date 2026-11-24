import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { authFrame } from '../../../ui/__stories__/frames';
import { LoginScreen } from '../LoginScreen';

// The password step of the login, with each notice of an ended access.

const meta = {
  title: 'Auth/Login',
  component: LoginScreen,
  decorators: [authFrame],
  args: { ended: null },
} satisfies Meta<typeof LoginScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Password: Story = {};

export const EndedIdle: Story = { args: { ended: 'idle' } };

export const EndedExpired: Story = { args: { ended: 'expired' } };

export const LogoutUnconfirmed: Story = { args: { ended: 'unconfirmed' } };
