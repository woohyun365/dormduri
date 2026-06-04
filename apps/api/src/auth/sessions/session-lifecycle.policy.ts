import { hasUserDisplayIdentity } from '../../common/account-identity-invariant.owner.js';
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
  if (!session.rememberMe) {
    return 'remember_me_disabled';
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

export function isRenewalTokenReuse(
  session: { refreshTokenHash: string },
  presentedTokenHash: string,
) {
  return !safeCompareTokenHash(session.refreshTokenHash, presentedTokenHash);
}
