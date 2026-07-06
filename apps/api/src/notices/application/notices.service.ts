import { Injectable } from '@nestjs/common';
import type { ListGlobalNoticesQuery } from '@repo/shared/notices';
import { GlobalNoticeQuery } from '../queries/global-notice.query.js';

@Injectable()
export class NoticesService {
  constructor(private readonly globalNoticeQuery: GlobalNoticeQuery) {}

  listGlobalNotices(query: ListGlobalNoticesQuery) {
    return this.globalNoticeQuery.list(query);
  }

  getGlobalNotice(noticeId: string) {
    return this.globalNoticeQuery.get(noticeId);
  }
}
