import Link from 'next/link';
import type { Route } from 'next';
import { Suspense, type ReactNode } from 'react';
import type { BackofficePermission } from '@repo/shared/backoffice';
import type { ActiveSession } from '@/server/session';
import { IdleNotice } from './IdleNotice';
import { LogoutButton } from './LogoutButton';

// The server decides every action; the menu only hides what the session's roles do not grant.
const NAVIGATION: readonly { href: Route; label: string; permission?: BackofficePermission }[] = [
  { href: '/', label: '홈' },
  { href: '/accounts', label: '운영자 계정', permission: 'admin:account:invite' },
  { href: '/access', label: '권한 요청' },
  { href: '/audit', label: '감사 기록', permission: 'admin:audit:read' },
  { href: '/security', label: '내 보안 설정' },
];

const ACCESS_PERMISSIONS: readonly BackofficePermission[] = [
  'admin:access:request',
  'admin:access:approve',
];

export function ConsoleShell({
  active,
  children,
}: {
  readonly active: ActiveSession;
  readonly children: ReactNode;
}) {
  const { session } = active;
  const visible = NAVIGATION.filter((item) => {
    if (item.href === '/access') {
      return ACCESS_PERMISSIONS.some((permission) => session.permissions.includes(permission));
    }
    return !item.permission || session.permissions.includes(item.permission);
  });
  return (
    <div className="mx-auto flex min-h-screen max-w-page flex-col gap-6 px-6 py-6">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-stroke-subtle pb-4">
        <div className="flex flex-col">
          <span className="text-body font-semibold text-fg-neutral">돔두리 백오피스</span>
          <span className="text-caption text-fg-muted">{session.account.displayName}</span>
        </div>
        <nav aria-label="백오피스 메뉴">
          <ul className="flex flex-wrap gap-4 text-body">
            {visible.map((item) => (
              <li key={item.href}>
                {/* No prefetch: a prefetch would read the API and move the session's activity. */}
                <Link
                  href={item.href}
                  prefetch={false}
                  className="text-fg-label underline-offset-4 hover:underline"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <LogoutButton />
      </header>
      <Suspense fallback={null}>
        <IdleNotice
          idleRemainingMs={active.idleRemainingMs}
          absoluteRemainingMs={active.absoluteRemainingMs}
        />
      </Suspense>
      <main className="flex flex-col gap-6">{children}</main>
    </div>
  );
}
