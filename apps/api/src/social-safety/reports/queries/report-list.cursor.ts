interface ReportListCursorPayload {
  receivedAt: string;
  id: string;
}

export interface ReportListCursor {
  receivedAt: Date;
  id: string;
}

export function encodeReportListCursor(input: ReportListCursor): string {
  const payload: ReportListCursorPayload = {
    receivedAt: input.receivedAt.toISOString(),
    id: input.id,
  };
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

export function decodeReportListCursor(cursor: string | null | undefined): ReportListCursor | null {
  if (!cursor) return null;

  try {
    const parsed = JSON.parse(
      Buffer.from(cursor, 'base64url').toString('utf8'),
    ) as Partial<ReportListCursorPayload>;
    if (!parsed.id || !parsed.receivedAt) return null;
    const receivedAt = new Date(parsed.receivedAt);
    if (Number.isNaN(receivedAt.getTime())) return null;
    return { id: parsed.id, receivedAt };
  } catch {
    return null;
  }
}
