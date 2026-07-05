import type { UserNotification } from '@repo/shared/notifications';

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat('ko-KR', {
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

export type NotificationDisplay = Readonly<{
  id: string;
  title: string;
  body: string;
  helper: string;
  read: boolean;
  createdAtLabel: string;
  supportTicketId: string | null;
}>;

export function formatNotificationDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return DATE_TIME_FORMATTER.format(date).replace(/\. /g, '.').replace(/\.$/, '');
}

export function toNotificationDisplay(notification: UserNotification): NotificationDisplay {
  const supportTicketId = extractSupportTicketId(notification);

  return {
    id: notification.id,
    title: resolveNotificationTitle(notification),
    body: resolveNotificationBody(notification),
    helper: resolveNotificationHelper(notification),
    read: notification.readAt !== null,
    createdAtLabel: formatNotificationDate(notification.createdAt),
    supportTicketId,
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

function resolveNotificationBody(notification: UserNotification): string {
  switch (notification.kind) {
    case 'SUPPORT_TICKET_CREATED':
      return '문의 내역에서 접수 상태를 확인할 수 있어요.';
    case 'SUPPORT_TICKET_REPLIED':
      return '답변 본문은 문의 내역에서 다시 권한 확인 후 보여드려요.';
    case 'SUPPORT_TICKET_ACTION_REQUIRED':
      return '문의 내역에서 운영팀이 요청한 추가 확인을 확인해주세요.';
    case 'SUPPORT_APPEAL_RESOLVED':
      return '이의 신청 결과는 문의 내역에서 확인할 수 있어요.';
    case 'CHAT_THREAD_CREATED':
      return '대화 탭에서 새 대화를 이어갈 수 있어요.';
    case 'REPORT_RECEIVED':
      return '신고 접수 상태가 업데이트됐어요.';
    case 'REPORT_STATUS_UPDATED':
      return '신고 처리 상태가 변경됐어요. 민감한 신고 원문은 알림에 표시하지 않아요.';
    case 'PROFILE_MISMATCH_FEEDBACK':
      return '다음 시즌 참여 전 시즌 프로필 내용을 다시 확인해주세요.';
    case 'SEASON_SYSTEM_NOTICE':
      return '시즌 운영과 관련해 확인할 안내가 있어요.';
    default:
      return '필요한 내용을 확인해주세요.';
  }
}

function resolveNotificationHelper(notification: UserNotification): string {
  if (notification.sourceType === 'SUPPORT_TICKET') return '문의 내역으로 이동';
  if (notification.sourceType === 'CONVERSATION_THREAD') return '대화 탭에서 확인';
  if (notification.sourceType === 'REPORT_CASE') return '신고 처리 상태';
  return '상세 owner 화면에서 확인';
}

function extractSupportTicketId(notification: UserNotification): string | null {
  const payload = notification.payload;
  switch (payload.kind) {
    case 'SUPPORT_TICKET_CREATED':
    case 'SUPPORT_TICKET_REPLIED':
    case 'SUPPORT_TICKET_ACTION_REQUIRED':
    case 'SUPPORT_APPEAL_RESOLVED':
      return payload.supportTicketId;
    default:
      return null;
  }
}
