const KST = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

/** Times are shown in KST (the operators' time), the stored values are UTC ISO strings. */
export function formatKst(iso: string | null): string {
  return iso ? `${KST.format(new Date(iso))} KST` : '—';
}

export function shortId(id: string | null): string {
  return id ? id.slice(0, 8) : '—';
}
