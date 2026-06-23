'use client';

import type { ReactNode } from 'react';

interface HomeDashboardLayoutProps {
  primary: ReactNode;
  activity: ReactNode;
  stats: ReactNode;
  quickActions: ReactNode;
  tip?: ReactNode;
}

export function HomeDashboardLayout({
  primary,
  activity,
  stats,
  quickActions,
  tip,
}: HomeDashboardLayoutProps) {
  return (
    <div data-testid="home-dashboard-layout" className="max-w-md md:max-w-5xl mx-auto px-5 py-5">
      <div className="grid gap-5 md:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.8fr)] md:items-start">
        <main className="space-y-5" aria-label="홈 주요 상태">
          {primary}
          {activity}
          {quickActions}
        </main>
        <aside className="space-y-5" aria-label="홈 보조 정보">
          {stats}
          {tip}
        </aside>
      </div>
    </div>
  );
}
