export function MatchStatusBadge({ label, terminal }: { label: string; terminal: boolean }) {
  return (
    <span
      className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
        terminal
          ? 'bg-(--knu-background-alt) text-(--knu-text-secondary)'
          : 'bg-(--knu-primary)/10 text-(--knu-primary)'
      }`}
    >
      {label}
    </span>
  );
}
