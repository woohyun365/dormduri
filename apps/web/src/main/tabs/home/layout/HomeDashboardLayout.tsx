'use client';

import type { ReactNode } from 'react';
import { HomeSectionGrid } from './HomeSectionGrid';

interface HomeDashboardLayoutProps {
  primary: ReactNode;
  readiness: ReactNode;
  activity: ReactNode;
  quickActions: ReactNode;
  operations: ReactNode;
}

export function HomeDashboardLayout({
  primary,
  readiness,
  activity,
  quickActions,
  operations,
}: HomeDashboardLayoutProps) {
  return (
    <div data-testid="home-dashboard-layout" className="mx-auto max-w-md px-5 py-5 md:max-w-5xl">
      <HomeSectionGrid
        primary={primary}
        readiness={readiness}
        activity={activity}
        quickActions={quickActions}
        operations={operations}
      />
    </div>
  );
}
