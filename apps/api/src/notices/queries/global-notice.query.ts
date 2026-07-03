import { Injectable } from '@nestjs/common';
import type {
  GlobalNoticeDetailResponse,
  GlobalNoticeListResponse,
  ListGlobalNoticesQuery,
} from '@repo/shared/notices';
import { noticeErrors } from '../errors.js';
import {
  toGlobalNoticeDetailResponse,
  toGlobalNoticeListResponse,
} from '../presenters/global-notice.presenter.js';
import { GlobalNoticeRepository } from '../repositories/global-notice.repository.js';
import {
  decodeGlobalNoticeListCursor,
  encodeGlobalNoticeListCursor,
} from './global-notice-list.cursor.js';

@Injectable()
export class GlobalNoticeQuery {
  constructor(private readonly repository: GlobalNoticeRepository) {}

  async list(query: ListGlobalNoticesQuery): Promise<GlobalNoticeListResponse> {
    const after = query.cursor ? decodeGlobalNoticeListCursor(query.cursor) : undefined;
    const records = await this.repository.listPublished({ query, after });
    const nextRecord = records.length > query.limit ? records[query.limit - 1] : undefined;

    return toGlobalNoticeListResponse({
      records,
      limit: query.limit,
      nextCursor: nextRecord ? encodeGlobalNoticeListCursor(nextRecord) : null,
    });
  }

  async get(noticeId: string): Promise<GlobalNoticeDetailResponse> {
    const record = await this.repository.findPublishedById(noticeId);
    if (!record) {
      throw noticeErrors.notFound();
    }
    return toGlobalNoticeDetailResponse(record);
  }
}
