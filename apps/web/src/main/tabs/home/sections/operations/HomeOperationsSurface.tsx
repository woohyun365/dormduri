'use client';

import { Megaphone, MessageSquareText, RefreshCw } from 'lucide-react';
import { sectionCard, sectionHeader } from '@/main/styles/home';
import { useHomeOperations } from '../../hooks/useHomeOperations';
import type { HomeOperationsDetailState } from '../../hooks/useHomeOperations';
import { HomeResponsiveSheet } from '../../overlays/HomeResponsiveSheet';
import { HomeNoticeBanner } from './HomeNoticeBanner';
import { NotificationInboxPreview } from './NotificationInboxPreview';
import { OperationsPanelSkeleton } from './OperationsPanelSkeleton';
import { SupportCenterEntry } from './SupportCenterEntry';
import { SupportTicketDetailSheet } from './SupportTicketDetailSheet';
import { SupportTicketListPreview } from './SupportTicketListPreview';

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
      eyebrow="운영 센터"
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

export function HomeOperationsSurface() {
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

  return (
    <>
      <section className={sectionCard()} aria-labelledby="home-operations-title">
        <div className={sectionHeader}>
          <div>
            <p className="mb-1 text-xs font-bold text-(--knu-primary)">운영 센터</p>
            <h2 id="home-operations-title" className="font-bold text-(--knu-text-primary)">
              공지·알림·문의 상태를 확인해요
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {operations.refreshing && (
              <RefreshCw
                className="size-4 animate-spin text-(--knu-text-tertiary)"
                aria-hidden="true"
              />
            )}
            <MessageSquareText className="size-5 text-(--knu-primary)" aria-hidden="true" />
          </div>
        </div>

        {operations.loading && !hasLoadedData ? (
          <OperationsPanelSkeleton />
        ) : (
          <div className="space-y-3">
            {allFeedsFailed && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs font-bold text-amber-800">
                  운영 센터 정보를 불러오지 못했어요. 홈의 다른 기능은 계속 사용할 수 있어요.
                </p>
                <button
                  type="button"
                  onClick={() => void operations.refresh()}
                  className="mt-2 inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-amber-800 shadow-sm transition-colors hover:bg-amber-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
                >
                  <RefreshCw className="size-3" aria-hidden="true" />
                  다시 시도
                </button>
              </div>
            )}

            <HomeNoticeBanner
              notices={operations.viewModel.globalNotices}
              status={operations.feedStatus.notice}
              error={operations.errors.notice}
              onOpenNotice={(noticeId) => void operations.openNoticeDetail(noticeId)}
              onRetry={() => void operations.refresh()}
            />

            <NotificationInboxPreview
              notifications={operations.viewModel.notifications}
              unreadCount={operations.unreadCount}
              status={operations.feedStatus.notification}
              error={operations.errors.notification}
              onOpenSupportTicket={(notification) => {
                if (notification.supportTicketId) {
                  void operations.openSupportTicketDetail(notification.supportTicketId);
                }
                void operations.markNotificationRead(notification);
              }}
              onMarkRead={(notification) => void operations.markNotificationRead(notification)}
              onMarkAllRead={() => void operations.markAllNotificationsRead()}
              onRetry={() => void operations.refresh()}
            />

            <SupportCenterEntry
              faqs={operations.faqs}
              status={operations.feedStatus.support}
              error={operations.errors.support}
              onRetry={() => void operations.refresh()}
            />

            <SupportTicketListPreview
              tickets={operations.viewModel.supportTickets}
              onOpenTicket={(ticketId) => void operations.openSupportTicketDetail(ticketId)}
            />
          </div>
        )}
      </section>

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
