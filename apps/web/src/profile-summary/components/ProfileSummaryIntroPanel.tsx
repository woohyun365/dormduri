import { MessageSquare } from 'lucide-react';

export function ProfileSummaryIntroPanel({ intro }: { readonly intro: string }) {
  const placeholder = intro === '-';

  return (
    <section
      aria-label="자기소개"
      className="rounded-xl border border-slate-100 bg-(--knu-background-alt) px-3 py-2.5"
    >
      <p className="flex items-center gap-1.5 text-[10px] font-bold text-(--knu-text-tertiary)">
        <MessageSquare className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        자기소개
      </p>
      <p
        className={`mt-1 line-clamp-2 wrap-break-word text-xs leading-5 ${
          placeholder ? 'text-slate-500' : 'text-(--knu-text-secondary)'
        }`}
      >
        {intro}
      </p>
    </section>
  );
}
