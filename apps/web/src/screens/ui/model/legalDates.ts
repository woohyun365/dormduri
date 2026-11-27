// Legal dates in the words readers use. The public reading contract writes a version's dates as
// `YYYY-MM-DD` (KST) and a document's effective and last-modified dates as that day's `T00:00:00.000Z`;
// both are read by their date part, so '2026-06-22' and '2026-06-22T00:00:00.000Z' are '2026년 6월 22일'.
// The Legal screens and the Landing revision line write dates with this one function.
export function formatLegalDate(value: string): string {
  const [year, month, day] = value.slice(0, 10).split('-');
  if (!year || !month || !day) return value.slice(0, 10);
  return `${year}년 ${Number(month)}월 ${Number(day)}일`;
}
