import type { GlobalNoticeListResponse, GlobalNoticePreview } from '@repo/shared/notices';
import type { NotificationListResponse, UserNotification } from '@repo/shared/notifications';
import type { SupportTicketListResponse, SupportTicketResponse } from '@repo/shared/support';

export type HomeGlobalNoticePreview = Readonly<{
  id: string;
  title: string;
  summary: string;
  severity: GlobalNoticePreview['severity'];
  publishedAt: string;
  relatedSeasonId: string | null;
}>;

export type HomeNotificationPreview = Readonly<{
  id: string;
  kind: UserNotification['kind'];
  sourceType: UserNotification['sourceType'];
  sourceId: string;
  read: boolean;
  createdAt: string;
  title: string;
  supportTicketId?: string;
}>;

export type HomeSupportTicketPreview = Readonly<{
  id: string;
  category: SupportTicketResponse['category'];
  status: SupportTicketResponse['status'];
  subject: string;
  lastMessageAt: string;
}>;

export type HomeOperationsViewModel = Readonly<{
  globalNotices: HomeGlobalNoticePreview[];
  notifications: HomeNotificationPreview[];
  supportTickets: HomeSupportTicketPreview[];
}>;

export function toHomeGlobalNoticePreview(notice: GlobalNoticePreview): HomeGlobalNoticePreview {
  return {
    id: notice.id,
    title: notice.title,
    summary: notice.summary,
    severity: notice.severity,
    publishedAt: notice.publishedAt,
    relatedSeasonId: notice.relatedSeasonId,
  };
}

export function toHomeNotificationPreview(notification: UserNotification): HomeNotificationPreview {
  const supportTicketId = extractSupportTicketId(notification);
  return {
    id: notification.id,
    kind: notification.kind,
    sourceType: notification.sourceType,
    sourceId: notification.sourceId,
    read: notification.readAt !== null,
    createdAt: notification.createdAt,
    title: resolveNotificationTitle(notification),
    ...(supportTicketId ? { supportTicketId } : {}),
  };
}

export function toHomeSupportTicketPreview(
  ticket: SupportTicketResponse,
): HomeSupportTicketPreview {
  return {
    id: ticket.id,
    category: ticket.category,
    status: ticket.status,
    subject: ticket.subject,
    lastMessageAt: ticket.lastMessageAt,
  };
}

export function createHomeOperationsViewModel(input: {
  notices?: GlobalNoticeListResponse | null;
  notifications?: NotificationListResponse | null;
  supportTickets?: SupportTicketListResponse | null;
}): HomeOperationsViewModel {
  return {
    globalNotices: (input.notices?.items ?? []).map(toHomeGlobalNoticePreview),
    notifications: (input.notifications?.items ?? []).map(toHomeNotificationPreview),
    supportTickets: (input.supportTickets?.items ?? []).map(toHomeSupportTicketPreview),
  };
}

function resolveNotificationTitle(notification: UserNotification): string {
  switch (notification.kind) {
    case 'SUPPORT_TICKET_CREATED':
      return '문의가 접수됐어요';
    case 'SUPPORT_TICKET_REPLIED':
      return '문의 답변이 도착했어요';
    case 'SUPPORT_TICKET_ACTION_REQUIRED':
      return '문의에 추가 확인이 필요해요';
    case 'SUPPORT_APPEAL_RESOLVED':
      return '이의 신청 결과가 업데이트됐어요';
    case 'CHAT_THREAD_CREATED':
      return '새 대화가 시작됐어요';
    case 'REPORT_RECEIVED':
      return '신고가 접수됐어요';
    case 'REPORT_STATUS_UPDATED':
      return '신고 처리 상태가 변경됐어요';
    case 'PROFILE_MISMATCH_FEEDBACK':
      return '시즌 프로필을 다시 확인해주세요';
    case 'SEASON_SYSTEM_NOTICE':
      return '시즌 운영 안내가 있어요';
    default:
      return '확인할 알림이 있어요';
  }
}

function extractSupportTicketId(notification: UserNotification): string | undefined {
  const payload = notification.payload;
  switch (payload.kind) {
    case 'SUPPORT_TICKET_CREATED':
    case 'SUPPORT_TICKET_REPLIED':
    case 'SUPPORT_TICKET_ACTION_REQUIRED':
    case 'SUPPORT_APPEAL_RESOLVED':
      return payload.supportTicketId;
    default:
      return undefined;
  }
}
