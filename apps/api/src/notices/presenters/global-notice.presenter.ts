import {
  noticeSeveritySchema,
  type GlobalNotice,
  type GlobalNoticeDetailResponse,
  type GlobalNoticeListResponse,
  type GlobalNoticePreview,
} from '@repo/shared/notices';
import type { GlobalNoticeRecord } from '../repositories/global-notice.repository.js';

function toPreview(record: GlobalNoticeRecord): GlobalNoticePreview {
  return {
    id: record.id,
    title: record.title,
    summary: record.summary,
    severity: noticeSeveritySchema.parse(record.severity),
    relatedSeasonId: record.relatedSeasonId,
    publishedAt: record.publishedAt.toISOString(),
    expiresAt: record.expiresAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function toNotice(record: GlobalNoticeRecord): GlobalNotice {
  return {
    ...toPreview(record),
    body: record.body,
  };
}

export function toGlobalNoticeListResponse(input: {
  records: readonly GlobalNoticeRecord[];
  limit: number;
  nextCursor: string | null;
}): GlobalNoticeListResponse {
  const visibleRecords = input.records.slice(0, input.limit);
  return {
    items: visibleRecords.map(toPreview),
    pageInfo: {
      hasNextPage: input.records.length > input.limit,
      nextCursor: input.nextCursor,
    },
  };
}

export function toGlobalNoticeDetailResponse(
  record: GlobalNoticeRecord,
): GlobalNoticeDetailResponse {
  return { notice: toNotice(record) };
}
