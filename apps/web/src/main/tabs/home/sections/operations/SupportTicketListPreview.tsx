import type { Route } from 'next';
import Link from 'next/link';
import { MessageCircleMore } from 'lucide-react';
import type { HomeSupportTicketPreview } from '../../model/operations/homeOperationsViewModel';

const SUPPORT_STATUS_LABEL: Record<HomeSupportTicketPreview['status'], string> = {
  OPEN: '접수',
  WAITING_USER: '추가 확인 필요',
  WAITING_OPERATOR: '운영자 확인 중',
  RESOLVED: '답변 완료',
  CLOSED: '종료',
};

export function SupportTicketListPreview({ tickets }: { tickets: HomeSupportTicketPreview[] }) {
  if (tickets.length === 0) {
    return (
      <div className="rounded-2xl border border-(--knu-border) bg-(--knu-background-alt) p-3">
        <p className="text-xs font-bold text-(--knu-text-primary)">진행 중인 문의가 없어요.</p>
        <p className="mt-1 text-[11px] text-(--knu-text-tertiary)">
          도움이 필요하면 문의하기에서 새 문의를 남길 수 있어요.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-(--knu-border) bg-white/80 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <MessageCircleMore className="size-4 text-(--knu-primary)" aria-hidden="true" />
          <p className="text-sm font-extrabold text-(--knu-text-primary)">문의 내역</p>
        </div>
        <Link
          href={'/support' as Route}
          className="text-[11px] font-extrabold text-(--knu-primary)"
        >
          전체 보기
        </Link>
      </div>
      <div className="space-y-2">
        {tickets.map((ticket) => (
          <Link
            key={ticket.id}
            href={`/support?ticketId=${encodeURIComponent(ticket.id)}` as Route}
            className="block w-full rounded-xl border border-(--knu-border) bg-(--knu-background-alt) px-3 py-2 text-left transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--knu-primary)"
          >
            <span className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate text-xs font-extrabold text-(--knu-text-primary)">
                {ticket.subject}
              </span>
              <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-(--knu-text-secondary)">
                {SUPPORT_STATUS_LABEL[ticket.status]}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
