import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { answerBff } from '../../../ui/__stories__/bff-stub';
import { OWNER_ID, accountList, invitationCreated } from '../../../ui/__stories__/fixtures';
import { consoleFrame } from '../../../ui/__stories__/frames';
import { AccountsScreen } from '../AccountsScreen';

// Operator accounts and invitations (owner role) inside the console shell. Fixture accounts only. The one-time
// invitation code and the deactivation form open the way the owner opens them.

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

/** The invitation code shown once after the invite form. */
export const InvitationIssued: Story = {
  beforeEach: () => answerBff({ '/api/accounts/invitations': invitationCreated }),
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByLabelText('이메일'), 'new-operator@example.test');
    await userEvent.type(canvas.getByLabelText('이름'), '새 운영자');
    await userEvent.click(canvas.getByRole('button', { name: '초대 code 만들기' }));
    await canvas.findByTestId('invitation-code');
  },
};

/** The reason form under the account table. */
export const DeactivationForm: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getAllByRole('button', { name: '비활성화' })[0]!);
    await canvas.findByRole('form', { name: '계정 비활성화' });
  },
};
