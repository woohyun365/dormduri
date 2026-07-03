import { noticeErrors } from '../errors.js';
import type {
  GlobalNoticeCursorBoundary,
  GlobalNoticeRecord,
} from '../repositories/global-notice.repository.js';

type CursorPayload = {
  v: 1;
  purpose: 'GLOBAL_NOTICE_LIST_CURSOR';
  publishedAt: string;
  noticeId: string;
};

export function encodeGlobalNoticeListCursor(record: GlobalNoticeRecord): string {
  const payload: CursorPayload = {
    v: 1,
    purpose: 'GLOBAL_NOTICE_LIST_CURSOR',
    publishedAt: record.publishedAt.toISOString(),
    noticeId: record.id,
  };

  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

export function decodeGlobalNoticeListCursor(cursor: string): GlobalNoticeCursorBoundary {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  } catch {
    throw noticeErrors.invalidListCursor();
  }

  if (!isCursorPayload(parsed)) {
    throw noticeErrors.invalidListCursor();
  }

  const publishedAt = new Date(parsed.publishedAt);
  if (Number.isNaN(publishedAt.getTime())) {
    throw noticeErrors.invalidListCursor();
  }

  return { publishedAt, noticeId: parsed.noticeId };
}

function isCursorPayload(value: unknown): value is CursorPayload {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<CursorPayload>;
  return (
    candidate.v === 1 &&
    candidate.purpose === 'GLOBAL_NOTICE_LIST_CURSOR' &&
    typeof candidate.publishedAt === 'string' &&
    typeof candidate.noticeId === 'string' &&
    candidate.noticeId.trim().length > 0
  );
}
