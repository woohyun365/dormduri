import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, waitFor } from 'storybook/test';
import { answerBff, bffWaiting } from '../../../ui/__stories__/bff-stub';
import {
  OWNER_ID,
  accountList,
  invitationCreated,
  longAccountList,
  manyAccountList,
} from '../../../ui/__stories__/fixtures';
import { consoleFrame } from '../../../ui/__stories__/frames';
import { AccountsScreen } from '../AccountsScreen';

// Operator accounts and invitations (owner role) inside the console shell. Fixture accounts only. The invite drawer,
// the one-time invitation code and the deactivation dialog open the way the owner opens them.

const meta = {
  title: 'Accounts/Screen',
  component: AccountsScreen,
  decorators: [consoleFrame],
  args: { data: accountList, selfAccountId: OWNER_ID, canDeactivate: true },
  parameters: { nextjs: { navigation: { pathname: '/accounts' } } },
} satisfies Meta<typeof AccountsScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Accounts: Story = {};

/** Fifty rows for the row height. */
export const Rows: Story = { args: { data: manyAccountList } };

/** A long Korean name and a long address break at spaces, a word longer than its cell inside it (design guide ⑦). */
export const LongNames: Story = { args: { data: longAccountList } };

const openInvite: NonNullable<Story['play']> = async ({ canvas, userEvent }) => {
  await userEvent.click(canvas.getByRole('button', { name: '운영자 초대' }));
  await canvas.findByRole('dialog', { name: '운영자 초대' });
};

/** The invitation in the right drawer. */
export const InviteDrawer: Story = { play: openInvite };

/** A submit in flight: the drawer stays open until its answer comes, so a failure has a place to show. */
export const InviteSubmitting: Story = {
  beforeEach: () => answerBff({ '/api/accounts/invitations': bffWaiting() }),
  play: async (context) => {
    const { canvas, userEvent } = context;
    await openInvite(context);
    await userEvent.type(canvas.getByLabelText('이메일'), 'new-operator@example.test');
    await userEvent.type(canvas.getByLabelText('이름'), '새 운영자');
    await userEvent.click(canvas.getByRole('button', { name: '초대 code 만들기' }));
    const drawer = canvas.getByRole('dialog', { name: '운영자 초대' });
    await waitFor(() => expect(canvas.getByRole('button', { name: '닫기' })).toBeDisabled());
    await userEvent.keyboard('{Escape}');
    await expect(drawer).toBeInTheDocument();
    await expect(drawer).toHaveAttribute('open');
  },
};

/** The invitation code shown once under the page title after the drawer closed. */
export const InvitationIssued: Story = {
  beforeEach: () => answerBff({ '/api/accounts/invitations': invitationCreated }),
  play: async (context) => {
    const { canvas, userEvent } = context;
    await openInvite(context);
    await userEvent.type(canvas.getByLabelText('이메일'), 'new-operator@example.test');
    await userEvent.type(canvas.getByLabelText('이름'), '새 운영자');
    await userEvent.click(canvas.getByRole('button', { name: '초대 code 만들기' }));
    await canvas.findByTestId('invitation-code');
  },
};

const openDeactivation: NonNullable<Story['play']> = async ({ canvas, userEvent }) => {
  await userEvent.click(canvas.getAllByRole('button', { name: /^비활성화/u })[0]!);
  await canvas.findByRole('alertdialog', { name: '계정 비활성화' });
};

/** The deactivation confirmed in a centered dialog with its reason. */
export const DeactivationForm: Story = { play: openDeactivation };

/** The dialog closed and the result shows under the page title. */
export const Deactivated: Story = {
  beforeEach: () => answerBff({ [`/api/accounts/${accountList.accounts[1]!.id}/deactivate`]: {} }),
  play: async (context) => {
    const { canvas, userEvent } = context;
    await openDeactivation(context);
    await userEvent.type(canvas.getByLabelText('비활성화 사유'), '업무 변경');
    await userEvent.click(canvas.getByRole('button', { name: '비활성화' }));
    const result = await canvas.findByText(
      '계정을 비활성화했습니다. 그 계정의 역할과 접속도 끝났습니다.',
    );
    // The row's button leaves with the refreshed row in the app, so focus waits on the result.
    await waitFor(() => expect(result).toHaveFocus());
  },
};

export const WithoutDeactivation: Story = { args: { canDeactivate: false } };

export const NoInvitations: Story = {
  args: { data: { ...accountList, invitations: [] } },
};
