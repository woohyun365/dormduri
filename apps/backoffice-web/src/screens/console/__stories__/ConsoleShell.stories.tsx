import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, waitFor } from 'storybook/test';
import { SESSION_CLOSED_EVENT } from '../../../client/bff-client';
import { activeAuditor, activeOwner } from '../../../ui/__stories__/fixtures';
import { ConsoleShell } from '../ConsoleShell';

// The console shell: the sidebar groups hidden by the session's permissions, the top bar, the collapse, the narrow menu
// and the ended-session notice above the page. Fixture sessions only.

const meta = {
  title: 'Console/Shell',
  component: ConsoleShell,
  args: {
    active: activeOwner,
    children: <p className="text-body text-fg-description">본문 자리</p>,
  },
  parameters: { nextjs: { navigation: { pathname: '/' } } },
} satisfies Meta<typeof ConsoleShell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Owner: Story = {};

/** An auditor sees only the menu items its permission grants; the group left empty is gone. */
export const Auditor: Story = {
  args: { active: activeAuditor },
  parameters: { nextjs: { navigation: { pathname: '/audit' } } },
};

/** The sidebar collapsed to its icon rail (1024px and wider), kept across pages without browser storage. */
export const Collapsed: Story = { args: { defaultCollapsed: true } };

/** Below 1024px: the top bar with the menu button, the menu opened. */
export const NarrowMenu: Story = {
  args: { defaultMenuOpen: true },
  globals: { viewport: { value: 'mobile390' } },
};

/** The collapse is a wide-screen form: the opened narrow menu still shows every name. */
export const NarrowCollapsedMenu: Story = {
  args: { defaultCollapsed: true, defaultMenuOpen: true },
  globals: { viewport: { value: 'mobile390' } },
};

/** The notice appears after the countdown's zero-delay timer; the check runs once it is there. */
const noticeShown: NonNullable<Story['play']> = async ({ canvas }) => {
  await canvas.findByRole('alert');
};

/** The idle countdown ran out: the notice from the server's last answer, without asking the API. */
export const IdleEnded: Story = {
  args: { active: { ...activeOwner, idleRemainingMs: 0 } },
  play: noticeShown,
};

/** The absolute limit came before the idle limit. */
export const AbsoluteEnded: Story = {
  args: { active: { ...activeOwner, absoluteRemainingMs: 0 } },
  play: noticeShown,
};

/**
 * A BFF call found the session closed (another operator's role revoke, a deactivation or a logout in another window):
 * the same place and look as the idle notice, with the closed wording.
 */
export const SessionClosed: Story = {
  // The notice listens from an effect, which may run after play starts: send the event until the notice is there.
  play: async ({ canvas }) => {
    await waitFor(() => {
      window.dispatchEvent(new Event(SESSION_CLOSED_EVENT));
      expect(canvas.getByRole('alert')).toBeInTheDocument();
    });
  },
};
