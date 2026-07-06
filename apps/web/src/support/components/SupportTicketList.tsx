import { MessageCircleMore } from 'lucide-react';
import type { SupportTicketListItemViewModel } from '../model/supportTicketDisplay.mapper';

export function SupportTicketList({
  tickets,
  selectedTicketId,
  onSelectTicket,
}: {
  tickets: SupportTicketListItemViewModel[];
  selectedTicketId: string | null;
  onSelectTicket: (ticketId: string) => void;
}) {
  if (tickets.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-(--knu-border) bg-white p-5 text-center shadow-sm">
        <MessageCircleMore
          className="mx-auto size-8 text-(--knu-text-tertiary)"
          aria-hidden="true"
        />
        <p className="mt-3 text-sm font-extrabold text-(--knu-text-primary)">
          아직 문의 내역이 없어요.
        </p>
        <p className="mt-1 text-xs leading-relaxed text-(--knu-text-secondary)">
          새 문의를 남기면 답변과 추가 요청을 이곳에서 이어갈 수 있어요.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2" aria-label="문의 내역">
      {tickets.map((ticket) => (
        <button
          key={ticket.id}
          type="button"
          onClick={() => onSelectTicket(ticket.id)}
          className={`w-full rounded-2xl border p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 ${
            selectedTicketId === ticket.id
              ? 'border-emerald-400 bg-emerald-50'
              : 'border-(--knu-border) bg-white hover:bg-emerald-50/50'
          }`}
        >
          <span className="flex items-center justify-between gap-3">
            <span className="min-w-0">
              <span className="block truncate text-sm font-extrabold text-(--knu-text-primary)">
                {ticket.subject}
              </span>
              <span className="mt-1 block text-[11px] font-bold text-(--knu-text-tertiary)">
                {ticket.categoryLabel} · {ticket.lastMessageAtLabel}
              </span>
            </span>
            <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-700">
              {ticket.statusLabel}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}
