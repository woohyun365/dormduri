import type { Decorator } from '@storybook/nextjs-vite';
import AuthLayout from '../../app/(auth)/layout';
import { ConsoleShell } from '../../screens/console/ConsoleShell';
import { activeOwner } from './fixtures';

// Story frames (design guide ⑨): a screen renders inside the same layout as its route group, so a story shows it as
// the operator sees it.

/** The sign-in card of the (auth) route group. */
export const authFrame: Decorator = (Story) => (
  <AuthLayout>
    <Story />
  </AuthLayout>
);

/** The console shell of the (console) route group with the owner fixture session. */
export const consoleFrame: Decorator = (Story) => (
  <ConsoleShell active={activeOwner}>
    <Story />
  </ConsoleShell>
);
