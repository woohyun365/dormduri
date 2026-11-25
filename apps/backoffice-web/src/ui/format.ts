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

// KST times by where they show (design guide ⑦). Lists show minutes (`2026-11-24 09:58`); the audit table shows seconds
// (`2026-11-24 09:58:12`) because rows of one minute are read in order. The column header `(KST)` or a trailing word says
// KST. Details use seconds with the KST suffix (`2026-11-24 09:58:12 KST`), so a list row and its detail read alike.
const PARTS = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

function kstParts(iso: string): Record<string, string> {
  return Object.fromEntries(
    PARTS.formatToParts(new Date(iso)).map((part) => [part.type, part.value]),
  );
}

export function formatKstShort(iso: string | null): string {
  if (!iso) return '—';
  const parts = kstParts(iso);
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

export function formatKstSeconds(iso: string | null): string {
  if (!iso) return '—';
  const parts = kstParts(iso);
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

export function formatKstDetail(iso: string | null): string {
  return iso ? `${formatKstSeconds(iso)} KST` : '—';
}

export function shortId(id: string | null): string {
  return id ? id.slice(0, 8) : '—';
}
