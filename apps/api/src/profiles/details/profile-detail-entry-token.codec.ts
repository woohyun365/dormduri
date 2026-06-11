import type { RoommateSearchScope } from '@repo/shared/roommate-search-contract';
import {
  signOpaqueHmacToken,
  verifyOpaqueHmacToken,
} from '../../platform/security/opaque-hmac-token.js';

export const PROFILE_DETAIL_ENTRY_TOKEN_HMAC_SECRET_ENV = 'PROFILE_DETAIL_ENTRY_TOKEN_HMAC_SECRET';
export const DEFAULT_PROFILE_DETAIL_ENTRY_TOKEN_HMAC_SECRET = 'local-profile-detail-entry-secret';

const PROFILE_DETAIL_ENTRY_TOKEN_TTL_MS = 10 * 60 * 1000;

export type ProfileDetailEntryTokenPayload = {
  v: 1;
  purpose: 'PROFILE_DETAIL_ENTRY';
  context: 'ROOMMATE_SEARCH_SUMMARY';
  viewerUserId: string;
  targetUserId: string;
  targetParticipantId: string;
  seasonId: string;
  issuedScope: RoommateSearchScope;
  issuedRelation: 'GENERAL' | 'MATCHED_PARTNER';
  issuedExposure: {
    listSummaryVisible: true;
    canViewFull: boolean;
    detailViewable: boolean;
    scoreVisible: boolean;
  };
  issuedAt: number;
  expiresAt: number;
};

export interface VerifiedProfileDetailEntryToken {
  payload: ProfileDetailEntryTokenPayload;
}

export interface ProfileDetailEntryTokenCodec {
  sign(input: {
    viewerUserId: string;
    targetUserId: string;
    targetParticipantId: string;
    seasonId: string;
    issuedScope: RoommateSearchScope;
    issuedRelation: 'GENERAL' | 'MATCHED_PARTNER';
    issuedExposure: ProfileDetailEntryTokenPayload['issuedExposure'];
    now: Date;
  }): string;
  verify(input: {
    token: string;
    viewerUserId: string;
    targetUserId: string;
    now: Date;
  }): VerifiedProfileDetailEntryToken | null;
}

export function createProfileDetailEntryTokenCodec(): ProfileDetailEntryTokenCodec {
  const detailEntrySecret = readSecret(
    PROFILE_DETAIL_ENTRY_TOKEN_HMAC_SECRET_ENV,
    DEFAULT_PROFILE_DETAIL_ENTRY_TOKEN_HMAC_SECRET,
  );

  return {
    sign(input) {
      const issuedAt = input.now.getTime();
      return signOpaqueHmacToken(
        {
          v: 1,
          purpose: 'PROFILE_DETAIL_ENTRY',
          context: 'ROOMMATE_SEARCH_SUMMARY',
          viewerUserId: input.viewerUserId,
          targetUserId: input.targetUserId,
          targetParticipantId: input.targetParticipantId,
          seasonId: input.seasonId,
          issuedScope: input.issuedScope,
          issuedRelation: input.issuedRelation,
          issuedExposure: input.issuedExposure,
          issuedAt,
          expiresAt: issuedAt + PROFILE_DETAIL_ENTRY_TOKEN_TTL_MS,
        } satisfies ProfileDetailEntryTokenPayload,
        detailEntrySecret,
      );
    },
    verify(input) {
      try {
        const payload = verifyOpaqueHmacToken(input.token, detailEntrySecret);
        if (!isProfileDetailEntryTokenPayload(payload)) {
          return null;
        }
        if (
          payload.viewerUserId !== input.viewerUserId ||
          payload.targetUserId !== input.targetUserId ||
          payload.expiresAt < input.now.getTime()
        ) {
          return null;
        }

        return { payload };
      } catch {
        return null;
      }
    },
  };
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

function isProfileRelation(value: unknown): value is 'GENERAL' | 'MATCHED_PARTNER' {
  return value === 'GENERAL' || value === 'MATCHED_PARTNER';
}

function isIssuedExposure(
  value: unknown,
): value is ProfileDetailEntryTokenPayload['issuedExposure'] {
  return (
    isRecord(value) &&
    value.listSummaryVisible === true &&
    typeof value.canViewFull === 'boolean' &&
    typeof value.detailViewable === 'boolean' &&
    typeof value.scoreVisible === 'boolean'
  );
}

function isProfileDetailEntryTokenPayload(value: unknown): value is ProfileDetailEntryTokenPayload {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.v === 1 &&
    value.purpose === 'PROFILE_DETAIL_ENTRY' &&
    value.context === 'ROOMMATE_SEARCH_SUMMARY' &&
    typeof value.viewerUserId === 'string' &&
    typeof value.targetUserId === 'string' &&
    typeof value.targetParticipantId === 'string' &&
    typeof value.seasonId === 'string' &&
    isRoommateSearchScope(value.issuedScope) &&
    isProfileRelation(value.issuedRelation) &&
    isIssuedExposure(value.issuedExposure) &&
    typeof value.issuedAt === 'number' &&
    typeof value.expiresAt === 'number'
  );
}
