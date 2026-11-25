import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { answerBff } from '../../../ui/__stories__/bff-stub';
import { activeAuditor } from '../../../ui/__stories__/fixtures';
import { consoleFrame } from '../../../ui/__stories__/frames';
import {
  legalHistoricalVersion,
  legalRequests,
  legalScheduledVersion,
} from '../../../ui/__stories__/legal-fixtures';
import { Forbidden as ForbiddenPage } from '../../../ui/Forbidden';
import { LegalVersionScreen } from '../LegalVersionScreen';

// One published version inside the console shell: its facts, its text in its stored order, a new draft from
// it, and the withdrawal request of a scheduled version.

const meta = {
  title: 'Legal/Version',
  component: LegalVersionScreen,
  decorators: [consoleFrame],
  args: { version: legalScheduledVersion, state: 'scheduled', canEdit: true },
  parameters: {
    nextjs: { navigation: { pathname: `/legal/versions/${legalScheduledVersion.id}` } },
  },
} satisfies Meta<typeof LegalVersionScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Scheduled: Story = {};

export const Current: Story = { args: { state: 'current' } };

export const Historical: Story = { args: { version: legalHistoricalVersion, state: 'previous' } };

/** A legal approver without the edit permission: no new draft, no withdrawal. */
export const ReadOnly: Story = { args: { canEdit: false } };

export const WithdrawConfirm: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: '철회 요청' }));
    await canvas.findByRole('alertdialog', { name: '철회 요청' });
  },
};

export const WithdrawRequested: Story = {
  beforeEach: () =>
    answerBff({
      [`/api/legal/versions/${legalScheduledVersion.id}/withdraw-requests`]: legalRequests[1],
    }),
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: '철회 요청' }));
    await userEvent.click(await canvas.findByRole('button', { name: '철회 요청 만들기' }));
    await canvas.findByText('철회 요청을 만들었습니다. 승인 권한 운영자가 결정합니다.');
  },
};

export const NewDraftDrawer: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: '이 판으로 새 초안 만들기' }));
    await canvas.findByRole('dialog', { name: '이 판으로 새 초안' });
  },
};

export const Narrow: Story = { globals: { viewport: { value: 'mobile390' } } };

export const Forbidden: Story = {
  render: () => <ForbiddenPage title="문서 판" />,
  parameters: { consoleSession: activeAuditor },
};
