import { Injectable, Optional } from '@nestjs/common';
import type { Campus, Gender } from '../../generated/prisma/enums.js';
import type { ApiSessionRejectionReason } from '@repo/shared/auth/session';
import { hasUserDisplayIdentity } from '../../identity/account-identity-invariant.js';
import type { AuthSessionUserSummary, SessionStatusResult } from '../domain/auth.types.js';
import { toAuthenticatedSessionResult } from '../mappers/auth-response.builder.js';
import { toAuthSessionUserSummary } from '../mappers/auth-user-view.js';
import type { AuthRequestContext } from '../domain/auth-request-context.js';
import { SELF_SERVICE_AUTH_CAPABILITIES } from '../access/auth-capability.js';
import type { ResolvedAuthActorContext } from '../application/auth-actor-context.types.js';
import {
  AuthSecurityEventService,
  recordAuthSecurityEventSafely,
} from '../security-events/auth-security-event.service.js';
import { parseOpaqueToken } from './opaque-token.js';
import { AuthSessionRepository } from './auth-session.repository.js';
import { resolveSessionRejectionReason } from './session-lifecycle.policy.js';

interface AuthenticatedSessionRef {
  userId: string;
  sessionId: string;
  user: {
    id: string;
    email: string;
    gender: Gender;
    campus: Campus;
    deletedAt: Date | null;
    displayIdentity: {
      userId: string;
      nickname: string;
    };
  };
}

type CurrentSessionResolution =
  | { authenticated: true; session: AuthenticatedSessionRef }
  | { authenticated: false; reason: ApiSessionRejectionReason };

const SESSION_REJECTION_REASON_MAP = {
  not_found: 'SESSION_NOT_FOUND',
  revoked: 'SESSION_REVOKED',
  missing_token_expiry: 'ACCESS_EXPIRED',
  access_expired: 'ACCESS_EXPIRED',
  session_expired: 'SESSION_EXPIRED',
  deleted_user: 'ACCOUNT_DELETED',
  account_identity_incomplete: 'ACCOUNT_IDENTITY_INCOMPLETE',
} as const satisfies Record<string, ApiSessionRejectionReason>;

@Injectable()
export class CurrentSessionQuery {
  constructor(
    private readonly repository: AuthSessionRepository,
    @Optional() private readonly securityEvents?: AuthSecurityEventService,
  ) {}

  async getSession(
    token: string | null,
    requestContext: AuthRequestContext = {},
  ): Promise<SessionStatusResult> {
    const resolution = await this.resolveAuthenticatedSession(token, requestContext);
    if (!resolution.authenticated) {
      return resolution;
    }

    return toAuthenticatedSessionResult(this.toSessionUserSummary(resolution.session));
  }

  async resolveCurrentUserContext(
    token: string | null,
    requestContext: AuthRequestContext = {},
  ): Promise<ResolvedAuthActorContext | null> {
    const resolution = await this.resolveAuthenticatedSession(token, requestContext);
    if (!resolution.authenticated) {
      return null;
    }
    const session = resolution.session;

    return {
      id: session.user.id,
      sessionId: session.sessionId,
      gender: session.user.gender,
      campus: session.user.campus,
      actorType: 'USER',
      actorId: session.user.id,
      capabilities: SELF_SERVICE_AUTH_CAPABILITIES,
    };
  }

  private toSessionUserSummary(session: AuthenticatedSessionRef): AuthSessionUserSummary {
    return toAuthSessionUserSummary({
      id: session.user.id,
      email: session.user.email,
      nickname: session.user.displayIdentity.nickname,
      gender: session.user.gender,
      campus: session.user.campus,
    });
  }

  private async resolveAuthenticatedSession(
    token: string | null,
    requestContext: AuthRequestContext = {},
  ): Promise<CurrentSessionResolution> {
    if (!token) {
      return { authenticated: false, reason: 'MISSING_TOKEN' };
    }

    const parsedAccessToken = parseOpaqueToken(token);
    if (!parsedAccessToken) {
      await this.recordOpaqueTransportRejected('access', 'malformed_or_legacy', requestContext);
      return { authenticated: false, reason: 'MALFORMED_TOKEN' };
    }

    const session = await this.repository.findAuthenticatedSessionByAccessTokenHash(
      parsedAccessToken.tokenHash,
    );

    const rejectedReason = resolveSessionRejectionReason(session);
    if (rejectedReason) {
      await this.recordOpaqueTransportRejected('access', rejectedReason, requestContext, {
        sessionId: parsedAccessToken.sessionId,
        targetUserId: session?.userId,
      });
      return {
        authenticated: false,
        reason: SESSION_REJECTION_REASON_MAP[rejectedReason],
      };
    }

    const displayIdentity = session?.user.displayIdentity;
    if (!session || !hasUserDisplayIdentity(session.user) || !displayIdentity) {
      return { authenticated: false, reason: 'ACCOUNT_IDENTITY_INCOMPLETE' };
    }

    return {
      authenticated: true,
      session: {
        userId: session.userId,
        sessionId: session.id,
        user: {
          ...session.user,
          displayIdentity,
        },
      },
    };
  }

  private async recordOpaqueTransportRejected(
    tokenKind: 'access' | 'renewal',
    reason: string,
    requestContext: AuthRequestContext,
    context: { sessionId?: string; targetUserId?: string } = {},
  ) {
    await recordAuthSecurityEventSafely(this.securityEvents, {
      type: 'OPAQUE_TRANSPORT_REJECTED',
      severity: 'WARNING',
      targetUserId: context.targetUserId,
      sessionId: context.sessionId,
      requestIp: requestContext.requestIp,
      userAgent: requestContext.userAgent,
      metadata: {
        tokenKind,
        reason,
      },
    });
  }
}
