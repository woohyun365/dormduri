import type { GlobalNoticeListResponse } from '@repo/shared/notices';
import type { NotificationListResponse } from '@repo/shared/notifications';
import type { SupportTicketListResponse } from '@repo/shared/support';
import { toHomeGlobalNoticePreview, type HomeGlobalNoticePreview } from './noticePreview.mapper';
import {
  toHomeNotificationPreview,
  type HomeNotificationPreview,
} from './notificationPreview.mapper';
import { toHomeSupportTicketPreview, type HomeSupportTicketPreview } from './supportPreview.mapper';

export type { HomeGlobalNoticePreview } from './noticePreview.mapper';
export { toHomeGlobalNoticePreview } from './noticePreview.mapper';
export type { HomeNotificationPreview } from './notificationPreview.mapper';
export { toHomeNotificationPreview } from './notificationPreview.mapper';
export type { HomeSupportTicketPreview } from './supportPreview.mapper';
export { toHomeSupportTicketPreview } from './supportPreview.mapper';

export type HomeOperationsViewModel = Readonly<{
  globalNotices: HomeGlobalNoticePreview[];
  notifications: HomeNotificationPreview[];
  supportTickets: HomeSupportTicketPreview[];
}>;

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
