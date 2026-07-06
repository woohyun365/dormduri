'use client';

import type { ReactNode } from 'react';
import { useHomeOperations } from '../../hooks/useHomeOperations';
import { HomeInboxSupportSection } from './HomeInboxSupportSection';
import { HomeNoticeSurface } from './HomeNoticeSurface';

export type HomeOperationsSurfaces = Readonly<{
  notice: ReactNode;
  assistance: ReactNode;
}>;

export function HomeOperationsSurface({
  children,
}: {
  children?: (surfaces: HomeOperationsSurfaces) => ReactNode;
}) {
  const operations = useHomeOperations();

  const notice = <HomeNoticeSurface />;
  const assistance = (
    <HomeInboxSupportSection
      unreadNotificationCount={operations.unreadNotificationCount}
      loadingUnreadCount={operations.loading || operations.refreshing}
    />
  );

  return children ? (
    children({ notice, assistance })
  ) : (
    <div className="space-y-3">
      {notice}
      {assistance}
    </div>
  );
}
