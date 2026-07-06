'use client';

import type { ReactNode } from 'react';
import { HomeSectionGrid } from './HomeSectionGrid';

interface HomeDashboardLayoutProps {
  notice: ReactNode;
  primary: ReactNode;
  readiness: ReactNode;
  activity: ReactNode;
  quickActions: ReactNode;
  assistance: ReactNode;
}

export function HomeDashboardLayout({
  notice,
  primary,
  readiness,
  activity,
  quickActions,
  assistance,
}: HomeDashboardLayoutProps) {
  return (
    <div data-testid="home-dashboard-layout" className="mx-auto max-w-md px-5 py-5 md:max-w-5xl">
      <HomeSectionGrid
        notice={notice}
        primary={primary}
        readiness={readiness}
        activity={activity}
        quickActions={quickActions}
        assistance={assistance}
      />
    </div>
  );
}
