import { Quote } from 'lucide-react';
import type { RequestDirection } from '@repo/shared/match/contract';

const DIRECTION_STYLE = {
  RECEIVED: {
    copy: '상대가 보낸 요청 메시지',
  },
  SENT: {
    copy: '내가 보낸 요청 메시지',
  },
} as const;

export function PairRequestNotePanel({
  direction,
  note,
}: {
  readonly direction: RequestDirection;
  readonly note: string | null;
}) {
  const style = DIRECTION_STYLE[direction];
  const hasNote = Boolean(note?.trim());
  return (
    <section
      aria-label="요청 메시지"
      className="min-w-0 rounded-xl border border-slate-100 bg-(--knu-background-alt) px-3 py-2.5"
    >
      <p className="flex items-center gap-1.5 text-[10px] font-bold text-(--knu-text-tertiary)">
        <Quote className="h-3.5 w-3.5 shrink-0" aria-hidden />
        {style.copy}
      </p>
      {hasNote ? (
        <p className="mt-1 line-clamp-2 wrap-break-word text-xs leading-5 text-(--knu-text-secondary)">
          {note}
        </p>
      ) : (
        <p className="mt-1 text-xs leading-5 text-slate-500">보낸 요청 메시지가 없어요.</p>
      )}
    </section>
  );
}
