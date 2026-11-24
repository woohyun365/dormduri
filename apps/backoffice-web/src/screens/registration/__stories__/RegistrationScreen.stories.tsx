import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { authFrame } from '../../../ui/__stories__/frames';
import { RegistrationScreen } from '../RegistrationScreen';

// The first step of the invitation registration (invitation code).

const meta = {
  title: 'Auth/Registration',
  component: RegistrationScreen,
  decorators: [authFrame],
} satisfies Meta<typeof RegistrationScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const InvitationCode: Story = {};
