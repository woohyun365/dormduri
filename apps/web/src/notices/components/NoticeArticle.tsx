import { FileText, Megaphone } from 'lucide-react';
import type { NoticeArticleViewModel } from '../model/noticePageViewModel';
import { NoticeSeverityChip } from './NoticeSeverityChip';

export function NoticeArticle({ notice }: { notice: NoticeArticleViewModel | null }) {
  if (!notice) {
    return (
      <article className="rounded-3xl border border-(--knu-border) bg-white p-6 shadow-sm md:p-8">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
            <FileText className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-lg font-extrabold text-(--knu-text-primary)">공지 상세</h2>
            <p className="mt-2 text-sm leading-relaxed text-(--knu-text-secondary)">
              왼쪽 목록에서 공지사항을 선택하면 상세 내용을 확인할 수 있어요.
            </p>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="rounded-3xl border border-(--knu-border) bg-white p-6 shadow-sm md:p-8">
      <div className="flex flex-wrap items-center gap-2">
        <NoticeSeverityChip severity={notice.severity} />
        <span className="text-xs font-bold text-(--knu-text-tertiary)">
          게시 {notice.publishedAtLabel} · 수정 {notice.updatedAtLabel}
        </span>
      </div>
      <div className="mt-5 flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
          <Megaphone className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 className="text-2xl font-black leading-tight tracking-tight text-(--knu-text-primary)">
            {notice.title}
          </h2>
          <p className="mt-2 text-sm font-bold leading-relaxed text-(--knu-text-secondary)">
            {notice.summary}
          </p>
        </div>
      </div>
      <div className="mt-6 whitespace-pre-line rounded-2xl border border-(--knu-border) bg-(--knu-background-alt) p-4 text-sm leading-7 text-(--knu-text-primary)">
        {notice.body}
      </div>
    </article>
  );
}
