'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { BrandLogo, BrandMark } from '@/ui/brand/BrandLogo';
import { Icon } from '@/ui/icons';
import { currentItem, locate, type NavigationGroup } from './navigation';

const MENU_ID = 'console-menu';

/**
 * The console frame (design guide ③): the light sidebar with the logo and the work-group menu, and the top bar with
 * where the page is, the operator and the logout. From 1024px the sidebar can collapse to icons; the state stays while
 * the operator moves between pages (this frame lives in the console layout) and is never saved. Below 1024px the sidebar
 * becomes a top bar with a menu button, and the opened menu shows every name and closes on the next page. The ended
 * session notice has its one place above the page. Every link has prefetch={false} (a prefetch would read the API and
 * move the session's activity, README §4).
 */
export function ConsoleFrame({
  groups,
  user,
  logout,
  notice,
  defaultCollapsed = false,
  defaultMenuOpen = false,
  children,
}: {
  /** The menu groups the session's permissions show (navigation.ts `visibleNavigation`). */
  readonly groups: readonly NavigationGroup[];
  readonly user: { readonly name: string; readonly roles: string };
  readonly logout: ReactNode;
  readonly notice: ReactNode;
  /** The first state of the collapse (a story state). */
  readonly defaultCollapsed?: boolean;
  /** The narrow-screen menu shown open first (a story state). */
  readonly defaultMenuOpen?: boolean;
  readonly children: ReactNode;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  // The narrow menu is open for the page it was opened on, so the next page starts with it closed.
  const [menuOpenAt, setMenuOpenAt] = useState<string | null>(defaultMenuOpen ? pathname : null);
  const menuOpen = menuOpenAt === pathname;
  const current = currentItem(groups, pathname);
  const location = locate(pathname);

  // The collapsed rail is a wide-screen form: below 1024px the opened menu shows every name (lg: prefixes).
  const narrow = collapsed;
  return (
    <div className="min-h-screen bg-layer-basement text-fg-neutral lg:flex">
      <div className="flex items-center justify-between gap-3 border-b border-shell-stroke bg-shell px-4 py-3 lg:hidden">
        <BrandLogo />
        <button
          type="button"
          aria-expanded={menuOpen}
          aria-controls={MENU_ID}
          onClick={() => setMenuOpenAt(menuOpen ? null : pathname)}
          className="flex items-center gap-2 rounded-control border border-shell-stroke px-3 py-1.5 text-body font-semibold text-shell-fg lg:hidden focus-ring"
        >
          <Icon name={menuOpen ? 'close' : 'menu'} className="size-4" />
          메뉴
        </button>
      </div>
      <aside
        className={`${menuOpen ? 'flex' : 'hidden'} flex-col border-shell-stroke bg-shell lg:sticky lg:top-0 lg:flex lg:h-screen lg:shrink-0 lg:border-r ${
          narrow ? 'lg:w-16' : 'lg:w-sidebar'
        }`}
      >
        <div
          className={`hidden h-header items-center lg:flex ${narrow ? 'justify-center' : 'px-5'}`}
        >
          {narrow ? <BrandMark /> : <BrandLogo />}
        </div>
        <nav id={MENU_ID} aria-label="백오피스 메뉴" className="flex flex-col gap-5 px-3 py-4">
          {groups.map((group, index) => {
            const headingId = `${MENU_ID}-group-${index}`;
            return (
              <div key={group.label ?? 'home'} className="flex flex-col gap-1">
                {group.label ? (
                  <p
                    id={headingId}
                    className={`px-3 pb-1 text-caption font-semibold text-shell-muted ${narrow ? 'lg:sr-only' : ''}`}
                  >
                    {group.label}
                  </p>
                ) : null}
                <ul
                  aria-labelledby={group.label ? headingId : undefined}
                  className="flex flex-col gap-0.5"
                >
                  {group.items.map((item) => {
                    const isCurrent = item === current;
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          prefetch={false}
                          aria-current={isCurrent ? 'page' : undefined}
                          title={narrow ? item.label : undefined}
                          className={`relative flex items-center gap-3 rounded-control px-3 py-nav-y text-body font-medium ${
                            narrow ? 'lg:justify-center' : ''
                          } ${
                            isCurrent
                              ? 'border border-shell-stroke bg-shell-active text-shell-active-fg'
                              : 'text-shell-fg hover:bg-shell-hover'
                          } focus-ring`}
                        >
                          {isCurrent ? (
                            <span
                              aria-hidden="true"
                              className="absolute inset-y-2 left-0 w-1 rounded-full bg-shell-indicator"
                            />
                          ) : null}
                          <Icon name={item.icon} />
                          <span className={narrow ? 'lg:sr-only' : ''}>{item.label}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>
        <div className="mt-auto hidden border-t border-shell-stroke p-3 lg:block">
          <button
            type="button"
            aria-expanded={!collapsed}
            aria-controls={MENU_ID}
            onClick={() => setCollapsed((value) => !value)}
            className={`flex w-full items-center gap-3 rounded-control px-3 py-nav-y text-body text-shell-muted hover:bg-shell-hover ${
              narrow ? 'lg:justify-center' : ''
            } focus-ring`}
          >
            <Icon name={collapsed ? 'expand' : 'collapse'} />
            <span className={narrow ? 'lg:sr-only' : ''}>
              {collapsed ? '메뉴 펼치기' : '메뉴 접기'}
            </span>
          </button>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-header items-center justify-between gap-4 border-b border-stroke-subtle bg-layer-default px-page">
          <p className="min-w-0 truncate text-body text-fg-muted">
            {location?.group ? (
              <>
                {location.group}
                <span aria-hidden="true" className="px-2">
                  /
                </span>
              </>
            ) : null}
            {location ? (
              <span className="font-semibold text-fg-neutral">{location.page}</span>
            ) : null}
          </p>
          <div className="flex min-w-0 items-center gap-3">
            <div className="hidden min-w-0 flex-col items-end sm:flex">
              <span className="truncate text-label font-semibold text-fg-neutral">{user.name}</span>
              <span className="truncate text-caption text-fg-muted">{user.roles}</span>
            </div>
            {logout}
          </div>
        </header>
        <main className="flex flex-col gap-stack p-page">
          {notice}
          {children}
        </main>
      </div>
    </div>
  );
}
