import { FileWarning, MessageCircleMore } from 'lucide-react';
import type { ReportListItem } from '@repo/shared/social-safety/report';
import { getReportReasonLabel } from '@/social-safety/model/reportPresentation';

export type SupportReportListItemView = ReportListItem & {
  linkedTicketId: string | null;
};

export function SupportReportList({
  reports,
  onCreateAppeal,
  onSelectTicket,
}: {
  reports: readonly SupportReportListItemView[];
  onCreateAppeal: (report: ReportListItem) => void;
  onSelectTicket: (ticketId: string) => void;
}) {
  return (
    <section className="rounded-3xl border border-(--knu-border) bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
          <FileWarning className="size-4" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-base font-black text-(--knu-text-primary)">내 신고 내역</h2>
          <p className="mt-1 text-xs leading-relaxed text-(--knu-text-secondary)">
            접수한 신고와 연결된 운영팀 대화를 확인할 수 있어요.
          </p>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {reports.length === 0 ? (
          <p className="rounded-2xl bg-(--knu-background-alt) p-3 text-sm font-bold text-(--knu-text-secondary)">
            접수한 신고 내역이 없어요.
          </p>
        ) : (
          reports.map((report) => {
            const linkedTicketId = report.linkedTicketId;
            return (
              <article
                key={report.id}
                className="rounded-2xl border border-amber-100 bg-amber-50/40 p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-extrabold text-(--knu-text-primary)">
                      {report.targetLabel}
                    </p>
                    <p className="mt-1 text-xs font-bold text-amber-700">
                      {getReportReasonLabel(report.reason)} · 접수 완료
                    </p>
                  </div>
                  <time
                    dateTime={report.receivedAt}
                    className="shrink-0 text-[11px] font-bold text-(--knu-text-tertiary)"
                  >
                    {formatShortDate(report.receivedAt)}
                  </time>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-(--knu-text-secondary)">
                  검토가 완료되면 알림으로 안내드려요.
                </p>
                {linkedTicketId ? (
                  <button
                    type="button"
                    onClick={() => onSelectTicket(linkedTicketId)}
                    className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs font-extrabold text-indigo-700 transition-colors hover:bg-indigo-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
                  >
                    <MessageCircleMore className="size-4" aria-hidden="true" />
                    운영자 대화 보기
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onCreateAppeal(report)}
                    className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-600 px-3 py-2 text-xs font-extrabold text-white transition-colors hover:bg-amber-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
                  >
                    신고 처리 이의 신청
                  </button>
                )}
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}

function formatShortDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'short',
    day: 'numeric',
  }).format(date);
}
