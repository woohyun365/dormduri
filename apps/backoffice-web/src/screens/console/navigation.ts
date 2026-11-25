import type { Route } from 'next';
import type { BackofficePermission } from '@repo/shared/backoffice';
import type { IconName } from '@/ui/icons';

// The console menu (design guide ③): work groups 홈 / 운영자 관리 / 감사 / 내 설정. The server decides every action; the
// menu only hides what the session's roles do not grant (README §1).

export type NavigationItem = {
  readonly href: Route;
  readonly label: string;
  readonly icon: IconName;
  /** The item shows when the session has any of these; without a list every operator sees it. */
  readonly anyOf?: readonly BackofficePermission[];
};

export type NavigationGroup = {
  /** The group name above its items; the home group has none. */
  readonly label: string | null;
  readonly items: readonly NavigationItem[];
};

export const NAVIGATION: readonly NavigationGroup[] = [
  { label: null, items: [{ href: '/', label: '홈', icon: 'home' }] },
  {
    label: '운영자 관리',
    items: [
      {
        href: '/accounts',
        label: '운영자 계정',
        icon: 'accounts',
        anyOf: ['admin:account:invite'],
      },
      {
        href: '/access',
        label: '권한 요청',
        icon: 'access',
        anyOf: ['admin:access:request', 'admin:access:approve'],
      },
    ],
  },
  {
    label: '감사',
    items: [{ href: '/audit', label: '감사 기록', icon: 'audit', anyOf: ['admin:audit:read'] }],
  },
  { label: '내 설정', items: [{ href: '/security', label: '내 보안 설정', icon: 'security' }] },
];

/** The groups and items the session's permissions show; a group left without items is dropped. */
export function visibleNavigation(
  permissions: readonly BackofficePermission[],
): readonly NavigationGroup[] {
  return NAVIGATION.map((group) => ({
    ...group,
    items: group.items.filter(
      (item) => !item.anyOf || item.anyOf.some((permission) => permissions.includes(permission)),
    ),
  })).filter((group) => group.items.length > 0);
}

function pathOnly(path: string): string {
  return path.split(/[?#]/u)[0] ?? path;
}

/** The menu item of a path (its query aside), or null for a path the menu does not have. */
export function currentItem(
  groups: readonly NavigationGroup[],
  path: string,
): NavigationItem | null {
  const pathname = pathOnly(path);
  for (const group of groups) {
    const item = group.items.find((candidate) => candidate.href === pathname);
    if (item) return item;
  }
  return null;
}

/** Where the top bar says the page is: its group and its name, from the whole menu (a hidden item keeps its place). */
export function locate(
  path: string,
): { readonly group: string | null; readonly page: string } | null {
  const pathname = pathOnly(path);
  for (const group of NAVIGATION) {
    const item = group.items.find((candidate) => candidate.href === pathname);
    if (item) return { group: group.label, page: item.label };
  }
  return null;
}
