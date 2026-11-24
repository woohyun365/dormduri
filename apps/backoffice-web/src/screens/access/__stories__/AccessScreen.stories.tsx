import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import {
  OWNER_ID,
  accountList,
  pageCursor,
  pendingRequests,
  roleCatalog,
} from '../../../ui/__stories__/fixtures';
import { consoleFrame } from '../../../ui/__stories__/frames';
import { AccessScreen } from '../AccessScreen';

// Role grant and revoke requests inside the console shell: the pending queue with the only approver's own request,
// the request-only view and an empty list.

const meta = {
  title: 'Access/Screen',
  component: AccessScreen,
  decorators: [consoleFrame],
  args: {
    requests: pendingRequests,
    roles: roleCatalog,
    accounts: accountList.accounts,
    selfAccountId: OWNER_ID,
    canRequest: true,
    canApprove: true,
    status: 'PENDING',
    nextPage: pageCursor,
  },
} satisfies Meta<typeof AccessScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PendingQueue: Story = {};

export const RequestOnly: Story = {
  args: { canApprove: false, accounts: null, nextPage: null },
};

export const Empty: Story = { args: { requests: [], status: null, nextPage: null } };
