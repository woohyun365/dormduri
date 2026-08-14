import type {
  SupportFaqDetailResponse,
  SupportFaqItem,
  SupportFaqListResponse,
} from '@repo/shared/support';
import type { SupportFaqRecord } from '../repositories/support-faq.repository.js';

export function toSupportFaqItem(record: SupportFaqRecord): SupportFaqItem {
  return {
    id: record.id,
    category: record.category,
    question: record.question,
    answer: record.answer,
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
