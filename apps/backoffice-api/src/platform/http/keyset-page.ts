import type { PageCursor } from '@repo/shared/backoffice';

/**
 * Keyset paging for the newest-first lists (`ORDER BY <time> DESC, id DESC`). Rows written in one
 * transaction share one time, so the cursor carries the id too: the next page is every row older
 * than the cursor time, or at that time with a smaller id.
 */
export function pageCursor(query: {
  readonly beforeTime?: string;
  readonly beforeId?: string;
}): { readonly time: Date; readonly id: string } | null {
  if (query.beforeTime === undefined || query.beforeId === undefined) {
    return null;
  }
  return { time: new Date(query.beforeTime), id: query.beforeId };
}

/** The cursor of the page after `rows`, or null when this page was the last one. */
export function nextPageAfter<Row extends { readonly id: string }>(
  rows: readonly Row[],
  limit: number,
  timeOf: (row: Row) => Date,
): PageCursor | null {
  const last = rows.at(-1);
  if (rows.length < limit || !last) {
    return null;
  }
  return { beforeTime: timeOf(last).toISOString(), beforeId: last.id };
}
