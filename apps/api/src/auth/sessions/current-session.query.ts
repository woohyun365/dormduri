import { Injectable, Optional } from '@nestjs/common';
import type { Campus, Gender } from '../../generated/prisma/enums.js';
import { hasUserDisplayIdentity } from '../../common/account-identity-invariant.owner.js';
import type { AuthSessionUserSummary, SessionStatusResult } from '../auth.types.js';
import { toAuthenticatedSessionResult } from '../mappers/auth-response.builder.js';
import { toAuthSessionUserSummary } from '../mappers/auth-user-view.js';
import type { AuthRequestContext } from '../auth-request-context.js';
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
    const session = await this.resolveAuthenticatedSession(token, requestContext);
    if (!session) {
      return { authenticated: false };
    }

    return toAuthenticatedSessionResult(this.toSessionUserSummary(session));
  }

  async resolveCurrentUserContext(
    token: string | null,
    requestContext: AuthRequestContext = {},
  ): Promise<ResolvedAuthActorContext | null> {
    const session = await this.resolveAuthenticatedSession(token, requestContext);
    if (!session) {
      return null;
    }

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
  ): Promise<AuthenticatedSessionRef | null> {
    const parsedAccessToken = parseOpaqueToken(token);
    if (!parsedAccessToken) {
      if (token) {
        await this.recordOpaqueTransportRejected('access', 'malformed_or_legacy', requestContext);
      }
      return null;
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
      return null;
    }

    const displayIdentity = session?.user.displayIdentity;
    if (!session || !hasUserDisplayIdentity(session.user) || !displayIdentity) {
      return null;
    }

    return {
      userId: session.userId,
      sessionId: session.id,
      user: {
        ...session.user,
        displayIdentity,
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
