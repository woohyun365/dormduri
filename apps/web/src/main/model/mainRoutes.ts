import type { Route } from 'next';
import type { MatchingNavOptions, TabId } from './navigation';

export const mainRoutes = {
  home: '/main',
  list: '/main/roommates',
  matching: '/main/matching',
  chat: '/main/chat',
  profile: '/main/profile',
} as const satisfies Record<TabId, Route>;

export function mainDestination(pathname: string): TabId {
  return (Object.keys(mainRoutes) as TabId[]).find((tab) => mainRoutes[tab] === pathname) ?? 'home';
}

export function mainHref(tab: TabId, selection?: MatchingNavOptions): Route {
  const pathname = mainRoutes[tab];
  if (tab !== 'matching' || !selection) return pathname;
  const params = new URLSearchParams();
  if (selection.section) params.set('section', selection.section);
  if (selection.requestTab) params.set('requestTab', selection.requestTab);
  return (params.size ? `${pathname}?${params}` : pathname) as Route;
}
