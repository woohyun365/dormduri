import { HelpCircle } from 'lucide-react';
import type { SupportFaqItem } from '@repo/shared/support';
import { SUPPORT_CATEGORY_LABEL } from '../model/supportTicketDisplay.mapper';

export function SupportFaqList({ faqs }: { faqs: SupportFaqItem[] }) {
  if (faqs.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-(--knu-border) bg-white p-4">
        <p className="text-sm font-extrabold text-(--knu-text-primary)">FAQ를 준비 중이에요.</p>
        <p className="mt-1 text-xs leading-relaxed text-(--knu-text-secondary)">
          궁금한 점은 새 문의로 남겨주세요.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2" aria-label="자주 묻는 질문">
      {faqs.map((faq) => (
        <article key={faq.id} className="rounded-2xl border border-(--knu-border) bg-white p-4">
          <div className="flex items-start gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <HelpCircle className="size-4" aria-hidden="true" />
            </span>
            <div>
              <p className="text-[11px] font-bold text-(--knu-text-tertiary)">
                {SUPPORT_CATEGORY_LABEL[faq.category]}
              </p>
              <h3 className="mt-1 text-sm font-extrabold text-(--knu-text-primary)">
                {faq.question}
              </h3>
              <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-(--knu-text-secondary)">
                {faq.answer}
              </p>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
