import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import {
  activeOwner,
  activeOwnerWithoutRecovery,
  ownerWithoutRecovery,
} from '../../../ui/__stories__/fixtures';
import { consoleFrame } from '../../../ui/__stories__/frames';
import { HomeDashboard } from '../HomeDashboard';

// The home dashboard inside the console shell: what waits for the operator, from the session and the first page of
// pending access requests the home page read.

const meta = {
  title: 'Home/Dashboard',
  component: HomeDashboard,
  decorators: [consoleFrame],
  args: { session: activeOwner.session, pending: { count: 2, overflow: false } },
  parameters: { nextjs: { navigation: { pathname: '/' } } },
} satisfies Meta<typeof HomeDashboard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Owner: Story = {};

/** No confirmed TOTP and no recovery codes: the warning with its link to 내 보안 설정. */
export const RecoveryMissing: Story = {
  args: { session: ownerWithoutRecovery },
  parameters: { consoleSession: activeOwnerWithoutRecovery },
};

/** The first page of pending requests has a next page. */
export const PendingOverflow: Story = { args: { pending: { count: 50, overflow: true } } };

/** No approve permission (nothing read) and the recovery means ready. */
export const NothingToDo: Story = { args: { pending: null } };

/** The pending requests could not be read: the line says so and links to 권한 요청; the rest of the home stays. */
export const PendingUnread: Story = { args: { pending: 'unavailable' } };
