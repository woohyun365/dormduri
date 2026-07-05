import { Megaphone } from 'lucide-react';
import type { NoticeListItemViewModel } from '../model/noticePageViewModel';
import { NoticeSeverityChip } from './NoticeSeverityChip';

export function NoticeList({
  notices,
  selectedNoticeId,
  onSelectNotice,
}: {
  notices: NoticeListItemViewModel[];
  selectedNoticeId: string | null;
  onSelectNotice: (noticeId: string) => void;
}) {
  if (notices.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-(--knu-border) bg-white p-6 text-center shadow-sm">
        <Megaphone className="mx-auto size-8 text-(--knu-text-tertiary)" aria-hidden="true" />
        <p className="mt-3 text-sm font-extrabold text-(--knu-text-primary)">
          현재 공개된 공지사항이 없어요.
        </p>
        <p className="mt-1 text-xs leading-relaxed text-(--knu-text-secondary)">
          운영 안내가 등록되면 이곳에서 확인할 수 있어요.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3" aria-label="공지사항 목록">
      {notices.map((notice) => {
        const selected = selectedNoticeId === notice.id;
        return (
          <button
            key={notice.id}
            type="button"
            onClick={() => onSelectNotice(notice.id)}
            className={`w-full rounded-3xl border p-4 text-left shadow-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--knu-primary) ${
              selected
                ? 'border-(--knu-primary) bg-blue-50/80'
                : 'border-(--knu-border) bg-white hover:border-blue-200 hover:bg-blue-50/40'
            }`}
          >
            <span className="flex items-start justify-between gap-3">
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <NoticeSeverityChip severity={notice.severity} />
                  <span className="text-[11px] font-bold text-(--knu-text-tertiary)">
                    {notice.publishedAtLabel}
                  </span>
                </span>
                <span className="mt-2 block text-sm font-extrabold leading-snug text-(--knu-text-primary)">
                  {notice.title}
                </span>
                <span className="mt-1 block text-xs leading-relaxed text-(--knu-text-secondary)">
                  {notice.summary}
                </span>
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
