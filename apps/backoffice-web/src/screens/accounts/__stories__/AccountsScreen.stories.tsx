import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { OWNER_ID, accountList } from '../../../ui/__stories__/fixtures';
import { consoleFrame } from '../../../ui/__stories__/frames';
import { AccountsScreen } from '../AccountsScreen';

// Operator accounts and invitations (owner role) inside the console shell. Fixture accounts only.

const meta = {
  title: 'Accounts/Screen',
  component: AccountsScreen,
  decorators: [consoleFrame],
  args: { data: accountList, selfAccountId: OWNER_ID, canDeactivate: true },
} satisfies Meta<typeof AccountsScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Accounts: Story = {};

export const WithoutDeactivation: Story = { args: { canDeactivate: false } };

export const NoInvitations: Story = {
  args: { data: { ...accountList, invitations: [] } },
};
