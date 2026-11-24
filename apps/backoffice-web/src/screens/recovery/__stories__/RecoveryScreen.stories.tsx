import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { authFrame } from '../../../ui/__stories__/frames';
import { RecoveryScreen } from '../RecoveryScreen';

// The recovery session screen: it can only register a new passkey.

const meta = {
  title: 'Auth/Recovery',
  component: RecoveryScreen,
  decorators: [authFrame],
  args: { displayName: '시험 운영자' },
} satisfies Meta<typeof RecoveryScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NewPasskey: Story = {};
