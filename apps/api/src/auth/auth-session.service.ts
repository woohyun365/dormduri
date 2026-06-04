import { Injectable, Optional } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Campus, Gender } from '../generated/prisma/enums.js';
import { PrismaService } from '../common/prisma/prisma.service.js';
import {
  AUTH_ACCESS_TOKEN_TTL_SECONDS,
  AUTH_SESSION_REMEMBER_ME_TTL_SECONDS,
  AUTH_SESSION_TTL_SECONDS,
} from './auth.constants.js';
import type {
  AuthSessionUserSummary,
  AuthSessionIssueResult,
  GenericSuccessResult,
  RenewSessionResult,
  SessionStatusResult,
} from './auth.types.js';
import { toAuthenticatedSessionResult } from './auth-response.builder.js';
import { toAuthSessionUserSummary } from './auth-user-view.js';
import { hasUserDisplayIdentity } from '../common/account-identity-invariant.owner.js';
import { authFailures } from './auth-failures.js';
import { SELF_SERVICE_AUTH_CAPABILITIES } from './auth-capability.js';
import type { AuthRequestContext } from './auth-request-context.js';
import {
  AuthSecurityEventService,
  recordAuthSecurityEventSafely,
} from './auth-security-event.service.js';
import { AUTH_SECURITY_EVENT_METRICS } from './auth-security-event.types.js';
import {
  createOpaqueToken,
  hashOpaqueToken,
  parseOpaqueToken,
  safeCompareTokenHash,
} from './domain/opaque-token.js';
import type { ResolvedAuthActorContext } from './application/auth-actor-context.types.js';
export type {
  AuthenticatedUserContext,
  ResolvedAuthActorContext,
} from './application/auth-actor-context.types.js';

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
export class AuthSessionService {
  constructor(
    private readonly prisma: PrismaService,
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

  async issueAuthResult(
    userId: string,
    _email: string,
    rememberMe: boolean,
  ): Promise<AuthSessionIssueResult> {
    const ttlSeconds = rememberMe ? AUTH_SESSION_REMEMBER_ME_TTL_SECONDS : AUTH_SESSION_TTL_SECONDS;
    const databaseNow = await this.prisma.getDatabaseNow();
    const sessionId = randomUUID();
    const accessToken = createOpaqueToken(sessionId);
    const sessionTokenExpiresAt = new Date(
      databaseNow.getTime() + AUTH_ACCESS_TOKEN_TTL_SECONDS * 1000,
    );
    const renewalToken = rememberMe ? createOpaqueToken(sessionId) : undefined;

    const session = await this.prisma.authSession.create({
      data: {
        id: sessionId,
        userId,
        rememberMe,
        sessionTokenHash: hashOpaqueToken(accessToken),
        sessionTokenExpiresAt,
        ...(renewalToken ? { refreshTokenHash: hashOpaqueToken(renewalToken) } : {}),
        expiresAt: new Date(databaseNow.getTime() + ttlSeconds * 1000),
      },
      select: { id: true },
    });

    return {
      accessToken,
      sessionId: session.id,
      ...(renewalToken ? { renewalToken } : {}),
    };
  }

  async renewSession(
    renewalToken: string | null,
    requestContext: AuthRequestContext = {},
  ): Promise<RenewSessionResult> {
    const parsedRenewalToken = parseOpaqueToken(renewalToken);
    if (!parsedRenewalToken) {
      await this.recordOpaqueTransportRejected('renewal', 'malformed_or_legacy', requestContext);
      return authFailures.sessionRenewalRequired();
    }

    const databaseNow = await this.prisma.getDatabaseNow();
    const nextAccessToken = createOpaqueToken(parsedRenewalToken.sessionId);
    const nextAccessTokenHash = hashOpaqueToken(nextAccessToken);
    const nextAccessTokenExpiresAt = new Date(
      databaseNow.getTime() + AUTH_ACCESS_TOKEN_TTL_SECONDS * 1000,
    );
    const nextRenewalToken = createOpaqueToken(parsedRenewalToken.sessionId);
    const nextRenewalTokenHash = hashOpaqueToken(nextRenewalToken);

    const renewalAttempt = await this.prisma.runSerializableTransaction(async (tx) => {
      const session = await tx.authSession.findUnique({
        where: { id: parsedRenewalToken.sessionId },
        select: {
          id: true,
          userId: true,
          rememberMe: true,
          refreshTokenHash: true,
          expiresAt: true,
          revokedAt: true,
          user: {
            select: {
              deletedAt: true,
              displayIdentity: {
                select: { userId: true },
              },
            },
          },
        },
      });

      if (
        !session ||
        !session.rememberMe ||
        !session.refreshTokenHash ||
        session.revokedAt ||
        session.expiresAt <= databaseNow ||
        session.user.deletedAt ||
        !session.user.displayIdentity
      ) {
        return null;
      }

      if (!safeCompareTokenHash(session.refreshTokenHash, parsedRenewalToken.tokenHash)) {
        await tx.authSession.updateMany({
          where: {
            id: session.id,
            revokedAt: null,
          },
          data: {
            revokedAt: databaseNow,
          },
        });
        return { kind: 'reused' as const };
      }

      const rotation = await tx.authSession.updateMany({
        where: {
          id: session.id,
          rememberMe: true,
          refreshTokenHash: parsedRenewalToken.tokenHash,
          revokedAt: null,
          expiresAt: {
            gt: databaseNow,
          },
        },
        data: {
          refreshTokenHash: nextRenewalTokenHash,
          sessionTokenHash: nextAccessTokenHash,
          sessionTokenExpiresAt: nextAccessTokenExpiresAt,
        },
      });

      if (rotation.count !== 1) {
        return null;
      }

      return {
        kind: 'renewed' as const,
      };
    });

    if (!renewalAttempt) {
      return authFailures.sessionRenewalRequired();
    }

    if (renewalAttempt.kind === 'reused') {
      await recordAuthSecurityEventSafely(this.securityEvents, {
        type: 'SESSION_TOKEN_REUSE_DETECTED',
        severity: 'WARNING',
        sessionId: parsedRenewalToken.sessionId,
        requestIp: requestContext.requestIp,
        userAgent: requestContext.userAgent,
        metadata: {
          metricName: AUTH_SECURITY_EVENT_METRICS.tokenReuse,
          tokenKind: 'renewal',
        },
      });
      return authFailures.sessionRenewalReused();
    }

    await recordAuthSecurityEventSafely(this.securityEvents, {
      type: 'SESSION_REFRESH_SUCCESS',
      severity: 'INFO',
      sessionId: parsedRenewalToken.sessionId,
      requestIp: requestContext.requestIp,
      userAgent: requestContext.userAgent,
      metadata: {
        rememberMe: true,
      },
    });

    return {
      success: true,
      accessToken: nextAccessToken,
      renewalToken: nextRenewalToken,
      rememberMe: true,
    };
  }

  async logout(
    token: string | null,
    renewalToken: string | null = null,
    requestContext: AuthRequestContext = {},
  ): Promise<GenericSuccessResult> {
    const sessionIds = new Set<string>();

    const parsedRenewalToken = parseOpaqueToken(renewalToken);
    if (parsedRenewalToken) {
      const session = await this.prisma.authSession.findUnique({
        where: { id: parsedRenewalToken.sessionId },
        select: { id: true, refreshTokenHash: true },
      });
      if (
        session?.refreshTokenHash &&
        safeCompareTokenHash(session.refreshTokenHash, parsedRenewalToken.tokenHash)
      ) {
        sessionIds.add(session.id);
      }
    }

    const parsedAccessToken = parseOpaqueToken(token);
    if (parsedAccessToken) {
      const session = await this.prisma.authSession.findUnique({
        where: { sessionTokenHash: parsedAccessToken.tokenHash },
        select: { id: true },
      });
      if (session) {
        sessionIds.add(session.id);
      }
    }

    if (sessionIds.size > 0) {
      const revokedAt = await this.prisma.getDatabaseNow();

      const revokeResult = await this.prisma.authSession.updateMany({
        where: {
          id: { in: [...sessionIds] },
          revokedAt: null,
        },
        data: {
          revokedAt,
        },
      });
      await recordAuthSecurityEventSafely(this.securityEvents, {
        type: 'SESSION_REVOKED',
        severity: 'INFO',
        sessionId: sessionIds.size === 1 ? [...sessionIds][0] : undefined,
        requestIp: requestContext.requestIp,
        userAgent: requestContext.userAgent,
        metadata: {
          reason: 'logout',
          revokedCount: revokeResult.count,
        },
      });
    }

    return { success: true };
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

    const session = await this.prisma.authSession.findUnique({
      where: { sessionTokenHash: parsedAccessToken.tokenHash },
      select: {
        id: true,
        userId: true,
        sessionTokenExpiresAt: true,
        expiresAt: true,
        revokedAt: true,
        user: {
          select: {
            id: true,
            email: true,
            gender: true,
            campus: true,
            deletedAt: true,
            displayIdentity: {
              select: {
                userId: true,
                nickname: true,
              },
            },
          },
        },
      },
    });

    const rejectedReason = this.resolveSessionRejectionReason(session);
    if (rejectedReason) {
      await this.recordOpaqueTransportRejected('access', rejectedReason, requestContext, {
        sessionId: parsedAccessToken.sessionId,
        targetUserId: session?.userId,
      });
      return null;
    }

    if (!session || !hasUserDisplayIdentity(session.user)) {
      return null;
    }

    return {
      userId: session.userId,
      sessionId: session.id,
      user: session.user,
    };
  }

  private resolveSessionRejectionReason(
    session: {
      userId: string;
      sessionTokenExpiresAt?: Date | null;
      expiresAt: Date;
      revokedAt: Date | null;
      user: {
        id: string;
        email: string;
        gender: Gender;
        campus: Campus;
        deletedAt: Date | null;
        displayIdentity: AuthenticatedSessionRef['user']['displayIdentity'] | null;
      };
    } | null,
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
    if (session.sessionTokenExpiresAt <= new Date()) {
      return 'access_expired';
    }
    if (session.expiresAt <= new Date()) {
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
