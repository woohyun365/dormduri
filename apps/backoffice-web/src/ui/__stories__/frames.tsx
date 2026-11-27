import type { Decorator } from '@storybook/nextjs-vite';
import AuthLayout from '../../app/(auth)/layout';
import type { ActiveSession } from '../../server/session';
import { ConsoleShell } from '../../screens/console/ConsoleShell';
import { activeOwner } from './fixtures';

// Story frames (design guide ⑨): a screen renders inside the same layout as its route group, so a story shows it as
// the operator sees it. A console story names its route in `parameters.nextjs.navigation.pathname`, which marks the
// current menu item, and another session than the owner's in `parameters.consoleSession`.

/** The sign-in card of the (auth) route group. */
export const authFrame: Decorator = (Story) => (
  <AuthLayout>
    <Story />
  </AuthLayout>
);

/** The console shell of the (console) route group with a fixture session (the owner's unless the story names one). */
export const consoleFrame: Decorator = (Story, { parameters }) => (
  <ConsoleShell active={(parameters.consoleSession as ActiveSession | undefined) ?? activeOwner}>
    <Story />
  </ConsoleShell>
);
