'use client';

import type { ReactNode } from 'react';
import { useHomeOperations } from '../../hooks/useHomeOperations';
import { HomeInboxSupportSection } from './HomeInboxSupportSection';
import { HomeNoticeSurface } from './HomeNoticeSurface';
import { OperationsPanelSkeleton } from './OperationsPanelSkeleton';

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
  const hasLoadedData =
    operations.viewModel.globalNotices.length > 0 ||
    operations.viewModel.notifications.length > 0 ||
    operations.viewModel.supportTickets.length > 0 ||
    operations.faqs.length > 0;
  const allFeedsFailed =
    operations.feedStatus.notice === 'error' &&
    operations.feedStatus.notification === 'error' &&
    operations.feedStatus.support === 'error';

  const notice = (
    <HomeNoticeSurface
      notices={operations.viewModel.globalNotices}
      status={operations.feedStatus.notice}
    />
  );

  const assistance =
    operations.loading && !hasLoadedData ? (
      <OperationsPanelSkeleton />
    ) : (
      <HomeInboxSupportSection
        notifications={operations.viewModel.notifications}
        unreadCount={operations.unreadCount}
        notificationStatus={operations.feedStatus.notification}
        notificationError={operations.errors.notification}
        supportStatus={operations.feedStatus.support}
        supportError={operations.errors.support}
        faqs={operations.faqs}
        tickets={operations.viewModel.supportTickets}
        allFeedsFailed={allFeedsFailed}
        onRetry={() => void operations.refresh()}
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
