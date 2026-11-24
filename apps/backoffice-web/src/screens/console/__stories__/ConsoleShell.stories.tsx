import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { activeAuditor, activeOwner } from '../../../ui/__stories__/fixtures';
import { ConsoleShell } from '../ConsoleShell';
import { IdleNotice } from '../IdleNotice';

// The console shell (menu hidden by the session's permissions) and the idle notice. Fixture sessions only.

const meta = {
  title: 'Console/Shell',
  component: ConsoleShell,
  args: {
    active: activeOwner,
    children: <p className="text-body text-fg-description">본문 자리</p>,
  },
} satisfies Meta<typeof ConsoleShell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Owner: Story = {};

/** An auditor sees only the menu items its permission grants. */
export const Auditor: Story = { args: { active: activeAuditor } };

/** The idle countdown ran out: the notice from the server's last answer, without asking the API. */
export const IdleEnded: Story = {
  render: () => (
    <div className="p-6">
      <IdleNotice idleRemainingMs={0} absoluteRemainingMs={8 * 60 * 60 * 1000} />
    </div>
  ),
};

/** The absolute limit came before the idle limit. */
export const AbsoluteEnded: Story = {
  render: () => (
    <div className="p-6">
      <IdleNotice idleRemainingMs={15 * 60 * 1000} absoluteRemainingMs={0} />
    </div>
  ),
};
