import type { ReactNode } from 'react';

interface HomeSectionGridProps {
  notice: ReactNode;
  primary: ReactNode;
  readiness: ReactNode;
  activity: ReactNode;
  quickActions: ReactNode;
  assistance: ReactNode;
}

export function HomeSectionGrid({
  notice,
  primary,
  readiness,
  activity,
  quickActions,
  assistance,
}: HomeSectionGridProps) {
  return (
    <div data-testid="home-dashboard-section-grid" className="space-y-5">
      <div data-testid="home-section-notice" className="empty:hidden">
        {notice}
      </div>

      <div className="grid gap-5 md:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.8fr)] md:items-start">
        <main className="contents md:block md:space-y-5" aria-label="홈 주요 상태">
          <div data-testid="home-section-primary" className="order-1">
            {primary}
          </div>
          <div data-testid="home-section-activity" className="order-4 md:mt-5">
            {activity}
          </div>
          <div data-testid="home-section-quick-actions" className="order-5 md:mt-5">
            {quickActions}
          </div>
        </main>
        <aside className="contents md:block md:space-y-5" aria-label="홈 보조 정보">
          <div data-testid="home-section-readiness" className="order-2">
            {readiness}
          </div>
          <div data-testid="home-section-assistance" className="order-6 md:mt-5">
            {assistance}
          </div>
        </aside>
      </div>
    </div>
  );
}
