import type { GlobalNotice, GlobalNoticePreview, NoticeSeverity } from '@repo/shared/notices';

export const NOTICE_SEVERITY_FILTERS: ReadonlyArray<{
  value: NoticeSeverity | 'ALL';
  label: string;
}> = [
  { value: 'ALL', label: '전체' },
  { value: 'INFO', label: '공지' },
  { value: 'WARNING', label: '확인 필요' },
  { value: 'CRITICAL', label: '중요' },
  { value: 'MAINTENANCE', label: '점검' },
];

const DATE_FORMATTER = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function formatNoticeDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return DATE_FORMATTER.format(date).replace(/\. /g, '.').replace(/\.$/, '');
}

export type NoticeListItemViewModel = Readonly<{
  id: string;
  title: string;
  summary: string;
  severity: NoticeSeverity;
  publishedAtLabel: string;
  expiredLabel: string | null;
}>;

export type NoticeArticleViewModel = NoticeListItemViewModel &
  Readonly<{
    body: string;
    updatedAtLabel: string;
  }>;

export function toNoticeListItemViewModel(notice: GlobalNoticePreview): NoticeListItemViewModel {
  return {
    id: notice.id,
    title: notice.title,
    summary: notice.summary,
    severity: notice.severity,
    publishedAtLabel: formatNoticeDate(notice.publishedAt),
    expiredLabel: notice.expiresAt ? `${formatNoticeDate(notice.expiresAt)}까지` : null,
  };
}

export function toNoticeArticleViewModel(notice: GlobalNotice): NoticeArticleViewModel {
  return {
    ...toNoticeListItemViewModel(notice),
    body: notice.body,
    updatedAtLabel: formatNoticeDate(notice.updatedAt),
  };
}
