import { hasUserDisplayIdentity } from '../../identity/account-identity-invariant.js';
import { safeCompareTokenHash } from './opaque-token.js';

export interface SessionUserIdentityProjection {
  deletedAt: Date | null;
  displayIdentity: object | null;
}

export interface AuthenticatedSessionPolicyProjection {
  sessionTokenExpiresAt?: Date | null;
  expiresAt: Date;
  revokedAt: Date | null;
  user: SessionUserIdentityProjection;
}

export interface RenewalSessionPolicyProjection {
  rememberMe: boolean;
  refreshTokenHash: string | null;
  previousRefreshTokenHash: string | null;
  previousRefreshTokenValidUntil: Date | null;
  expiresAt: Date;
  revokedAt: Date | null;
  user: SessionUserIdentityProjection;
}

export function resolveSessionRejectionReason(
  session: AuthenticatedSessionPolicyProjection | null,
  now: Date = new Date(),
) {
  if (!session) {
    return 'not_found';
  }
  if (session.revokedAt) {
    return 'revoked';
  }
  if (!session.sessionTokenExpiresAt) {
    return 'missing_token_expiry';
  }
  if (session.sessionTokenExpiresAt <= now) {
    return 'access_expired';
  }
  if (session.expiresAt <= now) {
    return 'session_expired';
  }
  if (session.user.deletedAt) {
    return 'deleted_user';
  }
  if (!hasUserDisplayIdentity(session.user)) {
    return 'account_identity_incomplete';
  }

  return null;
}

export function resolveRenewalRejectionReason(
  session: RenewalSessionPolicyProjection | null,
  now: Date,
) {
  if (!session) {
    return 'not_found';
  }
  if (!session.refreshTokenHash) {
    return 'missing_renewal_token';
  }
  if (session.revokedAt) {
    return 'revoked';
  }
  if (session.expiresAt <= now) {
    return 'session_expired';
  }
  if (session.user.deletedAt) {
    return 'deleted_user';
  }
  if (!hasUserDisplayIdentity(session.user)) {
    return 'account_identity_incomplete';
  }

  return null;
}

export type RenewalTokenClassification = 'current' | 'previous' | 'unknown';

export function classifyRenewalToken(
  session: Pick<
    RenewalSessionPolicyProjection,
    'refreshTokenHash' | 'previousRefreshTokenHash' | 'previousRefreshTokenValidUntil'
  >,
  presentedTokenHash: string,
  databaseNow: Date,
  previousTokenGraceEnabled: boolean,
): RenewalTokenClassification {
  if (
    session.refreshTokenHash &&
    safeCompareTokenHash(session.refreshTokenHash, presentedTokenHash)
  ) {
    return 'current';
  }

  if (
    previousTokenGraceEnabled &&
    session.previousRefreshTokenHash &&
    session.previousRefreshTokenValidUntil &&
    session.previousRefreshTokenValidUntil > databaseNow &&
    safeCompareTokenHash(session.previousRefreshTokenHash, presentedTokenHash)
  ) {
    return 'previous';
  }

  return 'unknown';
}
