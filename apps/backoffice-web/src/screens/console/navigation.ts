import type { Route } from 'next';
import type { BackofficePermission } from '@repo/shared/backoffice';
import type { IconName } from '@/ui/icons';

// The console menu (design guide ③): work groups 홈 / 운영자 관리 / 법적 문서 / 감사 / 내 설정. The server decides every action;
// the menu only hides what the session's roles do not grant (README §1).

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

const LEGAL: readonly BackofficePermission[] = ['admin:legal:edit', 'admin:legal:approve'];

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
    // Either legal permission reads every legal screen; the owner role holds both (backoffice-api README §8).
    label: '법적 문서',
    items: [
      { href: '/legal', label: '문서 판', icon: 'document', anyOf: LEGAL },
      { href: '/legal/drafts', label: '초안', icon: 'draft', anyOf: LEGAL },
      { href: '/legal/requests', label: '게시 요청', icon: 'approval', anyOf: LEGAL },
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

/**
 * The item a path belongs to: the item whose path it is, or the deepest item it sits under by whole path segments (a
 * draft page `/legal/drafts/<id>` is under 초안, not 문서 판). The home is the root only.
 */
function owningItem(
  groups: readonly NavigationGroup[],
  path: string,
): { readonly group: NavigationGroup; readonly item: NavigationItem } | null {
  const pathname = pathOnly(path);
  let found: { readonly group: NavigationGroup; readonly item: NavigationItem } | null = null;
  for (const group of groups) {
    for (const item of group.items) {
      const owns =
        item.href === pathname || (item.href !== '/' && pathname.startsWith(`${item.href}/`));
      if (owns && (!found || item.href.length > found.item.href.length)) found = { group, item };
    }
  }
  return found;
}

/** The menu item of a path (its query aside), or null for a path the menu does not have. */
export function currentItem(
  groups: readonly NavigationGroup[],
  path: string,
): NavigationItem | null {
  return owningItem(groups, path)?.item ?? null;
}

/** Where the top bar says the page is: its group and its name, from the whole menu (a hidden item keeps its place). */
export function locate(
  path: string,
): { readonly group: string | null; readonly page: string } | null {
  const owner = owningItem(NAVIGATION, path);
  return owner ? { group: owner.group.label, page: owner.item.label } : null;
}
