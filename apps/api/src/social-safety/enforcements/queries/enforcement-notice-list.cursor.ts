interface EnforcementNoticeListCursorPayload {
  id: string;
  updatedAt: string;
}

export interface EnforcementNoticeListCursor {
  id: string;
  updatedAt: Date;
}

export function encodeEnforcementNoticeListCursor(input: EnforcementNoticeListCursor): string {
  const payload: EnforcementNoticeListCursorPayload = {
    id: input.id,
    updatedAt: input.updatedAt.toISOString(),
  };
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

export function decodeEnforcementNoticeListCursor(
  cursor: string | null | undefined,
): EnforcementNoticeListCursor | null {
  if (!cursor) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(cursor, 'base64url').toString('utf8'),
    ) as Partial<EnforcementNoticeListCursorPayload>;
    if (!payload.id || !payload.updatedAt) return null;
    const updatedAt = new Date(payload.updatedAt);
    if (Number.isNaN(updatedAt.getTime())) return null;
    return { id: payload.id, updatedAt };
  } catch {
    return null;
  }
}
