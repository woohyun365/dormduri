import type { GlobalNoticePreview } from '@repo/shared/notices';

export type HomeGlobalNoticePreview = Readonly<{
  id: string;
  title: string;
  summary: string;
  severity: GlobalNoticePreview['severity'];
  publishedAt: string;
  relatedSeasonId: string | null;
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
