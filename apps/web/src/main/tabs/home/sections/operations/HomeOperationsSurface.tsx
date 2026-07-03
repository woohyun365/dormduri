'use client';

import type { ReactNode } from 'react';
import { Megaphone } from 'lucide-react';
import { useHomeOperations } from '../../hooks/useHomeOperations';
import type { HomeOperationsDetailState } from '../../hooks/useHomeOperations';
import { HomeResponsiveSheet } from '../../overlays/HomeResponsiveSheet';
import { HomeInboxSupportSection } from './HomeInboxSupportSection';
import { HomeNoticeSurface } from './HomeNoticeSurface';
import { OperationsPanelSkeleton } from './OperationsPanelSkeleton';
import { SupportTicketDetailSheet } from './SupportTicketDetailSheet';

export type HomeOperationsSurfaces = Readonly<{
  notice: ReactNode;
  assistance: ReactNode;
}>;

function NoticeDetailSheet({
  detail,
  onClose,
}: {
  detail: Extract<HomeOperationsDetailState, { kind: 'notice' }>;
  onClose: () => void;
}) {
  const title = detail.status === 'success' ? detail.notice.title : '공지사항';
  const description =
    detail.status === 'success'
      ? '운영자가 모든 사용자에게 공개한 안내예요.'
      : '공지 상세 내용을 확인하고 있어요.';

  return (
    <HomeResponsiveSheet
      label="공지사항"
      eyebrow="공지사항"
      title={title}
      description={description}
      icon={Megaphone}
      tone={detail.status === 'success' && detail.notice.severity === 'WARNING' ? 'amber' : 'blue'}
      onClose={onClose}
      footer={
        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-xl bg-(--knu-primary) px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-(--knu-primary-dark) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--knu-primary)"
        >
          확인했어요
        </button>
      }
    >
      {detail.status === 'loading' && (
        <div className="space-y-3" aria-label="공지 상세 로딩 중">
          <div className="h-8 animate-pulse rounded-xl bg-(--knu-background-alt)" />
          <div className="h-36 animate-pulse rounded-2xl bg-(--knu-background-alt)" />
        </div>
      )}

      {detail.status === 'error' && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-bold text-amber-800">{detail.message}</p>
        </div>
      )}

      {detail.status === 'success' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-(--knu-border) bg-(--knu-background-alt) p-4">
            <p className="text-xs font-bold text-(--knu-text-tertiary)">요약</p>
            <p className="mt-1 text-sm font-bold leading-relaxed text-(--knu-text-primary)">
              {detail.notice.summary}
            </p>
          </div>
          <p className="whitespace-pre-line rounded-2xl border border-(--knu-border) bg-white p-4 text-sm leading-relaxed text-(--knu-text-secondary)">
            {detail.notice.body}
          </p>
        </div>
      )}
    </HomeResponsiveSheet>
  );
}

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
      onOpenNotice={(noticeId) => void operations.openNoticeDetail(noticeId)}
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
        onOpenSupportTicket={(notification) => {
          if (notification.supportTicketId) {
            void operations.openSupportTicketDetail(notification.supportTicketId);
          }
          void operations.markNotificationRead(notification);
        }}
        onMarkNotificationRead={(notification) =>
          void operations.markNotificationRead(notification)
        }
        onMarkAllNotificationsRead={() => void operations.markAllNotificationsRead()}
        onOpenTicket={(ticketId) => void operations.openSupportTicketDetail(ticketId)}
        onRetry={() => void operations.refresh()}
      />
    );

  return (
    <>
      {children ? (
        children({ notice, assistance })
      ) : (
        <div className="space-y-3">
          {notice}
          {assistance}
        </div>
      )}

      {operations.detail?.kind === 'notice' && (
        <NoticeDetailSheet detail={operations.detail} onClose={operations.closeDetail} />
      )}

      {operations.detail?.kind === 'supportTicket' && (
        <SupportTicketDetailSheet
          detail={operations.detail}
          onClose={operations.closeDetail}
          onAppendMessage={operations.appendSupportTicketMessage}
        />
      )}
    </>
  );
}
