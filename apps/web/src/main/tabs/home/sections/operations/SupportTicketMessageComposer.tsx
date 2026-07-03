export function SupportTicketMessageComposer({
  value,
  disabled,
  submitting,
  error,
  onChange,
}: {
  value: string;
  disabled: boolean;
  submitting: boolean;
  error: string | null;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <label
        htmlFor="home-support-message"
        className="text-xs font-bold text-(--knu-text-tertiary)"
      >
        추가 메시지
      </label>
      <textarea
        id="home-support-message"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={4}
        maxLength={4000}
        disabled={disabled || submitting}
        className="w-full resize-none rounded-2xl border border-(--knu-border) bg-white p-3 text-sm text-(--knu-text-primary) outline-none transition-colors placeholder:text-(--knu-text-tertiary) focus:border-(--knu-primary) disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
        placeholder="추가로 전달할 내용을 입력해주세요."
      />
      {error && (
        <p className="text-xs font-bold text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
