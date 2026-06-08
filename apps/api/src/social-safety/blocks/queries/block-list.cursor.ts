import { blockErrors } from '../errors/block.errors.js';

export interface BlockListCursorPayload {
  blockedAt: string;
  id: string;
}

export function encodeBlockListCursor(payload: BlockListCursorPayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

export function decodeBlockListCursor(
  cursor: string | null | undefined,
): BlockListCursorPayload | null {
  if (!cursor) {
    return null;
  }

  try {
    const decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as unknown;
    if (!isBlockListCursorPayload(decoded)) {
      throw blockErrors.invalidBlockQuery();
    }

    return decoded;
  } catch {
    throw blockErrors.invalidBlockQuery();
  }
}

function isBlockListCursorPayload(input: unknown): input is BlockListCursorPayload {
  if (typeof input !== 'object' || input === null) {
    return false;
  }

  const candidate = input as Record<string, unknown>;
  return typeof candidate.blockedAt === 'string' && typeof candidate.id === 'string';
}
