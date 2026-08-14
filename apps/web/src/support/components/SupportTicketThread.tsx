import { LifeBuoy } from 'lucide-react';
import type { SupportTicketDetailResponse } from '@repo/shared/support';
import {
  SUPPORT_CATEGORY_LABEL,
  SUPPORT_SENDER_LABEL,
  SUPPORT_STATUS_LABEL,
  canAppendSupportMessage,
  formatSupportDate,
} from '../model/supportTicketDisplay.mapper';
import { SupportTicketComposer } from './SupportTicketComposer';

export function SupportTicketThread({
  detail,
  loading,
  message,
  submitting,
  messageError,
  onMessageChange,
  onSubmitMessage,
}: {
  detail: SupportTicketDetailResponse | null;
  loading: boolean;
  message: string;
  submitting: boolean;
  messageError: string | null;
  onMessageChange: (value: string) => void;
  onSubmitMessage: () => void;
}) {
  if (loading) {
    return (
      <section
        className="rounded-3xl border border-(--knu-border) bg-white p-5 shadow-sm"
        aria-label="문의 상세 로딩 중"
      >
        <div className="space-y-3">
          {[0, 1, 2].map((index) => (
            <div key={index} className="h-16 animate-pulse rounded-2xl bg-(--knu-background-alt)" />
          ))}
        </div>
      </section>
    );
  }

  if (!detail) {
    return (
      <section className="rounded-3xl border border-(--knu-border) bg-white p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
            <LifeBuoy className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-lg font-extrabold text-(--knu-text-primary)">문의 상세</h2>
            <p className="mt-2 text-sm leading-relaxed text-(--knu-text-secondary)">
              문의 내역을 선택하면 답변과 추가 메시지를 확인할 수 있어요.
            </p>
          </div>
        </div>
      </section>
    );
  }

  const canAppend = canAppendSupportMessage(detail.ticket.status);

  return (
    <section className="rounded-3xl border border-(--knu-border) bg-white p-5 shadow-sm md:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-extrabold text-emerald-700">
          {SUPPORT_STATUS_LABEL[detail.ticket.status]}
        </span>
        <span className="text-[11px] font-bold text-(--knu-text-tertiary)">
          {SUPPORT_CATEGORY_LABEL[detail.ticket.category]} ·{' '}
          {formatSupportDate(detail.ticket.lastMessageAt)}
        </span>
      </div>
      <h2 className="mt-3 text-xl font-black text-(--knu-text-primary)">{detail.ticket.subject}</h2>

      <div className="mt-5 space-y-3" role="region" aria-label="문의 메시지">
        {detail.messages.map((item) => (
          <article
            key={item.id}
            className={`rounded-2xl border p-3 ${
              item.senderType === 'USER'
                ? 'border-emerald-100 bg-emerald-50/70'
                : 'border-(--knu-border) bg-(--knu-background-alt)'
            }`}
          >
            <p className="text-[11px] font-bold text-(--knu-text-tertiary)">
              {SUPPORT_SENDER_LABEL[item.senderType]} · {formatSupportDate(item.createdAt)}
            </p>
            <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-(--knu-text-primary)">
              {item.body}
            </p>
          </article>
        ))}
      </div>

      <div className="mt-5">
        {canAppend ? (
          <SupportTicketComposer
            value={message}
            disabled={false}
            submitting={submitting}
            error={messageError}
            onChange={onMessageChange}
            onSubmit={onSubmitMessage}
          />
        ) : (
          <p className="rounded-2xl bg-(--knu-background-alt) p-3 text-xs font-bold text-(--knu-text-secondary)">
            종료된 문의는 읽기 전용이에요. 추가 문의가 필요하면 새 문의를 남겨주세요.
          </p>
        )}
      </div>
    </section>
  );
}
