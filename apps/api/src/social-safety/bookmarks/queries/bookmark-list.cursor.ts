import type { BookmarkSort } from '@repo/shared/social-safety/bookmark';
import { bookmarkErrors } from '../errors/bookmark.errors.js';

export interface RecentBookmarkCursorPayload {
  sort: 'RECENT';
  bookmarkedAt: string;
  id: string;
}

export interface MatchScoreBookmarkCursorPayload {
  sort: 'MATCH_SCORE';
  matchScore: number | null;
  bookmarkedAt: string;
  id: string;
}

export type BookmarkListCursorPayload =
  RecentBookmarkCursorPayload | MatchScoreBookmarkCursorPayload;

export function encodeBookmarkListCursor(payload: BookmarkListCursorPayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

export function decodeBookmarkListCursor(
  cursor: string | null | undefined,
  expectedSort: BookmarkSort,
): BookmarkListCursorPayload | null {
  if (!cursor) {
    return null;
  }

  try {
    const decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as unknown;
    if (!isBookmarkListCursorPayload(decoded) || decoded.sort !== expectedSort) {
      throw bookmarkErrors.invalidBookmarkQuery();
    }

    return decoded;
  } catch (error) {
    if (error === bookmarkErrors.invalidBookmarkQuery()) {
      throw error;
    }
    throw bookmarkErrors.invalidBookmarkQuery();
  }
}

function isBookmarkListCursorPayload(input: unknown): input is BookmarkListCursorPayload {
  if (typeof input !== 'object' || input === null) {
    return false;
  }

  const candidate = input as Record<string, unknown>;
  if (candidate.sort !== 'RECENT' && candidate.sort !== 'MATCH_SCORE') {
    return false;
  }
  if (typeof candidate.bookmarkedAt !== 'string' || typeof candidate.id !== 'string') {
    return false;
  }
  if (candidate.sort === 'MATCH_SCORE') {
    return typeof candidate.matchScore === 'number' || candidate.matchScore === null;
  }

  return !('matchScore' in candidate);
}
