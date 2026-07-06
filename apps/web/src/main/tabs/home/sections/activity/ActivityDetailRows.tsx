export function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-(--knu-border) px-4 py-3">
      <span className="text-sm font-semibold text-(--knu-text-secondary)">{label}</span>
      <span className="text-sm font-bold text-(--knu-text-primary)">{value}</span>
    </div>
  );
}

export function DetailMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-(--knu-background-alt) p-3 text-center">
      <p className="text-lg font-extrabold text-(--knu-primary)">{value}</p>
      <p className="text-xs text-(--knu-text-tertiary)">{label}</p>
    </div>
  );
}

export function EmptyDetailCard({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-5 text-center text-sm text-(--knu-text-secondary)">
      {message}
    </div>
  );
}

export function formatProfileValue(value: string | null | undefined): string {
  if (!value) return '미입력';
  const labels: Record<string, string> = {
    NO: '비흡연',
    YES: '흡연',
    NONE: '해당 없음',
    CLOSE: '가까운 교류',
    RESPECTFUL: '적당한 거리',
    QUIET: '조용한 편',
    LATE: '늦은 편',
    EARLY: '이른 편',
  };
  return labels[value] ?? value.replaceAll('_', ' ').toLowerCase();
}
