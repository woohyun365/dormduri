import type { FormEvent } from 'react';
import { Send } from 'lucide-react';

export function SupportTicketComposer({
  value,
  disabled,
  submitting,
  error,
  onChange,
  onSubmit,
}: {
  value: string;
  disabled: boolean;
  submitting: boolean;
  error: string | null;
  onChange: (value: string) => void;
  onSubmit: () => void;
}) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <label htmlFor="support-reply" className="text-xs font-bold text-(--knu-text-tertiary)">
        추가 메시지
      </label>
      <textarea
        id="support-reply"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={4}
        maxLength={4000}
        disabled={disabled || submitting}
        className="w-full resize-none rounded-2xl border border-(--knu-border) bg-white p-3 text-sm text-(--knu-text-primary) outline-none placeholder:text-(--knu-text-tertiary) focus:border-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
        placeholder="운영팀에 추가로 전달할 내용을 입력해주세요."
      />
      {error && (
        <p className="text-xs font-bold text-red-600" role="alert">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={disabled || submitting || !value.trim()}
        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-extrabold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
      >
        <Send className="size-4" aria-hidden="true" />
        메시지 보내기
      </button>
    </form>
  );
}
