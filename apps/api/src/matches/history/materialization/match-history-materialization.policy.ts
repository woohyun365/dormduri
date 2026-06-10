import { formatKstDate, subtractDays } from '../../../platform/time/kst-date.js';
import type { SeasonHistorySource } from './ended-season-history.loader.js';

export function toRequestEntryResult(
  status: SeasonHistorySource['matchRequests'][number]['status'],
  terminalReason: SeasonHistorySource['matchRequests'][number]['terminalReason'],
): 'REQUEST_REJECTED' | 'REQUEST_CANCELLED' | 'REQUEST_EXPIRED' {
  if (status === 'REJECTED' || terminalReason === 'REJECTED_BY_RECEIVER') {
    return 'REQUEST_REJECTED';
  }

  if (status === 'EXPIRED' || terminalReason === 'EXPIRED') {
    return 'REQUEST_EXPIRED';
  }

  return 'REQUEST_CANCELLED';
}

export function toSeasonEndBoundary(seasonEndDate: Date, now: Date) {
  const seasonEnd = formatKstDate(seasonEndDate);
  const boundary = new Date(`${subtractDays(seasonEnd, -1)}T00:00:00+09:00`);
  return boundary.getTime() <= now.getTime() ? boundary : now;
}
