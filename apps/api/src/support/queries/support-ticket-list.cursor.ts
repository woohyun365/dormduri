interface SupportTicketCursorPayload {
  lastMessageAt: string;
  id: string;
}

export interface SupportTicketCursor {
  lastMessageAt: Date;
  id: string;
}

export function encodeSupportTicketCursor(input: SupportTicketCursor): string {
  const payload: SupportTicketCursorPayload = {
    lastMessageAt: input.lastMessageAt.toISOString(),
    id: input.id,
  };
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

export function decodeSupportTicketCursor(
  cursor: string | null | undefined,
): SupportTicketCursor | null {
  if (!cursor) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(cursor, 'base64url').toString('utf8'),
    ) as Partial<SupportTicketCursorPayload>;
    if (!parsed.id || !parsed.lastMessageAt) {
      return null;
    }
    const lastMessageAt = new Date(parsed.lastMessageAt);
    if (Number.isNaN(lastMessageAt.getTime())) {
      return null;
    }
    return { id: parsed.id, lastMessageAt };
  } catch {
    return null;
  }
}
