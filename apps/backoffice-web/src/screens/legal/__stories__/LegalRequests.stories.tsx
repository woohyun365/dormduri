import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { answerBff, bffFailure } from '../../../ui/__stories__/bff-stub';
import { OWNER_ID, accountList, activeAuditor, pageCursor } from '../../../ui/__stories__/fixtures';
import { consoleFrame } from '../../../ui/__stories__/frames';
import {
  decidedLegalRequests,
  legalClosedRequestDetail,
  legalDecision,
  legalFirstRequestDetail,
  legalRefusedRequestDetail,
  legalRequestDetail,
  legalRequests,
  legalSelfRequestDetail,
  legalWithdrawRequestDetail,
} from '../../../ui/__stories__/legal-fixtures';
import { Forbidden as ForbiddenPage } from '../../../ui/Forbidden';
import { LegalRequestsScreen } from '../LegalRequestsScreen';

// Legal publish and withdraw requests as a master-detail inside the console shell: the chosen request's comparison or
// whole text, the checks as of now and the decision area that opens approve after the reading mark.

const meta = {
  title: 'Legal/Requests',
  component: LegalRequestsScreen,
  decorators: [consoleFrame],
  args: {
    requests: legalRequests,
    selected: legalRequestDetail,
    accounts: accountList.accounts,
    selfAccountId: OWNER_ID,
    canEdit: true,
    canApprove: true,
    status: 'PENDING',
    nextPage: pageCursor,
  },
  parameters: { nextjs: { navigation: { pathname: '/legal/requests' } } },
} satisfies Meta<typeof LegalRequestsScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

const request = legalRequestDetail.request;

/** Another operator's publish request: approve stays closed until the reading mark. */
export const PendingPublish: Story = {};

const mark: NonNullable<Story['play']> = async ({ canvas, userEvent }) => {
  await userEvent.click(
    canvas.getByRole('checkbox', { name: '대조표와 고지 등급·시행일을 확인했습니다' }),
  );
};

export const Marked: Story = { play: mark };

/** The only approver's own request: the reason is required and there is no reject. */
export const SelfApproval: Story = { args: { selected: legalSelfRequestDetail } };

/** A first publication: no comparison, the whole text and its own reading mark. */
export const FirstPublication: Story = { args: { selected: legalFirstRequestDetail } };

/** The checks refuse as of now: the reason, and approve closed even after the mark. */
export const ChecksRefuse: Story = { args: { selected: legalRefusedRequestDetail }, play: mark };

export const Withdraw: Story = {
  args: { selected: legalWithdrawRequestDetail },
};

/** A decided request shows who decided and why, and its target as it is now. */
export const Closed: Story = {
  args: {
    requests: decidedLegalRequests,
    selected: legalClosedRequestDetail,
    status: null,
    nextPage: null,
  },
};

export const Approved: Story = {
  beforeEach: () => answerBff({ [`/api/legal/requests/${request.id}/approve`]: legalDecision }),
  play: async (context) => {
    await mark(context);
    await context.userEvent.click(context.canvas.getByRole('button', { name: '승인' }));
    await context.canvas.findByText('요청을 승인했습니다.');
  },
};

/** The draft changed or the request was decided elsewhere: the API's conflict in the decision area. */
export const Conflict: Story = {
  beforeEach: () =>
    answerBff({ [`/api/legal/requests/${request.id}/approve`]: bffFailure(409, 'conflict') }),
  play: async (context) => {
    await mark(context);
    await context.userEvent.click(context.canvas.getByRole('button', { name: '승인' }));
    await context.canvas.findByText(
      '이미 처리됐거나 지금 상태에서는 할 수 없는 작업입니다. 화면을 새로 고쳐 확인하세요.',
    );
  },
};

/** A legal editor without the approve permission: only the cancel of their own request. */
export const EditorOnly: Story = {
  args: { canApprove: false, selected: legalWithdrawRequestDetail, accounts: null },
};

export const FilteredEmpty: Story = {
  args: { requests: [], selected: null, status: 'APPROVED', nextPage: null },
};

export const Empty: Story = {
  args: { requests: [], selected: null, status: null, nextPage: null },
};

export const Narrow: Story = { globals: { viewport: { value: 'mobile390' } } };

export const Forbidden: Story = {
  render: () => <ForbiddenPage title="게시 요청" />,
  parameters: { consoleSession: activeAuditor },
};
