import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { answerBff } from '../../../ui/__stories__/bff-stub';
import {
  activeAuditor,
  auditEvents,
  auditNames,
  manyAuditEvents,
  pageCursor,
} from '../../../ui/__stories__/fixtures';
import { consoleFrame } from '../../../ui/__stories__/frames';
import { Forbidden as ForbiddenPage } from '../../../ui/Forbidden';
import { AuditScreen } from '../AuditScreen';

// The admin audit inside the console shell: newest-first rows (a self approval, two recovery logins, a denied login, an
// unknown action code, the monthly review), a row's detail and the monthly review in right drawers.

const meta = {
  title: 'Audit/Screen',
  component: AuditScreen,
  decorators: [consoleFrame],
  args: {
    events: auditEvents,
    names: auditNames,
    canReview: true,
    nextPage: pageCursor,
    laterPage: false,
  },
  parameters: { nextjs: { navigation: { pathname: '/audit' } } },
} satisfies Meta<typeof AuditScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Events: Story = {};

/** The auditor's recovery login with TOTP opened from its time. */
export const DetailDrawer: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getAllByRole('button', { name: /기록 상세/u })[1]!);
    await canvas.findByRole('dialog', { name: '기록 상세' });
  },
};

const openReview: NonNullable<Story['play']> = async ({ canvas, userEvent }) => {
  await userEvent.click(canvas.getByRole('button', { name: '월 점검 기록' }));
  await canvas.findByRole('dialog', { name: '월 점검 기록' });
};

export const ReviewDrawer: Story = { play: openReview };

/** The drawer closed and the result shows under the page title. */
export const Reviewed: Story = {
  beforeEach: () => answerBff({ '/api/audit/reviews': {} }),
  play: async (context) => {
    await openReview(context);
    await context.userEvent.click(context.canvas.getByRole('button', { name: '점검 완료 기록' }));
    await context.canvas.findByText('점검 완료를 기록했습니다.');
  },
};

/** A full first page of fifty rows, on a later page with both links. */
export const Rows: Story = { args: { events: manyAuditEvents, laterPage: true } };

export const Empty: Story = { args: { events: [], nextPage: null } };

/** An auditor without the owner role reads account ids, not names, and does not record the review. */
export const IdsOnly: Story = {
  args: { names: {}, canReview: false },
  parameters: { consoleSession: activeAuditor },
};

/** A session without `admin:audit:read`: the page title stays and the body says why. */
export const Forbidden: Story = {
  render: () => <ForbiddenPage title="감사 기록" />,
  parameters: {
    consoleSession: {
      ...activeAuditor,
      session: { ...activeAuditor.session, roles: [], permissions: ['admin:access:request'] },
    },
  },
};
