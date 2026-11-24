import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { consoleFrame } from '../../../ui/__stories__/frames';
import { SecurityScreen } from '../SecurityScreen';

// The operator's own credentials inside the console shell: ready, and without recovery means.

const meta = {
  title: 'Security/Screen',
  component: SecurityScreen,
  decorators: [consoleFrame],
  args: { passkeyCount: 2, totpConfirmed: true, recoveryCodesRemaining: 10 },
} satisfies Meta<typeof SecurityScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Ready: Story = {};

export const RecoveryMissing: Story = {
  args: { passkeyCount: 1, totpConfirmed: false, recoveryCodesRemaining: 0 },
};
