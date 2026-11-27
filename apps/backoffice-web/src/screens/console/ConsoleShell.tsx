import { Suspense, type ReactNode } from 'react';
import type { ActiveSession } from '@/server/session';
import { ROLE_LABELS } from '@/ui/labels';
import { ConsoleFrame } from './ConsoleFrame';
import { LogoutButton } from './LogoutButton';
import { visibleNavigation } from './navigation';
import { SessionEndNotice } from './SessionEndNotice';

/**
 * The console shell of the (console) route group: the session's menu groups (navigation.ts hides what its roles do not
 * grant; the server decides every action), the operator, the logout and the ended-session notice, drawn by the client
 * ConsoleFrame (design guide ③).
 */
export function ConsoleShell({
  active,
  defaultCollapsed,
  defaultMenuOpen,
  children,
}: {
  readonly active: ActiveSession;
  /** Story states of the frame (ConsoleFrame); the route group leaves them out. */
  readonly defaultCollapsed?: boolean;
  readonly defaultMenuOpen?: boolean;
  readonly children: ReactNode;
}) {
  const { session } = active;
  const roles = session.roles.map((role) => ROLE_LABELS[role]).join(', ') || '역할 없음';
  return (
    <ConsoleFrame
      groups={visibleNavigation(session.permissions)}
      user={{ name: session.account.displayName, roles }}
      logout={<LogoutButton />}
      defaultCollapsed={defaultCollapsed}
      defaultMenuOpen={defaultMenuOpen}
      notice={
        <Suspense fallback={null}>
          <SessionEndNotice
            idleRemainingMs={active.idleRemainingMs}
            absoluteRemainingMs={active.absoluteRemainingMs}
          />
        </Suspense>
      }
    >
      {children}
    </ConsoleFrame>
  );
}
