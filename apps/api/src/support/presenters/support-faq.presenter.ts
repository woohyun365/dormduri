import type { SupportFaqDetailResponse, SupportFaqListResponse } from '@repo/shared/support';
import type { SupportFaqRecord } from '../repositories/support-faq.repository.js';

export function toSupportFaqItem(record: SupportFaqRecord) {
  return {
    id: record.id,
    category: record.category,
    question: record.question,
    answer: record.answer,
    published: record.published,
    sortOrder: record.sortOrder,
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function toSupportFaqListResponse(
  records: readonly SupportFaqRecord[],
): SupportFaqListResponse {
  return { items: records.map(toSupportFaqItem) };
}

export function toSupportFaqDetailResponse(record: SupportFaqRecord): SupportFaqDetailResponse {
  return { item: toSupportFaqItem(record) };
}
