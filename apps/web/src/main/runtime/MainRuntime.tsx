'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useMainHomeDashboard } from '@/main/hooks/useMainHomeDashboard';
import { BottomTabBar } from '@/main/components/BottomTabBar';
import { AppShellSkeleton } from '@/app/main/components/AppShellSkeleton';
import { HomeDashboardErrorState } from '@/main/tabs/home/layout/HomeDashboardErrorState';
import { ProfileCompatibility } from '@/main/tabs/profile/ProfileCompatibility';
import { getDormitoryDisplayFromSeasonOperations } from '@/main/model/dormitoryDisplay.adapter';
import { getMainFeatureFlags } from '@/main/utils/mainFeatureFlags';
import { mainDestination, mainHref } from '@/main/model/mainRoutes';
import type { MatchingNavOptions, TabId } from '@/main/model/navigation';
import type { HomeDashboardResponse } from '@repo/shared/home';
import { MainHomeResourceContext, MainShellContext } from './MainContexts';

const destinationNames: Record<TabId, string> = {
  home: '홈',
  list: '룸메 찾기',
  matching: '매칭 현황',
  chat: '채팅',
  profile: '내 프로필',
};

function DestinationContent({ pathname, children }: { pathname: string; children: ReactNode }) {
  const main = useRef<HTMLElement>(null);
  const previousPathname = useRef(pathname);
  useEffect(() => {
    if (previousPathname.current === pathname) return;
    previousPathname.current = pathname;
    // A named content landmark gives keyboard/AT users a stable destination.
    // Keep feature-owned focus (e.g. Matching), and leave scroll to the router.
    if (main.current && !main.current.contains(document.activeElement)) {
      main.current.focus({ preventScroll: true });
    }
  }, [pathname]);
  return (
    <main
      ref={main}
      tabIndex={-1}
      aria-label={`${destinationNames[mainDestination(pathname)]} 주요 내용`}
    >
      {children}
    </main>
  );
}

export function MainRuntime({
  viewerId,
  initialDashboard,
  dashboardUnavailable,
  resourceSnapshot,
  children,
}: {
  viewerId: string;
  initialDashboard: HomeDashboardResponse | null;
  dashboardUnavailable: boolean;
  resourceSnapshot?: object;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const resource = useMainHomeDashboard({
    viewerId,
    initialDashboard,
    dashboardUnavailable,
    resourceSnapshot,
    refresh: router.refresh,
  });
  const activeTab = mainDestination(pathname);
  const dashboard = resource.dashboard;
  const scopeKey = JSON.stringify([
    viewerId,
    dashboard?.season.summary?.id ?? null,
    dashboard?.season.state ?? null,
  ]);
  const compatibilityScope = `${scopeKey}:${activeTab === 'home' ? 'home' : 'nonhome'}`;
  const [badge, setBadge] = useState({ scope: compatibilityScope, count: 0 });
  if (badge.scope !== compatibilityScope) setBadge({ scope: compatibilityScope, count: 0 });
  const publishMatchingBadge = useCallback(
    (count: number) => {
      setBadge((previous) =>
        previous.scope === compatibilityScope ? { scope: compatibilityScope, count } : previous,
      );
    },
    [compatibilityScope],
  );
  const navigate = useCallback(
    (tab: TabId, selection?: MatchingNavOptions) => {
      router.push(mainHref(tab, selection));
    },
    [router],
  );

  if (resource.loading || !dashboard) {
    return resource.error ? (
      <main>
        <HomeDashboardErrorState
          message={resource.error}
          refreshing={resource.refreshing}
          onRetry={resource.refetch}
        />
      </main>
    ) : (
      <AppShellSkeleton />
    );
  }
  const { user, displayIdentity } = dashboard.viewer.identity;
  const viewer = {
    id: viewerId,
    nickname: displayIdentity.nickname || user.nickname,
    campus: user.campus,
    gender: user.gender,
    dormitoryId: dashboard.viewer.selection.dormitoryId,
    dormitory: getDormitoryDisplayFromSeasonOperations(
      dashboard.viewer.selection.dormitoryId,
      dashboard.season.operatedDormitories,
    ),
  };
  const season = {
    id: dashboard.season.summary?.id ?? null,
    state: dashboard.season.state,
    isOpen: dashboard.season.isOpen,
    isMatching: dashboard.season.isMatching,
  };
  const flags = getMainFeatureFlags({
    campusOperated: dashboard.viewer.campusOperated,
    isOpen: season.isOpen,
    isMatching: season.isMatching,
  });

  return (
    <MainHomeResourceContext.Provider value={resource}>
      <MainShellContext.Provider
        value={{
          viewer,
          season,
          scopeKey,
          campusOperated: dashboard.viewer.campusOperated,
          registered: dashboard.viewer.seasonProfile.registered,
          canEnterRoommateSearch: dashboard.viewer.capabilities.canEnterRoommateSearch,
          navigate,
          publishMatchingBadge,
        }}
      >
        <ProfileCompatibility dashboard={dashboard} scopeKey={compatibilityScope}>
          <div className="min-h-screen bg-(--knu-background-alt) pb-[calc(5rem+env(safe-area-inset-bottom))]">
            <DestinationContent pathname={pathname}>{children}</DestinationContent>
            <BottomTabBar
              activeTab={activeTab}
              disabledTabs={flags.disabledTabs}
              badges={
                activeTab !== 'home' && badge.scope === compatibilityScope && badge.count > 0
                  ? { matching: badge.count }
                  : undefined
              }
            />
          </div>
        </ProfileCompatibility>
      </MainShellContext.Provider>
    </MainHomeResourceContext.Provider>
  );
}
