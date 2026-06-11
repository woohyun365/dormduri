import { createHash } from 'node:crypto';
import type {
  RoommateSearchQuery,
  RoommateSearchScope,
  RoommateSearchSort,
} from '@repo/shared/roommate-search-contract';
import {
  signOpaqueHmacToken,
  verifyOpaqueHmacToken,
} from '../../platform/security/opaque-hmac-token.js';
import { stableStringify } from '../../platform/security/stable-json.js';
import {
  createProfileDetailEntryTokenCodec,
  type ProfileDetailEntryTokenPayload,
  type VerifiedProfileDetailEntryToken,
} from '../../profiles/contracts/profile-detail-entry-token.codec.js';
export {
  DEFAULT_PROFILE_DETAIL_ENTRY_TOKEN_HMAC_SECRET,
  PROFILE_DETAIL_ENTRY_TOKEN_HMAC_SECRET_ENV,
} from '../../profiles/contracts/profile-detail-entry-token.codec.js';
export type {
  ProfileDetailEntryTokenPayload,
  VerifiedProfileDetailEntryToken,
} from '../../profiles/contracts/profile-detail-entry-token.codec.js';

export const ROOMMATE_SEARCH_CURSOR_HMAC_SECRET_ENV = 'ROOMMATE_SEARCH_CURSOR_HMAC_SECRET';
export const DEFAULT_ROOMMATE_SEARCH_CURSOR_HMAC_SECRET = 'local-roommate-search-cursor-secret';

const ROOMMATE_SEARCH_CURSOR_TTL_MS = 10 * 60 * 1000;

export type RoommateSearchCursorPayload = {
  v: 1;
  purpose: 'ROOMMATE_SEARCH_CURSOR';
  viewerUserId: string;
  seasonId: string;
  scope: RoommateSearchScope;
  sort: RoommateSearchSort;
  queryDigest: string;
  after: RoommateSearchCursorBoundary;
  issuedAt: number;
  expiresAt: number;
};

export interface RoommateSearchCursorBoundary {
  nicknameSortKey: string;
  participantId: string;
  matchScore?: number;
}

export interface VerifiedRoommateSearchCursor {
  payload: RoommateSearchCursorPayload;
  boundary: RoommateSearchCursorBoundary;
}

export interface RoommateSearchTokenOwner {
  buildQueryDigest(input: {
    scope: RoommateSearchScope;
    sort: RoommateSearchSort;
    query: RoommateSearchQuery;
  }): string;
  signCursor(input: {
    viewerUserId: string;
    seasonId: string;
    scope: RoommateSearchScope;
    sort: RoommateSearchSort;
    queryDigest: string;
    after: RoommateSearchCursorBoundary;
    now: Date;
  }): string;
  verifyCursor(input: {
    token: string;
    viewerUserId: string;
    seasonId: string;
    scope: RoommateSearchScope;
    sort: RoommateSearchSort;
    queryDigest: string;
    now: Date;
  }): VerifiedRoommateSearchCursor;
  signDetailEntryToken(input: {
    viewerUserId: string;
    targetUserId: string;
    targetParticipantId: string;
    seasonId: string;
    issuedScope: RoommateSearchScope;
    issuedRelation: 'GENERAL' | 'MATCHED_PARTNER';
    issuedExposure: ProfileDetailEntryTokenPayload['issuedExposure'];
    now: Date;
  }): string;
  verifyDetailEntryToken(input: {
    token: string;
    viewerUserId: string;
    targetUserId: string;
    now: Date;
  }): VerifiedProfileDetailEntryToken | null;
}

export function createRoommateSearchTokenOwner(): RoommateSearchTokenOwner {
  const cursorSecret = readSecret(
    ROOMMATE_SEARCH_CURSOR_HMAC_SECRET_ENV,
    DEFAULT_ROOMMATE_SEARCH_CURSOR_HMAC_SECRET,
  );
  const detailEntryTokenCodec = createProfileDetailEntryTokenCodec();

  return {
    buildQueryDigest,
    signCursor(input) {
      const issuedAt = input.now.getTime();
      return signOpaqueHmacToken(
        {
          v: 1,
          purpose: 'ROOMMATE_SEARCH_CURSOR',
          viewerUserId: input.viewerUserId,
          seasonId: input.seasonId,
          scope: input.scope,
          sort: input.sort,
          queryDigest: input.queryDigest,
          after: input.after,
          issuedAt,
          expiresAt: issuedAt + ROOMMATE_SEARCH_CURSOR_TTL_MS,
        } satisfies RoommateSearchCursorPayload,
        cursorSecret,
      );
    },
    verifyCursor(input) {
      const payload = verifyOpaqueHmacToken(input.token, cursorSecret);
      if (!isRoommateSearchCursorPayload(payload)) {
        throw new Error('[roommate-search-token-owner] invalid cursor payload');
      }
      if (
        payload.viewerUserId !== input.viewerUserId ||
        payload.seasonId !== input.seasonId ||
        payload.scope !== input.scope ||
        payload.sort !== input.sort ||
        payload.queryDigest !== input.queryDigest ||
        payload.expiresAt < input.now.getTime()
      ) {
        throw new Error('[roommate-search-token-owner] cursor context mismatch');
      }

      return { payload, boundary: payload.after };
    },
    signDetailEntryToken(input) {
      return detailEntryTokenCodec.sign(input);
    },
    verifyDetailEntryToken(input) {
      return detailEntryTokenCodec.verify(input);
    },
  };
}

function buildQueryDigest(input: {
  scope: RoommateSearchScope;
  sort: RoommateSearchSort;
  query: RoommateSearchQuery;
}) {
  const filters: Partial<RoommateSearchQuery> = { ...input.query };
  delete filters.cursor;
  delete filters.limit;
  delete filters.scope;
  delete filters.sort;

  return createHash('sha256')
    .update(
      stableStringify({
        scope: input.scope,
        sort: input.sort,
        filters,
      }),
    )
    .digest('hex');
}

function readSecret(key: string, fallback: string) {
  return process.env[key]?.trim() || fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isRoommateSearchScope(value: unknown): value is RoommateSearchScope {
  return value === 'CAMPUS_MERGED' || value === 'SAME_BUILDING_ONLY';
}

function isRoommateSearchCursorPayload(value: unknown): value is RoommateSearchCursorPayload {
  if (!isRecord(value) || !isRecord(value.after)) {
    return false;
  }

  return (
    value.v === 1 &&
    value.purpose === 'ROOMMATE_SEARCH_CURSOR' &&
    typeof value.viewerUserId === 'string' &&
    typeof value.seasonId === 'string' &&
    isRoommateSearchScope(value.scope) &&
    isRoommateSearchSort(value.sort) &&
    typeof value.queryDigest === 'string' &&
    typeof value.after.nicknameSortKey === 'string' &&
    typeof value.after.participantId === 'string' &&
    (value.sort === 'NICKNAME' || typeof value.after.matchScore === 'number') &&
    typeof value.issuedAt === 'number' &&
    typeof value.expiresAt === 'number'
  );
}

function isRoommateSearchSort(value: unknown): value is RoommateSearchSort {
  return value === 'NICKNAME' || value === 'MATCH_SCORE';
}
