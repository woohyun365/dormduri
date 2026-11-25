import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { within } from 'storybook/test';
import { answerBff, bffFailure } from '../../../ui/__stories__/bff-stub';
import {
  OWNER_ID,
  accountList,
  decidedRequests,
  pageCursor,
  pendingRequests,
  roleCatalog,
} from '../../../ui/__stories__/fixtures';
import { consoleFrame } from '../../../ui/__stories__/frames';
import { AccessScreen } from '../AccessScreen';

// Role grant and revoke requests as a master-detail inside the console shell: the pending queue with the only
// approver's own request first and another operator's second, the decided requests, the new request drawer, the
// decision's failures and the empty lists.

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
  parameters: { nextjs: { navigation: { pathname: '/access' } } },
} satisfies Meta<typeof AccessScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

const other = pendingRequests[1]!;

/** The first request (the viewer's own) is chosen; its decision area asks for the self-approval reason. */
export const PendingQueue: Story = {};

const chooseOther: NonNullable<Story['play']> = async ({ canvas, userEvent }) => {
  const list = canvas.getByRole('list', { name: '요청 목록' });
  await userEvent.click(within(list).getAllByRole('button')[1]!);
  await canvas.findByRole('button', { name: '거절' });
};

/** Another operator's request, with approve and reject. */
export const OtherOperator: Story = { play: chooseOther };

const openNewRequest: NonNullable<Story['play']> = async ({ canvas, userEvent }) => {
  await userEvent.click(canvas.getByRole('button', { name: '새 요청' }));
  await canvas.findByRole('dialog', { name: '새 요청' });
};

export const NewRequestDrawer: Story = { play: openNewRequest };

/** Without the account list (no owner role) the target is an account id typed in. */
export const NewRequestWithoutAccounts: Story = {
  args: { accounts: null },
  play: openNewRequest,
};

/** The only approver's own request approved with a reason: who decided, when, why, and the self-approval mark. */
export const DecidedSelfApproved: Story = {
  args: { requests: decidedRequests, status: null, nextPage: null },
};

export const Rejected: Story = {
  args: { requests: [decidedRequests[1]!], status: 'REJECTED', nextPage: null },
};

/** A reject without a reason stays in the decision area. */
export const MissingRejectReason: Story = {
  play: async (context) => {
    await chooseOther(context);
    await context.userEvent.click(context.canvas.getByRole('button', { name: '거절' }));
    await context.canvas.findByText('거절 사유를 적으세요.');
  },
};

/** The drawer closed and the result shows under the page title; the chosen request stays. */
export const RequestCreated: Story = {
  beforeEach: () => answerBff({ '/api/access/requests': pendingRequests[0] }),
  play: async (context) => {
    await openNewRequest(context);
    await context.userEvent.click(context.canvas.getByRole('button', { name: '요청 만들기' }));
    await context.canvas.findByText(
      '권한 요청을 만들었습니다. 다른 승인 권한 운영자가 결정합니다.',
    );
  },
};

/** The request changed or was decided elsewhere: the API's conflict, in the decision area. */
export const Conflict: Story = {
  beforeEach: () =>
    answerBff({ [`/api/access/requests/${other.id}/approve`]: bffFailure(409, 'conflict') }),
  play: async (context) => {
    await chooseOther(context);
    await context.userEvent.click(context.canvas.getByRole('button', { name: '승인' }));
    await context.canvas.findByText(
      '이미 처리됐거나 지금 상태에서는 할 수 없는 작업입니다. 화면을 새로 고쳐 확인하세요.',
    );
  },
};

/** An empty filter result, apart from an empty list, with the way back to every request. */
export const FilteredEmpty: Story = {
  args: { requests: [], status: 'APPROVED', nextPage: null },
};

export const Empty: Story = { args: { requests: [], status: null, nextPage: null } };

export const RequestOnly: Story = {
  args: { canApprove: false, accounts: null, nextPage: null },
};
